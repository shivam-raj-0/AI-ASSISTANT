import assert from 'node:assert/strict';
import test from 'node:test';
import { createDatabase } from '../src/db/database.js';
import { analyzeContext } from '../src/engine/contextAnalyzer.js';
import { runDecisionEngine } from '../src/engine/decisionEngine.js';
import { detectIntent } from '../src/engine/intentDetector.js';
import { processChatTurn } from '../src/engine/pipeline.js';

const FALLBACK_CONFIG = {
  aiProvider: 'fallback',
  geminiApiKey: '',
  openaiApiKey: '',
  geminiModel: 'gemini-2.5-flash',
  openaiModel: 'gpt-4o-mini',
  openaiBaseUrl: 'https://api.openai.com/v1'
};

test('detectIntent identifies task creation, completion, conflict, and ambiguity', () => {
  const createRes = detectIntent('Add urgent task: Prepare investor demo tomorrow 45 mins');
  assert.equal(createRes.intent, 'create_task');
  assert.equal(createRes.entities.priority, 'urgent');
  assert.equal(createRes.entities.estimated_minutes, 45);
  assert.equal(createRes.entities.title, 'Prepare investor demo');

  const completeRes = detectIntent('Mark investor demo as done');
  assert.equal(completeRes.intent, 'complete_task');
  assert.ok(completeRes.entities.taskQuery.toLowerCase().includes('investor demo'));

  const conflictRes = detectIntent('I am overwhelmed, I have conflicting deadlines and only 30 minutes');
  assert.equal(conflictRes.intent, 'resolve_conflict');
  assert.equal(conflictRes.constraints.availableMinutes, 30);

  const ambiguousRes = detectIntent('help me');
  assert.equal(ambiguousRes.intent, 'ambiguous_request');
});

test('Decision engine detects time-budget overload and energy-vs-urgency conflicts', () => {
  const db = createDatabase(':memory:', { seed: false });
  db.createTask({ title: 'Deep architecture refactor', priority: 'urgent', estimated_minutes: 90, category: 'Work' });
  db.createTask({ title: 'Client contract review', priority: 'high', estimated_minutes: 60, category: 'Work' });
  db.updateUserContext({ availableMinutes: 45, energyLevel: 'low', focusMode: 'quick_wins' });

  const intentResult = detectIntent('What should I work on next?');
  const context = analyzeContext({
    intentResult,
    tasks: db.listTasks(),
    userContext: db.getUserContext(),
    recentMessages: [],
    userInput: 'What should I work on next?'
  });
  const decision = runDecisionEngine({ intentResult, context });

  assert.ok(decision.conflicts.some((c) => c.type === 'time_budget_overload'));
  assert.ok(decision.conflicts.some((c) => c.type === 'energy_vs_urgency'));
  assert.ok(decision.tradeOffPlan);
  assert.ok(decision.recommendations.length === 2);
  db.close();
});

test('Pipeline retains conversation context across clarification follow-up', async () => {
  const db = createDatabase(':memory:', { seed: false });

  // Turn 1: Underspecified task creation triggers clarification
  const turn1 = await processChatTurn({
    db,
    config: FALLBACK_CONFIG,
    rawInput: 'Create a task',
    sessionId: 's1'
  });

  assert.equal(turn1.assistantMessage.mode, 'fallback');
  assert.equal(turn1.assistantMessage.decision.needsClarification, true);
  assert.equal(db.listTasks().length, 0);

  // Turn 2: User answers the clarification question
  const turn2 = await processChatTurn({
    db,
    config: FALLBACK_CONFIG,
    rawInput: 'Draft sprint retrospective notes high priority',
    sessionId: 's1'
  });

  assert.equal(turn2.tasksChanged, true);
  const tasks = db.listTasks();
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].priority, 'high');
  assert.ok(tasks[0].title.includes('Draft sprint retrospective notes'));
  db.close();
});

test('Pipeline gracefully falls back when upstream LLM endpoint fails', async () => {
  const db = createDatabase(':memory:', { seed: true });

  const brokenLlmConfig = {
    aiProvider: 'openai',
    openaiApiKey: 'sk-test-fake-key-1234567890',
    openaiBaseUrl: 'http://127.0.0.1:1/unreachable',
    openaiModel: 'gpt-4o-mini',
    geminiApiKey: ''
  };

  const turn = await processChatTurn({
    db,
    config: brokenLlmConfig,
    rawInput: 'What should I focus on next?',
    sessionId: 's2'
  });

  assert.equal(turn.assistantMessage.mode, 'fallback');
  assert.ok(turn.assistantMessage.decision.fallbackReason.includes('Upstream AI service unavailable'));
  assert.ok(turn.assistantMessage.content.length > 20);
  db.close();
});
