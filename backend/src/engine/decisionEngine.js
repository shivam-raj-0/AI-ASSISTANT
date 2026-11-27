const PRIORITY_WEIGHT = {
  urgent: 45,
  high: 32,
  medium: 18,
  low: 8
};

/**
 * Stage 3: Decision Engine.
 * Scores tasks deterministically using urgency, priority, momentum, and user context,
 * resolves conflicts, and chooses the optimal action with transparent explanations.
 */
export function runDecisionEngine({ intentResult, context }) {
  const rankedTasks = scoreAndRankTasks(context.activeTasks, context.effectiveProfile, context.nowIso);
  const { intent, entities } = intentResult;

  // 1. Clarification takes precedence when input lacks critical targets
  if (context.clarification.needed) {
    return {
      actionType: 'ask_clarification',
      pendingIntent: intent,
      needsClarification: true,
      clarificationQuestions: context.clarification.questions,
      clarificationReason: context.clarification.reason,
      conflicts: context.conflicts,
      recommendations: rankedTasks.slice(0, 2),
      reasoning: [
        `Detected intent "${intent}" but paused execution to avoid guessing.`,
        context.clarification.reason
      ],
      proposedAction: null
    };
  }

  // 2. Create Task
  if (intent === 'create_task') {
    const priority = entities.priority || inferPriorityFromContext(entities.due_date);
    const category = entities.category || 'Work';
    const estimatedMinutes = entities.estimated_minutes || 30;
    const nextAction = suggestNextActionForTitle(entities.title, category);

    const reasoning = [
      `Extracted actionable task "${entities.title}" in category "${category}".`,
      `Assigned "${priority}" priority${entities.due_date ? ` with deadline ${entities.due_date}` : ' (no explicit deadline)'}.`
    ];
    if (context.conflicts.length > 0) {
      reasoning.push(`Flagged ${context.conflicts.length} scheduling/priority conflict(s) to help you balance workload.`);
    }

    return {
      actionType: 'create_task',
      pendingIntent: null,
      needsClarification: false,
      clarificationQuestions: [],
      conflicts: context.conflicts,
      recommendations: rankedTasks.slice(0, 3),
      reasoning,
      proposedAction: {
        type: 'create_task',
        payload: {
          title: entities.title,
          priority,
          category,
          due_date: entities.due_date,
          estimated_minutes: estimatedMinutes,
          next_action: nextAction
        }
      }
    };
  }

  // 3. Complete Task
  if (intent === 'complete_task') {
    const target = context.matchedTasks[0];
    if (!target) {
      return emptyQueueDecision(intent, context);
    }
    const remaining = rankedTasks.filter((r) => r.task.id !== target.id).slice(0, 2);
    return {
      actionType: 'complete_task',
      pendingIntent: null,
      needsClarification: false,
      clarificationQuestions: [],
      conflicts: context.conflicts,
      recommendations: remaining,
      reasoning: [
        `Matched "${target.title}" (#${target.id}) unambiguously.`,
        remaining[0]
          ? `Identified "${remaining[0].task.title}" as your logical follow-up task.`
          : 'Completing this clears your active queue.'
      ],
      proposedAction: {
        type: 'complete_task',
        taskId: target.id,
        taskTitle: target.title
      }
    };
  }

  // 4. Delete Task
  if (intent === 'delete_task') {
    const target = context.matchedTasks[0];
    if (!target) {
      return emptyQueueDecision(intent, context);
    }
    return {
      actionType: 'delete_task',
      pendingIntent: null,
      needsClarification: false,
      clarificationQuestions: [],
      conflicts: context.conflicts,
      recommendations: rankedTasks.filter((r) => r.task.id !== target.id).slice(0, 2),
      reasoning: [
        `Matched "${target.title}" (#${target.id}) for removal.`,
        'Recomputed remaining task priorities after removal.'
      ],
      proposedAction: {
        type: 'delete_task',
        taskId: target.id,
        taskTitle: target.title
      }
    };
  }

  // 5. Update Task
  if (intent === 'update_task') {
    const target = context.matchedTasks[0];
    if (!target) {
      return emptyQueueDecision(intent, context);
    }
    const updates = {};
    if (entities.priority) updates.priority = entities.priority;
    if (entities.category) updates.category = entities.category;
    if (entities.due_date) updates.due_date = entities.due_date;
    if (entities.estimated_minutes) updates.estimated_minutes = entities.estimated_minutes;

    if (Object.keys(updates).length === 0) {
      return {
        actionType: 'ask_clarification',
        pendingIntent: 'update_task',
        needsClarification: true,
        clarificationQuestions: [
          `What would you like to change on "${target.title}" (#${target.id}) — priority, due date, category, or duration?`
        ],
        clarificationReason: 'Target task found, but no update fields were specified.',
        conflicts: context.conflicts,
        recommendations: rankedTasks.slice(0, 2),
        reasoning: [`Matched "${target.title}", waiting on which attribute to update.`],
        proposedAction: null
      };
    }

    return {
      actionType: 'update_task',
      pendingIntent: null,
      needsClarification: false,
      clarificationQuestions: [],
      conflicts: context.conflicts,
      recommendations: rankedTasks.slice(0, 3),
      reasoning: [
        `Matched "${target.title}" (#${target.id}).`,
        `Applying updates: ${Object.entries(updates).map(([k, v]) => `${k}=${v}`).join(', ')}.`
      ],
      proposedAction: {
        type: 'update_task',
        taskId: target.id,
        taskTitle: target.title,
        updates
      }
    };
  }

  // 6. Conflict Resolution
  if (intent === 'resolve_conflict' || (intent === 'prioritize_recommend' && context.conflicts.length > 0)) {
    const tradeOffPlan = buildConflictTradeOffPlan(rankedTasks, context.effectiveProfile, context.conflicts);
    return {
      actionType: 'resolve_conflict',
      pendingIntent: null,
      needsClarification: false,
      clarificationQuestions: [],
      conflicts: context.conflicts,
      recommendations: rankedTasks.slice(0, 3),
      tradeOffPlan,
      reasoning: [
        `Evaluated ${rankedTasks.length} active tasks against ${context.effectiveProfile.availableMinutes}m budget and ${context.effectiveProfile.energyLevel} energy.`,
        context.conflicts.length > 0
          ? `Detected ${context.conflicts.length} conflict(s); generated a sequential triage plan.`
          : 'No severe conflicts detected; ordered tasks by urgency-to-effort ratio.'
      ],
      proposedAction: null
    };
  }

  // 7. Prioritization / Next Action Recommendation
  if (intent === 'prioritize_recommend') {
    return {
      actionType: 'recommend_focus',
      pendingIntent: null,
      needsClarification: false,
      clarificationQuestions: [],
      conflicts: context.conflicts,
      recommendations: rankedTasks.slice(0, 3),
      reasoning: buildFocusReasoning(rankedTasks, context),
      proposedAction: null
    };
  }

  // 8. Summary / Status
  if (intent === 'summarize_status') {
    return {
      actionType: 'provide_summary',
      pendingIntent: null,
      needsClarification: false,
      clarificationQuestions: [],
      conflicts: context.conflicts,
      recommendations: rankedTasks.slice(0, 3),
      reasoning: [
        `Aggregated ${context.taskStats.activeCount} active and ${context.taskStats.completedCount} completed tasks.`,
        context.taskStats.overdueCount > 0
          ? `Highlighted ${context.taskStats.overdueCount} overdue item(s) needing immediate review.`
          : 'All deadlines are currently on track.'
      ],
      proposedAction: null
    };
  }

  // 9. General Guidance grounded in user context
  return {
    actionType: 'respond_conversational',
    pendingIntent: null,
    needsClarification: false,
    clarificationQuestions: [],
    conflicts: context.conflicts,
    recommendations: rankedTasks.slice(0, 2),
    reasoning: [
      `Analyzed prompt with ${context.taskStats.activeCount} active tasks and "${context.effectiveProfile.focusMode}" focus mode.`,
      rankedTasks[0]
        ? `Kept top priority "${rankedTasks[0].task.title}" in context for relevant guidance.`
        : 'Task queue is currently empty.'
    ],
    proposedAction: null
  };
}

