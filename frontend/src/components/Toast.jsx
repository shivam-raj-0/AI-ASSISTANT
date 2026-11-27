import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

const STYLES = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/90 dark:border-emerald-800 dark:text-emerald-100',
  error: 'bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950/90 dark:border-rose-800 dark:text-rose-100',
  info: 'bg-indigo-50 border-indigo-200 text-indigo-900 dark:bg-indigo-950/90 dark:border-indigo-800 dark:text-indigo-100'
};

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info
};

export function Toast({ toast, onDismiss }) {
  if (!toast) return null;
  const Icon = ICONS[toast.type] || Info;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-4 right-4 z-50 flex max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-lg animate-fade-slide ${STYLES[toast.type] || STYLES.info}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="text-sm font-medium leading-snug">{toast.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="ml-1 rounded-md p-0.5 opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
