import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Layout } from '../../components/Layout';
import { Card, Loader, Badge, cx } from '../../components/ui';
import { getCourses } from '../../api/courses';
import { getSchedule } from '../../api/schedule';
import { getReviewQueue } from '../../api/homeworks';
import type { Course, ScheduleEntry, HomeworkSubmission } from '../../types';

interface TeacherStats {
  totalStudents: number;
  pendingReviews: number;
  todayLessons: number;
  coursesCount: number;
}

const quickActions = [
  { icon: '📚', label: 'Мої курси',     desc: 'Редагування матеріалів',  href: '/admin/courses',       color: 'from-brand-500 to-brand-700' },
  { icon: '✅', label: 'Перевірка ДЗ', desc: 'Незавершені завдання',    href: '/teacher/review',      color: 'from-emerald-500 to-emerald-700' },
  { icon: '📋', label: 'Журнал',        desc: 'Відвідуваність та оцінки', href: '/teacher/journal',     color: 'from-sky-500 to-sky-700' },
  { icon: '📊', label: 'Журнал оцінок', desc: 'Таблиця успішності',      href: '/teacher/gradebook',   color: 'from-amber-500 to-amber-700' },
  { icon: '📝', label: 'Заявки',        desc: 'Запити на зарахування',   href: '/teacher/requests',    color: 'from-fuchsia-500 to-fuchsia-700' },
  { icon: '❓', label: 'Банк питань',   desc: 'Тести та питання',        href: '/admin/question-bank', color: 'from-rose-500 to-rose-700' },
];

