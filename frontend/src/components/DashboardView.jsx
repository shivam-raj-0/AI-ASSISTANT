import { AlertTriangle, ArrowRight, CheckCircle2, Clock, Flame, ListTodo, Play } from 'lucide-react';

export function DashboardView({
  dashboard,
  tasks = [],
  loading,
  onNavigate,
  onApplyRecommendation,
  onUpdateTask
}) {
  if (loading && !dashboard) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
        ))}
      </div>
    );
  }

  const stats = dashboard?.stats || {
    activeCount: 0,
    completedCount: 0,
    overdueCount: 0,
    urgentOrHighCount: 0,
    totalActiveMinutes: 0,
    completionRate: 0
  };
  const conflicts = dashboard?.conflicts || [];
  const recommendations = dashboard?.recommendations || [];
  const categoryBreakdown = dashboard?.categoryBreakdown || {};
  const recentActivity = dashboard?.recentActivity || [];
  const topRec = recommendations[0];

  return (
    <div className="space-y-6 animate-fade-slide">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active Tasks"
          value={stats.activeCount}
          subtext={`${stats.urgentOrHighCount} urgent/high priority`}
          icon={ListTodo}
          tone="indigo"
        />
        <StatCard
          label="Completion Rate"
          value={`${stats.completionRate}%`}
          subtext={`${stats.completedCount} completed`}
          icon={CheckCircle2}
          tone="emerald"
        />
        <StatCard
          label="Active Workload"
          value={`${stats.totalActiveMinutes}m`}
          subtext={`vs ${dashboard?.profile?.availableMinutes || 120}m budget`}
          icon={Clock}
          tone="amber"
        />
        <StatCard
          label="Urgency Alerts"
          value={stats.overdueCount + stats.dueSoonCount}
          subtext={`${stats.overdueCount} overdue • ${stats.dueSoonCount || 0} due <24h`}
          icon={Flame}
          tone={stats.overdueCount > 0 ? 'rose' : 'slate'}
        />
      </div>

      {conflicts.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4 dark:border-amber-900/70 dark:bg-amber-950/40">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                Context Conflict Detected ({conflicts.length})
              </h3>
              <ul className="mt-1 space-y-1 text-xs text-amber-800 dark:text-amber-300">
                {conflicts.map((c, idx) => (
                  <li key={idx}>• {c.description}</li>
                ))}
              </ul>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('chat')}
              className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500"
            >
              Resolve in Chat
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              SmartMate Top Focus Recommendation
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('recommendations')}
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
            >
              All rankings <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {topRec ? (
            <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/30">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-indigo-600 px-2 py-0.5 text-[11px] font-bold text-white">
                      Score {topRec.score}
                    </span>
                    <span className="text-xs font-medium uppercase text-indigo-700 dark:text-indigo-300">
                      {topRec.task.priority} • {topRec.task.category} • ~{topRec.task.estimated_minutes}m
                    </span>
                  </div>
                  <h4 className="mt-2 text-base font-semibold text-slate-900 dark:text-white">
                    {topRec.task.title}
                  </h4>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{topRec.explanation}</p>
                  <p className="mt-2 text-xs font-medium text-indigo-800 dark:text-indigo-200">
                    Next Action: {topRec.nextAction}
                  </p>
                </div>

                <div className="flex gap-2">
                  {topRec.task.status !== 'in_progress' && (
                    <button
                      type="button"
                      onClick={() => onApplyRecommendation(topRec.task.id, 'start')}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
                    >
                      <Play className="h-3.5 w-3.5" /> Start Focus
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onApplyRecommendation(topRec.task.id, 'complete')}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-slate-800 dark:text-emerald-300"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Mark Done
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
              No pending tasks! Create a task or ask SmartMate in chat to plan your next goal.
            </div>
          )}

          <h4 className="mt-6 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Category Distribution
          </h4>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {Object.keys(categoryBreakdown).length === 0 ? (
              <p className="text-xs text-slate-500">No tasks categorized yet.</p>
            ) : (
              Object.entries(categoryBreakdown).map(([cat, info]) => {
                const pct = info.total > 0 ? Math.round((info.completed / info.total) * 100) : 0;
                return (
                  <div
                    key={cat}
                    className="rounded-xl border border-slate-200 p-3 dark:border-slate-800"
                  >
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span>{cat}</span>
                      <span className="text-slate-500 dark:text-slate-400">
                        {info.completed}/{info.total} done
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-indigo-600 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Recent Activity</h3>
          <div className="mt-4 space-y-3">
            {recentActivity.length === 0 ? (
              <p className="text-xs text-slate-500">No activity recorded yet.</p>
            ) : (
              recentActivity.slice(0, 8).map((item) => (
                <div
                  key={item.id}
                  className="border-l-2 border-indigo-200 pl-3 text-xs dark:border-indigo-800"
                >
                  <p className="font-medium text-slate-800 dark:text-slate-200">{item.summary}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {new Date(item.created_at).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Pending &amp; Active Tasks ({tasks.filter((t) => t.status !== 'completed').length})
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('tasks')}
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
            >
              Manage all <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {tasks.filter((t) => t.status !== 'completed').length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-500">All caught up! No pending tasks.</p>
            ) : (
              tasks
                .filter((t) => t.status !== 'completed')
                .slice(0, 5)
                .map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-800"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800 dark:text-slate-100">{task.title}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="uppercase font-semibold">{task.priority}</span> • {task.category} • {task.estimated_minutes}m
                      </p>
                    </div>
                    {onUpdateTask && (
                      <button
                        type="button"
                        onClick={() => onUpdateTask(task.id, { status: 'completed' })}
                        className="shrink-0 rounded-lg border border-emerald-200 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-300 dark:hover:bg-emerald-950"
                      >
                        Done
                      </button>
                    )}
                  </div>
                ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Completed Tasks ({tasks.filter((t) => t.status === 'completed').length})
            </h3>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              {stats.completionRate}% completion
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {tasks.filter((t) => t.status === 'completed').length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-500">No completed tasks yet.</p>
            ) : (
              tasks
                .filter((t) => t.status === 'completed')
                .slice(0, 5)
                .map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-slate-50/70 px-3 py-2 text-xs dark:border-slate-800/70 dark:bg-slate-950/40"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                      <p className="truncate text-slate-600 line-through dark:text-slate-400">{task.title}</p>
                    </div>
                    <span className="shrink-0 text-[11px] text-slate-400">{task.category}</span>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, subtext, icon: Icon, tone }) {
  const tones = {
    indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300',
    rose: 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300',
    slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
        <div className={`rounded-xl p-2 ${tones[tone] || tones.indigo}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtext}</p>
    </div>
  );
}
