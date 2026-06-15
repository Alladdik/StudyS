import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Layout } from '../../components/Layout';
import { Card, Loader } from '../../components/ui';
import api from '../../api/client';

interface Summary {
  totalStudents: number;
  totalTeachers: number;
  totalCourses: number;
  pendingHw: number;
}

const quickActions = [
  { icon: '👥', label: 'Користувачі',  desc: 'Перегляд акаунтів',       href: '/admin/users',             color: 'from-sky-500 to-sky-700' },
  { icon: '📊', label: 'Аналітика',    desc: 'Звіти та графіки',         href: '/admin/analytics',         color: 'from-emerald-500 to-emerald-700' },
  { icon: '🗓️', label: 'Розклад',      desc: 'Заняття та календар',     href: '/calendar',                color: 'from-amber-500 to-amber-700' },
  { icon: '👥', label: 'Групи',        desc: 'Класи студентів',          href: '/admin/groups',            color: 'from-fuchsia-500 to-fuchsia-700' },
  { icon: '🏆', label: 'Викладачі',    desc: 'Аналітика роботи',         href: '/admin/teacher-analytics', color: 'from-rose-500 to-rose-700' },
  { icon: '🛍️', label: 'Магазин',      desc: 'Управління товарами',      href: '/admin/shop',              color: 'from-orange-500 to-orange-700' },
  { icon: '❓', label: 'Банк питань',  desc: 'Тести та питання',         href: '/admin/question-bank',     color: 'from-violet-500 to-violet-700' },
  { icon: '📝', label: 'Заявки',       desc: 'Запити на зарахування',    href: '/admin/requests',          color: 'from-teal-500 to-teal-700' },
];

export function ManagerDashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Summary>('/analytics/summary')
      .then(r => setSummary(r.data))
      .catch(() => setSummary({ totalStudents: 0, totalTeachers: 0, totalCourses: 0, pendingHw: 0 }))
      .finally(() => setLoading(false));
  }, []);

  const stats = summary ? [
    { label: 'Студентів',       value: summary.totalStudents, icon: '🎓', color: 'text-brand-600 bg-brand-50' },
    { label: 'Викладачів',      value: summary.totalTeachers, icon: '👩‍🏫', color: 'text-sky-600 bg-sky-50' },
    { label: 'Курсів',          value: summary.totalCourses,  icon: '📚', color: 'text-emerald-600 bg-emerald-50' },
    { label: 'ДЗ на перевірці', value: summary.pendingHw,     icon: '📋', color: 'text-amber-600 bg-amber-50' },
  ] : [];

  return (
    <Layout title="Кабінет менеджера" subtitle="Управління школою без системних налаштувань">
      {loading ? <Loader /> : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {stats.map((s, i) => (
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
      )}

      <h2 className="font-bold text-ink-800 dark:text-white text-base mb-3">Швидкий доступ</h2>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
        {quickActions.map((a, i) => (
          <motion.div key={a.href} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 + i * 0.05 }}>
            <Link to={a.href}>
              <Card hover className="p-5 flex items-center gap-4 group">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${a.color} flex items-center justify-center text-2xl flex-shrink-0 shadow-lg transition group-hover:scale-110`}>
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

      {/* Notice about restricted access */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl text-sm">
        <span className="text-xl flex-shrink-0">🔐</span>
        <div>
          <p className="font-semibold text-amber-800 dark:text-amber-300">Обмежений доступ</p>
          <p className="text-amber-700 dark:text-amber-400 text-xs mt-0.5">
            Журнал дій, системний моніторинг та налаштування сервера доступні лише адміністратору.
            Якщо потрібен доступ — зверніться до адміна.
          </p>
        </div>
      </div>
    </Layout>
  );
}