export function TeacherDashboardPage() {
  const [courses, setCourses]     = useState<Course[]>([]);
  const [schedule, setSchedule]   = useState<ScheduleEntry[]>([]);
  const [pendingHw, setPendingHw] = useState<HomeworkSubmission[]>([]);
  const [loading, setLoading]     = useState(true);
  const [stats, setStats]         = useState<TeacherStats | null>(null);

  useEffect(() => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const in7days  = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10);

    Promise.all([
      getCourses().then(r => r.data),
      getSchedule(todayStr, in7days).then(r => { setSchedule(r.data); return null; }),
    ])
      .then(([coursesData]) => {
        if (!coursesData) return;
        setCourses(coursesData);
        setStats({ coursesCount: coursesData.length, totalStudents: 0, pendingReviews: 0, todayLessons: 0 });

        if (coursesData.length === 0) return;
        // Load review queues for all courses — counts pending HW and fills the preview list
        Promise.all(
          coursesData.map(c =>
            getReviewQueue(c.id).then(q => q.data).catch(() => [] as HomeworkSubmission[])
          )
        ).then(queues => {
          const allPending = queues.flat();
          setPendingHw(allPending.slice(0, 5));
          setStats(s => s ? { ...s, pendingReviews: allPending.length } : s);
        }).catch(() => {});
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const todayStr = new Date().toISOString().slice(0, 10);
  const todaySchedule = schedule.filter(s => s.startsAt.startsWith(todayStr));
  const upcomingSchedule = schedule.filter(s => !s.startsAt.startsWith(todayStr)).slice(0, 3);

  if (loading) return <Layout title="Кабінет викладача"><Loader /></Layout>;

  return (
    <Layout title="Кабінет викладача" subtitle="Ваші курси, завдання та розклад в одному місці">

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Моїх курсів',       value: courses.length,             icon: '📚', color: 'text-brand-600 bg-brand-50' },
          { label: 'ДЗ на перевірці',   value: stats?.pendingReviews ?? 0, icon: '📋', color: 'text-amber-600 bg-amber-50' },
          { label: 'Занять сьогодні',   value: todaySchedule.length,       icon: '📅', color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Занять на тижні',   value: schedule.length,            icon: '🗓️',  color: 'text-sky-600 bg-sky-50' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
            <Card className="p-5 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 ${s.color}`}>{s.icon}</div>
              <div>
                <p className="text-2xl font-extrabold text-ink-900 dark:text-white">{s.value}</p>
                <p className="text-xs text-ink-400 font-medium">{s.label}</p>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-8">

        {/* Quick actions */}
        <div className="lg:col-span-2">
          <h2 className="font-bold text-ink-800 dark:text-white text-base mb-3">Швидкий доступ</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {quickActions.map((a, i) => (
              <motion.div key={a.href} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 + i * 0.05 }}>
                <Link to={a.href}>
                  <Card hover className="p-4 flex items-center gap-3 group">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${a.color} flex items-center justify-center text-xl flex-shrink-0 shadow-md transition group-hover:scale-110`}>
                      {a.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-ink-800 dark:text-white text-sm truncate">{a.label}</p>
                      <p className="text-xs text-ink-400 truncate">{a.desc}</p>
                    </div>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Today's schedule */}
        <div>
          <h2 className="font-bold text-ink-800 dark:text-white text-base mb-3">Сьогодні</h2>
          <Card className="overflow-hidden">
            {todaySchedule.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-2xl mb-2">☕</p>
                <p className="text-sm font-semibold text-ink-600 dark:text-ink-300">Занять сьогодні немає</p>
                <p className="text-xs text-ink-400 mt-1">Насолоджуйтесь вільним днем</p>
              </div>
            ) : todaySchedule.map((s, i) => (
              <div key={s.id} className={cx('flex items-center gap-3 px-4 py-3', i < todaySchedule.length - 1 && 'border-b border-ink-50 dark:border-ink-800')}>
                <div className="w-12 text-center flex-shrink-0">
                  <p className="text-sm font-extrabold text-brand-600">
                    {new Date(s.startsAt).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-[10px] text-ink-400">{s.durationMinutes} хв</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink-800 dark:text-white truncate">{s.lessonTitle}</p>
                  <p className="text-xs text-ink-400 truncate">{s.courseTitle}</p>
                </div>
              </div>
            ))}
          </Card>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">

        {/* Pending HW */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-ink-800 dark:text-white text-base">ДЗ на перевірці</h2>
            <Link to="/teacher/review" className="text-xs text-brand-600 hover:text-brand-700 font-semibold">Всі →</Link>
          </div>
          <Card className="overflow-hidden">
            {pendingHw.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-2xl mb-2">✅</p>
                <p className="text-sm font-semibold text-ink-600 dark:text-ink-300">Всі роботи перевірено</p>
              </div>
            ) : pendingHw.map((hw, i) => (
              <Link key={hw.id} to="/teacher/review"
                className={cx('flex items-center gap-3 px-4 py-3 hover:bg-brand-50/40 transition', i < pendingHw.length - 1 && 'border-b border-ink-50 dark:border-ink-800')}>
                <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-sm flex-shrink-0">
                  {hw.studentName.split(' ').map(p => p[0]).join('').toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink-800 dark:text-white truncate">{hw.studentName}</p>
                  <p className="text-xs text-ink-400 truncate">{new Date(hw.updatedAt).toLocaleDateString('uk-UA')}</p>
                </div>
                <Badge tone="amber">На перевірці</Badge>
              </Link>
            ))}
          </Card>
        </div>

        {/* Upcoming schedule */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-ink-800 dark:text-white text-base">Найближчі заняття</h2>
            <Link to="/calendar" className="text-xs text-brand-600 hover:text-brand-700 font-semibold">Розклад →</Link>
          </div>
          <Card className="overflow-hidden">
            {upcomingSchedule.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-2xl mb-2">📅</p>
                <p className="text-sm font-semibold text-ink-600 dark:text-ink-300">Немає запланованих занять</p>
              </div>
            ) : upcomingSchedule.map((s, i) => (
              <div key={s.id} className={cx('flex items-center gap-3 px-4 py-3', i < upcomingSchedule.length - 1 && 'border-b border-ink-50 dark:border-ink-800')}>
                <div className="w-12 flex-shrink-0 text-center">
                  <p className="text-xs font-bold text-ink-600 dark:text-ink-300">
                    {new Date(s.startsAt).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' })}
                  </p>
                  <p className="text-[11px] text-brand-600 font-semibold">
                    {new Date(s.startsAt).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink-800 dark:text-white truncate">{s.lessonTitle}</p>
                  <p className="text-xs text-ink-400 truncate">{s.courseTitle}</p>
                </div>
                <span className="text-xs text-ink-400 flex-shrink-0">{s.durationMinutes} хв</span>
              </div>
            ))}
          </Card>
        </div>

        {/* My courses */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-ink-800 dark:text-white text-base">Мої курси</h2>
            <Link to="/admin/courses" className="text-xs text-brand-600 hover:text-brand-700 font-semibold">Редагувати →</Link>
          </div>
          {courses.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-3xl mb-3">📚</p>
              <p className="font-semibold text-ink-600 dark:text-ink-300 mb-1">Курсів поки немає</p>
              <Link to="/admin/courses" className="btn btn-primary text-sm mt-3">Створити курс</Link>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {courses.slice(0, 6).map((c, i) => (
                <motion.div key={c.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.05 }}>
                  <Link to="/admin/courses">
                    <Card hover className="p-4 group">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="font-bold text-ink-800 dark:text-white text-sm leading-snug line-clamp-2 flex-1">{c.title}</p>
                        <Badge tone={c.status === 'Published' ? 'green' : 'amber'} className="flex-shrink-0">
                          {c.status === 'Published' ? 'Опубл.' : 'Чернетка'}
                        </Badge>
                      </div>
                      {c.description && (
                        <p className="text-xs text-ink-400 line-clamp-2 mb-2">{c.description}</p>
                      )}
                      <p className="text-[10px] text-ink-400">
                        {new Date(c.createdAt).toLocaleDateString('uk-UA', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>

      </div>
    </Layout>
  );
}
