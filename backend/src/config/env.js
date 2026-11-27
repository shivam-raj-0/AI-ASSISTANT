import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootEnvPath = resolve(__dirname, '../../../.env');
const backendEnvPath = resolve(__dirname, '../../.env');
const backendRoot = resolve(__dirname, '../..');

export function loadEnvFiles() {
  if (existsSync(rootEnvPath)) {
    dotenv.config({ path: rootEnvPath });
  } else if (existsSync(backendEnvPath)) {
    dotenv.config({ path: backendEnvPath });
  }
}

loadEnvFiles();

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveDbPath(rawPath) {
  const value = (rawPath || '').trim();
  if (!value) return resolve(backendRoot, 'data/smartmate.sqlite');
  if (value === ':memory:') return value;
  return resolve(backendRoot, value);
}

export function getConfig() {
  const providerPref = (process.env.AI_PROVIDER || 'auto').toLowerCase();
  const geminiApiKey = (process.env.GEMINI_API_KEY || '').trim();
  const openaiApiKey = (process.env.OPENAI_API_KEY || '').trim();

  return {
    port: parsePositiveInt(process.env.PORT, 4000),
    nodeEnv: process.env.NODE_ENV || 'development',
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    dbPath: resolveDbPath(process.env.DB_PATH),
    rateLimitWindowMs: parsePositiveInt(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    rateLimitMax: parsePositiveInt(process.env.RATE_LIMIT_MAX, 120),
    chatRateLimitMax: parsePositiveInt(process.env.CHAT_RATE_LIMIT_MAX, 40),
    aiProvider: providerPref,
    geminiApiKey,
    geminiModel: (process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim(),
    openaiApiKey,
    openaiBaseUrl: (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').trim().replace(/\/+$/, ''),
    openaiModel: (process.env.OPENAI_MODEL || 'gpt-4o-mini').trim()
  };
}

/**
 * Returns non-sensitive AI provider availability metadata for clients.
 */
export function getAiStatus(config = getConfig()) {
  const hasGemini = Boolean(config.geminiApiKey);
  const hasOpenAi = Boolean(config.openaiApiKey);

  if (config.aiProvider === 'fallback') {
    return { configured: false, activeProvider: 'fallback', model: 'rule-based-v1', reason: 'AI_PROVIDER set to fallback' };
  }
  if (config.aiProvider === 'gemini') {
    if (hasGemini) {
      return { configured: true, activeProvider: 'gemini', model: config.geminiModel, reason: null };
    }
    return {
      configured: false,
      activeProvider: 'fallback',
      model: 'rule-based-v1',
      reason: 'AI_PROVIDER=gemini selected, but GEMINI_API_KEY is missing; running rule-based fallback engine.'
    };
  }
  if (config.aiProvider === 'openai') {
    if (hasOpenAi) {
      return { configured: true, activeProvider: 'openai', model: config.openaiModel, reason: null };
    }
    return {
      configured: false,
      activeProvider: 'fallback',
      model: 'rule-based-v1',
      reason: 'AI_PROVIDER=openai selected, but OPENAI_API_KEY is missing; running rule-based fallback engine.'
    };
  }
  if (config.aiProvider === 'auto') {
    if (hasGemini) {
      return { configured: true, activeProvider: 'gemini', model: config.geminiModel, reason: null };
    }
    if (hasOpenAi) {
      return { configured: true, activeProvider: 'openai', model: config.openaiModel, reason: null };
    }
  }

  return {
    configured: false,
    activeProvider: 'fallback',
    model: 'rule-based-v1',
    reason: 'No external LLM API key configured; running transparent rule-based fallback engine.'
  };
}
