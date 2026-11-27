import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const DEFAULT_CONTEXT = {
  displayName: 'User',
  focusMode: 'balanced',
  energyLevel: 'medium',
  availableMinutes: '120',
  preferredCategories: JSON.stringify(['Work', 'Learning'])
};

export function createDatabase(dbPath, options = {}) {
  const { seed = true } = options;

  if (dbPath !== ':memory:') {
    mkdirSync(dirname(dbPath), { recursive: true });
  }

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      priority TEXT NOT NULL DEFAULT 'medium',
      category TEXT NOT NULL DEFAULT 'Work',
      status TEXT NOT NULL DEFAULT 'pending',
      due_date TEXT,
      estimated_minutes INTEGER NOT NULL DEFAULT 30,
      next_action TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL DEFAULT 'default',
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      mode TEXT,
      intent TEXT,
      decision_json TEXT,
      redacted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_context (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      summary TEXT NOT NULL,
      metadata_json TEXT,
      created_at TEXT NOT NULL
    );
  `);

  const now = new Date().toISOString();
  const insertContext = db.prepare(
    'INSERT OR IGNORE INTO user_context (key, value, updated_at) VALUES (?, ?, ?)'
  );
  for (const [key, value] of Object.entries(DEFAULT_CONTEXT)) {
    insertContext.run(key, value, now);
  }

  if (seed) {
    seedInitialDataIfEmpty(db);
  }

  return createDbRepository(db);
}

function seedInitialDataIfEmpty(db) {
  const countRow = db.prepare('SELECT COUNT(*) AS count FROM tasks').get();
  if (countRow && countRow.count > 0) return;

  const now = new Date();
  const todayIso = new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString().slice(0, 16);
  const tomorrowIso = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
  const nextWeekIso = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
  const nowStr = now.toISOString();

  const insertTask = db.prepare(`
    INSERT INTO tasks (title, description, priority, category, status, due_date, estimated_minutes, next_action, created_at, updated_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertTask.run(
    'Finalize Q4 Product Roadmap Review',
    'Align engineering milestones with customer feedback ahead of leadership sync.',
    'urgent',
    'Work',
    'pending',
    todayIso,
    45,
    'Draft top 3 milestone trade-offs in a 1-page summary.',
    nowStr,
    nowStr,
    null
  );

  insertTask.run(
    'Prepare Architecture Security Checklist',
    'Verify API rate limits, env templates, and input sanitization rules.',
    'high',
    'Work',
    'in_progress',
    tomorrowIso,
    60,
    'Audit backend route validation and test edge cases.',
    nowStr,
    nowStr,
    null
  );

  insertTask.run(
    '30-Minute Evening Mobility & Cardio',
    'Maintain consistent energy levels during intense sprint week.',
    'medium',
    'Health',
    'pending',
    tomorrowIso,
    30,
    'Block 6:00 PM on calendar and lay out workout gear.',
    nowStr,
    nowStr,
    null
  );

  insertTask.run(
    'Review Monthly Cloud Spending Report',
    'Confirm test sandbox instances are shut down to avoid idle charges.',
    'low',
    'Finance',
    'completed',
    nextWeekIso,
    20,
    'Archive billing receipt.',
    nowStr,
    nowStr,
    nowStr
  );

  db.prepare(`
    INSERT INTO activity_logs (type, summary, metadata_json, created_at)
    VALUES (?, ?, ?, ?)
  `).run(
    'system_initialized',
    'Initialized workspace with sample context-aware tasks.',
    JSON.stringify({ seededCount: 4 }),
    nowStr
  );
}

function createDbRepository(db) {
  return {
    raw: db,

    close() {
      db.close();
    },

    listTasks({ status, category, priority } = {}) {
      const clauses = [];
      const params = [];
      if (status && status !== 'all') {
        clauses.push('status = ?');
        params.push(status);
      }
      if (category && category !== 'all') {
        clauses.push('category = ?');
        params.push(category);
      }
      if (priority && priority !== 'all') {
        clauses.push('priority = ?');
        params.push(priority);
      }
      const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
      return db
        .prepare(
          `SELECT * FROM tasks ${where}
           ORDER BY
             CASE status WHEN 'in_progress' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
             CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
             COALESCE(due_date, '9999-12-31') ASC,
             id DESC`
        )
        .all(...params);
    },

    getTaskById(id) {
      return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) || null;
    },

    createTask(input) {
      const now = new Date().toISOString();
      const status = input.status || 'pending';
      const completedAt = status === 'completed' ? now : null;
      const result = db
        .prepare(
          `INSERT INTO tasks (title, description, priority, category, status, due_date, estimated_minutes, next_action, created_at, updated_at, completed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          input.title,
          input.description || '',
          input.priority || 'medium',
          input.category || 'Work',
          status,
          input.due_date || null,
          input.estimated_minutes ?? 30,
          input.next_action || '',
          now,
          now,
          completedAt
        );
      return this.getTaskById(Number(result.lastInsertRowid));
    },

    updateTask(id, updates) {
      const existing = this.getTaskById(id);
      if (!existing) return null;

      const now = new Date().toISOString();
      const nextStatus = updates.status ?? existing.status;
      let completedAt = existing.completed_at;
      if (nextStatus === 'completed' && existing.status !== 'completed') {
        completedAt = now;
      } else if (nextStatus !== 'completed') {
        completedAt = null;
      }

      db.prepare(
        `UPDATE tasks
         SET title = ?, description = ?, priority = ?, category = ?, status = ?, due_date = ?, estimated_minutes = ?, next_action = ?, updated_at = ?, completed_at = ?
         WHERE id = ?`
      ).run(
        updates.title ?? existing.title,
        updates.description ?? existing.description,
        updates.priority ?? existing.priority,
        updates.category ?? existing.category,
        nextStatus,
        updates.due_date !== undefined ? updates.due_date : existing.due_date,
        updates.estimated_minutes ?? existing.estimated_minutes,
        updates.next_action ?? existing.next_action,
        now,
        completedAt,
        id
      );

      return this.getTaskById(id);
    },

    deleteTask(id) {
      const existing = this.getTaskById(id);
      if (!existing) return false;
      db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
      return true;
    },

    listMessages(sessionId = 'default', limit = 50) {
      const rows = db
        .prepare(
          `SELECT * FROM messages WHERE session_id = ? ORDER BY id DESC LIMIT ?`
        )
        .all(sessionId, limit);
      return rows.reverse().map((row) => ({
        ...row,
        redacted: Boolean(row.redacted),
        decision: row.decision_json ? safeParseJson(row.decision_json) : null
      }));
    },

    addMessage({ sessionId = 'default', role, content, mode = null, intent = null, decision = null, redacted = false }) {
      const now = new Date().toISOString();
      const result = db
        .prepare(
          `INSERT INTO messages (session_id, role, content, mode, intent, decision_json, redacted, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          sessionId,
          role,
          content,
          mode,
          intent,
          decision ? JSON.stringify(decision) : null,
          redacted ? 1 : 0,
          now
        );
      const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(Number(result.lastInsertRowid));
      return {
        ...row,
        redacted: Boolean(row.redacted),
        decision: row.decision_json ? safeParseJson(row.decision_json) : null
      };
    },

    clearMessages(sessionId = 'default') {
      const info = db.prepare('DELETE FROM messages WHERE session_id = ?').run(sessionId);
      return Number(info.changes || 0);
    },

    getUserContext() {
      const rows = db.prepare('SELECT key, value, updated_at FROM user_context').all();
      const ctx = { ...DEFAULT_CONTEXT };
      for (const row of rows) {
        ctx[row.key] = row.value;
      }
      return {
        displayName: ctx.displayName,
        focusMode: ctx.focusMode,
        energyLevel: ctx.energyLevel,
        availableMinutes: Number.parseInt(ctx.availableMinutes, 10) || 120,
        preferredCategories: safeParseJson(ctx.preferredCategories) || ['Work', 'Learning']
      };
    },

    updateUserContext(updates) {
      const now = new Date().toISOString();
      const stmt = db.prepare(
        `INSERT INTO user_context (key, value, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
      );
      if (updates.displayName !== undefined) stmt.run('displayName', String(updates.displayName), now);
      if (updates.focusMode !== undefined) stmt.run('focusMode', String(updates.focusMode), now);
      if (updates.energyLevel !== undefined) stmt.run('energyLevel', String(updates.energyLevel), now);
      if (updates.availableMinutes !== undefined) stmt.run('availableMinutes', String(updates.availableMinutes), now);
      if (updates.preferredCategories !== undefined) {
        stmt.run('preferredCategories', JSON.stringify(updates.preferredCategories), now);
      }
      return this.getUserContext();
    },

    logActivity(type, summary, metadata = null) {
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO activity_logs (type, summary, metadata_json, created_at)
         VALUES (?, ?, ?, ?)`
      ).run(type, summary, metadata ? JSON.stringify(metadata) : null, now);
    },

    listActivity(limit = 20) {
      return db
        .prepare('SELECT * FROM activity_logs ORDER BY id DESC LIMIT ?')
        .all(limit)
        .map((row) => ({
          ...row,
          metadata: row.metadata_json ? safeParseJson(row.metadata_json) : null
        }));
    }
  };
}

function safeParseJson(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}
