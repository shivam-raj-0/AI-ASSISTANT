import assert from 'node:assert/strict';
import http from 'node:http';
import { Duplex } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/db/database.js';

/**
 * Lightweight in-process HTTP dispatcher so Express middleware (helmet, cors,
 * rate-limit, json parser, routers, error handler) can be tested without opening TCP ports.
 */
function createInProcessClient() {
  const db = createDatabase(':memory:', { seed: true });
  const { app } = createApp({
    db,
    config: {
      port: 0,
      corsOrigin: 'http://localhost:5173',
      rateLimitWindowMs: 60000,
      rateLimitMax: 200,
      chatRateLimitMax: 100,
      aiProvider: 'fallback',
      geminiApiKey: '',
      openaiApiKey: ''
    }
  });

  function request(method, path, body = null, extraHeaders = {}) {
    return new Promise((resolve, reject) => {
      const payload = body !== null ? Buffer.from(JSON.stringify(body), 'utf8') : null;
      const socket = new Duplex({
        read() {},
        write(_chunk, _enc, cb) {
          cb();
        }
      });
      socket.remoteAddress = '127.0.0.1';

      const req = new http.IncomingMessage(socket);
      req.method = method;
      req.url = `/api${path}`;
      req.headers = {
        host: '127.0.0.1',
        ...(payload ? { 'content-type': 'application/json', 'content-length': String(payload.length) } : {}),
        ...extraHeaders
      };

      const res = new http.ServerResponse(req);
      res.assignSocket(socket);

      const chunks = [];
      const origWrite = res.write.bind(res);
      const origEnd = res.end.bind(res);

      res.write = (chunk, encoding, cb) => {
        if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
        return origWrite(chunk, encoding, cb);
      };

      res.end = (chunk, encoding, cb) => {
        if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
        const raw = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try {
          json = raw ? JSON.parse(raw) : null;
        } catch {
          json = raw;
        }
        origEnd(chunk, encoding, cb);
        resolve({
          status: res.statusCode,
          headers: res.getHeaders(),
          body: json
        });
      };

      app.handle(req, res, (err) => {
        if (err) reject(err);
      });

      if (payload) req.push(payload);
      req.push(null);
    });
  }

  return {
    request,
    close() {
      db.close();
    }
  };
}

test('Health endpoint exposes security headers and hides secrets', async () => {
  const client = createInProcessClient();
  try {
    const res = await client.request('GET', '/health');
    assert.equal(res.status, 200);
    assert.equal(res.headers['x-powered-by'], undefined);
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.ok(res.headers['ratelimit-limit']);

    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.ai.activeProvider, 'fallback');
    assert.equal(res.body.ai.configured, false);
  } finally {
    client.close();
  }
});

test('Task CRUD endpoints validate inputs and persist updates', async () => {
  const client = createInProcessClient();
  try {
    const badRes = await client.request('POST', '/tasks', { title: 'a', priority: 'invalid_prio' });
    assert.equal(badRes.status, 400);

    const createRes = await client.request('POST', '/tasks', {
      title: 'Write integration tests',
      priority: 'high',
      category: 'Work',
      estimated_minutes: 40
    });
    assert.equal(createRes.status, 201);
    const { task } = createRes.body;
    assert.equal(task.title, 'Write integration tests');
    assert.ok(task.next_action.length > 5);

    const patchRes = await client.request('PATCH', `/tasks/${task.id}`, { status: 'completed' });
    assert.equal(patchRes.status, 200);
    assert.equal(patchRes.body.task.status, 'completed');
    assert.ok(patchRes.body.task.completed_at);

    const delRes = await client.request('DELETE', `/tasks/${task.id}`);
    assert.equal(delRes.status, 200);

    const missingRes = await client.request('DELETE', `/tasks/${task.id}`);
    assert.equal(missingRes.status, 404);
  } finally {
    client.close();
  }
});

test('Chat endpoint executes task actions, redacts secrets, and clears memory', async () => {
  const client = createInProcessClient();
  try {
    const emptyRes = await client.request('POST', '/chat', { message: '   ' });
    assert.equal(emptyRes.status, 400);

    const chatRes = await client.request('POST', '/chat', {
      sessionId: 'test-session',
      message: 'Add urgent task: Rotate token sk-secret1234567890abcdef today'
    });
    assert.equal(chatRes.status, 200);
    assert.equal(chatRes.body.privacy.redacted, true);
    assert.equal(chatRes.body.tasksChanged, true);
    assert.ok(!chatRes.body.userMessage.content.includes('sk-secret1234567890abcdef'));
    assert.equal(chatRes.body.assistantMessage.mode, 'fallback');

    const histRes = await client.request('GET', '/chat/history?sessionId=test-session');
    assert.equal(histRes.body.messages.length, 2);

    const clearRes = await client.request('DELETE', '/chat/history?sessionId=test-session');
    assert.equal(clearRes.status, 200);

    const histAfter = await client.request('GET', '/chat/history?sessionId=test-session');
    assert.equal(histAfter.body.messages.length, 0);
  } finally {
    client.close();
  }
});

test('Context update affects recommendations and dashboard endpoints', async () => {
  const client = createInProcessClient();
  try {
    const ctxRes = await client.request('PUT', '/context', {
      displayName: 'Jordan',
      focusMode: 'quick_wins',
      energyLevel: 'low',
      availableMinutes: 35,
      preferredCategories: ['Health']
    });
    assert.equal(ctxRes.status, 200);
    assert.equal(ctxRes.body.context.displayName, 'Jordan');

    const dashRes = await client.request('GET', '/dashboard');
    assert.equal(dashRes.status, 200);
    assert.ok(dashRes.body.recommendations.length > 0);
    assert.ok(dashRes.body.stats.total >= 4);

    const topId = dashRes.body.recommendations[0].task.id;
    const applyRes = await client.request('POST', `/recommendations/${topId}/apply`, { action: 'start' });
    assert.equal(applyRes.status, 200);
    assert.equal(applyRes.body.task.status, 'in_progress');
  } finally {
    client.close();
  }
});
