import { getAiStatus } from '../config/env.js';

/**
 * Stage 4: Response Generation.
 * Uses an external LLM (Gemini or OpenAI-compatible) when configured, strictly grounded in the
 * structured decision object. Transparently falls back to the deterministic rule-based generator
 * if no key is configured or if the upstream AI call fails.
 */
export async function generateAssistantResponse({
  sanitizedInput,
  intentResult,
  context,
  decision,
  executedResult,
  recentMessages,
  privacyFindings,
  config
}) {
  const aiStatus = getAiStatus(config);

  if (aiStatus.configured) {
    const candidates = [{ provider: aiStatus.activeProvider, model: aiStatus.model }];
    if (config.aiProvider === 'auto' && aiStatus.activeProvider === 'gemini' && config.openaiApiKey) {
      candidates.push({ provider: 'openai', model: config.openaiModel });
    }

    let lastError = null;
    for (const candidate of candidates) {
      try {
        const llmText = await callConfiguredLlm({
          aiStatus: { ...aiStatus, activeProvider: candidate.provider, model: candidate.model },
          config,
          sanitizedInput,
          intentResult,
          context,
          decision,
          executedResult,
          recentMessages
        });

        if (llmText && llmText.trim()) {
          return {
            content: prependPrivacyNotice(llmText.trim(), privacyFindings),
            mode: 'llm',
            provider: candidate.provider,
            model: candidate.model,
            fallbackReason: lastError ? `Primary provider failed (${lastError.message}); used secondary ${candidate.provider}.` : null
          };
        }
      } catch (err) {
        lastError = err;
      }
    }

    const fallbackText = buildRuleBasedResponse({
      sanitizedInput,
      intentResult,
      context,
      decision,
      executedResult,
      privacyFindings
    });
    return {
      content: fallbackText,
      mode: 'fallback',
      provider: 'fallback',
      model: 'rule-based-v1',
      fallbackReason: `Upstream AI service unavailable (${lastError?.message || 'empty response'}); used rule-based decision engine.`
    };
  }

  const fallbackText = buildRuleBasedResponse({
    sanitizedInput,
    intentResult,
    context,
    decision,
    executedResult,
    privacyFindings
  });

  return {
    content: fallbackText,
    mode: 'fallback',
    provider: 'fallback',
    model: 'rule-based-v1',
    fallbackReason: aiStatus.reason || 'Running in rule-based fallback mode.'
  };
}

function prependPrivacyNotice(text, privacyFindings) {
  if (!privacyFindings || privacyFindings.length === 0) return text;
  return `> Privacy Notice: Sensitive content (${privacyFindings.join(', ')}) was automatically redacted and excluded from conversation memory.\n\n${text}`;
}

