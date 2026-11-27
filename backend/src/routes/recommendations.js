import { Router } from 'express';
import { computeWorkspaceInsights } from '../engine/pipeline.js';

export function createRecommendationsRouter(db) {
  const router = Router();

  router.get('/', (_req, res) => {
    const insights = computeWorkspaceInsights(db);
    res.json({
      recommendations: insights.recommendations,
      conflicts: insights.conflicts,
      profile: insights.profile
    });
  });

  router.post('/:taskId/apply', (req, res) => {
    const rawId = req.params.taskId;
    if (!/^\d+$/.test(String(rawId))) {
      return res.status(400).json({ error: { code: 'INVALID_ID', message: 'Invalid task ID.' } });
    }
    const taskId = Number.parseInt(rawId, 10);
    const action = req.body?.action === 'complete' ? 'complete' : 'start';

    const existing = db.getTaskById(taskId);
    if (!existing) {
      return res.status(404).json({ error: { code: 'TASK_NOT_FOUND', message: 'Recommended task not found.' } });
    }

    const nextStatus = action === 'complete' ? 'completed' : 'in_progress';
    const updated = db.updateTask(taskId, { status: nextStatus });

    db.logActivity(
      'recommendation_applied',
      `Applied recommendation (${action}) on "${updated.title}".`,
      { taskId: updated.id, action }
    );

    return res.json({ task: updated, action });
  });

  return router;
}