/**
 * Computes deterministic scores & explanations for active tasks.
 */
export function scoreAndRankTasks(activeTasks, profile, nowIso = new Date().toISOString()) {
  const nowMs = new Date(nowIso).getTime();
  const preferred = Array.isArray(profile.preferredCategories) ? profile.preferredCategories : [];
  const available = profile.availableMinutes || 120;
  const energy = profile.energyLevel || 'medium';
  const focusMode = profile.focusMode || 'balanced';

  return activeTasks
    .map((task) => {
      const reasons = [];
      let score = PRIORITY_WEIGHT[task.priority] ?? 18;
      reasons.push(`${task.priority} priority (+${score})`);

      // Deadline factor
      if (task.due_date) {
        const dueMs = new Date(task.due_date).getTime();
        if (!Number.isNaN(dueMs)) {
          const hoursUntilDue = (dueMs - nowMs) / (1000 * 60 * 60);
          if (hoursUntilDue < 0) {
            score += 35;
            reasons.push('overdue (+35)');
          } else if (hoursUntilDue <= 12) {
            score += 28;
            reasons.push('due within 12h (+28)');
          } else if (hoursUntilDue <= 24) {
            score += 20;
            reasons.push('due within 24h (+20)');
          } else if (hoursUntilDue <= 72) {
            score += 10;
            reasons.push('due within 3 days (+10)');
          }
        }
      }

      // Momentum
      if (task.status === 'in_progress') {
        score += 12;
        reasons.push('already in progress (+12)');
      }

      // Energy & focus fit
      const est = task.estimated_minutes || 30;
      if (energy === 'low' || focusMode === 'quick_wins') {
        if (est <= 30) {
          score += 15;
          reasons.push(`quick win ${est}m matches ${energy} energy (+15)`);
        } else if (est >= 60) {
          score -= 10;
          reasons.push(`heavy ${est}m effort penalized for ${energy} energy (-10)`);
        }
      } else if (focusMode === 'deep_work' && est >= 45) {
        score += 12;
        reasons.push('deep-work block match (+12)');
      }

      // Time budget fit
      if (est <= available) {
        score += 10;
        reasons.push(`fits ${available}m window (+10)`);
      } else {
        score -= 15;
        reasons.push(`exceeds ${available}m window (-15)`);
      }

      // Preference alignment
      if (preferred.includes(task.category)) {
        score += 8;
        reasons.push(`matches preferred "${task.category}" category (+8)`);
      }

      const nextAction =
        task.next_action && task.next_action.trim()
          ? task.next_action.trim()
          : suggestNextActionForTitle(task.title, task.category);

      return {
        task,
        score,
        nextAction,
        explanation: `Scored ${score} pts: ${reasons.join(', ')}.`,
        fitsTimeBudget: est <= available
      };
    })
    .sort((a, b) => b.score - a.score || a.task.id - b.task.id);
}

