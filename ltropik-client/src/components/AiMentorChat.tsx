import { useState, useRef, useEffect } from 'react';
import { askTutor } from '../api/homeworks';
import { motion, AnimatePresence } from 'framer-motion';

interface Message { role: 'user' | 'ai'; text: string; }
interface Props { courseId: string; lessonContext?: string; maxMessages?: number; }

const MAX_MESSAGES = 20;

export function AiMentorChat({ courseId, lessonContext, maxMessages = MAX_MESSAGES }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const remaining = maxMessages - messages.filter((m) => m.role === 'user').length;

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  async function send() {
    const text = input.trim();
    if (!text || loading || remaining <= 0) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setLoading(true);
    try {
      const history = messages.map((m) => m.text);
      const question = lessonContext
        ? `[Контекст уроку: ${lessonContext.slice(0, 400)}]\n\n${text}`
        : text;
      const { data } = await askTutor(courseId, question, history);
      setMessages((prev) => [...prev, { role: 'ai', text: data.response }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'ai', text: 'Вибачте, сталася помилка. Спробуйте ще раз.' }]);
    } finally { setLoading(false); }
  }

  return (
    <>
      {/* Floating button */}
      <motion.button
        onClick={() => setOpen((p) => !p)}
        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.92 }}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-[var(--shadow-glow)] flex items-center justify-center text-2xl z-40"
        title="AI-Ментор">
        <AnimatePresence mode="wait">
          <motion.span key={open ? 'x' : 'bot'} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
            {open ? '✕' : '🤖'}
          </motion.span>
        </AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 22 }}
            className="fixed bottom-24 right-6 w-80 sm:w-96 bg-white rounded-3xl shadow-2xl border border-ink-100 flex flex-col z-40 overflow-hidden"
            style={{ maxHeight: '70vh' }}>
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3.5 bg-gradient-to-r from-brand-600 to-brand-700">
              <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center text-lg">🤖</div>
              <div className="flex-1">
                <p className="text-white font-bold text-sm">AI-Ментор</p>
                <p className="text-white/60 text-xs">Підкажу логіку, але не дам готову відповідь</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-white/60 hover:text-white w-7 h-7 rounded-lg hover:bg-white/10 transition">✕</button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-0 bg-ink-50/50">
              {messages.length === 0 && (
                <div className="text-center text-ink-400 text-sm py-8">
                  <p className="text-4xl mb-2">💬</p>
                  <p className="font-medium text-ink-500">
                  {lessonContext ? 'Питай по поточному уроку' : 'Постав будь-яке питання по матеріалу'}
                </p>
                  <p className="text-xs mt-1 text-ink-300">Залишилось запитань: {remaining}</p>
                </div>
              )}
              {messages.map((msg, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-brand-500 to-brand-600 text-white rounded-br-md shadow-sm'
                      : 'bg-white text-ink-700 rounded-bl-md border border-ink-100'
                  }`}>
                    {msg.text}
                  </div>
                </motion.div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-ink-100 rounded-2xl rounded-bl-md px-4 py-3 flex gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <motion.span key={i} className="w-2 h-2 bg-brand-300 rounded-full inline-block"
                        animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="border-t border-ink-100 p-3 bg-white">
              {remaining <= 0 ? (
                <p className="text-center text-sm text-ink-400 py-1">Ліміт запитань вичерпано ({maxMessages}/{maxMessages})</p>
              ) : (
                <div className="flex gap-2">
                  <input value={input} onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
                    placeholder="Напиши питання…" disabled={loading}
                    className="input flex-1 py-2.5 disabled:opacity-50" />
                  <button onClick={send} disabled={loading || !input.trim()}
                    className="btn btn-primary w-11 px-0 flex-shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
