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
