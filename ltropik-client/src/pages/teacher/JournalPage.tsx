import { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { getJournal, bulkMarkPresent, setAttendance } from '../../api/attendance';
import { getCourses, getCourseMembers } from '../../api/courses';
import api from '../../api/client';
import type { JournalEntry, Course, AttendanceStatus, GradeScale } from '../../types';
import { Card, EmptyState, toast, cx } from '../../components/ui';

interface LessonOption { id: string; title: string; moduleTitle: string; }

const STATUSES: AttendanceStatus[] = ['Present', 'Late', 'AbsentWithReason', 'AbsentWithoutReason'];
const statusLabels: Record<AttendanceStatus, string> = {
  Present: 'Присутній', Late: 'Запізнився', AbsentWithReason: 'НБ з причини', AbsentWithoutReason: 'НБ',
};
const statusColors: Record<AttendanceStatus, string> = {
  Present: 'text-emerald-600', Late: 'text-amber-600', AbsentWithReason: 'text-sky-600', AbsentWithoutReason: 'text-rose-600',
};

export function JournalPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [lessons, setLessons] = useState<LessonOption[]>([]);
  const [selectedLesson, setSelectedLesson] = useState('');
  
  // Bug fix state: Enrolled students list
  const [students, setStudents] = useState<Array<{ studentId: string; name: string; email: string }>>([]);
  
  // Extension state: Grade Scales list
  const [gradeScales, setGradeScales] = useState<GradeScale[]>([]);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    getCourses()
      .then((r) => { 
        setCourses(r.data); 
        if (r.data[0]) setSelectedCourse(r.data[0].id); 
      })
      .catch(() => toast('error', 'Не вдалося завантажити курси'));

    // Fetch all grade scales once on mount
    api.get<GradeScale[]>('/gradescales')
      .then((r) => setGradeScales(r.data))
      .catch(() => {});
  }, []);

  // Fetch course members (students list) immediately when course is selected
  useEffect(() => {
    if (!selectedCourse) {
      setStudents([]);
      return;
    }
    getCourseMembers(selectedCourse)
      .then((r) => setStudents(r.data.students || []))
      .catch(() => setStudents([]));
  }, [selectedCourse]);

  // Load modules & lessons for selected course
  useEffect(() => {
    if (!selectedCourse) return;
    setSelectedLesson('');
    api.get<{ modules: { title: string; lessons: { id: string; title: string }[] }[] }>(`/courses/${selectedCourse}`)
      .then((r) => {
        const opts: LessonOption[] = [];
        for (const m of r.data.modules ?? []) {
          for (const l of m.lessons ?? []) {
            opts.push({ id: l.id, title: l.title, moduleTitle: m.title });
          }
        }
        setLessons(opts);
      }).catch(() => {});
  }, [selectedCourse]);

  // Fetch journal entries (existing attendance records)
  useEffect(() => {
    if (selectedCourse) {
      getJournal(selectedCourse)
        .then((r) => setEntries(r.data))
        .catch(() => toast('error', 'Не вдалося завантажити журнал'));
    }
  }, [selectedCourse]);

  // Find the selected course's grade scale values
  const currentCourse = courses.find((c) => c.id === selectedCourse);
  const currentGradeScale = gradeScales.find((gs) => gs.id === currentCourse?.gradeScaleId);
  const gradeOptions = currentGradeScale?.values ?? [];

  const grouped = entries.reduce<Record<string, JournalEntry[]>>(
    (acc, e) => { (acc[e.lessonDate] ??= []).push(e); return acc; }, {}
  );

  async function handleExport() {
    if (!selectedCourse) return;
    try {
      const r = await api.get(`/export/journal/${selectedCourse}`, { responseType: 'blob' });
      const url = URL.createObjectURL(r.data as Blob);
      const a = document.createElement('a'); a.href = url; a.download = 'journal.xlsx'; a.click();
      URL.revokeObjectURL(url);
    } catch { toast('error', 'Помилка при експорті'); }
  }

  async function handleBulkPresent() {
    if (!selectedLesson) { toast('info', 'Оберіть урок зі списку нижче'); return; }
    try {
      await bulkMarkPresent(selectedLesson, today);
      toast('success', 'Всі студенти позначені як присутні');
      getJournal(selectedCourse).then((r) => setEntries(r.data));
    } catch { toast('error', 'Помилка при масовому позначенні'); }
  }

  async function handleStatusChange(studentId: string, attendance: AttendanceStatus) {
    if (!selectedLesson) { toast('info', 'Оберіть урок щоб відмічати відвідуваність'); return; }
    
    // Preserve existing grade if any
    const existing = entries.find((e) => e.studentId === studentId && e.lessonDate === today);
    const gradeVal = existing?.gradeValue;
    const matchedGradeOption = gradeOptions.find((o) => o.valueString === gradeVal);

    try {
      await setAttendance({ 
        lessonId: selectedLesson, 
        lessonDate: today, 
        records: [{ 
          studentId, 
          attendance,
          gradeId: matchedGradeOption?.id || undefined
        }] 
      });
      getJournal(selectedCourse).then((r) => setEntries(r.data));
    } catch { toast('error', 'Не вдалося зберегти відвідуваність'); }
  }

  async function handleGradeChange(studentId: string, gradeId: string) {
    if (!selectedLesson) { toast('info', 'Оберіть урок щоб виставляти оцінки'); return; }
    
    // Preserve existing attendance status
    const existing = entries.find((e) => e.studentId === studentId && e.lessonDate === today);
    const currentAttendance = existing?.attendance ?? 'Present';

    try {
      await setAttendance({
        lessonId: selectedLesson,
        lessonDate: today,
        records: [{
          studentId,
          attendance: currentAttendance,
          gradeId: gradeId || undefined
        }]
      });
      getJournal(selectedCourse).then((r) => setEntries(r.data));
      toast('success', 'Оцінку збережено');
    } catch { toast('error', 'Не вдалося зберегти оцінку'); }
  }

  // Dynamic columns: Include today's date if a lesson is selected for scheduling
  const datesSet = new Set(Object.keys(grouped));
  if (selectedLesson) {
    datesSet.add(today);
  }
  const dates = Array.from(datesSet).sort();

  return (
    <Layout title="Журнал" subtitle="Відвідуваність та оцінки групи">
      {/* Course tabs */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        {courses.map((c) => (
          <button key={c.id} onClick={() => setSelectedCourse(c.id)}
            className={cx('chip', selectedCourse === c.id
              ? 'bg-brand-600 text-white shadow-[var(--shadow-glow)]'
              : 'bg-white dark:bg-[#1e2033] text-ink-500 dark:text-[#9aa2bd] ring-1 ring-ink-200 dark:ring-[#2d3148] hover:ring-brand-200 dark:hover:ring-brand-700')}>
            {c.title}
          </button>
        ))}
        <div className="ml-auto flex flex-wrap gap-2">
          <button onClick={handleBulkPresent} className="btn btn-soft !text-emerald-700 !bg-emerald-50 !border-emerald-100 text-xs">✓ Всі присутні</button>
          {/* Bulk grade */}
          {gradeOptions.length > 0 && (
            <div className="flex items-center gap-1.5 bg-purple-50 border border-purple-100 rounded-xl px-2.5 py-1.5">
              <span className="text-xs font-semibold text-purple-700">Всім:</span>
              <select
                className="text-xs bg-transparent text-purple-700 font-bold outline-none cursor-pointer"
                defaultValue=""
                onChange={async (e) => {
                  const gradeId = e.target.value;
                  if (!gradeId || !selectedLesson) { toast('info', 'Спочатку оберіть урок'); e.target.value = ''; return; }
                  try {
                    await setAttendance({
                      lessonId: selectedLesson,
                      lessonDate: today,
                      // Preserve each student's existing attendance — only overwrite the grade
                      records: students.map(s => {
                        const existing = entries.find(e => e.studentId === s.studentId && e.lessonDate === today);
                        return { studentId: s.studentId, attendance: existing?.attendance ?? 'Present' as const, gradeId };
                      }),
                    });
                    toast('success', 'Оцінку виставлено всім студентам');
                    getJournal(selectedCourse).then(r => setEntries(r.data));
                  } catch { toast('error', 'Помилка масового оцінювання'); }
                  e.target.value = '';
                }}
              >
                <option value="">— оцінка —</option>
                {gradeOptions.map(o => <option key={o.id} value={o.id}>{o.valueString}</option>)}
              </select>
            </div>
          )}
          <button onClick={handleExport} className="btn btn-soft !text-brand-700 !bg-brand-50 !border-brand-100 text-xs">⬇ Excel</button>
        </div>
      </div>

      {/* Lesson selector — needed for attendance editing */}
      {lessons.length > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-amber-50 border border-amber-100 rounded-2xl">
          <span className="text-sm text-amber-700 font-semibold flex-shrink-0">📋 Урок сьогодні:</span>
          <select value={selectedLesson} onChange={(e) => setSelectedLesson(e.target.value)}
            className="input py-1.5 flex-1 text-sm">
            <option value="">— оберіть урок для позначення відвідуваності та оцінювання —</option>
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>{l.moduleTitle} › {l.title}</option>
            ))}
          </select>
        </div>
      )}

      {students.length === 0 ? (
        <EmptyState icon="📋" title="Журнал порожній"
          hint="У цьому курсі ще немає записаних студентів." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-ink-100">
                <th className="text-left px-5 py-3.5 text-xs font-bold text-ink-400 dark:text-[#6b7394] uppercase tracking-wider sticky left-0 bg-white dark:bg-[#1a1c2e] z-10">Студент</th>
                {dates.map((date) => (
                  <th key={date} className={cx('text-center px-4 py-3.5 text-xs font-bold uppercase tracking-wider',
                    date === today ? 'text-brand-600 bg-brand-50' : 'text-ink-400')}>
                    {new Date(date + 'T00:00:00').toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' })}
                    {date === today && <span className="block text-[10px] normal-case font-normal">сьогодні</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((stud) => {
                const sid = stud.studentId;
                return (
                  <tr key={sid} className="border-b border-ink-50 dark:border-[#1e2033] last:border-0 hover:bg-ink-50/60 dark:hover:bg-[#1e2033]/60 transition">
                    <td className="px-5 py-3 font-semibold text-ink-800 dark:text-[#e8eaf0] sticky left-0 bg-white dark:bg-[#1a1c2e] z-10 border-r border-ink-50 dark:border-[#1e2033]">{stud.name}</td>
                    {dates.map((date) => {
                      const entry = grouped[date]?.find((e) => e.studentId === sid);
                      const isToday = date === today;
                      return (
                        <td key={date} className={cx('px-4 py-3 text-center', isToday && 'bg-brand-50/30')}>
                          {isToday ? (
                            <div className="flex items-center justify-center gap-2">
                              {/* Attendance selector */}
                              <select
                                value={entry?.attendance ?? 'Present'}
                                onChange={(e) => handleStatusChange(sid, e.target.value as AttendanceStatus)}
                                disabled={!selectedLesson}
                                className={cx('bg-white dark:bg-[#1e2033] dark:text-[#e8eaf0] border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-200 transition',
                                  selectedLesson ? 'border-ink-200 cursor-pointer' : 'border-ink-100 opacity-50 cursor-not-allowed')}
                                title={!selectedLesson ? 'Спочатку оберіть урок вище' : ''}>
                                {STATUSES.map((s) => <option key={s} value={s}>{statusLabels[s]}</option>)}
                              </select>

                              {/* Grade selector */}
                              {gradeOptions.length > 0 && (
                                <select
                                  value={gradeOptions.find((o) => o.valueString === entry?.gradeValue)?.id ?? ''}
                                  onChange={(e) => handleGradeChange(sid, e.target.value)}
                                  disabled={!selectedLesson}
                                  className={cx('bg-white dark:bg-[#1e2033] border rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-brand-200 transition text-brand-700 dark:text-brand-400',
                                    selectedLesson ? 'border-brand-200 cursor-pointer' : 'border-ink-100 opacity-50 cursor-not-allowed')}
                                  title={!selectedLesson ? 'Спочатку оберіть урок вище' : ''}>
                                  <option value="">— Оцінка —</option>
                                  {gradeOptions.map((v) => (
                                    <option key={v.id} value={v.id}>{v.valueString}</option>
                                  ))}
                                </select>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1.5">
                              <span className={cx('text-xs font-semibold', entry ? statusColors[entry.attendance] : 'text-ink-200')}>
                                {entry ? statusLabels[entry.attendance] : '—'}
                              </span>
                              {entry?.gradeValue && (
                                <span className="px-1.5 py-0.5 bg-brand-50 text-brand-700 ring-1 ring-brand-100 rounded text-xs font-bold">
                                  {entry.gradeValue}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </Layout>
  );
}
