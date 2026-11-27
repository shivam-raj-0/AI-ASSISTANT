import { Router } from 'express';
import { getAiStatus } from '../config/env.js';

export function createHealthRouter(config) {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'SmartMate AI Backend',
      ai: getAiStatus(config),
      timestamp: new Date().toISOString()
    });
  });

  return router;
}

/**
 * Root liveness/readiness handler for GET /healthz.
 * Verifies database connectivity without exposing secrets or internal errors.
 */
export function createHealthzHandler(db) {
  return (_req, res) => {
    const timestamp = new Date().toISOString();
    try {
      const healthy = Boolean(db && typeof db.ping === 'function' && db.ping());
      if (!healthy) {
        return res.status(503).json({
          status: 'error',
          service: 'SmartMate AI Backend',
          timestamp
        });
      }

      return res.status(200).json({
        status: 'ok',
        service: 'SmartMate AI Backend',
        timestamp
      });
    } catch {
      return res.status(503).json({
        status: 'error',
        service: 'SmartMate AI Backend',
        timestamp
      });
    }
  };
}
