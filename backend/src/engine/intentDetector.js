const PRIORITY_KEYWORDS = [
  { level: 'urgent', pattern: /\b(urgent|asap|immediately|critical|emergency|right now|p0)\b/i },
  { level: 'high', pattern: /\b(high priority|important|priority|crucial|must|p1)\b/i },
  { level: 'low', pattern: /\b(low priority|whenever|someday|minor|optional|p3)\b/i }
];

const CATEGORY_KEYWORDS = [
  { category: 'Health', pattern: /\b(workout|gym|run|exercise|doctor|health|sleep|meditate|yoga|cardio|mobility|walk)\b/i },
  { category: 'Finance', pattern: /\b(budget|tax|invoice|bill|bank|finance|expense|spending|payment|salary|invest)\b/i },
  { category: 'Learning', pattern: /\b(study|learn|course|read|book|tutorial|practice|research|lecture|exam)\b/i },
  { category: 'Errands', pattern: /\b(groceries|shop|buy|clean|laundry|errand|mail|pack|repair|pickup)\b/i },
  { category: 'Personal', pattern: /\b(family|friend|birthday|dinner|call mom|call dad|vacation|trip|home|personal)\b/i },
  { category: 'Work', pattern: /\b(meeting|report|deck|deploy|code|bug|pr|review|client|sprint|roadmap|email|project|deadline|presentation)\b/i }
];

/**
 * Stage 1: Intent Detection & Entity Extraction.
 * Identifies the user's primary intent, extracted entities, and situational constraints.
 */
