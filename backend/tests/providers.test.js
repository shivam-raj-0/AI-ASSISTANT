import assert from 'node:assert/strict';
import test from 'node:test';
import { getAiStatus, getConfig } from '../src/config/env.js';
import { createDatabase } from '../src/db/database.js';
import { processChatTurn } from '../src/engine/pipeline.js';

test('Root .env values load cleanly into backend config without exposing secrets', () => {
  const config = getConfig();
  assert.equal(config.port, 4000);
  assert.equal(config.aiProvider, 'auto');
  assert.equal(config.geminiModel, 'gemini-2.5-flash');
  assert.equal(config.openaiModel, 'gpt-4o-mini');
  assert.ok(config.dbPath.endsWith('smartmate.sqlite'));
});

test('getAiStatus handles gemini, openai, auto, and fallback provider selection', () => {
  const base = {
    geminiModel: 'gemini-2.5-flash',
    openaiModel: 'gpt-4o-mini',
    geminiApiKey: '',
    openaiApiKey: ''
  };

  // No keys -> fallback
  assert.equal(getAiStatus({ ...base, aiProvider: 'auto' }).activeProvider, 'fallback');

  // Auto prefers Gemini when both keys present
  const autoBoth = getAiStatus({
    ...base,
    aiProvider: 'auto',
    geminiApiKey: 'test-gemini',
    openaiApiKey: 'test-openai'
  });
  assert.equal(autoBoth.activeProvider, 'gemini');
  assert.equal(autoBoth.configured, true);

  // Auto picks OpenAI when only OpenAI key present
  const autoOpenAi = getAiStatus({
    ...base,
    aiProvider: 'auto',
    openaiApiKey: 'test-openai'
  });
  assert.equal(autoOpenAi.activeProvider, 'openai');
  assert.equal(autoOpenAi.configured, true);

  // Explicit gemini without key reports clear fallback reason
  const missingGemini = getAiStatus({
    ...base,
    aiProvider: 'gemini',
    openaiApiKey: 'test-openai'
  });
  assert.equal(missingGemini.activeProvider, 'fallback');
  assert.ok(missingGemini.reason.includes('GEMINI_API_KEY is missing'));

  // Explicit openai with key
  const explicitOpenAi = getAiStatus({
    ...base,
    aiProvider: 'openai',
    openaiApiKey: 'test-openai'
  });
  assert.equal(explicitOpenAi.activeProvider, 'openai');

  // Explicit fallback ignores keys
  const forcedFallback = getAiStatus({
    ...base,
    aiProvider: 'fallback',
    geminiApiKey: 'test-gemini',
    openaiApiKey: 'test-openai'
  });
  assert.equal(forcedFallback.activeProvider, 'fallback');
  assert.equal(forcedFallback.configured, false);
});

test('Gemini provider sends grounded request and returns llm mode', async () => {
  const db = createDatabase(':memory:', { seed: true });
  const origFetch = globalThis.fetch;
  let capturedUrl = '';
  let capturedHeaders = null;

  globalThis.fetch = async (url, init) => {
    capturedUrl = String(url);
    capturedHeaders = init.headers;
    return {
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Start with Finalize Q4 Product Roadmap Review.' }] } }]
      })
    };
  };

  try {
    const turn = await processChatTurn({
      db,
      config: {
        aiProvider: 'gemini',
        geminiApiKey: 'mock-gemini-key',
        geminiModel: 'gemini-2.5-flash',
        openaiApiKey: '',
        openaiBaseUrl: 'https://api.openai.com/v1',
        openaiModel: 'gpt-4o-mini'
      },
      rawInput: 'What should I work on next?',
      sessionId: 'gemini-test'
    });

    assert.ok(capturedUrl.includes('generativelanguage.googleapis.com'));
    assert.equal(capturedHeaders['x-goog-api-key'], 'mock-gemini-key');
    assert.equal(turn.assistantMessage.mode, 'llm');
    assert.equal(turn.assistantMessage.decision.provider, 'gemini');
    assert.ok(turn.assistantMessage.content.includes('Finalize Q4 Product Roadmap Review'));
  } finally {
    globalThis.fetch = origFetch;
    db.close();
  }
});

test('OpenAI provider sends Bearer token and returns llm mode', async () => {
  const db = createDatabase(':memory:', { seed: true });
  const origFetch = globalThis.fetch;
  let capturedUrl = '';
  let capturedHeaders = null;

  globalThis.fetch = async (url, init) => {
    capturedUrl = String(url);
    capturedHeaders = init.headers;
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Focus on the security checklist next.' } }]
      })
    };
  };

  try {
    const turn = await processChatTurn({
      db,
      config: {
        aiProvider: 'openai',
        geminiApiKey: '',
        geminiModel: 'gemini-2.5-flash',
        openaiApiKey: 'mock-openai-key',
        openaiBaseUrl: 'https://api.openai.com/v1',
        openaiModel: 'gpt-4o-mini'
      },
      rawInput: 'What should I work on next?',
      sessionId: 'openai-test'
    });

    assert.equal(capturedUrl, 'https://api.openai.com/v1/chat/completions');
    assert.equal(capturedHeaders.Authorization, 'Bearer mock-openai-key');
    assert.equal(turn.assistantMessage.mode, 'llm');
    assert.equal(turn.assistantMessage.decision.provider, 'openai');
  } finally {
    globalThis.fetch = origFetch;
    db.close();
  }
});

test('Auto mode fails over from Gemini to OpenAI when Gemini errors and both keys exist', async () => {
  const db = createDatabase(':memory:', { seed: true });
  const origFetch = globalThis.fetch;
  const calledUrls = [];

  globalThis.fetch = async (url) => {
    calledUrls.push(String(url));
    if (String(url).includes('generativelanguage.googleapis.com')) {
      return { ok: false, status: 503 };
    }
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Recovered via OpenAI secondary provider.' } }]
      })
    };
  };

  try {
    const turn = await processChatTurn({
      db,
      config: {
        aiProvider: 'auto',
        geminiApiKey: 'mock-gemini-key',
        geminiModel: 'gemini-2.5-flash',
        openaiApiKey: 'mock-openai-key',
        openaiBaseUrl: 'https://api.openai.com/v1',
        openaiModel: 'gpt-4o-mini'
      },
      rawInput: 'Summarize my tasks',
      sessionId: 'auto-failover-test'
    });

    assert.equal(calledUrls.length, 2);
    assert.equal(turn.assistantMessage.mode, 'llm');
    assert.equal(turn.assistantMessage.decision.provider, 'openai');
    assert.ok(turn.assistantMessage.decision.fallbackReason.includes('used secondary openai'));
  } finally {
    globalThis.fetch = origFetch;
    db.close();
  }
});