async function callConfiguredLlm({
  aiStatus,
  config,
  sanitizedInput,
  intentResult,
  context,
  decision,
  executedResult,
  recentMessages
}) {
  const systemPrompt = [
    'You are SmartMate AI, a context-aware personal productivity and decision assistant.',
    'You MUST base all task facts, IDs, deadlines, and actions strictly on the provided JSON context and decision trace.',
    'NEVER invent tasks, deadlines, or facts that are not present in the context.',
    'Be concise, practical, and structured. Always explain WHY a recommendation fits the user context.',
    'If clarificationQuestions are present, ask them clearly without guessing.'
  ].join(' ');

  const groundingPayload = {
    userDisplayName: context.effectiveProfile.displayName,
    profile: context.effectiveProfile,
    taskStats: context.taskStats,
    intent: intentResult.intent,
    executedResult,
    decisionSummary: {
      actionType: decision.actionType,
      needsClarification: decision.needsClarification,
      clarificationQuestions: decision.clarificationQuestions,
      conflicts: decision.conflicts,
      tradeOffPlan: decision.tradeOffPlan || null,
      topRecommendations: decision.recommendations.map((r) => ({
        id: r.task.id,
        title: r.task.title,
        priority: r.task.priority,
        category: r.task.category,
        due_date: r.task.due_date,
        estimated_minutes: r.task.estimated_minutes,
        score: r.score,
        nextAction: r.nextAction,
        explanation: r.explanation
      }))
    },
    recentTurns: recentMessages.slice(-4).map((m) => ({ role: m.role, content: m.content }))
  };

  const userPrompt = `User message: "${sanitizedInput}"\n\nGrounded Decision Context:\n${JSON.stringify(groundingPayload, null, 2)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    if (aiStatus.activeProvider === 'gemini') {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.geminiModel)}:generateContent`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': config.geminiApiKey
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 500
          }
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Gemini HTTP ${response.status}`);
      }
      const data = await response.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    if (aiStatus.activeProvider === 'openai') {
      const response = await fetch(`${config.openaiBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.openaiApiKey}`
        },
        body: JSON.stringify({
          model: config.openaiModel,
          temperature: 0.3,
          max_tokens: 500,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ]
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`OpenAI HTTP ${response.status}`);
      }
      const data = await response.json();
      return data?.choices?.[0]?.message?.content || '';
    }

    return '';
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Deterministic rule-based response builder.
 */
export function buildRuleBasedResponse({
  sanitizedInput,
  context,
  decision,
  executedResult,
  privacyFindings
}) {
  const lines = [];
  const name = context.effectiveProfile.displayName || 'there';

  if (decision.needsClarification) {
    lines.push(`I want to make sure I act on the right details, ${name}.`);
    if (decision.clarificationReason) {
      lines.push(`**Why I'm asking:** ${decision.clarificationReason}`);
    }
    lines.push('');
    decision.clarificationQuestions.forEach((q, idx) => {
      lines.push(`${idx + 1}. ${q}`);
    });
    return prependPrivacyNotice(lines.join('\n'), privacyFindings);
  }

  if (executedResult?.type === 'task_created' && executedResult.task) {
    const t = executedResult.task;
    lines.push(`Added task **#${t.id}: ${t.title}** (${t.priority} priority · ${t.category} · ~${t.estimated_minutes}m${t.due_date ? ` · due ${t.due_date.replace('T', ' ')}` : ''}).`);
    lines.push(`**Suggested next step:** ${t.next_action}`);
  } else if (executedResult?.type === 'task_completed' && executedResult.task) {
    const t = executedResult.task;
    lines.push(`Marked **#${t.id}: ${t.title}** as completed.`);
    if (decision.recommendations[0]) {
      const next = decision.recommendations[0];
      lines.push(`**Recommended next focus:** ${next.task.title} (${next.explanation})`);
      lines.push(`**Next action:** ${next.nextAction}`);
    } else {
      lines.push('Your active task queue is now clear.');
    }
  } else if (executedResult?.type === 'task_deleted') {
    lines.push(`Removed task **#${executedResult.taskId}: ${executedResult.taskTitle}** from your workspace.`);
  } else if (executedResult?.type === 'task_updated' && executedResult.task) {
    const t = executedResult.task;
    lines.push(`Updated **#${t.id}: ${t.title}** — now ${t.priority} priority, ${t.category}, status: ${t.status}.`);
  } else if (decision.actionType === 'resolve_conflict') {
    lines.push(`Here is a context-aware trade-off plan for your **${context.effectiveProfile.availableMinutes}-minute** window (${context.effectiveProfile.energyLevel} energy):`);
    if (decision.conflicts.length > 0) {
      lines.push('');
      lines.push('**Detected Conflicts:**');
      decision.conflicts.forEach((c) => lines.push(`- ${c.description}`));
    }
    if (decision.tradeOffPlan) {
      lines.push('');
      lines.push(`**Recommended Resolution:** ${decision.tradeOffPlan.summary}`);
    }
  } else if (decision.actionType === 'recommend_focus') {
    if (decision.recommendations.length === 0) {
      lines.push(`You currently have no active tasks, ${name}. Tell me what you need to get done and I will prioritize it for you.`);
    } else {
      const top = decision.recommendations[0];
      lines.push(`Based on your **${context.effectiveProfile.focusMode.replace('_', ' ')}** mode, **${context.effectiveProfile.energyLevel}** energy, and **${context.effectiveProfile.availableMinutes}m** availability, start with **${top.task.title}**.`);
      lines.push(`- **Why it fits:** ${top.explanation}`);
      lines.push(`- **Next action:** ${top.nextAction}`);
      if (decision.recommendations.length > 1) {
        lines.push('');
        lines.push('**Runner-up options:**');
        decision.recommendations.slice(1).forEach((rec) => {
          lines.push(`- **${rec.task.title}** (${rec.score} pts): ${rec.nextAction}`);
        });
      }
    }
  } else if (decision.actionType === 'provide_summary') {
    const s = context.taskStats;
    lines.push(`Here is your current workspace snapshot, ${name}:`);
    lines.push(`- **Active tasks:** ${s.activeCount} (${s.urgentOrHighCount} urgent/high, ${s.overdueCount} overdue, ${s.dueSoonCount} due within 24h)`);
    lines.push(`- **Completed tasks:** ${s.completedCount}`);
    lines.push(`- **Estimated active workload:** ${s.totalActiveMinutes} minutes vs. ${context.effectiveProfile.availableMinutes} minutes available`);
    if (decision.recommendations[0]) {
      lines.push(`- **Top recommended focus:** ${decision.recommendations[0].task.title} — ${decision.recommendations[0].nextAction}`);
    }
  } else {
    // Conversational fallback grounded in actual context
    const isGreeting = /^(hi|hello|hey|good morning|good afternoon|good evening)\b/i.test(sanitizedInput);
    if (isGreeting) {
      lines.push(`Hello ${name}! You have **${context.taskStats.activeCount} active task(s)** (${context.taskStats.urgentOrHighCount} urgent/high).`);
    } else {
      lines.push(`I analyzed your message in the context of your **${context.taskStats.activeCount} active task(s)** and **${context.effectiveProfile.focusMode.replace('_', ' ')}** focus preference.`);
    }
    if (decision.recommendations[0]) {
      lines.push(`Right now, your highest-impact item is **${decision.recommendations[0].task.title}** (${decision.recommendations[0].explanation}).`);
      lines.push(`**Suggested next step:** ${decision.recommendations[0].nextAction}`);
    }
    lines.push('You can ask me to add/complete tasks, resolve priority conflicts, or suggest what to tackle next.');
  }

  if (decision.conflicts.length > 0 && decision.actionType !== 'resolve_conflict') {
    lines.push('');
    lines.push(`**Heads-up:** ${decision.conflicts[0].description}`);
  }

  return prependPrivacyNotice(lines.join('\n'), privacyFindings);
}
