import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

export function buildSecurityMiddleware(config) {
  const allowedOrigins = config.corsOrigin
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const helmetMiddleware = helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'", ...allowedOrigins]
      }
    },
    crossOriginResourcePolicy: { policy: 'same-site' }
  });

  const corsMiddleware = cors({
    origin(origin, callback) {
      // Allow non-browser / same-origin requests without Origin header
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return callback(null, true);
      }
      const err = new Error('Origin not allowed by CORS policy');
      err.status = 403;
      return callback(err);
    },
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'X-Session-Id']
  });

  const apiLimiter = rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests from this client. Please try again shortly.'
      }
    }
  });

  const chatLimiter = rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.chatRateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: {
        code: 'CHAT_RATE_LIMITED',
        message: 'Chat rate limit exceeded. Please wait before sending more messages.'
      }
    }
  });

  return {
    helmetMiddleware,
    corsMiddleware,
    apiLimiter,
    chatLimiter
  };
}

/**
 * Strips unsafe control characters and trims strings.
 */
export function sanitizeText(value, maxLength = 2000) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);
}
