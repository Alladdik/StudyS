import { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Link } from 'react-router-dom';
import { getJournal } from '../../api/attendance';
import { getCourses } from '../../api/courses';
import api from '../../api/client';
import type { JournalEntry, Course, AttendanceStatus } from '../../types';
import { motion } from 'framer-motion';
import { Card, Badge, Modal, Loader, EmptyState, cx, Tabs } from '../../components/ui';
import { AttendanceHeatmap } from '../../components/AttendanceHeatmap';
import { DailyQuestsWidget } from '../../components/DailyQuestsWidget';
import { useAuthStore } from '../../store/authStore';
import { completeQuestType } from '../../api/quests';

interface Bookmark { id: string; type: string; refId: string; title: string; createdAt: string; }

const attendanceCfg: Record<AttendanceStatus, { label: string; tone: 'green' | 'amber' | 'blue' | 'rose' }> = {
  Present:             { label: 'Присутній',  tone: 'green' },
  Late:                { label: 'Запізнився', tone: 'amber' },
  AbsentWithReason:    { label: 'НБ з пр.',   tone: 'blue' },
  AbsentWithoutReason: { label: 'НБ',         tone: 'rose' },
};

export function DiaryPage() {
  const { userId } = useAuthStore();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'diary' | 'bookmarks'>('diary');
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [bmLoading, setBmLoading] = useState(false);

  // Complete login quest on page load
  useEffect(() => { completeQuestType('login').catch(() => {}); }, []);

  useEffect(() => {
    getCourses().then((r) => { setCourses(r.data); if (r.data[0]) setSelectedCourse(r.data[0].id); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedCourse) getJournal(selectedCourse).then((r) => setEntries(r.data));
  }, [selectedCourse]);

  useEffect(() => {
    if (tab !== 'bookmarks') return;
    setBmLoading(true);
    api.get<Bookmark[]>('/bookmarks')
      .then(r => setBookmarks(r.data))
      .finally(() => setBmLoading(false));
  }, [tab]);

  async function removeBookmark(id: string) {
    await api.delete(`/bookmarks/${id}`);
    setBookmarks(bms => bms.filter(b => b.id !== id));
  }

  if (loading) return <Layout title="Щоденник"><Loader /></Layout>;

  return (
    <Layout title="Щоденник" subtitle="Відвідуваність та оцінки за уроки">
      {/* Tab switcher */}
      <div className="mb-5">
        <Tabs
          tabs={[
            { value: 'diary', label: '📅 Щоденник' },
            { value: 'bookmarks', label: `🔖 Закладки${bookmarks.length ? ` (${bookmarks.length})` : ''}` },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {tab === 'bookmarks' ? (
        bmLoading ? <Loader /> :
        bookmarks.length === 0 ? (
          <EmptyState icon="🔖" title="Закладок немає" hint="Додавай уроки та курси в закладки щоб швидко знаходити їх тут" />
        ) : (
          <div className="flex flex-col gap-3">
            {bookmarks.map(bm => (
              <Card key={bm.id} className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xl flex-shrink-0">{bm.type === 'lesson' ? '📝' : '📚'}</span>
                  <div className="min-w-0">
                    {bm.type === 'lesson' ? (
                      <Link to={`/student/lesson/${bm.refId}`}
                        className="font-semibold text-ink-800 dark:text-white hover:text-brand-600 transition truncate block">
                        {bm.title ?? 'Урок'}
                      </Link>
                    ) : (
                      <p className="font-semibold text-ink-800 dark:text-white truncate">{bm.title ?? bm.type}</p>
                    )}
                    <p className="text-xs text-ink-400 mt-0.5">
                      {new Date(bm.createdAt).toLocaleDateString('uk-UA')} · {bm.type === 'lesson' ? 'Урок' : 'Курс'}
                    </p>
                  </div>
                </div>
                <button onClick={() => removeBookmark(bm.id)}
                  className="text-ink-300 hover:text-rose-500 transition flex-shrink-0 text-lg">×</button>
              </Card>
            ))}
          </div>
        )
      ) : (
      <>
      {/* Daily quests + heatmap side by side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-1">
          <DailyQuestsWidget />
        </div>
        <div className="lg:col-span-2 bg-white dark:bg-[#1a1c2e] rounded-2xl border border-ink-100 dark:border-[#282c44] p-4">
          <p className="text-xs font-bold text-ink-400 uppercase tracking-wide mb-3">Теплова карта відвідуваності</p>
          {userId && <AttendanceHeatmap studentId={userId} />}
        </div>
      </div>
      {/* Course tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {courses.map((c) => (
          <button key={c.id} onClick={() => setSelectedCourse(c.id)}
            className={cx('chip', selectedCourse === c.id
              ? 'bg-brand-600 text-white shadow-[var(--shadow-glow)]'
              : 'bg-white dark:bg-[#1e2033] text-ink-500 dark:text-[#9aa2bd] ring-1 ring-ink-200 dark:ring-[#2d3148] hover:ring-brand-200 hover:text-ink-700')}>
            {c.title}
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <EmptyState icon="🗓️" title="Записів немає" hint="Коли викладач відмітить твою відвідуваність — записи з'являться тут" />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 dark:border-[#282c44]">
                {['Дата', 'Відвідуваність', 'Оцінка'].map((h) => (
                  <th key={h} className="text-left px-5 py-3.5 text-xs font-bold text-ink-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const att = attendanceCfg[e.attendance];
                return (
                  <tr key={`${e.studentId}-${e.lessonDate}`} onClick={() => setSelectedEntry(e)}
                    className="border-b border-ink-50 dark:border-[#1e2033] last:border-0 hover:bg-brand-50/40 dark:hover:bg-brand-900/10 cursor-pointer transition">
                    <td className="px-5 py-3.5 font-semibold text-ink-800 dark:text-[#e8eaf0]">{new Date(e.lessonDate).toLocaleDateString('uk-UA')}</td>
                    <td className="px-5 py-3.5"><Badge tone={att.tone}>{att.label}</Badge></td>
                    <td className="px-5 py-3.5">{e.gradeValue ? <Badge tone="brand">{e.gradeValue}</Badge> : <span className="text-ink-300">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      </>
      )}

      <Modal open={!!selectedEntry} onClose={() => setSelectedEntry(null)} className="max-w-sm">
        {selectedEntry && (
          <div className="p-7">
            <h2 className="font-extrabold text-ink-900 dark:text-white text-lg mb-5">
              {new Date(selectedEntry.lessonDate).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })}
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-ink-500">Відвідуваність</span>
                <Badge tone={attendanceCfg[selectedEntry.attendance].tone}>{attendanceCfg[selectedEntry.attendance].label}</Badge>
              </div>
              {selectedEntry.gradeValue && (
                <div className="flex justify-between items-center">
                  <span className="text-ink-500">Оцінка</span>
                  <Badge tone="brand">{selectedEntry.gradeValue}</Badge>
                </div>
              )}
            </div>
            <motion.button whileTap={{ scale: 0.98 }} onClick={() => setSelectedEntry(null)}
              className="btn btn-soft w-full mt-6">Закрити</motion.button>
          </div>
        )}
      </Modal>
    </Layout>
  );
}
