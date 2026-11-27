import { AlertTriangle, CheckCircle2, Play, RefreshCw, Sparkles } from 'lucide-react';

export function RecommendationsView({ data, loading, onRefresh, onApply }) {
  const recommendations = data?.recommendations || [];
  const conflicts = data?.conflicts || [];
  const profile = data?.profile;

  return (
    <div className="space-y-5 animate-fade-slide">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Decision Engine Priority Queue
          </h3>
          {profile && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Scored for <strong className="capitalize">{profile.focusMode.replace('_', ' ')}</strong> mode,{' '}
              <strong>{profile.energyLevel}</strong> energy, and <strong>{profile.availableMinutes}m</strong> available.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Recompute
        </button>
      </div>

      {conflicts.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4" />
            Active Scheduling & Priority Conflicts
          </div>
          <ul className="mt-2 space-y-1 text-xs text-amber-800 dark:text-amber-300">
            {conflicts.map((c, idx) => (
              <li key={idx}>• {c.description}</li>
            ))}
          </ul>
        </div>
      )}

      {recommendations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
          <Sparkles className="mx-auto h-7 w-7 text-indigo-500" />
          <p className="mt-2 text-sm font-medium">No active tasks to recommend right now.</p>
          <p className="mt-1 text-xs text-slate-500">Add a task to see scored, context-aware recommendations.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recommendations.map((rec, index) => (
            <div
              key={rec.task.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex-1 min-w-[240px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                      {index + 1}
                    </span>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                      {rec.task.title}
                    </h4>
                    <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                      {rec.score} pts
                    </span>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                        rec.fitsTimeBudget
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                      }`}
                    >
                      {rec.fitsTimeBudget ? 'Fits time budget' : 'Exceeds current budget'}
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                    <strong className="text-slate-700 dark:text-slate-300">Why recommended:</strong>{' '}
                    {rec.explanation}
                  </p>
                  <p className="mt-1 text-xs text-indigo-700 dark:text-indigo-300">
                    <strong>Next action:</strong> {rec.nextAction}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {rec.task.status !== 'in_progress' && (
                    <button
                      type="button"
                      onClick={() => onApply(rec.task.id, 'start')}
                      className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
                    >
                      <Play className="h-3.5 w-3.5" /> Start
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onApply(rec.task.id, 'complete')}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-emerald-950"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
