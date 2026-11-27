/**
 * Stage 2: Context Analysis.
 * Combines active tasks, user preferences, conversational memory, situational overrides,
 * conflict detection, and ambiguity checks.
 */
export function analyzeContext({ intentResult, tasks, userContext, recentMessages, userInput }) {
  const now = new Date();
  const activeTasks = tasks.filter((t) => t.status !== 'completed');
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  const overdueTasks = activeTasks.filter((t) => {
    if (!t.due_date) return false;
    const due = new Date(t.due_date);
    return !Number.isNaN(due.getTime()) && due.getTime() < now.getTime();
  });

  const dueSoonTasks = activeTasks.filter((t) => {
    if (!t.due_date) return false;
    const due = new Date(t.due_date);
    const diffHours = (due.getTime() - now.getTime()) / (1000 * 60 * 60);
    return !Number.isNaN(due.getTime()) && diffHours >= 0 && diffHours <= 24;
  });

  // Merge stored profile with transient constraints extracted from current prompt
  const effectiveProfile = {
    ...userContext,
    availableMinutes: intentResult.constraints.availableMinutes ?? userContext.availableMinutes ?? 120,
    energyLevel: intentResult.constraints.energyLevel ?? userContext.energyLevel ?? 'medium',
    focusMode: intentResult.constraints.focusMode ?? userContext.focusMode ?? 'balanced',
    overriddenFromPrompt: Object.keys(intentResult.constraints).length > 0
  };

  // Detect conflicting requirements
  const conflicts = detectConflicts({
    activeTasks,
    overdueTasks,
    dueSoonTasks,
    effectiveProfile,
    intentResult,
    userInput
  });

  // Match referenced tasks for update/complete/delete intents
  const matchedTasks = matchTasksByQuery(activeTasks, intentResult.entities.taskQuery);

  // Detect ambiguities or missing essential info
  const clarification = evaluateClarificationNeed({
    intentResult,
    activeTasks,
    matchedTasks,
    recentMessages
  });

  return {
    nowIso: now.toISOString(),
    taskStats: {
      total: tasks.length,
      activeCount: activeTasks.length,
      completedCount: completedTasks.length,
      overdueCount: overdueTasks.length,
      dueSoonCount: dueSoonTasks.length,
      urgentOrHighCount: activeTasks.filter((t) => t.priority === 'urgent' || t.priority === 'high').length,
      totalActiveMinutes: activeTasks.reduce((acc, t) => acc + (t.estimated_minutes || 30), 0)
    },
    activeTasks,
    completedTasks,
    overdueTasks,
    dueSoonTasks,
    effectiveProfile,
    conflicts,
    matchedTasks,
    clarification,
    recentTurnCount: recentMessages.length
  };
}

function detectConflicts({ activeTasks, overdueTasks, dueSoonTasks, effectiveProfile, intentResult, userInput }) {
  const conflicts = [];
  const highPriorityTasks = activeTasks.filter((t) => t.priority === 'urgent' || t.priority === 'high');
  const highPriorityMinutes = highPriorityTasks.reduce((sum, t) => sum + (t.estimated_minutes || 30), 0);

  if (highPriorityTasks.length > 0 && highPriorityMinutes > effectiveProfile.availableMinutes) {
    conflicts.push({
      type: 'time_budget_overload',
      severity: 'high',
      description: `You have ${highPriorityMinutes} min of urgent/high-priority work across ${highPriorityTasks.length} tasks, exceeding your ${effectiveProfile.availableMinutes} min availability.`,
      affectedTaskIds: highPriorityTasks.map((t) => t.id)
    });
  }

  if (dueSoonTasks.length + overdueTasks.length >= 2) {
    const colliding = [...overdueTasks, ...dueSoonTasks];
    conflicts.push({
      type: 'deadline_collision',
      severity: 'medium',
      description: `${colliding.length} active tasks are either overdue or due within the next 24 hours.`,
      affectedTaskIds: colliding.map((t) => t.id)
    });
  }

  const urgentHeavyTask = activeTasks.find(
    (t) => (t.priority === 'urgent' || t.priority === 'high') && (t.estimated_minutes || 30) >= 45
  );
  if (
    urgentHeavyTask &&
    (effectiveProfile.energyLevel === 'low' || effectiveProfile.focusMode === 'quick_wins')
  ) {
    conflicts.push({
      type: 'energy_vs_urgency',
      severity: 'medium',
      description: `"${urgentHeavyTask.title}" is ${urgentHeavyTask.priority} priority (${urgentHeavyTask.estimated_minutes}m), which conflicts with your current ${effectiveProfile.energyLevel} energy / ${effectiveProfile.focusMode.replace('_', ' ')} preference.`,
      affectedTaskIds: [urgentHeavyTask.id]
    });
  }

  if (
    intentResult.intent === 'create_task' &&
    (intentResult.entities.priority === 'urgent' || intentResult.entities.priority === 'high') &&
    highPriorityTasks.length >= 3
  ) {
    conflicts.push({
      type: 'priority_inflation',
      severity: 'low',
      description: `Adding another high/urgent task will bring your high-priority queue to ${highPriorityTasks.length + 1} items, increasing context-switching risk.`,
      affectedTaskIds: highPriorityTasks.slice(0, 3).map((t) => t.id)
    });
  }

  if (/\b(and also|both)\b/i.test(userInput || '') && /\b(urgent|now|today)\b/i.test(userInput || '') && effectiveProfile.availableMinutes <= 45) {
    conflicts.push({
      type: 'constrained_scope',
      severity: 'medium',
      description: `Multiple urgent goals requested inside a tight ${effectiveProfile.availableMinutes}-minute window.`,
      affectedTaskIds: []
    });
  }

  return conflicts;
}