export function detectIntent(rawInput, recentMessages = []) {
  const text = (rawInput || '').trim();
  const lower = text.toLowerCase();

  // Check if the previous assistant turn asked a clarification question
  const lastAssistant = [...recentMessages].reverse().find((m) => m.role === 'assistant');
  const awaitingClarification = Boolean(lastAssistant?.decision?.needsClarification);

  const entities = extractEntities(text);
  const constraints = extractConstraints(text);

  // 1. Explicit task completion
  if (
    /\b(mark|set|flag)\b.*\b(done|complete|completed|finished)\b/i.test(text) ||
    /^(complete|finish|done with)\b/i.test(lower) ||
    /\bi (finished|completed)\b/i.test(lower)
  ) {
    return {
      intent: 'complete_task',
      confidence: 0.9,
      entities: { ...entities, taskQuery: extractTaskTarget(text, ['mark', 'complete', 'finish', 'done with', 'finished', 'completed', 'as done', 'done']) },
      constraints
    };
  }

  // 2. Explicit task deletion
  if (/^(delete|remove|cancel|drop)\b/i.test(lower) || /\b(delete|remove)\s+(the\s+)?task\b/i.test(lower)) {
    return {
      intent: 'delete_task',
      confidence: 0.88,
      entities: { ...entities, taskQuery: extractTaskTarget(text, ['delete', 'remove', 'cancel', 'drop', 'task']) },
      constraints
    };
  }

  // 3. Explicit task update (priority, due date, status)
  if (
    /\b(change|update|move|reschedule|set)\b.*\b(priority|due|deadline|status|category|to urgent|to high|to medium|to low|in progress)\b/i.test(lower)
  ) {
    return {
      intent: 'update_task',
      confidence: 0.84,
      entities: { ...entities, taskQuery: extractTaskTarget(text, ['change', 'update', 'move', 'reschedule', 'set', 'priority', 'of', 'to', 'urgent', 'high', 'medium', 'low']) },
      constraints
    };
  }

  // 4. Explicit task creation
  if (
    /^(add|create|new|remind me|schedule|todo)\b/i.test(lower) ||
    /\b(add a task|create a task|create task|add task|remind me to|i need to|need to finish|have to finish)\b/i.test(lower)
  ) {
    const title = extractNewTaskTitle(text);
    return {
      intent: 'create_task',
      confidence: title ? 0.92 : 0.65,
      entities: { ...entities, title },
      constraints
    };
  }

  // 5. Conflict / overload resolution
  if (
    /\b(conflict|overwhelmed|too many|too much|choose between|both are|trade-?off|competing|can't do both|cannot do both)\b/i.test(lower)
  ) {
    return {
      intent: 'resolve_conflict',
      confidence: 0.9,
      entities,
      constraints
    };
  }

  // 6. Prioritization / next action recommendation
  if (
    /\b(what should i|next action|next task|prioritize|top priority|highest priority|focus on|recommend|plan my|what's urgent|whats urgent|most important|best use of my time)\b/i.test(lower)
  ) {
    return {
      intent: 'prioritize_recommend',
      confidence: 0.91,
      entities,
      constraints
    };
  }

  // 7. Summary / status check
  if (
    /\b(summary|summarize|overview|status|progress|how am i doing|pending tasks|completed tasks|dashboard|workload)\b/i.test(lower)
  ) {
    return {
      intent: 'summarize_status',
      confidence: 0.89,
      entities,
      constraints
    };
  }

  // 8. Follow-up response when previous turn asked for clarification
  if (awaitingClarification && text.length >= 2) {
    const prevIntent = lastAssistant.decision?.pendingIntent;
    if (prevIntent === 'create_task') {
      return {
        intent: 'create_task',
        confidence: 0.85,
        entities: { ...entities, title: extractNewTaskTitle(text) },
        constraints
      };
    }
    if (prevIntent === 'complete_task' || prevIntent === 'delete_task' || prevIntent === 'update_task') {
      return {
        intent: prevIntent,
        confidence: 0.82,
        entities: { ...entities, taskQuery: text },
        constraints
      };
    }
  }

  // 9. Vague / underspecified inputs
  if (
    text.length < 4 ||
    /^(help|hi|hello|hey|fix it|do it|do that|help me|plan|something|task|update|change it)\.?$/i.test(lower)
  ) {
    const isGreeting = /^(hi|hello|hey|good morning|good afternoon|good evening)\b/i.test(lower);
    return {
      intent: isGreeting ? 'general_guidance' : 'ambiguous_request',
      confidence: isGreeting ? 0.85 : 0.45,
      entities,
      constraints
    };
  }

  return {
    intent: 'general_guidance',
    confidence: 0.72,
    entities,
    constraints
  };
}

function extractEntities(text) {
  let priority = null;
  for (const item of PRIORITY_KEYWORDS) {
    if (item.pattern.test(text)) {
      priority = item.level;
      break;
    }
  }

  let category = null;
  for (const item of CATEGORY_KEYWORDS) {
    if (item.pattern.test(text)) {
      category = item.category;
      break;
    }
  }

  const dueDate = extractDueDate(text);
  const estimatedMinutes = extractEstimatedMinutes(text);

  return {
    priority,
    category,
    due_date: dueDate,
    estimated_minutes: estimatedMinutes
  };
}

function extractConstraints(text) {
  const constraints = {};

  const timeMatch = text.match(/\b(?:only\s+have|only|have|in|within|got)\s+(\d+)\s*(min|mins|minutes|hr|hrs|hour|hours)\b/i);
  if (timeMatch) {
    const num = Number.parseInt(timeMatch[1], 10);
    const unit = timeMatch[2].toLowerCase();
    constraints.availableMinutes = unit.startsWith('h') ? num * 60 : num;
  }

  if (/\b(tired|exhausted|low energy|burnout|drained|sleepy)\b/i.test(text)) {
    constraints.energyLevel = 'low';
  } else if (/\b(energized|high energy|focused|sharp|ready)\b/i.test(text)) {
    constraints.energyLevel = 'high';
  }

  if (/\b(quick win|quick wins|small tasks|easy)\b/i.test(text)) {
    constraints.focusMode = 'quick_wins';
  } else if (/\b(deep work|deep focus|uninterrupted)\b/i.test(text)) {
    constraints.focusMode = 'deep_work';
  }

  return constraints;
}

function extractEstimatedMinutes(text) {
  const scrubbed = text.replace(/\b(?:only\s+have|only|have|within|got)\s+\d+\s*(?:min|mins|minutes|hr|hrs|hour|hours)\b/gi, '');
  const match = scrubbed.match(/\b(\d+)\s*(min|mins|minutes|hr|hrs|hour|hours)\b/i);
  if (!match) return null;
  const num = Number.parseInt(match[1], 10);
  return match[2].toLowerCase().startsWith('h') ? num * 60 : num;
}

function extractDueDate(text) {
  const now = new Date();
  const isoMatch = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoMatch) {
    return `${isoMatch[1]}T17:00`;
  }
  if (/\b(today|tonight|this evening)\b/i.test(text)) {
    const d = new Date(now);
    d.setHours(18, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  }
  if (/\btomorrow\b/i.test(text)) {
    const d = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    d.setHours(17, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  }
  if (/\bnext week\b/i.test(text)) {
    const d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    d.setHours(17, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  }
  const inDays = text.match(/\bin\s+(\d+)\s+days?\b/i);
  if (inDays) {
    const days = Number.parseInt(inDays[1], 10);
    const d = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    d.setHours(17, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  }
  return null;
}

function extractNewTaskTitle(text) {
  let cleaned = text
    .replace(/^(please\s+)?(add|create|new|schedule)\s+(an?\s+)?(new\s+)?((?:urgent|high|medium|low)(?:\s+priority)?\s+)?(task|todo|reminder)(\s+to|\s*:)?/i, '')
    .replace(/^(please\s+)?remind\s+me\s+to\s+/i, '')
    .replace(/^i\s+(need|have|want)\s+to\s+/i, '')
    .replace(/\b(with\s+)?(urgent|high|medium|low)\s+priority\b/gi, '')
    .replace(/\bpriority\s*[:=]?\s*(urgent|high|medium|low)\b/gi, '')
    .replace(/\b(today|tonight|tomorrow|next week|asap|immediately)\b/gi, '')
    .replace(/\b(by|due|on)\s+\d{4}-\d{2}-\d{2}\b/gi, '')
    .replace(/\b(?:takes?|for|about)?\s*\d+\s*(min|mins|minutes|hr|hrs|hour|hours)\b/gi, '')
    .replace(/\bin\s+(work|personal|health|learning|finance|errands)\s*(category)?\b/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,.:;-]+|[\s,.:;-]+$/g, '');

  return cleanTitleCandidate(cleaned);
}

function cleanTitleCandidate(candidate) {
  const trimmed = (candidate || '').trim();
  if (!trimmed || trimmed.length < 2) return '';
  if (/^(task|something|it|this|that|a task|new task)$/i.test(trimmed)) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function extractTaskTarget(text, stopWords) {
  let cleaned = text;
  for (const word of stopWords) {
    cleaned = cleaned.replace(new RegExp(`\\b${word}\\b`, 'gi'), ' ');
  }
  cleaned = cleaned
    .replace(/\b(the|my|a|an|task|as|please|to)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned;
}
