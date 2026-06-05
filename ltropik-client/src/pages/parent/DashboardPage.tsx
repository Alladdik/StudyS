import { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import {
  getParentChildren, getParentChildJournal, getParentChildCourses,
  getParentChildBalance, getParentChildUpcoming, getParentChildHomeworks,
  type Child, type Transaction, type HomeworkItem,
} from '../../api/parent';
import type { Course, JournalEntry, ScheduleEntry, AttendanceStatus } from '../../types';
import { Card, Badge, Loader, EmptyState, cx } from '../../components/ui';

const attendanceCfg: Record<AttendanceStatus, { label: string; tone: 'green' | 'amber' | 'blue' | 'rose' }> = {
  Present: { label: 'Присутній', tone: 'green' },
  Late: { label: 'Запізнився', tone: 'amber' },
  AbsentWithReason: { label: 'НБ з пр.', tone: 'blue' },
  AbsentWithoutReason: { label: 'НБ', tone: 'rose' },
};

const hwStatusCfg: Record<string, { label: string; tone: 'green' | 'amber' | 'blue' | 'rose' | 'gray' }> = {
  NotSubmitted:    { label: 'Не здано',          tone: 'rose'  },
  NotStarted:      { label: 'Не розпочато',      tone: 'gray'  },
  InProgress:      { label: 'Виконується',       tone: 'amber' },
  OnReview:        { label: 'На перевірці',       tone: 'blue'  },
  RequiresChanges: { label: 'Потребує змін',      tone: 'amber' },
  Passed:          { label: 'Зараховано ✓',       tone: 'green' },
  // legacy aliases (just in case)
  Submitted:       { label: 'На перевірці',       tone: 'blue'  },
  Graded:          { label: 'Зараховано ✓',       tone: 'green' },
};

export function ParentDashboardPage() {
  const [children, setChildren] = useState<Child[]>([]);
  const [selected, setSelected] = useState<Child | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [balance, setBalance] = useState<Transaction[]>([]);
  const [upcoming, setUpcoming] = useState<ScheduleEntry[]>([]);
  const [homeworks, setHomeworks] = useState<HomeworkItem[]>([]);
  const [tab, setTab] = useState<'journal' | 'balance' | 'upcoming' | 'homeworks'>('journal');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getParentChildren().then((r) => {
      setChildren(r.data);
      if (r.data[0]) setSelected(r.data[0]);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;

    // Reset course-dependent state first to avoid stale journal
    setSelectedCourse('');
    setJournal([]);

    getParentChildCourses(selected.id).then((r) => {
      if (cancelled) return;
      setCourses(r.data);
      // Use functional update so the latest course ID is set atomically
      if (r.data[0]) setSelectedCourse(r.data[0].id);
    });
    getParentChildBalance(selected.id).then((r) => { if (!cancelled) setBalance(r.data); });
    getParentChildUpcoming(selected.id).then((r) => { if (!cancelled) setUpcoming(r.data); });
    getParentChildHomeworks(selected.id).then((r) => { if (!cancelled) setHomeworks(r.data); });

    return () => { cancelled = true; };
  }, [selected]);

  useEffect(() => {
    // Only load journal when BOTH selected child and course belong to the same child
    // (selectedCourse is reset to '' whenever selected changes, so this fires only
    //  after the courses effect settles and sets a real course ID for the new child)
    if (!selected || !selectedCourse) return;
    let cancelled = false;
    getParentChildJournal(selected.id, selectedCourse)
      .then((r) => { if (!cancelled) setJournal(r.data); });
    return () => { cancelled = true; };
  }, [selected, selectedCourse]);

  if (loading) return <Layout title="Кабінет батьків"><Loader /></Layout>;

  return (
    <Layout title="Кабінет батьків" subtitle="Успішність та активність дитини">
      {children.length === 0 ? (
        <EmptyState icon="👨‍👩‍👧" title="Немає прив'язаних дітей"
          hint="Зверніться до адміністратора, щоб прив'язати обліковий запис студента" />
      ) : (
        <div className="flex flex-col gap-6">
          {/* Child selector */}
          <div className="flex gap-2 flex-wrap">
            {children.map((c) => (
              <button key={c.id} onClick={() => setSelected(c)}
                className={cx('chip', selected?.id === c.id
                  ? 'bg-brand-600 text-white shadow-[var(--shadow-glow)]'
                  : 'bg-white dark:bg-[#1e2033] text-ink-500 dark:text-[#9aa2bd] ring-1 ring-ink-200 dark:ring-[#2d3148] hover:ring-brand-200 dark:hover:ring-brand-700')}>
                {c.firstName} {c.lastName}
              </button>
            ))}
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="p-4">
              <p className="text-xs text-ink-400 font-semibold uppercase tracking-wide mb-1">Курсів</p>
              <p className="text-3xl font-extrabold text-ink-900">{courses.length}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-ink-400 font-semibold uppercase tracking-wide mb-1">Записів журналу</p>
              <p className="text-3xl font-extrabold text-ink-900">{journal.length}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-ink-400 font-semibold uppercase tracking-wide mb-1">Майбутніх занять</p>
              <p className="text-3xl font-extrabold text-ink-900">{upcoming.length}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-ink-400 font-semibold uppercase tracking-wide mb-1">ДЗ не здано</p>
              <p className={cx('text-3xl font-extrabold',
                homeworks.filter(h => h.status === 'NotSubmitted').length > 0 ? 'text-rose-600' : 'text-ink-900')}>
                {homeworks.filter(h => h.status === 'NotSubmitted').length}
              </p>
            </Card>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 flex-wrap">
            {(['journal', 'homeworks', 'balance', 'upcoming'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={cx('chip', tab === t ? 'bg-brand-600 text-white' : 'bg-white dark:bg-[#1e2033] text-ink-500 dark:text-[#9aa2bd] ring-1 ring-ink-200 dark:ring-[#2d3148]')}>
                {{ journal: 'Журнал', homeworks: 'Домашні завдання', balance: 'Баланс', upcoming: 'Розклад' }[t]}
              </button>
            ))}
          </div>

          {tab === 'journal' && (
            <div>
              <div className="flex gap-2 mb-4 flex-wrap">
                {courses.map((c) => (
                  <button key={c.id} onClick={() => setSelectedCourse(c.id)}
                    className={cx('chip text-sm', selectedCourse === c.id ? 'bg-ink-800 text-white' : 'bg-white dark:bg-[#1e2033] text-ink-500 dark:text-[#9aa2bd] ring-1 ring-ink-200 dark:ring-[#2d3148]')}>
                    {c.title}
                  </button>
                ))}
              </div>
              {journal.length === 0 ? (
                <EmptyState icon="🗓️" title="Журнал порожній" />
              ) : (
                <Card className="overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-ink-100">
                        {['Дата', 'Відвідуваність', 'Оцінка'].map((h) => (
                          <th key={h} className="text-left px-5 py-3.5 text-xs font-bold text-ink-400 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {journal.map((e, i) => {
                        const att = attendanceCfg[e.attendance];
                        return (
                          <tr key={i} className="border-b border-ink-50 last:border-0">
                            <td className="px-5 py-3 font-semibold">{new Date(e.lessonDate).toLocaleDateString('uk-UA')}</td>
                            <td className="px-5 py-3"><Badge tone={att.tone}>{att.label}</Badge></td>
                            <td className="px-5 py-3">{e.gradeValue ? <Badge tone="brand">{e.gradeValue}</Badge> : <span className="text-ink-300">—</span>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </Card>
              )}
            </div>
          )}

          {tab === 'homeworks' && (
            homeworks.length === 0 ? (
              <EmptyState icon="📝" title="Домашніх завдань немає" />
            ) : (
              <Card className="overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink-100">
                      {['Завдання', 'Курс', 'Статус', 'Оцінка'].map((h) => (
                        <th key={h} className="text-left px-5 py-3.5 text-xs font-bold text-ink-400 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {homeworks.map((hw) => {
                      const cfg = hwStatusCfg[hw.status] ?? { label: hw.status, tone: 'gray' as const };
                      return (
                        <tr key={hw.id} className="border-b border-ink-50 last:border-0">
                          <td className="px-5 py-3 font-medium text-ink-800 max-w-[200px] truncate">{hw.title}</td>
                          <td className="px-5 py-3 text-ink-500">{hw.courseTitle}</td>
                          <td className="px-5 py-3"><Badge tone={cfg.tone}>{cfg.label}</Badge></td>
                          <td className="px-5 py-3">{hw.grade ? <Badge tone="brand">{hw.grade}</Badge> : <span className="text-ink-300">—</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            )
          )}

          {tab === 'balance' && (
            balance.length === 0 ? (
              <EmptyState icon="💳" title="Транзакцій немає" />
            ) : (
              <Card className="overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink-100">
                      {['Дата', 'Курс', 'Сума', 'Статус'].map((h) => (
                        <th key={h} className="text-left px-5 py-3.5 text-xs font-bold text-ink-400 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {balance.map((t) => (
                      <tr key={t.id} className="border-b border-ink-50 last:border-0">
                        <td className="px-5 py-3">{new Date(t.createdAt).toLocaleDateString('uk-UA')}</td>
                        <td className="px-5 py-3">{t.courseName ?? '—'}</td>
                        <td className="px-5 py-3 font-semibold">{t.amount} {t.currency}</td>
                        <td className="px-5 py-3">
                          <Badge tone={t.status === 'Success' ? 'green' : t.status === 'Pending' ? 'amber' : 'rose'}>
                            {t.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )
          )}

          {tab === 'upcoming' && (
            upcoming.length === 0 ? (
              <EmptyState icon="📅" title="Найближчих занять немає" />
            ) : (
              <div className="flex flex-col gap-3">
                {upcoming.map((s) => (
                  <Card key={s.id} className="p-4 flex items-center gap-4">
                    <div className="flex-shrink-0 w-14 text-center">
                      <p className="text-2xl font-extrabold text-brand-600">
                        {new Date(s.startsAt).getDate()}
                      </p>
                      <p className="text-xs text-ink-400">
                        {new Date(s.startsAt).toLocaleString('uk-UA', { month: 'short' })}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-ink-800 truncate">{s.lessonTitle}</p>
                      <p className="text-sm text-ink-400 truncate">{s.courseTitle} · {s.teacherName}</p>
                    </div>
                    <div className="text-sm font-medium text-ink-600 flex-shrink-0">
                      {new Date(s.startsAt).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </Card>
                ))}
              </div>
            )
          )}
        </div>
      )}
    </Layout>
  );
}
