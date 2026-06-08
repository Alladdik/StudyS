import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/client';
import { cx, toast } from './ui';
import { Spinner } from './ui';

// ── Types ────────────────────────────────────────────────────────────────────
interface ChatMsg { role: 'user' | 'assistant'; content: string; }

export interface AiQuestion {
  id: string;
  type: 'single' | 'multiple' | 'text';
  text: string;
  options?: { id: string; text: string }[];
  correctAnswer?: string;
  correctAnswers?: string[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called when teacher saves — receives final questions */
  onSave: (questions: AiQuestion[], testTitle: string) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const TYPE_LABEL: Record<string, string> = { single: 'Одна', multiple: 'Кілька', text: 'Текст' };
const TYPE_COLOR: Record<string, string> = {
  single:   'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400',
  multiple: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  text:     'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
};

// ── Main component ───────────────────────────────────────────────────────────
export function TestBuilderChat({ open, onClose, onSave }: Props) {
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: 'assistant', content: 'Привіт! 👋 Опишіть тест який хочете створити — тему, клас, кількість питань, тип. Наприклад:\n\n«Зроби 8 питань по темі Квадратні рівняння для 9 класу, змішані типи»' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<AiQuestion[]>([]);
  const [testTitle, setTestTitle] = useState('');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setMessages([{ role: 'assistant', content: 'Привіт! 👋 Опишіть тест який хочете створити — тему, клас, кількість питань, тип. Наприклад:\n\n«Зроби 8 питань по темі Квадратні рівняння для 9 класу, змішані типи»' }]);
      setInput('');
      setQuestions([]);
      setTestTitle('');
      setEditingIdx(null);
    }
  }, [open]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');

    const userMsg: ChatMsg = { role: 'user', content: text };
    const history = [...messages, userMsg];
    setMessages(history);
    setLoading(true);

    try {
      const { data } = await api.post<{ message: string; questionsJson: string | null }>(
        '/ai/test-builder/chat',
        { messages: history.map(m => ({ role: m.role, content: m.content })) }
      );

      setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);