function matchTasksByQuery(tasks, query) {
  if (!query || query.trim().length < 2) return [];
  const normalized = query.toLowerCase().trim();

  // Check numeric ID reference (e.g., "#2" or "2")
  const idMatch = normalized.match(/^#?(\d+)$/);
  if (idMatch) {
    const id = Number.parseInt(idMatch[1], 10);
    const found = tasks.find((t) => t.id === id);
    return found ? [found] : [];
  }

  const exactMatches = tasks.filter((t) => t.title.toLowerCase().includes(normalized));
  if (exactMatches.length > 0) return exactMatches;

  const tokens = normalized.split(/\s+/).filter((w) => w.length >= 3);
  if (tokens.length === 0) return [];

  return tasks.filter((t) => {
    const hay = `${t.title} ${t.description} ${t.category}`.toLowerCase();
    return tokens.some((tok) => hay.includes(tok));
  });
}

function evaluateClarificationNeed({ intentResult, activeTasks, matchedTasks }) {
  const { intent, entities } = intentResult;

  if (intent === 'ambiguous_request') {
    return {
      needed: true,
      reason: 'The request is too open-ended to take a specific, accurate action.',
      questions: [
        'Are you looking to create a new task, prioritize what to work on next, or resolve a schedule conflict?',
        'How much time and energy do you have available right now?'
      ]
    };
  }

  if (intent === 'create_task' && !entities.title) {
    return {
      needed: true,
      reason: 'Missing the task title or core action.',
      questions: [
        'What specific task would you like me to add?',
        'Should it be urgent, high, medium, or low priority, and when is it due?'
      ]
    };
  }

  if (['complete_task', 'delete_task', 'update_task'].includes(intent)) {
    if (activeTasks.length === 0) {
      return {
        needed: false,
        reason: null,
        questions: []
      };
    }
    if (!entities.taskQuery || matchedTasks.length === 0) {
      const sampleTitles = activeTasks.slice(0, 3).map((t) => `"${t.title}" (#${t.id})`).join(', ');
      return {
        needed: true,
        reason: entities.taskQuery
          ? `No active task matched "${entities.taskQuery}".`
          : 'No target task was specified.',
        questions: [
          `Which active task did you mean? Current active tasks include: ${sampleTitles}.`
        ]
      };
    }
    if (matchedTasks.length > 1) {
      const options = matchedTasks.slice(0, 4).map((t) => `"${t.title}" (#${t.id})`).join(', ');
      return {
        needed: true,
        reason: `Multiple active tasks matched "${entities.taskQuery}".`,
        questions: [
          `I found ${matchedTasks.length} matching tasks (${options}). Which one should I ${intent.replace('_task', '')}?`
        ]
      };
    }
  }

  return {
    needed: false,
    reason: null,
    questions: []
  };
}
