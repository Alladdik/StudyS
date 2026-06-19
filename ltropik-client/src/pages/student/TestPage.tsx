import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { startTest, submitTest } from '../../api/tests';
import type { TestInfo, StartTestResponse, TestResult } from '../../api/tests';
import api from '../../api/client';
import { Spinner, cx } from '../../components/ui';
import { useProctoring } from '../../hooks/useProctoring';

const MAX_BLUR_COUNT = 3;

export function TestPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [test, setTest] = useState<TestInfo | null>(null);
  const [session, setSession] = useState<StartTestResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [result, setResult] = useState<TestResult | null>(null);
  const [blurCount, setBlurCount] = useState(0);
  const [blurWarning, setBlurWarning] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [forceSubmitted, setForceSubmitted] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionRef = useRef<StartTestResponse | null>(null);

  // Cleanup countdown timer on unmount
  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);
  const answersRef = useRef<Record<string, unknown>>({});
  answersRef.current = answers;

  const [questionTimes, setQuestionTimes] = useState<Record<string, number>>({});
  const questionTimesRef = useRef<Record<string, number>>({});
  questionTimesRef.current = questionTimes;
  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Viewport tracking timer
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => {
      let closestQId = null;
      let minDistance = Infinity;
      const centerY = window.innerHeight / 2;

      Object.entries(questionRefs.current).forEach(([qId, el]) => {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const elementCenter = rect.top + rect.height / 2;
        const distance = Math.abs(elementCenter - centerY);
        if (distance < minDistance) {
          minDistance = distance;
          closestQId = qId;
        }
      });

      if (closestQId) {
        setQuestionTimes(prev => ({
          ...prev,
          [closestQId!]: (prev[closestQId!] ?? 0) + 1
        }));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [session]);

  const { videoRef, permitted } = useProctoring(!!session, session?.attemptId);

  useEffect(() => {
    if (!id) return;
    api.get<TestInfo>(`/tests/${id}`).then((r) => setTest(r.data)).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  // Anti-cheat: block right-click + copy/paste shortcuts
  useEffect(() => {
    if (!session) return;
    const blockMenu = (e: MouseEvent) => e.preventDefault();
    const blockKeys = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'a', 'u'].includes(e.key.toLowerCase())) e.preventDefault();
    };
    document.addEventListener('contextmenu', blockMenu);
    document.addEventListener('keydown', blockKeys);
    return () => { document.removeEventListener('contextmenu', blockMenu); document.removeEventListener('keydown', blockKeys); };
  }, [session]);

  // Anti-cheat: tab blur counter
  useEffect(() => {
    if (!session) return;
    const handleBlur = () => {
      setBlurCount((prev) => {
        const next = prev + 1;
        if (next >= MAX_BLUR_COUNT) handleAutoSubmit();
        else { setBlurWarning(true); setTimeout(() => setBlurWarning(false), 3000); }
        return next;
      });
    };
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function handleAutoSubmit() {
    setForceSubmitted(true);
    if (!sessionRef.current) return;
    try {
      const res = await submitTest(sessionRef.current.attemptId, answersRef.current, questionTimesRef.current);
      setResult(res.data);
    } catch {
      setResult({ scorePercentage: 0, passed: false, attemptId: sessionRef.current?.attemptId ?? '' });
    }
    clearInterval(timerRef.current!);
  }

  function startTimer(startTimeStr: string, limitMinutes: number) {
    const startTime = new Date(startTimeStr).getTime();
    const endTime = startTime + limitMinutes * 60 * 1000;
    timerRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) { clearInterval(timerRef.current!); handleAutoSubmit(); }
    }, 1000);
  }

  async function handleStart() {
    if (!id) return;
    setLoading(true);
    try {
      const { data } = await startTest(id);
      setSession(data); sessionRef.current = data;
      if (data.timeLimitMinutes > 0) startTimer(data.serverStartTime, data.timeLimitMinutes);
    } finally { setLoading(false); }
  }

  async function handleSubmit() {
    if (!session || submitting) return;
    setSubmitting(true);
    clearInterval(timerRef.current!);
    try { const { data } = await submitTest(session.attemptId, answers, questionTimes); setResult(data); }
    finally { setSubmitting(false); }
  }

  const setAnswer = (qId: string, value: unknown) => setAnswers((p) => ({ ...p, [qId]: value }));
  const toggleMultiple = (qId: string, optId: string) => setAnswers((p) => {
    const cur = (p[qId] as string[] | undefined) ?? [];
    return { ...p, [qId]: cur.includes(optId) ? cur.filter((x) => x !== optId) : [...cur, optId] };
  });
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const answered = Object.keys(answers).length;
  const total = test?.questions.length ?? 0;
  const progress = total > 0 ? (answered / total) * 100 : 0;

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Spinner className="w-8 h-8 text-brand-500" /></div>;

  // ----- Result -----
  if (result) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 16 }}
          className="card p-10 max-w-md w-full text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring', damping: 10 }} className="text-7xl mb-4">
            {forceSubmitted ? '⚠️' : result.passed ? '🎉' : '😔'}
          </motion.div>
          <h1 className="text-2xl font-extrabold text-ink-900 dark:text-white mb-2">
            {forceSubmitted ? 'Тест завершено автоматично' : result.passed ? 'Тест пройдено!' : 'Спробуй ще раз'}
          </h1>
          {forceSubmitted && <p className="text-amber-600 text-sm mb-3">Завершено через перемикання вкладки понад {MAX_BLUR_COUNT} разів</p>}
          <div className="my-6">
            <div className="relative w-32 h-32 mx-auto">
              <svg viewBox="0 0 36 36" className="w-32 h-32 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#eef0f6" strokeWidth="3" />
                <motion.circle cx="18" cy="18" r="15.9" fill="none" stroke={result.passed ? '#10b981' : '#f43f5e'} strokeWidth="3" strokeLinecap="round"
                  strokeDasharray="100" initial={{ strokeDashoffset: 100 }} animate={{ strokeDashoffset: 100 - result.scorePercentage }} transition={{ duration: 1.5, ease: 'easeOut' }} />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={cx('text-3xl font-extrabold', result.passed ? 'text-emerald-600' : 'text-rose-500')}>{Math.round(result.scorePercentage)}%</span>
              </div>
            </div>
          </div>
          <p className={cx('text-lg font-bold', result.passed ? 'text-emerald-600' : 'text-rose-500')}>{result.passed ? '✅ Тест зараховано' : '❌ Не зараховано'}</p>
          <p className="text-ink-400 text-sm mt-1">Результат: {result.scorePercentage.toFixed(1)}%</p>
          <button onClick={() => navigate(-1)} className="btn btn-primary mt-6">Назад до уроку</button>
        </motion.div>
      </div>
    );
  }

  // ----- Start screen -----
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card p-10 max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-3xl bg-brand-100 flex items-center justify-center text-4xl mx-auto mb-4">📝</div>
          <h1 className="text-2xl font-extrabold text-ink-900 dark:text-white mb-1">{test?.title}</h1>
          <div className="grid grid-cols-2 gap-3 my-6 text-left">
            {[
              { l: 'Питань', v: test?.questions.length },
              { l: 'Час', v: test?.timeLimitMinutes ? `${test.timeLimitMinutes} хв` : '∞' },
              { l: 'Спроб', v: test?.maxAttempts },
              { l: 'Прохідний', v: `${test?.passingPercentage}%` },
            ].map((s) => (
              <div key={s.l} className="bg-ink-50 dark:bg-[#102a1d] rounded-xl px-4 py-3">
                <p className="text-xs text-ink-400">{s.l}</p>
                <p className="font-bold text-ink-800 dark:text-[#e8eaf0]">{s.v}</p>
              </div>
            ))}
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/40 rounded-xl p-4 mb-6 text-sm text-amber-700 dark:text-amber-400 text-left">
            <p className="font-bold mb-1">⚠️ Правила тесту</p>
            <ul className="list-disc pl-4 space-y-0.5 text-amber-700/90">
              <li>Заборонено копіювати/вставляти текст</li>
              <li>Не перемикай вкладки (допускається {MAX_BLUR_COUNT - 1} рази)</li>
              <li>Час відраховується на сервері</li>
            </ul>
          </div>
          <button onClick={handleStart} className="btn btn-primary w-full py-3.5 text-base">Розпочати тест →</button>
        </motion.div>
      </div>
    );
  }

  // ----- Active test -----
  return (
    <div className="min-h-screen select-none pb-28">
      {/* Proctoring webcam corner */}
      {session && (
        <div className="fixed bottom-20 right-4 z-40 flex flex-col items-end gap-1">
          <video ref={videoRef} autoPlay muted playsInline
            className={cx('w-28 h-20 rounded-xl object-cover border-2',
              permitted ? 'border-emerald-400' : 'border-rose-400 opacity-30')} />
          <span className="text-[10px] text-ink-400 bg-white/80 dark:bg-[#0e2218]/80 rounded px-1">
            {permitted ? '🔴 Прокторинг' : '📵 Камера вимкнена'}
          </span>
        </div>
      )}

      {/* Sticky header */}
      <div className="sticky top-0 z-30 bg-white/90 dark:bg-[#0c1f16]/90 backdrop-blur-xl border-b border-ink-100 dark:border-[#1c3a2a] px-4 sm:px-6 py-3 flex items-center gap-3 sm:gap-4">
        <span className="font-bold text-ink-800 dark:text-[#e8eaf0] flex-1 truncate text-sm">{test?.title}</span>
        <span className="hidden sm:inline text-sm text-ink-400">{answered}/{total}</span>
        {timeLeft !== null && (
          <span className={cx('font-mono font-bold px-3 py-1.5 rounded-lg text-sm',
            timeLeft <= 60 ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 animate-pulse' : timeLeft <= 180 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 'bg-ink-100 dark:bg-[#163a28] text-ink-700 dark:text-[#b0b8d0]')}>
            ⏱ {formatTime(timeLeft)}
          </span>
        )}
        <div className="w-24 sm:w-32 h-2 bg-ink-100 dark:bg-[#163a28] rounded-full overflow-hidden">
          <motion.div className="h-full bg-gradient-to-r from-brand-500 to-brand-600 rounded-full" animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
        </div>
      </div>

      {/* Blur warning */}
      <AnimatePresence>
        {blurWarning && (
          <motion.div initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -60, opacity: 0 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-white px-6 py-3 rounded-xl shadow-xl text-sm font-semibold">
            ⚠️ Не перемикай вкладки! Залишилось: {MAX_BLUR_COUNT - blurCount}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Questions */}
      <div className="max-w-2xl mx-auto p-4 sm:p-6">
        {test?.questions.map((q, idx) => (
          <motion.div 
            key={q.id}
            ref={(el) => { questionRefs.current[q.id] = el as HTMLDivElement | null; }}
            initial={{ opacity: 0, y: 16 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: idx * 0.04 }}
            className={cx('card p-6 mb-4', answers[q.id] !== undefined && '!border-brand-200')}
          >
            <div className="flex items-start gap-3 mb-4">
              <span className="w-7 h-7 rounded-lg bg-brand-100 text-brand-600 flex-shrink-0 flex items-center justify-center text-sm font-bold">{idx + 1}</span>
              <p className="font-semibold text-ink-800 dark:text-[#e8eaf0] leading-relaxed">{q.text}</p>
            </div>

            {q.type === 'single' && q.options && (
              <div className="flex flex-col gap-2 pl-10">
                {q.options.map((opt) => (
                  <label key={opt.id} className={cx('flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition',
                    answers[q.id] === opt.id ? 'border-brand-400 bg-brand-50 dark:bg-brand-900/20' : 'border-ink-200 dark:border-[#1f4d36] hover:border-brand-200 hover:bg-ink-50 dark:hover:bg-[#102a1d]')}>
                    <div className={cx('w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center', answers[q.id] === opt.id ? 'border-brand-500' : 'border-ink-300 dark:border-[#4d5470]')}>
                      {answers[q.id] === opt.id && <div className="w-2.5 h-2.5 rounded-full bg-brand-500" />}
                    </div>
                    <input type="radio" name={q.id} checked={answers[q.id] === opt.id} onChange={() => setAnswer(q.id, opt.id)} className="sr-only" />
                    <span className="text-sm text-ink-700 dark:text-[#b0b8d0]">{opt.text}</span>
                  </label>
                ))}
              </div>
            )}

            {q.type === 'multiple' && q.options && (
              <div className="flex flex-col gap-2 pl-10">
                <p className="text-xs text-ink-400 -mt-1 mb-1">Можна вибрати кілька варіантів</p>
                {q.options.map((opt) => {
                  const selected = ((answers[q.id] as string[] | undefined) ?? []).includes(opt.id);
                  return (
                    <label key={opt.id} className={cx('flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition',
                      selected ? 'border-brand-400 bg-brand-50 dark:bg-brand-900/20' : 'border-ink-200 dark:border-[#1f4d36] hover:border-brand-200 hover:bg-ink-50 dark:hover:bg-[#102a1d]')}>
                      <div className={cx('w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center', selected ? 'border-brand-500 bg-brand-500' : 'border-ink-300 dark:border-[#4d5470]')}>
                        {selected && <span className="text-white text-xs">✓</span>}
                      </div>
                      <input type="checkbox" checked={selected} onChange={() => toggleMultiple(q.id, opt.id)} className="sr-only" />
                      <span className="text-sm text-ink-700 dark:text-[#b0b8d0]">{opt.text}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {q.type === 'text' && (
              <div className="pl-10">
                <input type="text" value={String(answers[q.id] ?? '')} onChange={(e) => setAnswer(q.id, e.target.value)} placeholder="Введи відповідь…" className="input" />
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Fixed submit */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-[#0c1f16]/90 backdrop-blur-xl border-t border-ink-100 dark:border-[#1c3a2a] px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
        <span className="text-sm text-ink-400 hidden sm:inline">Відповіли на {answered} з {total} питань</span>
        <button onClick={handleSubmit} disabled={submitting || answered === 0} className="btn btn-primary px-8 py-3 ml-auto">
          {submitting ? <><Spinner className="w-4 h-4" /> Перевірка…</> : <>✅ Здати тест</>}
        </button>
      </div>
    </div>
  );
}
