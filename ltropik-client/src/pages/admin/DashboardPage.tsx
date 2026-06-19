import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Layout } from '../../components/Layout';
import { Card, Loader, Badge } from '../../components/ui';
import api from '../../api/client';
import { linkParent } from '../../api/parent';
import { getUsers } from '../../api/users';
import type { UserItem } from '../../api/users';

interface Summary {
  totalStudents: number; totalTeachers: number; totalCourses: number;
  totalRevenue: number; thisMonthRevenue: number; pendingHw: number;
}

const quickActions = [
  { icon: '📚', label: 'Курси', desc: 'Конструктор уроків', href: '/admin/courses', color: 'from-brand-500 to-brand-700' },
  { icon: '👥', label: 'Користувачі', desc: 'Керування акаунтами', href: '/admin/users', color: 'from-sky-500 to-sky-700' },
  { icon: '📊', label: 'Аналітика', desc: 'Звіти та графіки', href: '/admin/analytics', color: 'from-emerald-500 to-emerald-700' },
  { icon: '🗓️', label: 'Розклад', desc: 'Заняття та календар', href: '/calendar', color: 'from-amber-500 to-amber-700' },
  { icon: '👥', label: 'Групи', desc: 'Класи студентів', href: '/admin/groups', color: 'from-fuchsia-500 to-fuchsia-700' },
  { icon: '❓', label: 'Банк питань', desc: 'Тестові питання', href: '/admin/question-bank', color: 'from-rose-500 to-rose-700' },
];

export function AdminDashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  // Parent linking state
  const [parents, setParents] = useState<UserItem[]>([]);
  const [students, setStudents] = useState<UserItem[]>([]);
  const [parentId, setParentId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkMsg, setLinkMsg] = useState('');

  useEffect(() => {
    api.get<Summary>('/analytics/summary')
      .then(r => setSummary(r.data))
      .catch(() => setSummary({ totalStudents: 0, totalTeachers: 0, totalCourses: 0, totalRevenue: 0, thisMonthRevenue: 0, pendingHw: 0 }))
      .finally(() => setLoading(false));

    Promise.all([
      getUsers({ role: 'Parent' }),
      getUsers({ role: 'Student' }),
    ]).then(([p, s]) => {
      setParents(p.data.items);
      setStudents(s.data.items);
    }).catch(() => {});
  }, []);

  async function handleLink() {
    if (!parentId || !studentId) return;
    setLinking(true); setLinkMsg('');
    try {
      await linkParent(parentId, studentId);
      setLinkMsg('✅ Прив\'язано успішно!');
      setParentId(''); setStudentId('');
    } catch {
      setLinkMsg('❌ Помилка — можливо вже прив\'язано');
    } finally { setLinking(false); }
  }

  const stats = summary ? [
    { label: 'Студентів', value: summary.totalStudents, icon: '🎓', color: 'text-brand-600 bg-brand-50 dark:bg-brand-900/30 dark:text-brand-400' },
    { label: 'Викладачів', value: summary.totalTeachers, icon: '👩‍🏫', color: 'text-sky-600 bg-sky-50 dark:bg-sky-900/30 dark:text-sky-400' },
    { label: 'Курсів', value: summary.totalCourses, icon: '📚', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400' },
    { label: 'ДЗ на перевірці', value: summary.pendingHw, icon: '📋', color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400' },
  ] : [];

  return (
    <Layout title="Панель адміна" subtitle="Ласкаво просимо! Усі інструменти в одному місці.">
      {/* Stat row */}
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

      {/* Quick actions */}
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
                  <p className="font-bold text-ink-800 dark:text-[#e8eaf0] group-hover:text-brand-600 dark:group-hover:text-brand-400 transition">{a.label}</p>
                  <p className="text-xs text-ink-400 truncate">{a.desc}</p>
                </div>
                <svg className="w-4 h-4 text-ink-200 ml-auto flex-shrink-0 group-hover:text-brand-400 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Parent–Student linking */}
      <div className="grid lg:grid-cols-2 gap-5">
        <Card className="p-5">
          <h2 className="font-bold text-ink-800 dark:text-white mb-1">Прив'язати батьків до студента</h2>
          <p className="text-sm text-ink-400 mb-4">Батьки зможуть бачити успіхи дитини у своєму кабінеті</p>
          <div className="flex flex-col gap-3">
            <div>
              <label className="label">Батьківський акаунт</label>
              <select value={parentId} onChange={e => setParentId(e.target.value)} className="input">
                <option value="">— Обрати батьків —</option>
                {parents.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.email})</option>)}
              </select>
              {parents.length === 0 && <p className="text-xs text-ink-400 mt-1">Немає акаунтів з роллю Parent — зареєструйте спочатку</p>}
            </div>
            <div>
              <label className="label">Студент</label>
              <select value={studentId} onChange={e => setStudentId(e.target.value)} className="input">
                <option value="">— Обрати студента —</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.email})</option>)}
              </select>
            </div>
            {linkMsg && (
              <p className={`text-sm font-medium ${linkMsg.startsWith('✅') ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{linkMsg}</p>
            )}
            <button onClick={handleLink} disabled={!parentId || !studentId || linking} className="btn btn-primary">
              {linking ? 'Прив\'язую…' : '🔗 Прив\'язати'}
            </button>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-bold text-ink-800 dark:text-white mb-1">Фінанси</h2>
          <p className="text-sm text-ink-400 mb-4">Зведення за поточний місяць</p>
          {summary ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between py-3 border-b border-ink-50 dark:border-[#102a1d]">
                <span className="text-sm text-ink-500 dark:text-[#6b7394]">Дохід цього місяця</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-lg">{summary.thisMonthRevenue.toLocaleString()} ₴</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-ink-50 dark:border-[#102a1d]">
                <span className="text-sm text-ink-500 dark:text-[#6b7394]">Загальний дохід</span>
                <span className="font-bold text-ink-800 dark:text-[#e8eaf0] text-lg">{summary.totalRevenue.toLocaleString()} ₴</span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-ink-500 dark:text-[#6b7394]">ДЗ на перевірці</span>
                <Badge tone={summary.pendingHw > 0 ? 'amber' : 'green'}>{summary.pendingHw}</Badge>
              </div>
              <Link to="/admin/analytics" className="btn btn-soft text-center mt-1">Детальна аналітика →</Link>
            </div>
          ) : <Loader />}
        </Card>
      </div>
    </Layout>
  );
}
