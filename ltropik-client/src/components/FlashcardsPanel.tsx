import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/client';
import { Spinner, Modal } from './ui';

interface Card { front: string; back: string; }
interface Props { lessonId: string; lessonTitle: string; lessonText: string; }

export function FlashcardsPanel({ lessonId, lessonTitle, lessonText }: Props) {
  const [open, setOpen] = useState(false);
  const [cards, setCards] = useState<Card[]>([]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [current, setCurrent] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [error, setError] = useState('');

  async function generate() {
    if (!lessonText.trim()) { setError('Урок не містить тексту для аналізу'); return; }
    setGenerating(true); setError(''); setCards([]); setCurrent(0); setFlipped(false);
    try {
      const r = await api.post<Card[]>('/flashcards/generate', { text: lessonText });
      setCards(r.data);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Помилка генерації. AI недоступний?');
    } finally {
      setGenerating(false);
    }
  }

  async function saveSet() {
    if (!cards.length) return;
    setSaving(true); setSaveError('');
    try {
      await api.post('/flashcards/sets', {
        title: lessonTitle,
        lessonId,
        cards: cards.map(c => ({ front: c.front, back: c.back })),
      });
      setSaved(true);
    } catch (e: any) {
      setSaveError(e?.response?.data?.error ?? 'Не вдалося зберегти набір');
    } finally {
      setSaving(false);
    }
  }

  function next() { setCurrent(c => (c + 1) % cards.length); setFlipped(false); }
  function prev() { setCurrent(c => (c - 1 + cards.length) % cards.length); setFlipped(false); }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-50 dark:bg-[#1e1a2e] border border-purple-200 dark:border-[#382860] text-purple-700 dark:text-purple-300 text-sm font-semibold hover:bg-purple-100 dark:hover:bg-[#261e3a] transition"
      >
        <span className="text-base">🃏</span> Флешкарти
      </button>

      <Modal open={open} onClose={() => setOpen(false)} className="max-w-lg">
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-extrabold text-ink-900 text-lg">🃏 Флешкарти</h3>
              <p className="text-xs text-ink-400 mt-0.5">{lessonTitle}</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-ink-400 hover:text-ink-700 transition text-xl">×</button>
          </div>

          {!cards.length ? (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="text-5xl">🤖</div>
              <p className="text-sm text-ink-500 text-center max-w-xs">
                AI згенерує картки «питання ↔ відповідь» на основі тексту уроку
              </p>
              {error && <p className="text-sm text-rose-600 font-semibold text-center">{error}</p>}
              <button onClick={generate} disabled={generating} className="btn btn-primary px-8">
                {generating ? <><Spinner className="w-4 h-4" /> Генерую…</> : '✨ Згенерувати картки'}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Card flip */}
              <div className="text-center text-xs text-ink-400 mb-1">
                {current + 1} / {cards.length} · натисніть на картку щоб перевернути
              </div>
              <div className="relative h-44 cursor-pointer select-none" onClick={() => setFlipped(f => !f)}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${current}-${flipped}`}
                    initial={{ rotateY: -90, opacity: 0 }}
                    animate={{ rotateY: 0, opacity: 1 }}
                    exit={{ rotateY: 90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`absolute inset-0 rounded-2xl border-2 flex items-center justify-center p-6 text-center font-semibold text-sm ${
                      flipped
                        ? 'bg-emerald-50 dark:bg-[#0d2418] border-emerald-200 text-emerald-800 dark:text-emerald-200'
                        : 'bg-brand-50 dark:bg-[#1a1535] border-brand-200 text-brand-900 dark:text-brand-200'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider mb-2 opacity-60">
                        {flipped ? 'Відповідь' : 'Питання'}
                      </div>
                      {flipped ? cards[current].back : cards[current].front}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between gap-2">
                <button onClick={prev} className="btn btn-ghost py-2 px-4">← Назад</button>
                <div className="flex gap-1">
                  {cards.map((_, i) => (
                    <button key={i} onClick={() => { setCurrent(i); setFlipped(false); }}
                      className={`w-2 h-2 rounded-full transition ${i === current ? 'bg-brand-600' : 'bg-ink-200'}`} />
                  ))}
                </div>
                <button onClick={next} className="btn btn-ghost py-2 px-4">Далі →</button>
              </div>

              {/* Save to library */}
              {saveError && (
                <p className="text-xs text-rose-600 font-semibold text-center">{saveError}</p>
              )}
              <button onClick={saveSet} disabled={saving || saved} className="btn btn-soft text-sm py-2.5 w-full">
                {saved ? '✅ Збережено в бібліотеку' : saving ? <><Spinner className="w-4 h-4" /> Зберігаю…</> : '💾 Зберегти набір'}
              </button>

              <button onClick={() => { setCards([]); setSaved(false); }} className="text-xs text-ink-400 hover:text-brand-600 text-center transition">
                🔄 Згенерувати новий набір
              </button>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
