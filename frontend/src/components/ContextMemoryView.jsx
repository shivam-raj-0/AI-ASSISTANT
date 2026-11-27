import { useEffect, useState } from 'react';
import { Save, Shield, Trash2 } from 'lucide-react';

const ALL_CATEGORIES = ['Work', 'Personal', 'Health', 'Learning', 'Finance', 'Errands'];

export function ContextMemoryView({ userContext, messages, onSaveContext, onClearMemory }) {
  const [form, setForm] = useState({
    displayName: 'User',
    focusMode: 'balanced',
    energyLevel: 'medium',
    availableMinutes: 120,
    preferredCategories: ['Work', 'Learning']
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (userContext) {
      setForm({
        displayName: userContext.displayName || 'User',
        focusMode: userContext.focusMode || 'balanced',
        energyLevel: userContext.energyLevel || 'medium',
        availableMinutes: userContext.availableMinutes || 120,
        preferredCategories: userContext.preferredCategories || []
      });
    }
  }, [userContext]);

  const toggleCategory = (cat) => {
    setForm((prev) => {
      const exists = prev.preferredCategories.includes(cat);
      return {
        ...prev,
        preferredCategories: exists
          ? prev.preferredCategories.filter((c) => c !== cat)
          : [...prev.preferredCategories, cat]
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSaveContext({
        ...form,
        availableMinutes: Number(form.availableMinutes) || 120
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2 animate-fade-slide">
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Personal Decision Context Profile
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            SmartMate uses these live preferences to score tasks, detect overload conflicts, and personalize recommendations.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
            Display Name
          </label>
          <input
            type="text"
            value={form.displayName}
            maxLength={50}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Focus Mode
            </label>
            <select
              value={form.focusMode}
              onChange={(e) => setForm({ ...form, focusMode: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="balanced">Balanced</option>
              <option value="deep_work">Deep Work</option>
              <option value="quick_wins">Quick Wins</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Energy Level
            </label>
            <select
              value={form.energyLevel}
              onChange={(e) => setForm({ ...form, energyLevel: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Time Budget (min)
            </label>
            <input
              type="number"
              min={10}
              max={720}
              value={form.availableMinutes}
              onChange={(e) => setForm({ ...form, availableMinutes: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
        </div>

        <div>
          <span className="block text-xs font-medium text-slate-700 dark:text-slate-300">
            Preferred Focus Categories (+8 priority boost)
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {ALL_CATEGORIES.map((cat) => {
              const selected = form.preferredCategories.includes(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                    selected
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950 dark:text-indigo-300'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Context Preferences'}
        </button>
      </form>

      <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Conversation Memory ({messages.length} turns)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Review or purge stored session messages at any time.
            </p>
          </div>
          <button
            type="button"
            onClick={onClearMemory}
            disabled={messages.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-40 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear History
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
          <Shield className="h-4 w-4 shrink-0" />
          <span>API keys, passwords, bearer tokens, SSNs, and card numbers are automatically scrubbed before saving.</span>
        </div>

        <div className="mt-4 max-h-72 flex-1 space-y-2 overflow-y-auto pr-1">
          {messages.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-500">Conversation memory is empty.</p>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-950/60"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span className="font-semibold uppercase">{m.role}</span>
                  <span>{new Date(m.created_at).toLocaleTimeString()}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-slate-700 dark:text-slate-300">
                  {String(m.content || '').replace(/\*\*([^*]+)\*\*/g, '$1')}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
