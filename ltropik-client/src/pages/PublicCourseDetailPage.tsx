import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../api/client';
import { useAuthStore } from '../store/authStore';
import { PublicNav, PublicFooter, PublicPage, Stars, dashboardPath } from '../components/PublicChrome';

interface PublicLesson { title: string; sortOrder: number; }
interface PublicModule { title: string; sortOrder: number; lessonCount: number; lessons: PublicLesson[]; }
interface PublicReview { rating: number; comment?: string; createdAt: string; studentName: string; }
interface CourseDetail {
  id: string;
  title: string;
  description?: string;
  createdAt: string;
  modules: PublicModule[];
  rating?: number | null;
  reviewCount: number;
  reviews: PublicReview[];
}

function ModuleRow({ m, index, defaultOpen }: { m: PublicModule; index: number; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-ink-50 dark:hover:bg-[#102a1d] transition">
        <span className="w-7 h-7 rounded-lg bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
          {index + 1}
        </span>
        <span className="font-bold text-ink-900 dark:text-white flex-1">{m.title}</span>
        <span className="text-xs text-ink-400 dark:text-[#6b7394]">{m.lessonCount} уроків</span>
        <span className={`text-ink-300 dark:text-[#4d5470] transition-transform ${open ? 'rotate-90' : ''}`}>▸</span>
      </button>
      {open && (
        <div className="px-5 pb-4 pl-14 flex flex-col gap-2 border-t border-ink-100 dark:border-[#1c3a2a] pt-3">
          {m.lessons.length === 0
            ? <p className="text-xs text-ink-400 dark:text-[#4d5470] italic">Уроки готуються</p>
            : m.lessons.map((l, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-ink-600 dark:text-[#9aa2bd]">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-300 dark:bg-brand-700 flex-shrink-0" />
                  {l.title}
                </div>
              ))}
        </div>
      )}
    </div>
  );
}

export function PublicCourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token, role } = useAuthStore();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.get<CourseDetail>(`/courses/${id}/public`)
      .then(r => setCourse(r.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  const lessonTotal = course?.modules.reduce((s, m) => s + m.lessonCount, 0) ?? 0;

  return (
    <PublicPage>
      <PublicNav />

      {loading ? (
        <div className="max-w-6xl mx-auto px-6 py-12 flex flex-col gap-4">
          <div className="h-40 rounded-3xl skeleton" />
          <div className="h-64 rounded-2xl skeleton" />
        </div>
      ) : notFound || !course ? (
        <div className="max-w-2xl mx-auto px-6 py-24 text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h1 className="text-2xl font-extrabold text-ink-900 dark:text-white">Курс не знайдено</h1>
          <p className="text-ink-500 dark:text-[#9aa2bd] mt-2">Можливо, його ще не опубліковано або посилання застаріле.</p>
          <Link to="/courses" className="btn btn-primary mt-6 inline-flex">← До каталогу</Link>
        </div>
      ) : (
        <>
          {/* Breadcrumb */}
          <div className="max-w-6xl mx-auto px-6 pt-8">
            <Link to="/courses" className="text-sm font-semibold text-ink-400 dark:text-[#6b7394] hover:text-brand-600 dark:hover:text-brand-400 transition">
              ← Усі курси
            </Link>
          </div>

          <div className="max-w-6xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main column */}
            <div className="lg:col-span-2 flex flex-col gap-8">
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-mint-500 to-brand-700 flex items-center justify-center text-forest-950 font-extrabold text-3xl mb-5 shadow-[0_0_24px_rgba(0,230,118,.4)]">
                  {course.title[0]?.toUpperCase()}
                </div>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-ink-900 dark:text-white tracking-tight">{course.title}</h1>
                <div className="flex flex-wrap items-center gap-4 mt-4">
                  <Stars rating={course.rating} />
                  {course.reviewCount > 0 && (
                    <span className="text-sm text-ink-400 dark:text-[#6b7394]">{course.reviewCount} відгуків</span>
                  )}
                </div>
                {course.description && (
                  <p className="text-ink-600 dark:text-[#9aa2bd] text-lg mt-5 leading-relaxed whitespace-pre-line">{course.description}</p>
                )}
              </motion.div>

              {/* Program */}
              <div>
                <h2 className="text-2xl font-extrabold text-ink-900 dark:text-white tracking-tight mb-4">Програма курсу</h2>
                {course.modules.length === 0 ? (
                  <div className="card p-8 text-center text-ink-400 dark:text-[#6b7394]">Програма готується</div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {course.modules.map((m, i) => (
                      <ModuleRow key={i} m={m} index={i} defaultOpen={i === 0} />
                    ))}
                  </div>
                )}
              </div>

              {/* Reviews */}
              {course.reviews.length > 0 && (
                <div>
                  <h2 className="text-2xl font-extrabold text-ink-900 dark:text-white tracking-tight mb-4">Відгуки учнів</h2>
                  <div className="flex flex-col gap-3">
                    {course.reviews.map((r, i) => (
                      <div key={i} className="card p-5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-bold text-ink-900 dark:text-white">{r.studentName}</span>
                          <Stars rating={r.rating} />
                        </div>
                        {r.comment && <p className="text-ink-600 dark:text-[#9aa2bd] text-sm mt-2 leading-relaxed">{r.comment}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sticky CTA card */}
            <div className="lg:col-span-1">
              <div className="card p-6 lg:sticky lg:top-24 flex flex-col gap-4">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-ink-500 dark:text-[#9aa2bd]">📚 Модулів</span>
                    <span className="font-bold text-ink-900 dark:text-white">{course.modules.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-ink-500 dark:text-[#9aa2bd]">📖 Уроків</span>
                    <span className="font-bold text-ink-900 dark:text-white">{lessonTotal}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-ink-500 dark:text-[#9aa2bd]">⭐ Рейтинг</span>
                    <span className="font-bold text-ink-900 dark:text-white">{course.rating ? course.rating.toFixed(1) : '—'}</span>
                  </div>
                </div>

                <div className="border-t border-ink-100 dark:border-[#1c3a2a] pt-4">
                  {token ? (
                    <>
                      <Link to={dashboardPath(role)} className="btn btn-primary w-full">Перейти до кабінету</Link>
                      <p className="text-xs text-ink-400 dark:text-[#6b7394] text-center mt-3">Запис на курс — у вашому кабінеті</p>
                    </>
                  ) : (
                    <>
                      <Link to="/register" className="btn btn-primary w-full">Записатися на курс</Link>
                      <p className="text-xs text-ink-400 dark:text-[#6b7394] text-center mt-3">
                        Вже маєте акаунт?{' '}
                        <Link to="/login" className="font-bold text-brand-600 dark:text-brand-400 hover:underline">Увійти</Link>
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <PublicFooter />
    </PublicPage>
  );
}