function buildConflictTradeOffPlan(rankedTasks, profile, conflicts) {
  let remainingMinutes = profile.availableMinutes || 120;
  const doNow = [];
  const defer = [];

  for (const item of rankedTasks) {
    const est = item.task.estimated_minutes || 30;
    if (doNow.length < 2 && est <= remainingMinutes) {
      doNow.push(item);
      remainingMinutes -= est;
    } else {
      defer.push(item);
    }
  }

  // If nothing fits in remainingMinutes, recommend a 20m slice of the top task
  if (doNow.length === 0 && rankedTasks[0]) {
    return {
      strategy: 'timebox_slice',
      summary: `Your top priority "${rankedTasks[0].task.title}" (${rankedTasks[0].task.estimated_minutes}m) exceeds your ${profile.availableMinutes}m window. Timebox the first ${Math.min(25, profile.availableMinutes)}m on its next step: ${rankedTasks[0].nextAction}`,
      doNowIds: [rankedTasks[0].task.id],
      deferIds: rankedTasks.slice(1).map((r) => r.task.id),
      conflictCount: conflicts.length
    };
  }

  return {
    strategy: 'sequential_triage',
    summary: `Focus on ${doNow.map((d) => `"${d.task.title}"`).join(' → ')} within your ${profile.availableMinutes}m window, and intentionally defer ${defer.length} lower-fit task(s) to reduce context switching.`,
    doNowIds: doNow.map((d) => d.task.id),
    deferIds: defer.map((d) => d.task.id),
    conflictCount: conflicts.length
  };
}

function buildFocusReasoning(rankedTasks, context) {
  if (rankedTasks.length === 0) {
    return ['No pending tasks in your queue. Ready to add a new goal or plan ahead.'];
  }
  const top = rankedTasks[0];
  return [
    `Evaluated ${rankedTasks.length} active tasks using priority, deadline proximity, and your ${context.effectiveProfile.availableMinutes}m / ${context.effectiveProfile.energyLevel}-energy context.`,
    `Top choice "${top.task.title}" scored ${top.score} pts (${top.explanation})`
  ];
}

function emptyQueueDecision(intent, context) {
  return {
    actionType: 'provide_summary',
    pendingIntent: null,
    needsClarification: false,
    clarificationQuestions: [],
    conflicts: context.conflicts,
    recommendations: [],
    reasoning: [`Cannot execute "${intent}" because there are currently no active tasks.`],
    proposedAction: null
  };
}

function inferPriorityFromContext(dueDate) {
  if (!dueDate) return 'medium';
  const hours = (new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60);
  if (hours <= 12) return 'urgent';
  if (hours <= 36) return 'high';
  return 'medium';
}

export function suggestNextActionForTitle(title, category) {
  const lower = (title || '').toLowerCase();
  if (/\b(review|audit|check)\b/.test(lower)) {
    return `Open "${title}" checklist and spend 10 minutes flagging top blockers.`;
  }
  if (/\b(prepare|draft|write|deck|report|summary)\b/.test(lower)) {
    return `Create a 3-bullet outline for "${title}" before writing full details.`;
  }
  if (/\b(fix|bug|debug|deploy|build|implement)\b/.test(lower)) {
    return `Reproduce the core requirement in a small scope and verify one passing test.`;
  }
  if (category === 'Health') {
    return `Schedule a concrete 20-30 minute time block today and set a reminder.`;
  }
  if (category === 'Finance') {
    return `Gather the latest statement or invoice first so the review takes under 15 minutes.`;
  }
  return `Break "${title}" into a 15-minute starter milestone and begin immediately.`;
}
