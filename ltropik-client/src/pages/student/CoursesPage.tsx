import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Layout } from '../../components/Layout';
import { getCourses, getCourse } from '../../api/courses';
import { getCourseProgress } from '../../api/progress';
import api from '../../api/client';
import type { Course, Module, CourseProgressInfo } from '../../types';
import { Card, Badge, Loader, EmptyState, cx } from '../../components/ui';

type CourseWithModules = Course & { modules: Module[] };

export function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, CourseWithModules>>({});
  const [progressMap, setProgressMap] = useState<Record<string, CourseProgressInfo>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCourses().then(async (r) => {
      setCourses(r.data);
      // Fetch progress for each course in parallel
      const progressEntries = await Promise.all(
        r.data.map((c) => getCourseProgress(c.id).then((p) => [c.id, p.data] as [string, CourseProgressInfo]).catch(() => null))
      );
      const map: Record<string, CourseProgressInfo> = {};
      for (const entry of progressEntries) { if (entry) map[entry[0]] = entry[1]; }
      setProgressMap(map);
    }).finally(() => setLoading(false));
  }, []);

  async function toggleCourse(course: Course) {
    if (expanded === course.id) { setExpanded(null); return; }
    setExpanded(course.id);
    if (!details[course.id]) {
      const { data } = await getCourse(course.id);
      setDetails((prev) => ({ ...prev, [course.id]: data }));
    }
  }

  if (loading) return <Layout title="Мої курси"><Loader /></Layout>;

  return (
    <Layout title="Мої курси" subtitle="Усі курси, на які ти записаний">
      {courses.length === 0 ? (
        <EmptyState icon="📚" title="Ти ще не записаний на жоден курс" hint="Зверніться до адміністратора, щоб отримати доступ до курсів" />
      ) : (
        <div className="flex flex-col gap-3 max-w-3xl">
          {courses.map((course, idx) => {
            const isOpen = expanded === course.id;
            const courseDetails = details[course.id];
            return (
              <motion.div key={course.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
                <Card className="overflow-hidden">
                  <button onClick={() => toggleCourse(course)}
                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-ink-50/60 transition text-left">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-xl flex-shrink-0 shadow-[var(--shadow-glow)]">
                      📘
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-base font-bold text-ink-900 truncate">{course.title}</h2>
                      {course.description && <p className="text-sm text-ink-400 mt-0.5 truncate">{course.description}</p>}
                    </div>
                    {progressMap[course.id] && (
                      <div className="hidden sm:flex flex-col items-end gap-0.5 flex-shrink-0">
                        <span className="text-xs font-bold text-brand-600">{progressMap[course.id].progressPercent}%</span>
                        <div className="w-20 h-1.5 bg-ink-100 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-500 rounded-full" style={{ width: `${progressMap[course.id].progressPercent}%` }} />
                        </div>
                      </div>
                    )}
                    {progressMap[course.id]?.progressPercent === 100 && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          const r = await api.get(`/certificates/${course.id}`, { responseType: 'blob' });
                          const url = URL.createObjectURL(r.data as Blob);
                          const a = document.createElement('a');
                          a.href = url; a.download = `certificate_${course.id}.pdf`; a.click();
                          URL.revokeObjectURL(url);
                        }}
                        className="chip bg-amber-50 text-amber-700 ring-1 ring-amber-100 hidden sm:flex items-center gap-1 text-xs"
                        title="Завантажити сертифікат"
                      >
                        🏆 Сертифікат
                      </button>
                    )}
                    {course.gradeScaleName && <Badge tone="brand" className="hidden sm:inline-flex">{course.gradeScaleName}</Badge>}
                    <svg className={cx('w-5 h-5 text-ink-300 transition-transform duration-200 flex-shrink-0', isOpen && 'rotate-90')}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5l7 7-7 7" /></svg>
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }} className="overflow-hidden border-t border-ink-100">
                        {courseDetails ? (
                          courseDetails.modules?.length > 0 ? (
                            courseDetails.modules.sort((a, b) => a.sortOrder - b.sortOrder).map((mod) => (
                              <div key={mod.id} className="px-5 py-4 border-b border-ink-50 last:border-0">
                                <p className="text-[11px] font-bold text-ink-300 uppercase tracking-widest mb-2.5">{mod.title}</p>
                                <div className="flex flex-col gap-1">
                                  {mod.lessons.sort((a, b) => a.sortOrder - b.sortOrder).map((lesson, i) => (
                                    <Link key={lesson.id} to={`/student/lesson/${lesson.id}?courseId=${course.id}`}
                                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-brand-50 group transition">
                                      {progressMap[course.id]?.completedLessonIds.includes(lesson.id)
                                        ? <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold">✓</span>
                                        : <span className="w-7 h-7 rounded-lg bg-ink-100 text-ink-500 flex items-center justify-center text-xs font-bold group-hover:bg-brand-600 group-hover:text-white transition">{i + 1}</span>
                                      }
                                      <span className="text-sm text-ink-600 group-hover:text-brand-700 font-medium transition">{lesson.title}</span>
                                      <svg className="w-4 h-4 text-ink-300 ml-auto group-hover:text-brand-500 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                    </Link>
                                  ))}
                                </div>
                              </div>
                            ))
                          ) : <div className="px-5 py-4 text-sm text-ink-400">Уроки ще не додано</div>
                        ) : <div className="px-5 py-6 flex justify-center"><div className="skeleton h-4 w-32" /></div>}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
