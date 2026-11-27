import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, GitBranch, Play, Sparkles } from 'lucide-react';

export function DecisionTraceCard({ decision, mode, onApplyTask, onQuickReply }) {
  const [expanded, setExpanded] = useState(false);
  if (!decision) return null;

  const isLlm = mode === 'llm';
  const conflicts = decision.conflicts || [];
  const recommendations = decision.recommendations || [];
  const clarifications = decision.clarificationQuestions || [];

  return (
    <div className="mt-2.5 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs dark:border-slate-700/80 dark:bg-slate-900/70">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold ${
              isLlm
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
            }`}
          >
            <Sparkles className="h-3 w-3" />
            {isLlm ? `AI (${decision.provider || 'llm'})` : 'Rule-Based Fallback'}
          </span>

          <span className="inline-flex items-center gap-1 rounded-md bg-indigo-100/80 px-2 py-0.5 font-medium text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
            <GitBranch className="h-3 w-3" />
            {decision.intent || 'general'} ({Math.round((decision.confidence || 0.7) * 100)}%)
          </span>

          {conflicts.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 px-2 py-0.5 font-medium text-rose-800 dark:bg-rose-950 dark:text-rose-300">
              <AlertTriangle className="h-3 w-3" />
              {conflicts.length} conflict{conflicts.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-slate-600 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <span>{expanded ? 'Hide reasoning' : 'Why this decision'}</span>
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {decision.fallbackReason && (
        <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          {decision.fallbackReason}
        </p>
      )}

      {clarifications.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {clarifications.map((question, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onQuickReply?.(question)}
              className="rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-left text-[11px] font-medium text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:bg-slate-800 dark:text-indigo-300 dark:hover:bg-indigo-950"
            >
              Clarify: {question}
            </button>
          ))}
        </div>
      )}

      {expanded && (
        <div className="mt-2.5 space-y-2 border-t border-slate-200 pt-2.5 dark:border-slate-700/80">
          {decision.reasoning?.length > 0 && (
            <div>
              <p className="font-semibold text-slate-700 dark:text-slate-200">Decision Pipeline Reasoning</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-slate-600 dark:text-slate-400">
                {decision.reasoning.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ul>
            </div>
          )}

          {conflicts.length > 0 && (
            <div>
              <p className="font-semibold text-rose-700 dark:text-rose-300">Detected Conflicts</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-slate-600 dark:text-slate-400">
                {conflicts.map((c, i) => (
                  <li key={i}>{c.description}</li>
                ))}
              </ul>
            </div>
          )}

          {recommendations.length > 0 && (
            <div>
              <p className="font-semibold text-slate-700 dark:text-slate-200">Top Ranked Actions</p>
              <div className="mt-1.5 space-y-1.5">
                {recommendations.slice(0, 2).map((rec) => (
                  <div
                    key={rec.task.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800 dark:text-slate-100">
                        {rec.task.title} <span className="text-indigo-600 dark:text-indigo-400">({rec.score} pts)</span>
                      </p>
                      <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{rec.nextAction}</p>
                    </div>
                    {rec.task.status !== 'in_progress' && (
                      <button
                        type="button"
                        onClick={() => onApplyTask?.(rec.task.id, 'start')}
                        className="inline-flex shrink-0 items-center gap-1 rounded-md bg-indigo-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-indigo-500"
                      >
                        <Play className="h-3 w-3" />
                        Start
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
