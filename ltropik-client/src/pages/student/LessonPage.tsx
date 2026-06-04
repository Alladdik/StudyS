import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Layout } from '../../components/Layout';
import { ContentBlockRenderer } from '../../components/ContentBlockRenderer';
import { AiMentorChat } from '../../components/AiMentorChat';
import { LessonComments } from '../../components/LessonComments';
import { LessonNotes } from '../../components/LessonNotes';
import { FlashcardsPanel } from '../../components/FlashcardsPanel';
import api from '../../api/client';
import { markLessonComplete, getCourseProgress } from '../../api/progress';
import type { Lesson, Homework } from '../../types/index';
import { Card, Loader, EmptyState, toast } from '../../components/ui';

interface LessonWithHomework extends Lesson {
  homeworks?: Homework[];
  tests?: { id: string; title: string }[];
}

export function LessonPage() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const courseId = params.get('courseId') ?? '';
  const [lesson, setLesson] = useState<LessonWithHomework | null>(null);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [progressPct, setProgressPct] = useState<number | null>(null);
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkId, setBookmarkId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.get<LessonWithHomework>(`/lessons/${id}`).then((r) => setLesson(r.data)).catch(console.error).finally(() => setLoading(false));
    // Check if bookmarked
    api.get<{ id: string; type: string; refId: string }[]>('/bookmarks').then(r => {
      const bm = r.data.find(b => b.type === 'lesson' && b.refId === id);
      if (bm) { setBookmarked(true); setBookmarkId(bm.id); }
    }).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!id || !courseId) return;
    getCourseProgress(courseId).then((r) => {
      setCompleted(r.data.completedLessonIds.includes(id));
      setProgressPct(r.data.progressPercent);
    }).catch(() => {});
  }, [id, courseId]);

  const toggleBookmark = useCallback(async () => {
    if (!id || !lesson) return;
    try {
      if (bookmarked && bookmarkId) {
        await api.delete(`/bookmarks/${bookmarkId}`);
        setBookmarked(false); setBookmarkId(null);
        toast('info', 'Закладку видалено');
      } else {
        const r = await api.post<{ id: string; toggled: boolean }>('/bookmarks', { type: 'lesson', refId: id, title: lesson.title });
        setBookmarked(true); setBookmarkId(r.data.id);
        toast('success', 'Урок збережено в закладки');
      }
    } catch {
      toast('error', 'Не вдалося оновити закладку');
    }
  }, [id, lesson, bookmarked, bookmarkId]);

  async function handleComplete() {
    if (!id) return;
    await markLessonComplete(id);
    setCompleted(true);
    if (courseId) {
      const r = await getCourseProgress(courseId).catch(() => null);
      if (r) setProgressPct(r.data.progressPercent);
    }
  }

  if (loading) return <Layout><Loader label="Завантаження уроку…" /></Layout>;
  if (!lesson) return <Layout><EmptyState title="Урок не знайдено" /></Layout>;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-ink-400 mb-5">
          <Link to="/student/courses" className="hover:text-brand-600 transition">Курси</Link>
          <span>›</span>
          <span className="text-ink-600 font-medium">{lesson.title}</span>
        </div>

        <div className="flex items-start justify-between gap-4 mb-7">
          <h1 className="text-3xl font-extrabold text-ink-900 dark:text-white tracking-tight">{lesson.title}</h1>
          <div className="flex items-center gap-2 flex-shrink-0 mt-1">
            <FlashcardsPanel
              lessonId={lesson.id}
              lessonTitle={lesson.title}
              lessonText={lesson.contentBlocks
                ? lesson.contentBlocks.map((b: any) => b.content ?? b.text ?? '').join(' ')
                : lesson.title}
            />
            <button
              onClick={toggleBookmark}
              title={bookmarked ? 'Видалити закладку' : 'Додати в закладки'}
              className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-semibold transition ${
                bookmarked
                  ? 'bg-amber-50 dark:bg-[#2a1e00] border-amber-300 dark:border-[#5a3e00] text-amber-700 dark:text-amber-300'
                  : 'bg-white dark:bg-[#1a1c2e] border-ink-200 dark:border-[#282c44] text-ink-500 dark:text-[#9aa2bd] hover:border-amber-300 hover:text-amber-600'
              }`}
            >
              <span>{bookmarked ? '🔖' : '🏷️'}</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-5">
          {lesson.contentBlocks && lesson.contentBlocks.length > 0 ? (
            lesson.contentBlocks.map((block, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                <Card className="p-6"><ContentBlockRenderer block={block} /></Card>
              </motion.div>
            ))
          ) : (
            <Card className="p-10"><EmptyState icon="📝" title="Контент уроку ще не додано" /></Card>
          )}
        </div>

        {/* Homework */}
        {lesson.homeworks && lesson.homeworks.length > 0 && (
          <div className="mt-10">
            <h2 className="text-lg font-bold text-ink-900 mb-4 flex items-center gap-2"><span className="text-2xl">📋</span> Домашні завдання</h2>
            <div className="flex flex-col gap-3">
              {lesson.homeworks.map((hw) => (
                <Link key={hw.id} to={`/student/homework/${hw.id}?courseId=${courseId}`}>
                  <Card hover className="p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink-800">Завдання</p>
                      <p className="text-sm text-ink-400 mt-0.5 line-clamp-2">{hw.instruction}</p>
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center flex-shrink-0">→</div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Tests */}
        {lesson.tests && lesson.tests.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-bold text-ink-900 mb-4 flex items-center gap-2"><span className="text-2xl">✅</span> Тести</h2>
            <div className="flex flex-col gap-3">
              {lesson.tests.map((test) => (
                <Link key={test.id} to={`/student/test/${test.id}`}>
                  <Card hover className="p-4 flex items-center justify-between gap-4">
                    <p className="font-semibold text-ink-800">{test.title}</p>
                    <span className="chip bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">Пройти</span>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Course progress bar */}
        {progressPct !== null && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-ink-500">Прогрес курсу</span>
              <span className="text-xs font-bold text-brand-600">{progressPct}%</span>
            </div>
            <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-brand-500 to-brand-600 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )}

        {/* Mark complete button */}
        <div className="mt-6">
          <button
            onClick={handleComplete}
            disabled={completed}
            className={completed
              ? 'w-full py-3 rounded-2xl bg-emerald-50 text-emerald-700 font-bold border border-emerald-200'
              : 'btn btn-primary w-full py-3'}
          >
            {completed ? '✓ Урок пройдено' : 'Позначити урок як пройдений'}
          </button>
        </div>

        {/* Notes */}
        <LessonNotes lessonId={lesson.id} />

        {/* Comments */}
        <LessonComments lessonId={lesson.id} />

        <div className="h-24" />
      </div>

      {courseId && (
        <AiMentorChat
          courseId={courseId}
          maxMessages={20}
          lessonContext={lesson.contentBlocks
            ? lesson.contentBlocks.map((b: any) => b.content ?? b.text ?? '').join(' ').slice(0, 800)
            : lesson.title}
        />
      )}
    </Layout>
  );
}
