import { useState } from 'react';
import { Calendar, CheckCircle2, Circle, Clock, Edit3, Play, Plus, Search, Trash2 } from 'lucide-react';

const PRIORITY_BADGE = {
  urgent: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
  high: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  medium: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300',
  low: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
};

export function TasksView({ tasks, loading, onCreateClick, onEditTask, onUpdateTask, onDeleteTask }) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filtered = tasks.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    if (normalizedQuery) {
      const hay = `${t.title} ${t.description || ''} ${t.category} ${t.next_action || ''}`.toLowerCase();
      if (!hay.includes(normalizedQuery)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4 animate-fade-slide">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-2">
          {['all', 'pending', 'in_progress', 'completed'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium capitalize transition ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              aria-label="Search tasks"
              className="w-40 rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-2.5 text-xs focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            aria-label="Filter by priority"
            className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="all">All Priorities</option>
            {['urgent', 'high', 'medium', 'low'].map((p) => (
              <option key={p} value={p}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filter by category"
            className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="all">All Categories</option>
            {['Work', 'Personal', 'Health', 'Learning', 'Finance', 'Errands'].map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={onCreateClick}
            className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No tasks match this filter.</p>
          <p className="mt-1 text-xs text-slate-500">Create a new task or adjust filters above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((task) => {
            const isCompleted = task.status === 'completed';
            const isOverdue = !isCompleted && task.due_date && new Date(task.due_date).getTime() < Date.now();
            return (
              <div
                key={task.id}
                className={`rounded-2xl border bg-white p-4 transition dark:bg-slate-900 ${
                  isCompleted
                    ? 'border-slate-200/70 opacity-75 dark:border-slate-800/70'
                    : 'border-slate-200 shadow-sm dark:border-slate-800'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateTask(task.id, { status: isCompleted ? 'pending' : 'completed' })
                      }
                      aria-label={isCompleted ? `Mark ${task.title} pending` : `Mark ${task.title} completed`}
                      className="mt-0.5 text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                    >
                      {isCompleted ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Circle className="h-5 w-5" />}
                    </button>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-mono text-slate-400">#{task.id}</span>
                        <h4
                          className={`text-sm font-semibold ${
                            isCompleted ? 'line-through text-slate-500' : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {task.title}
                        </h4>
                        <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase ${PRIORITY_BADGE[task.priority]}`}>
                          {task.priority}
                        </span>
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {task.category}
                        </span>
                        {task.status === 'in_progress' && (
                          <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                            In Progress
                          </span>
                        )}
                        {isOverdue && (
                          <span className="rounded-md bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                            Overdue
                          </span>
                        )}
                      </div>

                      {task.description && (
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{task.description}</p>
                      )}

                      {task.next_action && !isCompleted && (
                        <p className="mt-1.5 text-xs text-indigo-700 dark:text-indigo-300">
                          <span className="font-semibold">Next action:</span> {task.next_action}
                        </p>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" /> {task.estimated_minutes}m
                        </span>
                        {task.due_date && (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" /> Due {task.due_date.replace('T', ' ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {task.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => onUpdateTask(task.id, { status: 'in_progress' })}
                        title="Start task"
                        aria-label={`Start ${task.title}`}
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-indigo-950"
                      >
                        <Play className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onEditTask(task)}
                      title="Edit task"
                      aria-label={`Edit ${task.title}`}
                      className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteTask(task.id)}
                      title="Delete task"
                      aria-label={`Delete ${task.title}`}
                      className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-rose-50 hover:text-rose-600 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-rose-950"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
