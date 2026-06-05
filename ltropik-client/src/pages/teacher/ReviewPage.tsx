import { useEffect, useState, useCallback } from 'react';
import { Layout } from '../../components/Layout';
import { getReviewQueue, reviewHomework } from '../../api/homeworks';
import { getCourses } from '../../api/courses';
import type { HomeworkSubmission, Course, GradeScale } from '../../types';
import { useSignalR } from '../../hooks/useSignalR';
import api from '../../api/client';
import { Card, Badge, Avatar, EmptyState, cx } from '../../components/ui';

export function ReviewPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [queue, setQueue] = useState<HomeworkSubmission[]>([]);
  const [current, setCurrent] = useState<HomeworkSubmission | null>(null);
  const [feedback, setFeedback] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [reviewStatus, setReviewStatus] = useState<'Passed' | 'RequiresChanges'>('Passed');
  const [gradeScale, setGradeScale] = useState<GradeScale | null>(null);
  const [saving, setSaving] = useState(false);

  const loadQueue = useCallback(() => {
    if (selectedCourse) {
      getReviewQueue(selectedCourse).then((r) => {
        setQueue(r.data);
        // Only auto-open first item if nothing is currently open
        setCurrent((prev) => prev ?? (r.data[0] ?? null));
      });
    }
  }, [selectedCourse]);

  useEffect(() => {
    getCourses().then((r) => { setCourses(r.data); if (r.data[0]) setSelectedCourse(r.data[0].id); });
  }, []);
  useEffect(() => { loadQueue(); }, [loadQueue]);
  useEffect(() => {
    if (selectedCourse) {
      api.get<{ gradeScaleId?: string }>(`/courses/${selectedCourse}`).then((r) => {
        if (r.data.gradeScaleId) api.get<GradeScale[]>('/gradescales').then((gs) => setGradeScale(gs.data.find((s) => s.id === r.data.gradeScaleId) ?? null)).catch(() => {});
      }).catch(() => {});
    }
  }, [selectedCourse]);

  useSignalR('/hubs/review', {
    ReviewReady: (...args: unknown[]) => {
      const first = args[0];
      if (!first || typeof first !== 'object' || !('submissionId' in first)) return;
      const { submissionId } = first as { submissionId: string };
      setQueue((prev) => prev.map((s) => s.id === submissionId ? { ...s } : s));
      if (current?.id === submissionId) loadQueue();
    },
  });

  function openSubmission(sub: HomeworkSubmission) { setCurrent(sub); setFeedback(sub.teacherFeedback ?? ''); setGradeId(''); setReviewStatus('Passed'); }

  async function handleSave() {
    if (!current) return;
    setSaving(true);
    try {
      await reviewHomework({ submissionId: current.id, teacherFeedback: feedback, gradeValueId: gradeId || undefined, status: reviewStatus });
      const next = queue.find((s) => s.id !== current.id);
      loadQueue();
      if (next) openSubmission(next); else setCurrent(null);
    } finally { setSaving(false); }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.ctrlKey && e.key === 'Enter') handleSave(); };

  return (
    <Layout title="Перевірка ДЗ" subtitle="Черга домашніх завдань на перевірку">
      <div className="flex gap-2 mb-5 flex-wrap">
        {courses.map((c) => (
          <button key={c.id} onClick={() => setSelectedCourse(c.id)}
            className={cx('chip', selectedCourse === c.id ? 'bg-brand-600 text-white shadow-[var(--shadow-glow)]' : 'bg-white dark:bg-[#1e2033] text-ink-500 dark:text-[#9aa2bd] ring-1 ring-ink-200 dark:ring-[#2d3148] hover:ring-brand-200 dark:hover:ring-brand-700')}>
            {c.title}
            {queue.length > 0 && selectedCourse === c.id && <span className="ml-1.5 bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{queue.length}</span>}
          </button>
        ))}
      </div>

      {current ? (
        <div className="grid lg:grid-cols-2 gap-4 h-[calc(100vh-230px)]">
          {/* Submission */}
          <Card className="p-5 overflow-y-auto flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Avatar name={current.studentName} />
              <div className="min-w-0">
                <p className="font-bold text-ink-900 dark:text-white truncate">{current.studentName}</p>
                <p className="text-xs text-ink-400">{new Date(current.updatedAt).toLocaleString('uk')}</p>
              </div>
              <Badge tone="amber" className="ml-auto">На перевірці</Badge>
            </div>
            <div className="text-sm text-ink-700 dark:text-[#b0b8d0] whitespace-pre-wrap bg-ink-50 dark:bg-[#1e2033] border border-ink-100 dark:border-[#282c44] rounded-xl p-4 flex-1 leading-relaxed">
              {current.submissionData || <span className="text-ink-300 italic">Відповідь не надана</span>}
            </div>
          </Card>

          {/* Review */}
          <Card className="p-5 flex flex-col gap-4" onKeyDown={handleKeyDown}>
            {current.aiFeedbackDraft && (
              <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-800/40 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-brand-600 uppercase tracking-wider flex items-center gap-1.5">🤖 AI Рецензія</span>
                  <button onClick={() => setFeedback(current.aiFeedbackDraft ?? '')} className="btn btn-soft py-1 px-2.5 text-xs">Вставити</button>
                </div>
                <p className="text-sm text-brand-800/80 whitespace-pre-wrap">{current.aiFeedbackDraft}</p>
              </div>
            )}
            <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Фідбек викладача… (Ctrl+Enter — зберегти)"
              className="input flex-1 min-h-32 resize-none" />
            {/* Status selector */}
            <div className="flex gap-2">
              <button onClick={() => setReviewStatus('Passed')}
                className={cx('flex-1 py-2 rounded-xl text-sm font-semibold transition border-2',
                  reviewStatus === 'Passed' ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'border-ink-100 dark:border-[#282c44] text-ink-500 dark:text-[#6b7394] hover:border-emerald-200')}>
                ✅ Зараховано
              </button>
              <button onClick={() => setReviewStatus('RequiresChanges')}
                className={cx('flex-1 py-2 rounded-xl text-sm font-semibold transition border-2',
                  reviewStatus === 'RequiresChanges' ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400' : 'border-ink-100 dark:border-[#282c44] text-ink-500 dark:text-[#6b7394] hover:border-amber-200')}>
                🔄 Доопрацювати
              </button>
            </div>

            {gradeScale && (
              <select value={gradeId} onChange={(e) => setGradeId(e.target.value)} className="input">
                <option value="">— Виберіть оцінку —</option>
                {gradeScale.values.map((v) => <option key={v.id} value={v.id}>{v.valueString}</option>)}
              </select>
            )}
            <button onClick={handleSave} disabled={saving} className="btn btn-primary py-3">
              {saving ? 'Збереження…' : 'Зберегти та наступний (Ctrl+Enter)'}
            </button>
          </Card>
        </div>
      ) : (
        <EmptyState icon="✅" title="Черга перевірки порожня" hint="Усі домашні завдання перевірено. Чудова робота!" />
      )}
    </Layout>
  );
}
