import { Router } from 'express';
import { suggestNextActionForTitle } from '../engine/pipeline.js';
import { sanitizeText } from '../middleware/security.js';

const VALID_PRIORITIES = new Set(['urgent', 'high', 'medium', 'low']);
const VALID_CATEGORIES = new Set(['Work', 'Personal', 'Health', 'Learning', 'Finance', 'Errands']);
const VALID_STATUSES = new Set(['pending', 'in_progress', 'completed']);

function parseTaskId(rawId) {
  if (!/^\d+$/.test(String(rawId))) return null;
  const id = Number.parseInt(rawId, 10);
  return id > 0 ? id : null;
}

function validateTaskPayload(body, isUpdate = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Request body must be a JSON object.' };
  }

  const clean = {};

  if (!isUpdate || body.title !== undefined) {
    const title = sanitizeText(body.title, 160);
    if (!title || title.length < 2) {
      return { error: 'Task title is required and must be at least 2 characters.' };
    }
    clean.title = title;
  }

  if (body.description !== undefined) {
    if (typeof body.description !== 'string') {
      return { error: 'Description must be a string.' };
    }
    clean.description = sanitizeText(body.description, 1000);
  }

  if (body.priority !== undefined) {
    if (!VALID_PRIORITIES.has(body.priority)) {
      return { error: 'Priority must be one of: urgent, high, medium, low.' };
    }
    clean.priority = body.priority;
  }

  if (body.category !== undefined) {
    if (!VALID_CATEGORIES.has(body.category)) {
      return { error: 'Category must be one of: Work, Personal, Health, Learning, Finance, Errands.' };
    }
    clean.category = body.category;
  }

  if (body.status !== undefined) {
    if (!VALID_STATUSES.has(body.status)) {
      return { error: 'Status must be one of: pending, in_progress, completed.' };
    }
    clean.status = body.status;
  }

  if (body.due_date !== undefined) {
    if (body.due_date === null || body.due_date === '') {
      clean.due_date = null;
    } else {
      const dueStr = sanitizeText(String(body.due_date), 40);
      const parsed = new Date(dueStr);
      if (Number.isNaN(parsed.getTime())) {
        return { error: 'Invalid due_date format.' };
      }
      clean.due_date = dueStr;
    }
  }

  if (body.estimated_minutes !== undefined) {
    const mins = Number(body.estimated_minutes);
    if (!Number.isInteger(mins) || mins < 5 || mins > 480) {
      return { error: 'estimated_minutes must be an integer between 5 and 480.' };
    }
    clean.estimated_minutes = mins;
  }

  if (body.next_action !== undefined) {
    if (typeof body.next_action !== 'string') {
      return { error: 'next_action must be a string.' };
    }
    clean.next_action = sanitizeText(body.next_action, 300);
  }

  if (isUpdate && Object.keys(clean).length === 0) {
    return { error: 'No valid update fields were provided.' };
  }

  return { data: clean };
}

export function createTasksRouter(db) {
  const router = Router();

  router.get('/', (req, res) => {
    const status = req.query.status ? String(req.query.status) : 'all';
    const category = req.query.category ? String(req.query.category) : 'all';
    const priority = req.query.priority ? String(req.query.priority) : 'all';

    const tasks = db.listTasks({ status, category, priority });
    res.json({ tasks });
  });

  router.post('/', (req, res) => {
    const { data, error } = validateTaskPayload(req.body, false);
    if (error) {
      return res.status(400).json({ error: { code: 'INVALID_TASK', message: error } });
    }

    if (!data.next_action) {
      data.next_action = suggestNextActionForTitle(data.title, data.category || 'Work');
    }

    const created = db.createTask(data);
    db.logActivity('task_created', `Created task "${created.title}" (${created.priority}).`, {
      taskId: created.id
    });

    return res.status(201).json({ task: created });
  });

  router.patch('/:id', (req, res) => {
    const id = parseTaskId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: { code: 'INVALID_ID', message: 'Task ID must be a positive integer.' } });
    }

    const { data, error } = validateTaskPayload(req.body, true);
    if (error) {
      return res.status(400).json({ error: { code: 'INVALID_TASK', message: error } });
    }

    const existing = db.getTaskById(id);
    if (!existing) {
      return res.status(404).json({ error: { code: 'TASK_NOT_FOUND', message: 'Task not found.' } });
    }

    const updated = db.updateTask(id, data);
    const activityType = updated.status === 'completed' && existing.status !== 'completed'
      ? 'task_completed'
      : 'task_updated';
    db.logActivity(activityType, `${activityType === 'task_completed' ? 'Completed' : 'Updated'} task "${updated.title}".`, {
      taskId: updated.id
    });

    return res.json({ task: updated });
  });

  router.delete('/:id', (req, res) => {
    const id = parseTaskId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: { code: 'INVALID_ID', message: 'Task ID must be a positive integer.' } });
    }

    const existing = db.getTaskById(id);
    if (!existing) {
      return res.status(404).json({ error: { code: 'TASK_NOT_FOUND', message: 'Task not found.' } });
    }

    db.deleteTask(id);
    db.logActivity('task_deleted', `Deleted task "${existing.title}".`, { taskId: id });
    return res.json({ deleted: true, id });
  });

  return router;
}
