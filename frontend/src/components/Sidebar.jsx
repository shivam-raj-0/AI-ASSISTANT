import {
  BrainCircuit,
  CheckSquare,
  Cpu,
  LayoutDashboard,
  MessageSquareText,
  Sparkles,
  X
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'chat', label: 'Assistant Chat', icon: MessageSquareText },
  { id: 'dashboard', label: 'Smart Dashboard', icon: LayoutDashboard },
  { id: 'tasks', label: 'Smart Tasks', icon: CheckSquare },
  { id: 'recommendations', label: 'Recommendations', icon: Sparkles },
  { id: 'context', label: 'Context & Memory', icon: BrainCircuit }
];

export function Sidebar({ activeTab, onSelectTab, aiStatus, taskStats, mobileOpen, onCloseMobile }) {
  const isLlm = aiStatus?.configured && aiStatus?.activeProvider !== 'fallback';

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Main navigation"
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                SmartMate AI
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Context-Aware Assistant</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close sidebar"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectTab(item.id);
                  onCloseMobile();
                }}
                aria-current={active ? 'page' : undefined}
                className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  active
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-100'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </span>
                {item.id === 'tasks' && taskStats && (
                  <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {taskStats.activeCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-4 dark:border-slate-800">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Engine Mode
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  isLlm
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${isLlm ? 'bg-emerald-500' : 'bg-amber-500'}`}
                />
                {isLlm ? `LLM (${aiStatus.activeProvider})` : 'Rule-Based Fallback'}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">
              {isLlm
                ? `Model: ${aiStatus.model}`
                : 'No API key required. Running transparent 6-stage decision logic.'}
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
