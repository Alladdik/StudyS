import { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { StatCard, Card, Loader, Badge, cx } from '../../components/ui';
import api from '../../api/client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Summary {
  totalStudents: number; totalTeachers: number; totalCourses: number;
  totalRevenue: number; thisMonthRevenue: number; pendingHw: number;
}
interface CourseRow { id: string; title: string; students: number; lessons: number; revenue: number; }
interface Activity { date: string; submissions: number; tests: number; }
interface ChurnRow { id: string; name: string; email: string; lastActivity: string; hwPending: number; riskLevel: string; }
interface RevenueRow { month: string; revenue: number; count: number; }

// ── Styles ────────────────────────────────────────────────────────────────────
const COLORS = ['#6535f6', '#8d72ff', '#10b981', '#f59e0b', '#f43f5e', '#3b82f6', '#ec4899'];
const tooltipStyle = { background: '#fff', border: '1px solid #e1e4ee', borderRadius: 14, boxShadow: '0 8px 24px rgba(24,27,41,.08)', fontSize: 12, padding: '8px 12px' };
const tick = { fill: '#9aa2bd', fontSize: 11 };

// ── Error state ───────────────────────────────────────────────────────────────
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="text-5xl">⚠️</div>
      <p className="text-lg font-bold text-ink-800">Не вдалося завантажити дані</p>
      <p className="text-sm text-ink-400">Перевірте підключення до сервера або зверніться до розробника</p>
      <button onClick={onRetry} className="btn btn-primary px-8">🔄 Спробувати знову</button>
    </div>
  );
}

