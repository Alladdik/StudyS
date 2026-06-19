import { useEffect, useState } from 'react';
import { cx } from './ui';

const FOCUS_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;

function fmt(total: number) {
  const m = Math.floor(total / 60).toString().padStart(2, '0');
  const s = (total % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/**
 * Pomodoro study timer for students. Floating, self-contained (no backend):
 * 25-min focus / 5-min break cycles with a session counter.
 */
export function FocusTimer() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'focus' | 'break'>('focus');
  const [left, setLeft] = useState(FOCUS_SECONDS);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState(0);

  // Tick once per second while running.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  // Handle phase completion.
  useEffect(() => {
    if (left !== 0) return;
    setRunning(false);
    if (mode === 'focus') {
      setSessions((s) => s + 1);
      setMode('break');
      setLeft(BREAK_SECONDS);
    } else {
      setMode('focus');
      setLeft(FOCUS_SECONDS);
    }
  }, [left, mode]);

  function reset() {
    setRunning(false);
    setMode('focus');
    setLeft(FOCUS_SECONDS);
  }

  const total = mode === 'focus' ? FOCUS_SECONDS : BREAK_SECONDS;
  const pct = Math.round(((total - left) / total) * 100);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Таймер фокусування"
        className="fixed bottom-5 left-5 z-40 h-11 px-4 rounded-full bg-white dark:bg-[#0e2218] border border-ink-200 dark:border-[#1c3a2a] shadow-lg hover:border-brand-300 transition flex items-center gap-2 text-sm font-semibold text-ink-700 dark:text-[#e8eaf0]">
        <span>🍅</span>
        <span className="tabular-nums">{fmt(left)}</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 left-5 z-40 w-64 bg-white dark:bg-[#0e2218] border border-ink-200 dark:border-[#1c3a2a] rounded-2xl shadow-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="font-bold text-ink-900 dark:text-white text-sm flex items-center gap-1.5">
          🍅 Фокус
        </span>
        <button onClick={() => setOpen(false)} className="text-ink-400 hover:text-ink-600 transition" aria-label="Згорнути">✕</button>
      </div>

      <div className="text-center mb-3">
        <span className={cx('text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full',
          mode === 'focus'
            ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400'
            : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400')}>
          {mode === 'focus' ? 'Робота' : 'Перерва'}
        </span>
        <div className="text-4xl font-extrabold text-ink-900 dark:text-white tabular-nums mt-2">{fmt(left)}</div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-ink-100 dark:bg-[#163a28] overflow-hidden mb-3">
        <div className={cx('h-full transition-all', mode === 'focus' ? 'bg-brand-500' : 'bg-emerald-500')}
          style={{ width: `${pct}%` }} />
      </div>

      <div className="flex gap-2">
        <button onClick={() => setRunning((r) => !r)} className="btn btn-primary flex-1 py-2 text-sm">
          {running ? '⏸ Пауза' : '▶ Старт'}
        </button>
        <button onClick={reset} className="btn btn-soft py-2 px-3 text-sm" title="Скинути">↺</button>
      </div>

      <p className="text-[11px] text-ink-400 text-center mt-3">Завершено сесій: <strong>{sessions}</strong></p>
    </div>
  );
}
