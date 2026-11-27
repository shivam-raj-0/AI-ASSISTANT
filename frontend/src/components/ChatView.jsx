import { useEffect, useRef, useState } from 'react';
import { Bot, Loader2, Send, ShieldCheck, Trash2, User } from 'lucide-react';
import { DecisionTraceCard } from './DecisionTraceCard.jsx';

const STARTER_PROMPTS = [
  'What should I work on right now?',
  'Add urgent task: Prepare client demo deck tomorrow 45 mins',
  'I only have 30 minutes and low energy — resolve conflicts',
  'Summarize my pending and completed tasks'
];

export function ChatView({
  messages,
  loading,
  sending,
  onSendMessage,
  onClearMemory,
  onApplyRecommendation
}) {
  const [input, setInput] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    setInput('');
    await onSendMessage(trimmed);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex h-[calc(100vh-8.5rem)] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800 sm:px-5">
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span>Privacy Guard active: secrets & credentials are redacted before memory storage</span>
        </div>

        {messages.length > 0 && (
          <button
            type="button"
            onClick={onClearMemory}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-rose-50 hover:text-rose-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-rose-950/50 dark:hover:text-rose-300"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear Memory
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 sm:p-6">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading conversation context...
          </div>
        ) : messages.length === 0 ? (
          <div className="mx-auto flex max-w-xl flex-col items-center justify-center py-10 text-center animate-fade-slide">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
              <Bot className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
              Meet SmartMate AI
            </h3>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
              Ask me to prioritize your tasks, create or update goals in natural language, or resolve conflicting deadlines.
            </p>
            <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => onSendMessage(prompt)}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-left text-xs font-medium text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50/70 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/40"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 animate-fade-slide ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
                    <Bot className="h-4 w-4" />
                  </div>
                )}

                <div className={`max-w-[85%] sm:max-w-[75%] ${isUser ? 'order-first' : ''}`}>
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      isUser
                        ? 'bg-indigo-600 text-white'
                        : 'border border-slate-200 bg-white text-slate-800 shadow-sm dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-100'
                    }`}
                  >
                    <FormattedMessage text={msg.content} />
                    {msg.redacted && (
                      <p className="mt-1.5 text-[11px] opacity-80">
                        Sensitive token redacted from stored memory.
                      </p>
                    )}
                  </div>

                  {!isUser && msg.decision && (
                    <DecisionTraceCard
                      decision={msg.decision}
                      mode={msg.mode}
                      onApplyTask={onApplyRecommendation}
                      onQuickReply={(q) => setInput(`Regarding "${q}": `)}
                    />
                  )}
                </div>

                {isUser && (
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            );
          })
        )}

        {sending && (
          <div className="flex items-center gap-3 animate-fade-slide">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white">
              <Bot className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
              Analyzing intent, context, and priorities...
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/50 sm:p-4"
      >
        <div className="flex items-end gap-2">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask SmartMate to prioritize, add/complete a task, or resolve a conflict..."
            maxLength={2000}
            aria-label="Message SmartMate AI"
            className="max-h-36 min-h-[44px] flex-1 resize-none rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="inline-flex h-[44px] items-center gap-1.5 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <span>Press Enter to send, Shift+Enter for new line</span>
          <span>{input.length}/2000</span>
        </div>
      </form>
    </div>
  );
}

/**
 * Safely renders basic bold (**text**) and line breaks without innerHTML.
 */
function FormattedMessage({ text }) {
  const lines = String(text || '').split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, idx) => {
        if (!line.trim()) return <div key={idx} className="h-1" />;
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={idx} className="break-words">
            {parts.map((part, pIdx) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return (
                  <strong key={pIdx} className="font-semibold">
                    {part.slice(2, -2)}
                  </strong>
                );
              }
              return <span key={pIdx}>{part}</span>;
            })}
          </p>
        );
      })}
    </div>
  );
}
