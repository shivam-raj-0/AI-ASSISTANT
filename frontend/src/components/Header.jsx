import { Menu, Moon, Plus, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';

const VIEW_META = {
  chat: {
    title: 'Intelligent Assistant',
    subtitle: 'Context-aware intent detection, decision reasoning, and task actions'
  },
  dashboard: {
    title: 'Smart Dashboard',
    subtitle: 'Real-time overview of priorities, workload capacity, and insights'
  },
  tasks: {
    title: 'Smart Task Management',
    subtitle: 'Prioritize, categorize, and track actionable next steps'
  },
  recommendations: {
    title: 'Actionable Recommendations',
    subtitle: 'Explained rankings tuned to your urgency, energy, and time budget'
  },
  context: {
    title: 'Context & Conversation Memory',
    subtitle: 'Configure personal focus preferences, privacy protections, and chat history'
  }
};

export function Header({ activeTab, userContext, onOpenMobileMenu, onNewTask }) {
  const { theme, toggleTheme } = useTheme();
  const meta = VIEW_META[activeTab] || VIEW_META.chat;

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 py-3.5 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/90 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{meta.title}</h2>
          <p className="hidden text-xs text-slate-500 dark:text-slate-400 sm:block">{meta.subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {userContext && (
          <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300 md:flex">
            <span className="font-medium capitalize">{userContext.focusMode.replace('_', ' ')}</span>
            <span className="text-slate-300 dark:text-slate-600">•</span>
            <span className="capitalize">{userContext.energyLevel} energy</span>
            <span className="text-slate-300 dark:text-slate-600">•</span>
            <span>{userContext.availableMinutes}m budget</span>
          </div>
        )}

        <button
          type="button"
          onClick={onNewTask}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
        >
          <Plus className="h-4 w-4" />
          <span>New Task</span>
        </button>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    </header>
  );
}
