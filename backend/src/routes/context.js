import { Router } from 'express';
import { sanitizeText } from '../middleware/security.js';

const VALID_FOCUS_MODES = new Set(['balanced', 'deep_work', 'quick_wins']);
const VALID_ENERGY = new Set(['high', 'medium', 'low']);
const VALID_CATEGORIES = new Set(['Work', 'Personal', 'Health', 'Learning', 'Finance', 'Errands']);

export function createContextRouter(db) {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({
      context: db.getUserContext(),
      activity: db.listActivity(15)
    });
  });

  router.put('/', (req, res) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Context payload must be an object.' } });
    }

    const updates = {};

    if (body.displayName !== undefined) {
      const name = sanitizeText(String(body.displayName), 50);
      if (!name) {
        return res.status(400).json({ error: { code: 'INVALID_NAME', message: 'displayName cannot be empty.' } });
      }
      updates.displayName = name;
    }

    if (body.focusMode !== undefined) {
      if (!VALID_FOCUS_MODES.has(body.focusMode)) {
        return res.status(400).json({ error: { code: 'INVALID_FOCUS_MODE', message: 'focusMode must be balanced, deep_work, or quick_wins.' } });
      }
      updates.focusMode = body.focusMode;
    }

    if (body.energyLevel !== undefined) {
      if (!VALID_ENERGY.has(body.energyLevel)) {
        return res.status(400).json({ error: { code: 'INVALID_ENERGY', message: 'energyLevel must be high, medium, or low.' } });
      }
      updates.energyLevel = body.energyLevel;
    }

    if (body.availableMinutes !== undefined) {
      const mins = Number(body.availableMinutes);
      if (!Number.isInteger(mins) || mins < 10 || mins > 720) {
        return res.status(400).json({ error: { code: 'INVALID_MINUTES', message: 'availableMinutes must be an integer between 10 and 720.' } });
      }
      updates.availableMinutes = mins;
    }

    if (body.preferredCategories !== undefined) {
      if (!Array.isArray(body.preferredCategories)) {
        return res.status(400).json({ error: { code: 'INVALID_CATEGORIES', message: 'preferredCategories must be an array.' } });
      }
      const filtered = body.preferredCategories.filter((c) => VALID_CATEGORIES.has(c));
      updates.preferredCategories = filtered;
    }

    const updated = db.updateUserContext(updates);
    db.logActivity('context_updated', `Updated focus context (${updated.focusMode}, ${updated.energyLevel} energy, ${updated.availableMinutes}m).`);

    return res.json({ context: updated });
  });

  return router;
}
