import { useEffect, useState } from 'react';
import { Modal } from './ui';

const SHORTCUTS: { keys: string; desc: string }[] = [
  { keys: '⌘ / Ctrl + K', desc: 'Швидкий пошук (Spotlight)' },
  { keys: 'Ctrl + Enter', desc: 'Зберегти під час перевірки ДЗ' },
  { keys: '?', desc: 'Показати / сховати цю довідку' },
  { keys: 'Esc', desc: 'Закрити модальне вікно' },
];

/** Global keyboard-shortcut cheatsheet. Press "?" anywhere (outside inputs) to toggle. */
export function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (!typing && e.key === '?') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <Modal open={open} onClose={() => setOpen(false)} className="max-w-sm">
      <h2 className="text-lg font-extrabold text-ink-900 dark:text-white mb-4 flex items-center gap-2">
        ⌨️ Гарячі клавіші
      </h2>
      <ul className="space-y-2.5">
        {SHORTCUTS.map((s) => (
          <li key={s.keys} className="flex items-center justify-between gap-4">
            <span className="text-sm text-ink-600 dark:text-[#b0b8d0]">{s.desc}</span>
            <kbd className="flex-shrink-0 px-2 py-1 text-[11px] font-bold bg-ink-50 dark:bg-[#252840] border border-ink-200 dark:border-[#2d3148] rounded text-ink-500 dark:text-[#9aa2bd]">
              {s.keys}
            </kbd>
          </li>
        ))}
      </ul>
      <p className="text-xs text-ink-400 mt-5">Підказка: натисніть <kbd className="px-1 py-0.5 bg-ink-50 dark:bg-[#252840] border border-ink-200 dark:border-[#2d3148] rounded">?</kbd> ще раз, щоб закрити.</p>
    </Modal>
  );
}
