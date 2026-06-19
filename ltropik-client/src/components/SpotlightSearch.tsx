import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { search } from '../api/search';
import type { SearchResult } from '../types';

const categoryIcon: Record<string, string> = { Курси: '📚', Уроки: '📝', Студенти: '👤' };

interface Props { open: boolean; onClose: () => void; }

export function SpotlightSearch({ open, onClose }: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (open) {
      setQuery(''); setResults([]); setActive(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await search(query);
        setResults(r.data.results);
        setActive(0);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  function handleSelect(r: SearchResult) {
    onClose();
    setQuery('');
    if (r.url) navigate(r.url);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && results[active]) handleSelect(results[active]);
    else if (e.key === 'Escape') onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[999] flex items-start justify-center pt-[15vh] px-4 bg-ink-900/50 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: -12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: -12 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-lg bg-white dark:bg-[#0e2218] rounded-2xl shadow-2xl border border-ink-100 dark:border-[#1c3a2a] overflow-hidden"
          >
            {/* Input */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-ink-100 dark:border-[#1c3a2a]">
              <svg className="w-5 h-5 text-ink-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Пошук по курсах, уроках, студентах…"
                className="flex-1 bg-transparent text-sm text-ink-800 dark:text-[#e8eaf0] placeholder:text-ink-400 dark:placeholder:text-[#4d5470] outline-none"
              />
              {loading && (
                <svg className="w-4 h-4 text-brand-500 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              )}
              <kbd className="hidden sm:flex items-center gap-0.5 px-2 py-1 text-[10px] font-bold bg-ink-100 dark:bg-[#163a28] text-ink-400 rounded-lg flex-shrink-0">
                ESC
              </kbd>
            </div>

            {/* Results */}
            {results.length > 0 ? (
              <div className="py-1 max-h-72 overflow-y-auto">
                {results.map((r, i) => (
                  <button
                    key={r.url ?? `${r.category}-${r.title}`}
                    onClick={() => handleSelect(r)}
                    onMouseEnter={() => setActive(i)}
                    className={`w-full text-left px-4 py-3 flex items-center gap-3 transition ${
                      i === active ? 'bg-brand-50 dark:bg-brand-900/20' : 'hover:bg-ink-50 dark:hover:bg-[#102a1d]'
                    }`}
                  >
                    <span className="text-xl flex-shrink-0">{categoryIcon[r.category] ?? '🔍'}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink-800 dark:text-[#e8eaf0] truncate">{r.title}</p>
                      {r.subtitle && <p className="text-xs text-ink-400 truncate">{r.subtitle}</p>}
                    </div>
                    <span className="text-[10px] text-ink-300 dark:text-[#4d5470] flex-shrink-0 bg-ink-50 dark:bg-[#163a28] px-2 py-0.5 rounded-full">{r.category}</span>
                  </button>
                ))}
              </div>
            ) : query.length >= 2 && !loading ? (
              <div className="py-10 text-center text-ink-400 text-sm">
                <div className="text-3xl mb-2">🔍</div>
                Нічого не знайдено
              </div>
            ) : query.length === 0 ? (
              <div className="py-5 px-4 flex flex-wrap gap-2">
                {['Математика', 'Фізика', 'Студенти', 'Розклад'].map(hint => (
                  <button key={hint} onClick={() => setQuery(hint)}
                    className="px-3 py-1.5 text-xs font-semibold bg-ink-50 dark:bg-[#102a1d] text-ink-500 dark:text-[#9aa2bd] rounded-lg hover:bg-brand-50 hover:text-brand-700 transition">
                    {hint}
                  </button>
                ))}
              </div>
            ) : null}

            {/* Footer hint */}
            <div className="px-4 py-2.5 border-t border-ink-50 dark:border-[#102a1d] flex items-center gap-3 text-[10px] text-ink-300 dark:text-[#3a4a40]">
              <span><kbd className="bg-ink-100 dark:bg-[#163a28] px-1.5 py-0.5 rounded text-[10px]">↑↓</kbd> навігація</span>
              <span><kbd className="bg-ink-100 dark:bg-[#163a28] px-1.5 py-0.5 rounded text-[10px]">↵</kbd> вибрати</span>
              <span><kbd className="bg-ink-100 dark:bg-[#163a28] px-1.5 py-0.5 rounded text-[10px]">Esc</kbd> закрити</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
