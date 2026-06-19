import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Layout } from '../../components/Layout';
import { getProgress, getLeaderboard } from '../../api/gamification';
import { getJournal } from '../../api/attendance';
import { getCourses } from '../../api/courses';
import type { StudentProgress, BadgeDto, LeaderboardEntry } from '../../api/gamification';
import type { JournalEntry, Course, AttendanceStatus } from '../../types';
import { Card, StatCard, Tabs, Modal, Loader, EmptyState, cx } from '../../components/ui';
import { Confetti } from '../../components/Confetti';
import { useAuthStore } from '../../store/authStore';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as ChartTooltip, 
  PieChart, 
  Pie, 
  Cell, 
  Legend 
} from 'recharts';

export function AchievementsPage() {
  const { userId } = useAuthStore();
  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBadge, setSelectedBadge] = useState<BadgeDto | null>(null);
  const [tab, setTab] = useState<'badges' | 'leaderboard' | 'analytics'>('badges');

  // Confetti trigger state
  const [showConfetti, setShowConfetti] = useState(false);

  // Analytics states
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);

  useEffect(() => {
    Promise.all([
      getProgress().then((r) => setProgress(r.data)),
      getLeaderboard().then((r) => setLeaderboard(r.data)),
      getCourses().then((r) => {
        setCourses(r.data);
        if (r.data[0]) setSelectedCourseId(r.data[0].id);
      }).catch(() => {})
    ]).catch(console.error).finally(() => setLoading(false));
  }, []);

  // Fetch journal records for selected course
  useEffect(() => {
    if (!selectedCourseId) { setJournalEntries([]); return; }
    let cancelled = false;
    getJournal(selectedCourseId)
      .then(r  => { if (!cancelled) setJournalEntries(r.data); })
      .catch(() => { if (!cancelled) setJournalEntries([]); });
    return () => { cancelled = true; };
  }, [selectedCourseId]);

  // Click on badge triggers celebratory confetti explosion
  function handleBadgeClick(badge: BadgeDto) {
    setSelectedBadge(badge);
    if (badge.isEarned) {
      setShowConfetti(false);
      setTimeout(() => setShowConfetti(true), 50);
      setTimeout(() => setShowConfetti(false), 3500);
    }
  }

  if (loading) return <Layout title="Досягнення"><Loader /></Layout>;
  if (!progress) return <Layout title="Досягнення"><EmptyState title="Помилка завантаження" /></Layout>;

  const nextBadge = progress.allBadges.find((b) => !b.isEarned);

  // Chart data generators
  const parseGradeValue = (val: string): number => {
    const num = Number(val);
    if (!isNaN(num)) return num;
    const letters: Record<string, number> = { 'A': 5, 'B': 4, 'C': 3, 'D': 2, 'E': 1, 'FX': 0, 'F': 0 };
    return letters[val.toUpperCase()] ?? 0;
  };

  const chartData = journalEntries
    .filter((e) => e.gradeValue)
    .map((e) => ({
      date: new Date(e.lessonDate).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' }),
      score: parseGradeValue(e.gradeValue!),
      originalGrade: e.gradeValue
    }));

  const attendanceCounts = journalEntries.reduce<Record<AttendanceStatus, number>>(
    (acc, e) => { acc[e.attendance] = (acc[e.attendance] || 0) + 1; return acc; },
    { Present: 0, Late: 0, AbsentWithReason: 0, AbsentWithoutReason: 0 }
  );

  const attendanceData = [
    { name: 'Присутній', value: attendanceCounts.Present || 0, color: '#10b981' },
    { name: 'Запізнився', value: attendanceCounts.Late || 0, color: '#f59e0b' },
    { name: 'Поважна причина', value: attendanceCounts.AbsentWithReason || 0, color: '#0ea5e9' },
    { name: 'НБ', value: attendanceCounts.AbsentWithoutReason || 0, color: '#f43f5e' }
  ].filter(d => d.value > 0);

  const CustomChartTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-ink-150 rounded-xl shadow-lg text-xs leading-normal">
          <p className="font-bold text-ink-900">{data.date}</p>
          <p className="text-brand-600 font-extrabold mt-1">Оцінка: {data.originalGrade}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Layout title="Досягнення" subtitle="Твій прогрес, бейджі та місце в рейтингу">
      {showConfetti && <Confetti />}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <StatCard icon="🔥" tone="amber" value={progress.currentStreak} label={`днів поспіль · макс ${progress.maxStreak}`} />
        <StatCard icon="🪙" tone="brand" value={progress.totalCoins} label="монет зароблено" delay={0.05} />
        <StatCard icon="🏅" tone="green" value={`${progress.earnedBadges.length}/${progress.allBadges.length}`} label="бейджів отримано" delay={0.1} />
      </div>

      {/* Next badge */}
      {nextBadge && (
        <Card className="p-5 mb-6 flex items-center gap-4 !bg-gradient-to-r !from-brand-50 !to-white">
          <div className="w-14 h-14 rounded-2xl bg-white border border-brand-100 flex items-center justify-center text-3xl flex-shrink-0">{nextBadge.icon}</div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-brand-700 text-sm">Наступне: {nextBadge.name}</p>
            <p className="text-ink-500 text-xs mt-0.5">{nextBadge.description}</p>
            <div className="mt-2 bg-brand-100 rounded-full h-2 overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, (progress.currentStreak / nextBadge.conditionValue) * 100)}%` }}
                transition={{ duration: 0.9, ease: 'easeOut' }} className="h-full bg-gradient-to-r from-brand-500 to-brand-600 rounded-full" />
            </div>
            <p className="text-ink-400 text-xs mt-1">{progress.currentStreak} / {nextBadge.conditionValue}</p>
          </div>
          <span className="chip bg-amber-50 text-amber-700 ring-1 ring-amber-100 flex-shrink-0">+{nextBadge.coinsReward} 🪙</span>
        </Card>
      )}

      <div className="mb-5">
        <Tabs value={tab} onChange={setTab} tabs={[{ value: 'badges', label: '🏅 Бейджі' }, { value: 'leaderboard', label: '🏆 Топ' }, { value: 'analytics', label: '📊 Аналітика' }]} />
      </div>

      {tab === 'badges' && (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-4">
          {progress.allBadges.map((badge, i) => (
            <motion.button key={badge.id} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}
              whileHover={{ y: -4 }} onClick={() => handleBadgeClick(badge)}
              className={cx('relative flex flex-col items-center p-4 rounded-2xl border transition',
                badge.isEarned ? 'card card-hover' : 'bg-ink-50 border-ink-200 opacity-60 grayscale')}>
              {badge.isEarned && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400 }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center ring-2 ring-white">
                  <span className="text-white text-[10px]">✓</span>
                </motion.div>
              )}
              <span className="text-4xl mb-2">{badge.icon}</span>
              <span className="text-xs font-semibold text-ink-700 text-center leading-tight">{badge.name}</span>
              {badge.isEarned && <span className="mt-1.5 text-[11px] text-amber-600 font-bold">+{badge.coinsReward}🪙</span>}
            </motion.button>
          ))}
        </div>
      )}

      {tab === 'leaderboard' && (
        <div className="flex flex-col gap-2.5 max-w-2xl">
          {leaderboard.map((entry, i) => {
            const isMe = entry.studentId === userId;
            return (
              <motion.div key={entry.studentId} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                <Card className={cx(
                  'flex items-center gap-4 p-4',
                  i === 0 && '!border-amber-200 !bg-amber-50/40',
                  isMe && '!border-brand-300 !bg-brand-50/60 ring-1 ring-brand-200',
                )}>
                  <span className="text-xl font-extrabold w-9 text-center flex-shrink-0">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="text-ink-400 text-base">{i + 1}</span>}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="font-bold text-ink-800 text-sm truncate">{entry.name}</p>
                      {isMe && <span className="chip bg-brand-100 text-brand-700 text-[10px] py-0 flex-shrink-0">Ви</span>}
                    </div>
                    <p className="text-xs text-ink-400 mt-0.5">🔥 {entry.streak} · макс {entry.maxStreak} днів</p>
                  </div>
                  <span className="chip bg-amber-50 text-amber-700 ring-1 ring-amber-100 flex-shrink-0">{entry.coins} 🪙</span>
                </Card>
              </motion.div>
            );
          })}
          {leaderboard.length === 0 && <EmptyState icon="🏆" title="Таблиця лідерів порожня" />}
        </div>
      )}

      {tab === 'analytics' && (
        <div className="flex flex-col gap-6">
          {/* Course Selector */}
          <div className="flex items-center gap-3 bg-brand-50/40 p-4 border border-brand-100 rounded-2xl max-w-md">
            <span className="text-sm text-brand-800 font-semibold flex-shrink-0">📊 Курс:</span>
            <select value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)} className="input py-1.5 flex-1 text-sm bg-white border-brand-200 focus:ring-brand-200">
              <option value="">Оберіть курс</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>

          {journalEntries.length === 0 ? (
            <EmptyState icon="📈" title="Немає даних для аналітики" hint="Оцінки та відвідуваність з'являться після того, як вчитель відмітить їх у Журналі" />
          ) : (
            <>
              {/* Quick stats */}
              {(() => {
                const graded = chartData.filter(d => d.score > 0);
                const avgScore = graded.length ? graded.reduce((s, d) => s + d.score, 0) / graded.length : null;
                const total = journalEntries.length;
                const present = attendanceCounts.Present + attendanceCounts.Late;
                const attendPct = total ? Math.round(present / total * 100) : null;
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <Card className="p-4 text-center">
                      <p className="text-2xl font-extrabold text-ink-900">{total}</p>
                      <p className="text-xs text-ink-400 mt-1">уроків усього</p>
                    </Card>
                    <Card className="p-4 text-center">
                      <p className={cx('text-2xl font-extrabold', attendPct !== null && attendPct >= 80 ? 'text-emerald-600' : 'text-rose-500')}>
                        {attendPct !== null ? `${attendPct}%` : '—'}
                      </p>
                      <p className="text-xs text-ink-400 mt-1">відвідуваність</p>
                    </Card>
                    <Card className="p-4 text-center col-span-2 sm:col-span-1">
                      <p className={cx('text-2xl font-extrabold', avgScore !== null && avgScore >= 4 ? 'text-emerald-600' : avgScore !== null && avgScore >= 3 ? 'text-amber-500' : 'text-rose-500')}>
                        {avgScore !== null ? avgScore.toFixed(1) : '—'}
                      </p>
                      <p className="text-xs text-ink-400 mt-1">середня оцінка</p>
                    </Card>
                  </div>
                );
              })()}

              <div className="grid md:grid-cols-2 gap-6">
                {/* Grade Progression Chart */}
                <Card className="p-5">
                  <h3 className="font-bold text-ink-900 mb-4 flex items-center gap-1.5">📈 Динаміка успішності</h3>
                  <div className="h-56">
                    {chartData.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-ink-400 text-xs">Оцінок з цього курсу ще немає</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                          <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 'auto']} />
                          <ChartTooltip content={<CustomChartTooltip />} />
                          <Line type="monotone" dataKey="score" stroke="#00c853" strokeWidth={3} dot={{ r: 3, fill: '#00c853' }} activeDot={{ r: 6 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </Card>

                {/* Attendance Pie Chart */}
                <Card className="p-5">
                  <h3 className="font-bold text-ink-900 mb-4 flex items-center gap-1.5">📊 Статистика відвідуваності</h3>
                  <div className="h-56 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={attendanceData} cx="50%" cy="45%" innerRadius={52} outerRadius={72} paddingAngle={4} dataKey="value">
                          {attendanceData.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} formatter={(val) => <span className="text-xs text-ink-600 font-semibold">{val}</span>} />
                        <ChartTooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>
            </>
          )}
        </div>
      )}

      <Modal open={!!selectedBadge} onClose={() => setSelectedBadge(null)} className="max-w-xs">
        {selectedBadge && (
          <div className="p-8 text-center">
            <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring' }} className={cx('text-7xl mb-4', !selectedBadge.isEarned && 'grayscale opacity-60')}>{selectedBadge.icon}</motion.div>
            <h3 className="text-xl font-extrabold text-ink-900 mb-2">{selectedBadge.name}</h3>
            <p className="text-ink-500 text-sm mb-4">{selectedBadge.description}</p>
            {selectedBadge.isEarned ? (
              <>
                <span className="chip bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 mb-2">✓ Отримано</span>
                {selectedBadge.earnedAt && <p className="text-xs text-ink-400">{new Date(selectedBadge.earnedAt).toLocaleDateString('uk-UA')}</p>}
                <div className="mt-3 text-amber-600 font-bold">+{selectedBadge.coinsReward} монет</div>
              </>
            ) : <span className="chip bg-ink-100 text-ink-500">🔒 Ще не отримано</span>}
            <button onClick={() => setSelectedBadge(null)} className="btn btn-soft w-full mt-5">Закрити</button>
          </div>
        )}
      </Modal>
    </Layout>
  );
}
