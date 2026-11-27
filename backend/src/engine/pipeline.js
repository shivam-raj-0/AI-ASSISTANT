import { analyzeContext } from './contextAnalyzer.js';
import { runDecisionEngine, scoreAndRankTasks, suggestNextActionForTitle } from './decisionEngine.js';
import { detectIntent } from './intentDetector.js';
import { inspectAndRedact } from './privacyGuard.js';
import { generateAssistantResponse } from './responseGenerator.js';

/**
 * Executes the full 6-stage SmartMate AI pipeline:
 * User Input -> Privacy Guard & Intent Detection -> Context Analysis ->
 * Decision Engine -> Action Execution -> Response Generation.
 */
export async function processChatTurn({ db, config, rawInput, sessionId = 'default' }) {
  // Stage 0: Privacy protection before storing or analyzing
  const privacy = inspectAndRedact(rawInput);
  const sanitizedInput = privacy.sanitizedText;

  if (privacy.redacted) {
    db.logActivity('privacy_redacted', `Redacted sensitive data (${privacy.findings.join(', ')}) from chat input.`, {
      findings: privacy.findings
    });
  }

  const recentMessages = db.listMessages(sessionId, 8);
  const tasksBefore = db.listTasks();
  const userContext = db.getUserContext();

  // Persist sanitized user message
  const savedUserMessage = db.addMessage({
    sessionId,
    role: 'user',
    content: sanitizedInput,
    redacted: privacy.redacted
  });

  // Stage 1: Intent Detection
  const intentResult = detectIntent(sanitizedInput, recentMessages);

  // Stage 2: Context Analysis
  const context = analyzeContext({
    intentResult,
    tasks: tasksBefore,
    userContext,
    recentMessages,
    userInput: sanitizedInput
  });

  // Stage 3: Decision Engine
  const decision = runDecisionEngine({ intentResult, context });

  // Stage 4: Action Execution (Task CRUD when clearly authorized & unambiguous)
  const executedResult = executeDecisionAction(db, decision);

  // Refresh ranked recommendations after potential task mutation
  const tasksAfter = executedResult ? db.listTasks() : tasksBefore;
  const updatedRecommendations = scoreAndRankTasks(
    tasksAfter.filter((t) => t.status !== 'completed'),
    context.effectiveProfile,
    context.nowIso
  ).slice(0, 3);

  const enrichedDecision = {
    ...decision,
    intent: intentResult.intent,
    confidence: intentResult.confidence,
    contextSnapshot: {
      activeCount: tasksAfter.filter((t) => t.status !== 'completed').length,
      availableMinutes: context.effectiveProfile.availableMinutes,
      energyLevel: context.effectiveProfile.energyLevel,
      focusMode: context.effectiveProfile.focusMode
    },
    recommendations: updatedRecommendations
  };

  // Stage 5: Response Generation (LLM or Transparent Fallback)
  const generated = await generateAssistantResponse({
    sanitizedInput,
    intentResult,
    context,
    decision: enrichedDecision,
    executedResult,
    recentMessages,
    privacyFindings: privacy.findings,
    config
  });

  // Persist assistant response + decision trace
  const savedAssistantMessage = db.addMessage({
    sessionId,
    role: 'assistant',
    content: generated.content,
    mode: generated.mode,
    intent: intentResult.intent,
    decision: {
      ...enrichedDecision,
      provider: generated.provider,
      model: generated.model,
      fallbackReason: generated.fallbackReason,
      executedResult
    }
  });

  db.logActivity('decision_made', `Processed "${intentResult.intent}" via ${generated.mode} engine.`, {
    intent: intentResult.intent,
    actionType: decision.actionType,
    mode: generated.mode
  });

  return {
    userMessage: savedUserMessage,
    assistantMessage: savedAssistantMessage,
    privacy: {
      redacted: privacy.redacted,
      findings: privacy.findings
    },
    executedResult,
    tasksChanged: Boolean(executedResult)
  };
}

function executeDecisionAction(db, decision) {
  const action = decision.proposedAction;
  if (!action) return null;

  if (action.type === 'create_task') {
    const created = db.createTask(action.payload);
    db.logActivity('task_created', `Assistant created task "${created.title}" (${created.priority}).`, {
      taskId: created.id
    });
    return { type: 'task_created', task: created };
  }

  if (action.type === 'complete_task') {
    const updated = db.updateTask(action.taskId, { status: 'completed' });
    if (!updated) return null;
    db.logActivity('task_completed', `Assistant completed task "${updated.title}".`, {
      taskId: updated.id
    });
    return { type: 'task_completed', task: updated };
  }

  if (action.type === 'delete_task') {
    const deleted = db.deleteTask(action.taskId);
    if (!deleted) return null;
    db.logActivity('task_deleted', `Assistant deleted task "${action.taskTitle}".`, {
      taskId: action.taskId
    });
    return { type: 'task_deleted', taskId: action.taskId, taskTitle: action.taskTitle };
  }

  if (action.type === 'update_task') {
    const updated = db.updateTask(action.taskId, action.updates);
    if (!updated) return null;
    db.logActivity('task_updated', `Assistant updated task "${updated.title}".`, {
      taskId: updated.id,
      updates: action.updates
    });
    return { type: 'task_updated', task: updated };
  }

  return null;
}

/**
 * Computes live prioritized recommendations + insights for the Recommendations & Dashboard views.
 */
export function computeWorkspaceInsights(db) {
  const tasks = db.listTasks();
  const userContext = db.getUserContext();
  const activeTasks = tasks.filter((t) => t.status !== 'completed');
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  const context = analyzeContext({
    intentResult: { intent: 'prioritize_recommend', entities: {}, constraints: {} },
    tasks,
    userContext,
    recentMessages: [],
    userInput: ''
  });

  const ranked = scoreAndRankTasks(activeTasks, context.effectiveProfile, context.nowIso);

  const categoryBreakdown = {};
  for (const t of tasks) {
    if (!categoryBreakdown[t.category]) {
      categoryBreakdown[t.category] = { total: 0, completed: 0, active: 0 };
    }
    categoryBreakdown[t.category].total += 1;
    if (t.status === 'completed') categoryBreakdown[t.category].completed += 1;
    else categoryBreakdown[t.category].active += 1;
  }

  const priorityBreakdown = { urgent: 0, high: 0, medium: 0, low: 0 };
  for (const t of activeTasks) {
    if (priorityBreakdown[t.priority] !== undefined) {
      priorityBreakdown[t.priority] += 1;
    }
  }

  const completionRate = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;

  return {
    stats: {
      ...context.taskStats,
      completionRate
    },
    profile: context.effectiveProfile,
    conflicts: context.conflicts,
    recommendations: ranked.slice(0, 5),
    categoryBreakdown,
    priorityBreakdown,
    recentActivity: db.listActivity(12)
  };
}

export { suggestNextActionForTitle };