// ── Mini stat inside card ─────────────────────────────────────────────────────
function MiniStat({ label, value, sub, color = 'text-brand-600' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[11px] font-bold text-ink-400 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-ink-400">{sub}</p>}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function AnalyticsPage() {
  const [summary, setSummary]   = useState<Summary | null>(null);
  const [courses, setCourses]   = useState<CourseRow[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [churn, setChurn]       = useState<ChurnRow[]>([]);
  const [revenue, setRevenue]   = useState<RevenueRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);
  const [tab, setTab]           = useState<'overview' | 'courses' | 'revenue' | 'churn'>('overview');

  const load = async () => {
    setLoading(true);
    setError(false);

    try {
      // Use allSettled so one failing endpoint doesn't kill the whole page
      const [s, c, a, ch, rev] = await Promise.allSettled([
        api.get<Summary>('/analytics/summary'),
        api.get<CourseRow[]>('/analytics/courses'),
        api.get<Activity[]>('/analytics/activity?days=30'),
        api.get<ChurnRow[]>('/analytics/churn-risk'),
        api.get<RevenueRow[]>('/analytics/revenue?months=6'),
      ]);

      // Summary is required — if it fails, show error
      if (s.status === 'rejected') {
        console.error('[Analytics] summary failed:', s.reason);
        setError(true);
        return;
      }
      setSummary(s.value.data);
      if (c.status === 'fulfilled') setCourses(c.value.data ?? []);
      if (a.status === 'fulfilled') setActivity((a.value.data ?? []).slice(-30));
      if (ch.status === 'fulfilled') setChurn(ch.value.data ?? []);
      if (rev.status === 'fulfilled') setRevenue(rev.value.data ?? []);

      // Log partial failures
      [c, a, ch, rev].forEach((r, i) => {
        if (r.status === 'rejected')
          console.warn(`[Analytics] endpoint ${['courses','activity','churn','revenue'][i]} failed:`, r.reason);
      });
    } catch (err) {
      console.error('[Analytics] unexpected:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  if (loading) return <Layout title="Аналітика"><Loader /></Layout>;
  if (error || !summary) return <Layout title="Аналітика"><ErrorState onRetry={load} /></Layout>;

  const noActivity = activity.every(a => a.submissions === 0 && a.tests === 0);
  const noRevenue  = revenue.every(r => r.revenue === 0);
  const totalStudents = summary.totalStudents;

  // Derived: avg students per course
  const avgStudents = courses.length > 0 ? Math.round(courses.reduce((s, c) => s + c.students, 0) / courses.length) : 0;

  return (
    <Layout title="Аналітика" subtitle="Дані платформи в реальному часі">

      {/* ── KPI cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard icon="🎓" tone="brand"  value={summary.totalStudents} label="Студентів" delay={0} />
        <StatCard icon="🧑‍🏫" tone="blue"   value={summary.totalTeachers} label="Викладачів" delay={0.05} />
        <StatCard icon="📚" tone="green"  value={summary.totalCourses}  label="Курсів"     delay={0.1} />
        <StatCard icon="📋" tone="amber"  value={summary.pendingHw}     label="ДЗ на перевірці" delay={0.15} />
      </div>

      {/* ── Revenue hero row ──────────────────────────────────────────────── */}
      <div className="grid sm:grid-cols-3 gap-4 mb-5">
        <Card className="p-5 flex items-center gap-4 sm:col-span-1">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-2xl flex-shrink-0">💰</div>
          <MiniStat label="Загальний дохід" value={`${summary.totalRevenue.toLocaleString()} ₴`} color="text-emerald-600" />
        </Card>
        <Card className="p-5 flex items-center gap-4 sm:col-span-1">
          <div className="w-12 h-12 rounded-2xl bg-brand-100 flex items-center justify-center text-2xl flex-shrink-0">📈</div>
          <MiniStat label="Цей місяць" value={`${summary.thisMonthRevenue.toLocaleString()} ₴`} color="text-brand-600" />
        </Card>
        <Card className="p-5 flex items-center gap-4 sm:col-span-1">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center text-2xl flex-shrink-0">👥</div>
          <MiniStat label="Сер. студентів/курс" value={avgStudents} color="text-amber-600" sub={`${courses.length} курсів загалом`} />
        </Card>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 mb-5 bg-ink-100 dark:bg-[#1e2033] rounded-2xl p-1 w-fit flex-wrap">
        {([
          ['overview', '📊 Активність'],
          ['courses',  '📚 Курси'],
          ['revenue',  '💰 Дохід'],
          ['churn',    '⚠️ Відтік'],
        ] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={cx('px-4 py-2 rounded-xl text-sm font-semibold transition',
              tab === t ? 'bg-white dark:bg-[#252840] text-brand-700 dark:text-brand-400 shadow-sm' : 'text-ink-500 dark:text-[#6b7394] hover:text-ink-800 dark:hover:text-[#e8eaf0]')}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Overview ──────────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="flex flex-col gap-4">
          {/* Activity chart */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-ink-800">Активність студентів (30 днів)</h2>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1"><span className="w-3 h-1 rounded bg-brand-500 inline-block" /> ДЗ</span>
                <span className="flex items-center gap-1"><span className="w-3 h-1 rounded bg-emerald-500 inline-block" /> Тести</span>
              </div>
            </div>
            {noActivity ? (
              <div className="flex flex-col items-center justify-center py-16 text-ink-400 gap-2">
                <span className="text-4xl">🚀</span>
                <p className="text-sm">Активності ще немає — зачекайте перших студентів</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={activity}>
                  <defs>
                    <linearGradient id="colorSubmissions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6535f6" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#6535f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorTests" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef0f6" vertical={false} />
                  <XAxis dataKey="date" tick={tick} axisLine={false} tickLine={false} interval={4} />
                  <YAxis tick={tick} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="submissions" stroke="#6535f6" strokeWidth={2.5} fill="url(#colorSubmissions)" name="ДЗ" dot={false} />
                  <Area type="monotone" dataKey="tests" stroke="#10b981" strokeWidth={2.5} fill="url(#colorTests)" name="Тести" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Churn quick look */}
          {churn.length > 0 && (
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-ink-800">⚠️ Студенти з ризиком відтоку</h2>
                <Badge tone="rose">{churn.length}</Badge>
              </div>
              <div className="flex flex-col gap-1.5">
                {churn.slice(0, 5).map(r => (
                  <div key={r.id} className="flex items-center justify-between py-1.5 px-3 rounded-xl hover:bg-ink-50 dark:hover:bg-[#1e2033] transition">
                    <div>
                      <p className="text-sm font-medium text-ink-800">{r.name}</p>
                      <p className="text-xs text-ink-400">{r.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-ink-400">Остання активність: {r.lastActivity}</p>
                      <Badge tone={r.riskLevel === 'high' ? 'rose' : 'amber'}>
                        {r.riskLevel === 'high' ? '🔴 Високий' : '🟡 Середній'}
                      </Badge>
                    </div>
                  </div>
                ))}
                {churn.length > 5 && (
                  <button onClick={() => setTab('churn')} className="text-xs text-brand-600 hover:text-brand-700 text-center py-1.5 transition">
                    Показати всіх ({churn.length}) →
                  </button>
                )}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── Courses ───────────────────────────────────────────────────────── */}
      {tab === 'courses' && (
        <div className="flex flex-col gap-4">
          {courses.length === 0 ? (
            <Card className="p-16 text-center">
              <div className="text-4xl mb-3">📚</div>
              <p className="text-ink-500">Курсів ще немає — створіть перший у конструкторі</p>
            </Card>
          ) : (
            <>
              <div className="grid lg:grid-cols-5 gap-4">
                {/* Bar chart */}
                <Card className="p-5 lg:col-span-3">
                  <h2 className="font-bold text-ink-800 mb-4">Студентів по курсах</h2>
                  <ResponsiveContainer width="100%" height={Math.max(200, courses.length * 44)}>
                    <BarChart data={courses} layout="vertical" barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#eef0f6" horizontal={false} />
                      <XAxis type="number" tick={tick} axisLine={false} tickLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="title" tick={tick} axisLine={false} tickLine={false} width={120} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} студ.`, 'Студентів']} />
                      <Bar dataKey="students" radius={[0, 8, 8, 0]} maxBarSize={28} name="Студентів">
                        {courses.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>

                {/* Pie */}
                <Card className="p-5 lg:col-span-2">
                  <h2 className="font-bold text-ink-800 mb-4">Розподіл</h2>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={courses.filter(c => c.students > 0)} dataKey="students" nameKey="title"
                        cx="50%" cy="50%" outerRadius={80} innerRadius={35} paddingAngle={3}>
                        {courses.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [`${v} студ.`, n]} />
                      <Legend formatter={(v) => <span style={{ color: '#6b7394', fontSize: 11 }}>{v}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>
              </div>

              {/* Table */}
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-ink-100 dark:border-[#282c44] bg-ink-50/60 dark:bg-[#151722]/60">
                        {['#', 'Курс', 'Студентів', 'Уроків', 'Дохід'].map(h => (
                          <th key={h} className="text-left px-5 py-3 text-[11px] font-bold text-ink-400 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {courses.map((c, i) => (
                        <tr key={c.id} className="border-b border-ink-50 dark:border-[#1e2033] last:border-0 hover:bg-ink-50/60 dark:hover:bg-[#1e2033]/60 transition">
                          <td className="px-5 py-3.5 text-ink-300 text-xs font-bold">{i + 1}</td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                              <span className="font-semibold text-ink-800">{c.title}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="font-bold text-brand-600">{c.students}</span>
                            <span className="text-ink-400 text-xs ml-1">студ.</span>
                          </td>
                          <td className="px-5 py-3.5 text-ink-600">{c.lessons} ур.</td>
                          <td className="px-5 py-3.5">
                            <span className={`font-bold ${c.revenue > 0 ? 'text-emerald-600' : 'text-ink-300'}`}>
                              {c.revenue > 0 ? `${c.revenue.toLocaleString()} ₴` : '—'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-ink-100 dark:border-[#282c44] bg-ink-50/60 dark:bg-[#151722]/60">
                        <td className="px-5 py-2.5" colSpan={2}><span className="text-xs font-bold text-ink-400 uppercase">Разом</span></td>
                        <td className="px-5 py-2.5 font-bold text-brand-700">{totalStudents}</td>
                        <td className="px-5 py-2.5 font-bold text-ink-600">{courses.reduce((s, c) => s + c.lessons, 0)}</td>
                        <td className="px-5 py-2.5 font-bold text-emerald-600">
                          {courses.reduce((s, c) => s + c.revenue, 0).toLocaleString()} ₴
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {/* ── Revenue ───────────────────────────────────────────────────────── */}
      {tab === 'revenue' && (
        <div className="flex flex-col gap-4">
          <Card className="p-6">
            <h2 className="font-bold text-ink-800 mb-4">Дохід за місяцями (6 міс.)</h2>
            {noRevenue ? (
              <div className="flex flex-col items-center justify-center py-16 text-ink-400 gap-2">
                <span className="text-4xl">💳</span>
                <p className="text-sm">Платежів ще не було — налаштуйте Billing у Налаштуваннях</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={revenue} barCategoryGap="40%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef0f6" vertical={false} />
                  <XAxis dataKey="month" tick={tick} axisLine={false} tickLine={false} />
                  <YAxis tick={tick} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v, name) => [
                    name === 'revenue' ? `${Number(v).toLocaleString()} ₴` : `${v} транзакцій`,
                    name === 'revenue' ? 'Дохід' : 'Платежів'
                  ]} />
                  <Bar dataKey="revenue" fill="#6535f6" radius={[8, 8, 0, 0]} maxBarSize={60} name="revenue" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Revenue summary cards */}
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { label: 'Загальний дохід', value: `${summary.totalRevenue.toLocaleString()} ₴`, icon: '💰', color: 'text-emerald-600' },
              { label: 'Цей місяць', value: `${summary.thisMonthRevenue.toLocaleString()} ₴`, icon: '📈', color: 'text-brand-600' },
              { label: 'Транзакцій', value: revenue.reduce((s, r) => s + r.count, 0), icon: '💳', color: 'text-amber-600' },
            ].map(s => (
              <Card key={s.label} className="p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-ink-50 dark:bg-[#1e2033] flex items-center justify-center text-2xl flex-shrink-0">{s.icon}</div>
                <MiniStat label={s.label} value={s.value} color={s.color} />
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── Churn ─────────────────────────────────────────────────────────── */}
      {tab === 'churn' && (
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-ink-800">Студенти з ризиком відтоку</h2>
              <p className="text-xs text-ink-400 mt-0.5">Не було активності 14+ днів або жодної здачі</p>
            </div>
            <Badge tone={churn.length > 0 ? 'rose' : 'green'}>{churn.length}</Badge>
          </div>

          {churn.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-ink-400 gap-2">
              <span className="text-5xl">🎉</span>
              <p className="font-semibold text-ink-600">Всі студенти активні!</p>
              <p className="text-sm">Ніхто не пропустив більше 14 днів</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-100 dark:border-[#282c44] bg-ink-50/60 dark:bg-[#151722]/60">
                    {['Студент', 'Остання активність', 'ДЗ очікує', 'Ризик'].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-[11px] font-bold text-ink-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {churn.map(r => (
                    <tr key={r.id} className={cx('border-b border-ink-50 last:border-0 transition',
                      r.riskLevel === 'high' ? 'hover:bg-rose-50/40' : 'hover:bg-amber-50/40')}>
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-ink-800">{r.name}</p>
                        <p className="text-xs text-ink-400">{r.email}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={r.lastActivity === 'ніколи' ? 'text-rose-500 font-medium' : 'text-ink-600'}>
                          {r.lastActivity}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {r.hwPending > 0
                          ? <span className="font-bold text-amber-600">{r.hwPending}</span>
                          : <span className="text-ink-300">0</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge tone={r.riskLevel === 'high' ? 'rose' : 'amber'}>
                          {r.riskLevel === 'high' ? '🔴 Високий' : '🟡 Середній'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </Layout>
  );
}
