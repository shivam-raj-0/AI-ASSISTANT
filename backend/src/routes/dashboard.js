import { Router } from 'express';
import { getAiStatus } from '../config/env.js';
import { computeWorkspaceInsights } from '../engine/pipeline.js';

export function createDashboardRouter(db, config) {
  const router = Router();

  router.get('/', (_req, res) => {
    const insights = computeWorkspaceInsights(db);
    res.json({
      ...insights,
      ai: getAiStatus(config)
    });
  });

  return router;
}