      if (data.questionsJson) {
        try {
          const parsed = JSON.parse(data.questionsJson);
          if (!Array.isArray(parsed)) throw new Error('not an array');
          // Keep only well-formed questions
          const valid: AiQuestion[] = parsed.filter(
            (q): q is AiQuestion => q && typeof q.text === 'string' && typeof q.type === 'string'
          );
          if (valid.length > 0) setQuestions(valid);
          if (!testTitle) {
            // Auto-extract title from first user message
            const firstUser = history.find(m => m.role === 'user');
            if (firstUser) {
              const match = firstUser.content.match(/тем[аіу]\s+["«»]?([^"«»\n,]{3,40})/i);
              setTestTitle(match ? match[1].trim() : 'AI-тест');
            }
          }
        } catch { /* ignore bad JSON */ }
      }
    } catch {
      const errMsg = `❌ Помилка запиту. Спробуйте ще раз.`;
      setMessages(prev => [...prev, { role: 'assistant' as const, content: errMsg }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  // ── Question editing ──────────────────────────────────────────────────────
  function updateQuestion(idx: number, patch: Partial<AiQuestion>) {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, ...patch } : q));
  }
  function deleteQuestion(idx: number) {
    setQuestions(prev => prev.filter((_, i) => i !== idx));
  }
  function moveQuestion(idx: number, dir: -1 | 1) {
    const to = idx + dir;
    if (to < 0 || to >= questions.length) return;
    const arr = [...questions];
    [arr[idx], arr[to]] = [arr[to], arr[idx]];
    setQuestions(arr);
  }

  function handleSave() {
    if (!questions.length) { toast('error', 'Немає питань для збереження'); return; }
    if (!testTitle.trim()) { toast('error', 'Вкажіть назву тесту'); return; }
    onSave(questions, testTitle.trim());
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch bg-black/40 backdrop-blur-sm p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
        className="flex-1 flex flex-col sm:flex-row bg-white dark:bg-[#13141f] rounded-none sm:rounded-3xl shadow-2xl overflow-hidden max-w-6xl mx-auto w-full"
        style={{ maxHeight: '100vh' }}
      >
        {/* ── LEFT: Chat ─────────────────────────────────────────────────── */}
        <div className="flex flex-col w-full sm:w-[46%] border-r border-ink-100 dark:border-[#282c44] min-h-0">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-ink-100 dark:border-[#282c44] flex-shrink-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-brand-600 flex items-center justify-center text-white text-xl flex-shrink-0">🤖</div>
            <div className="flex-1 min-w-0">
              <p className="font-extrabold text-ink-900 dark:text-white text-sm leading-tight">AI-Конструктор тестів</p>
              <p className="text-xs text-ink-400">Gemini · розмова зберігається</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-xl bg-ink-100 dark:bg-[#252840] hover:bg-ink-200 dark:hover:bg-[#2d3148] flex items-center justify-center text-ink-500 transition flex-shrink-0">✕</button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-0">
            <AnimatePresence initial={false}>
              {messages.map((msg, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className={cx('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-brand-600 flex items-center justify-center text-white text-sm flex-shrink-0 mt-0.5 mr-2">🤖</div>
                  )}
                  <div className={cx(
                    'max-w-[82%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap',
                    msg.role === 'user'
                      ? 'bg-brand-600 text-white rounded-br-sm'
                      : 'bg-ink-50 dark:bg-[#1e2033] text-ink-800 dark:text-[#e8eaf0] rounded-bl-sm'
                  )}>
                    {msg.content}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {loading && (
              <div className="flex justify-start">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-brand-600 flex items-center justify-center text-white text-sm flex-shrink-0 mt-0.5 mr-2">🤖</div>
                <div className="bg-ink-50 dark:bg-[#1e2033] rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5">
                  {[0, 1, 2].map(i => (
                    <motion.span key={i} className="w-2 h-2 bg-brand-400 rounded-full"
                      animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.7, delay: i * 0.15 }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-ink-100 dark:border-[#282c44] p-3 flex gap-2 flex-shrink-0">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Напишіть запит… (Enter — надіслати, Shift+Enter — новий рядок)"
              rows={2}
              className="input flex-1 resize-none py-2.5 text-sm"
              disabled={loading}
            />
            <button onClick={send} disabled={loading || !input.trim()}
              className="btn btn-primary w-11 px-0 flex-shrink-0 self-end">
              {loading ? <Spinner className="w-4 h-4" /> : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* ── RIGHT: Questions preview ────────────────────────────────────── */}
        <div className="flex flex-col flex-1 min-h-0 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-ink-100 dark:border-[#282c44] flex-shrink-0">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-ink-400 mb-1">Назва тесту</p>
              <input
                value={testTitle}
                onChange={e => setTestTitle(e.target.value)}
                placeholder="Введіть назву…"
                className="input py-1.5 text-sm font-bold w-full"
              />
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs font-semibold text-ink-400">{questions.length} питань</span>
              <button
                onClick={handleSave}
                disabled={!questions.length || !testTitle.trim()}
                className="btn btn-primary text-sm py-2 px-4 disabled:opacity-40"
              >
                💾 Зберегти тест
              </button>
            </div>
          </div>

          {/* Questions list */}
          <div className="flex-1 overflow-y-auto p-4">
            {questions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-16 gap-4">
                <div className="w-20 h-20 rounded-3xl bg-ink-50 dark:bg-[#1e2033] flex items-center justify-center text-5xl">📝</div>
                <div>
                  <p className="font-bold text-ink-700 dark:text-[#b0b8d0] mb-1">Питань ще немає</p>
                  <p className="text-sm text-ink-400 max-w-xs">Попросіть AI згенерувати тест у чаті зліва — питання з'являться тут автоматично</p>
                </div>
                <div className="flex flex-col gap-2 mt-2 max-w-xs text-left">
                  {[
                    '«Зроби 10 питань по алгебрі 8 клас»',
                    '«Тест по Другій світовій війні, 7 питань, змішані типи»',
                    '«Англійська: Present Simple, 5 питань для початківців»',
                  ].map(ex => (
                    <button key={ex} onClick={() => setInput(ex.replace(/[«»]/g, ''))}
                      className="text-xs text-left px-3 py-2 rounded-xl bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400 hover:bg-brand-100 dark:hover:bg-brand-900/30 transition">
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {questions.map((q, idx) => (
                  <motion.div key={q.id ?? idx}
                    layout
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-ink-100 dark:border-[#282c44] bg-white dark:bg-[#1a1c2e] p-4"
                  >
                    {/* Question header */}
                    <div className="flex items-start gap-2 mb-3">
                      <span className="w-7 h-7 rounded-xl bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        {editingIdx === idx ? (
                          <textarea
                            value={q.text}
                            onChange={e => updateQuestion(idx, { text: e.target.value })}
                            onBlur={() => setEditingIdx(null)}
                            autoFocus
                            rows={2}
                            className="input resize-none text-sm w-full"
                          />
                        ) : (
                          <p className="text-sm font-semibold text-ink-900 dark:text-white cursor-pointer hover:text-brand-600 dark:hover:text-brand-400 transition leading-relaxed"
                            onClick={() => setEditingIdx(idx)}>
                            {q.text}
                            <span className="ml-1 text-ink-300 dark:text-[#4d5470] text-xs font-normal">✎</span>
                          </p>
                        )}
                      </div>
                      <span className={cx('text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0', TYPE_COLOR[q.type] ?? '')}>
                        {TYPE_LABEL[q.type]}
                      </span>
                    </div>

                    {/* Options */}
                    {q.options && q.options.length > 0 && (
                      <div className="pl-9 flex flex-col gap-1.5 mb-2">
                        {q.options.map(opt => {
                          const isCorrect = q.type === 'single'
                            ? q.correctAnswer === opt.id
                            : q.correctAnswers?.includes(opt.id);
                          return (
                            <div key={opt.id} className={cx(
                              'flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs transition',
                              isCorrect
                                ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/50 text-emerald-700 dark:text-emerald-400 font-semibold'
                                : 'bg-ink-50 dark:bg-[#1e2033] text-ink-600 dark:text-[#9aa2bd]'
                            )}>
                              <span className="font-bold text-[10px] opacity-50 uppercase flex-shrink-0">{opt.id}</span>
                              <span>{opt.text}</span>
                              {isCorrect && <span className="ml-auto text-emerald-500">✓</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="pl-9 flex items-center gap-1.5 mt-1">
                      <button onClick={() => moveQuestion(idx, -1)} disabled={idx === 0}
                        className="text-ink-300 dark:text-[#4d5470] hover:text-brand-500 disabled:opacity-30 transition text-sm" title="Вгору">↑</button>
                      <button onClick={() => moveQuestion(idx, 1)} disabled={idx === questions.length - 1}
                        className="text-ink-300 dark:text-[#4d5470] hover:text-brand-500 disabled:opacity-30 transition text-sm" title="Вниз">↓</button>
                      <button onClick={() => deleteQuestion(idx)}
                        className="text-ink-300 dark:text-[#4d5470] hover:text-rose-500 transition text-xs ml-1" title="Видалити">🗑</button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
