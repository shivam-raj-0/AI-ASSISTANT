import express from 'express';
import { getConfig } from './config/env.js';
import { createDatabase } from './db/database.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { buildSecurityMiddleware } from './middleware/security.js';
import { createChatRouter } from './routes/chat.js';
import { createContextRouter } from './routes/context.js';
import { createDashboardRouter } from './routes/dashboard.js';
import { createHealthRouter } from './routes/health.js';
import { createRecommendationsRouter } from './routes/recommendations.js';
import { createTasksRouter } from './routes/tasks.js';

export function createApp(options = {}) {
  const config = { ...getConfig(), ...(options.config || {}) };
  const db = options.db || createDatabase(config.dbPath, { seed: options.seed ?? true });

  const app = express();
  app.disable('x-powered-by');

  const { helmetMiddleware, corsMiddleware, apiLimiter, chatLimiter } = buildSecurityMiddleware(config);

  app.use(helmetMiddleware);
  app.use(corsMiddleware);
  app.use(express.json({ limit: '64kb' }));
  app.use('/api', apiLimiter);

  app.use('/api/health', createHealthRouter(config));
  app.use('/api/tasks', createTasksRouter(db));
  app.use('/api/chat', createChatRouter({ db, config, chatLimiter }));
  app.use('/api/recommendations', createRecommendationsRouter(db));
  app.use('/api/dashboard', createDashboardRouter(db, config));
  app.use('/api/context', createContextRouter(db));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return { app, db, config };
}
