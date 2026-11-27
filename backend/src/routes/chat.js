import { Router } from 'express';
import { getAiStatus } from '../config/env.js';
import { processChatTurn } from '../engine/pipeline.js';
import { sanitizeText } from '../middleware/security.js';

function normalizeSessionId(raw) {
  if (typeof raw !== 'string') return 'default';
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  return cleaned || 'default';
}

export function createChatRouter({ db, config, chatLimiter }) {
  const router = Router();

  router.get('/history', (req, res) => {
    const sessionId = normalizeSessionId(req.query.sessionId || req.headers['x-session-id']);
    const messages = db.listMessages(sessionId, 60);
    res.json({
      sessionId,
      messages,
      ai: getAiStatus(config)
    });
  });

  router.post('/', chatLimiter, async (req, res, next) => {
    try {
      const rawMessage = req.body?.message;
      if (typeof rawMessage !== 'string') {
        return res.status(400).json({
          error: { code: 'INVALID_INPUT', message: 'Message must be a non-empty text string.' }
        });
      }

      const cleaned = sanitizeText(rawMessage, 2000);
      if (!cleaned) {
        return res.status(400).json({
          error: { code: 'EMPTY_MESSAGE', message: 'Please enter a message before sending.' }
        });
      }

      const sessionId = normalizeSessionId(req.body?.sessionId || req.headers['x-session-id']);

      const result = await processChatTurn({
        db,
        config,
        rawInput: cleaned,
        sessionId
      });

      return res.json(result);
    } catch (err) {
      return next(err);
    }
  });

  router.delete('/history', (req, res) => {
    const sessionId = normalizeSessionId(req.query.sessionId || req.headers['x-session-id']);
    const clearedCount = db.clearMessages(sessionId);
    db.logActivity('memory_cleared', `Cleared ${clearedCount} conversation message(s) from memory.`, {
      sessionId,
      clearedCount
    });
    res.json({ cleared: true, clearedCount, sessionId });
  });

  return router;
}
