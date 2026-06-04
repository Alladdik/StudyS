import { useEffect, useRef, useState } from 'react';
import api from '../api/client';
import { cx } from './ui';

interface Props { lessonId: string; }

export function LessonNotes({ lessonId }: Props) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    api.get<{ content: string; updatedAt?: string }>(`/notes/${lessonId}`)
      .then(r => {
        if (cancelled) return;
        setContent(r.data.content);
        if (r.data.updatedAt) setSavedAt(r.data.updatedAt);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [lessonId]);

  // Clear pending debounce on unmount to avoid setState on dead component
  useEffect(() => () => clearTimeout(timerRef.current), []);

  function handleChange(val: string) {
    setContent(val);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => save(val), 1200);
  }

  async function save(val: string) {
    setSaving(true);
    try {
      await api.put(`/notes/${lessonId}`, { content: val });
      setSavedAt(new Date().toISOString());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-8">
      <button
        onClick={() => setOpen(o => !o)}
        className={cx(
          'w-full flex items-center justify-between px-5 py-3.5 rounded-2xl border transition font-semibold text-sm',
          open
            ? 'bg-amber-50 dark:bg-[#2a2010] border-amber-200 dark:border-[#4a3820] text-amber-800 dark:text-amber-300'
            : 'bg-white dark:bg-[#1a1c2e] border-ink-100 dark:border-[#282c44] text-ink-600 dark:text-[#9aa2bd] hover:border-amber-200'
        )}
      >
        <span className="flex items-center gap-2">
          <span className="text-lg">📝</span>
          Мої нотатки
          {content && <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" title="є нотатки" />}
        </span>
        <span className="text-xs font-normal text-ink-400">
          {saving ? '💾 Зберігаю…' : savedAt ? `Збережено ${new Date(savedAt).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}` : ''}
          <span className="ml-2">{open ? '▲' : '▼'}</span>
        </span>
      </button>

      {open && (
        <div className="mt-2 rounded-2xl border border-amber-200 dark:border-[#4a3820] bg-amber-50/50 dark:bg-[#1e1a0e] p-4">
          <textarea
            value={content}
            onChange={e => handleChange(e.target.value)}
            placeholder="Записуйте ключові думки, формули, запитання до наступного уроку…"
            rows={8}
            className="w-full bg-transparent text-sm text-ink-800 dark:text-[#e8eaf0] resize-y outline-none placeholder:text-ink-300 dark:placeholder:text-[#4d5470] leading-relaxed"
          />
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-amber-100 dark:border-[#3a2e10]">
            <span className="text-xs text-ink-400">{content.length} символів</span>
            {content && (
              <button
                onClick={() => { setContent(''); save(''); }}
                className="text-xs text-rose-400 hover:text-rose-600 transition"
              >
                🗑 Очистити
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
