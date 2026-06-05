import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { search } from '../api/search';
import type { SearchResult } from '../types';
import { cx } from './ui';

const categoryIcon: Record<string, string> = { Курси: '📚', Уроки: '📝', Студенти: '👤' };

export function SearchBar() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (query.length < 2) { setResults([]); setOpen(false); return; }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await search(query);
        setResults(r.data.results);
        setOpen(true);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleSelect(r: SearchResult) {
    setOpen(false);
    setQuery('');
    if (r.url) navigate(r.url);
  }

  return (
    <div ref={ref} className="relative w-full max-w-xs hidden lg:block">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        {loading && (
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        )}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Пошук…"
          className="w-full pl-9 pr-4 py-2 text-sm bg-ink-50 dark:bg-[#1e2033] border border-ink-200 dark:border-[#2d3148] text-ink-800 dark:text-[#e8eaf0] placeholder-ink-400 dark:placeholder-[#4d5470] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-300 focus:bg-white dark:focus:bg-[#1e2033] transition"
        />
      </div>

      <AnimatePresence>
        {open && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 top-11 w-80 bg-white dark:bg-[#1a1c2e] rounded-2xl shadow-2xl dark:shadow-black/50 border border-ink-100 dark:border-[#282c44] z-50 overflow-hidden"
          >
            {results.map((r, i) => (
              <button
                key={i}
                onClick={() => handleSelect(r)}
                className={cx('w-full text-left px-4 py-2.5 hover:bg-ink-50 dark:hover:bg-[#1e2033] transition flex items-center gap-3',
                  i > 0 && 'border-t border-ink-50 dark:border-[#1e2033]')}
              >
                <span className="text-lg flex-shrink-0">{categoryIcon[r.category] ?? '🔍'}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-800 dark:text-[#e8eaf0] truncate">{r.title}</p>
                  {r.subtitle && <p className="text-xs text-ink-400 dark:text-[#6b7394] truncate">{r.subtitle}</p>}
                </div>
                <span className="ml-auto text-[10px] text-ink-300 flex-shrink-0">{r.category}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
