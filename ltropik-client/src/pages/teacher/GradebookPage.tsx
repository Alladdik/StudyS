import { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { getCourses } from '../../api/courses';
import api from '../../api/client';
import type { Course } from '../../types';
import { Card, Loader, EmptyState, cx, toast } from '../../components/ui';

interface GradebookData {
  courseId: string;
  courseTitle: string;
  lessons: { id: string; title: string; moduleTitle: string }[];
  students: {
    id: string;
    name: string;
    email: string;
    cells: { lessonId: string; grade?: string; attendance?: string }[];
  }[];
}

const ATTENDANCE_COLOR: Record<string, string> = {
  Present:              'bg-emerald-100 text-emerald-700',
  Late:                 'bg-amber-100 text-amber-700',
  AbsentWithReason:     'bg-sky-100 text-sky-700',
  AbsentWithoutReason:  'bg-rose-100 text-rose-700',
};

function gradeColor(grade?: string): string {
  if (!grade) return '';
  const n = parseInt(grade, 10);
  if (isNaN(n)) return grade.toLowerCase().startsWith('a') ? 'text-emerald-700' : 'text-rose-600';
  if (n >= 90) return 'text-emerald-700 font-extrabold';
  if (n >= 70) return 'text-amber-600 font-bold';
  return 'text-rose-600 font-bold';
}

export function GradebookPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [data, setData] = useState<GradebookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingBook, setLoadingBook] = useState(false);

  async function handleExport() {
    if (!selectedCourse) return;
    try {
      const r = await api.get(`/export/journal/${selectedCourse}`, { responseType: 'blob' });
      const url = URL.createObjectURL(r.data as Blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `gradebook_${selectedCourse}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } catch { toast('error', 'Помилка при експорті'); }
  }

  useEffect(() => {
    getCourses().then(r => {
      setCourses(r.data);
      if (r.data[0]) setSelectedCourse(r.data[0].id);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedCourse) return;
    setLoadingBook(true);
    api.get<GradebookData>(`/gradebook/${selectedCourse}`)
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoadingBook(false));
  }, [selectedCourse]);

  if (loading) return <Layout title="Журнал оцінок"><Loader /></Layout>;

  return (
    <Layout title="Журнал оцінок" subtitle="Зведена таблиця: студенти × уроки">
      {/* Course selector + Export */}
      <div className="flex gap-2 mb-5 flex-wrap items-center">
        {courses.map(c => (
          <button key={c.id} onClick={() => setSelectedCourse(c.id)}
            className={cx('chip transition', selectedCourse === c.id
              ? 'bg-brand-600 text-white shadow-[var(--shadow-glow)]'
              : 'bg-white dark:bg-[#102a1d] text-ink-500 dark:text-[#9aa2bd] ring-1 ring-ink-200 dark:ring-[#1f4d36] hover:ring-brand-200 dark:hover:ring-brand-700')}>
            {c.title}
          </button>
        ))}
        {data && (
          <button onClick={handleExport} className="ml-auto btn btn-soft !text-brand-700 !bg-brand-50 !border-brand-100 text-xs">
            ⬇ Завантажити Excel
          </button>
        )}
      </div>

      {loadingBook ? <Loader /> : !data ? (
        <EmptyState icon="📊" title="Оберіть курс" />
      ) : data.students.length === 0 ? (
        <EmptyState icon="👤" title="Студентів немає" />
      ) : (
        <div className="overflow-x-auto">
          <Card className="overflow-hidden min-w-max">
            <table className="text-xs border-collapse">
              <thead>
                {/* Module row */}
                <tr className="bg-ink-50 dark:bg-[#0c2118] border-b border-ink-200 dark:border-[#1c3a2a]">
                  <th className="sticky left-0 bg-ink-50 dark:bg-[#0c2118] px-4 py-2 text-left font-bold text-ink-700 dark:text-[#e8eaf0] min-w-[180px] z-10">
                    Студент
                  </th>
                  {data.lessons.map((l, i) => {
                    const showModule = i === 0 || data.lessons[i - 1].moduleTitle !== l.moduleTitle;
                    return (
                      <th key={l.id} className="px-2 py-1 text-center font-semibold text-ink-500 dark:text-[#6b7394] border-l border-ink-100 dark:border-[#1c3a2a] max-w-[80px]"
                        title={l.title}>
                        {showModule && (
                          <div className="text-[9px] text-brand-500 font-bold truncate mb-0.5">{l.moduleTitle}</div>
                        )}
                        <div className="truncate max-w-[75px]">{l.title}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {data.students.map((s, si) => (
                  <tr key={s.id} className={cx('border-b border-ink-50 dark:border-[#102a1d]', si % 2 === 1 && 'bg-ink-50/40 dark:bg-[#0c2118]/40')}>
                    <td className="sticky left-0 px-4 py-2 font-semibold text-ink-800 dark:text-[#e8eaf0] border-r border-ink-100 dark:border-[#1c3a2a] z-10"
                      style={{ background: 'inherit' }}>
                      <div className="truncate max-w-[175px]">{s.name}</div>
                    </td>
                    {s.cells.map((cell) => (
                      <td key={cell.lessonId} className="px-2 py-2 text-center border-l border-ink-50 dark:border-[#102a1d]">
                        {cell.grade ? (
                          <span className={cx('font-bold', gradeColor(cell.grade))}>{cell.grade}</span>
                        ) : cell.attendance ? (
                          <span className={cx('rounded px-1 py-0.5 text-[9px] font-semibold',
                            ATTENDANCE_COLOR[cell.attendance] ?? 'bg-ink-100 text-ink-500 dark:bg-[#102a1d] dark:text-[#9aa2bd]')}>
                            {{ Present: 'П', Late: 'З', AbsentWithReason: 'НБ+', AbsentWithoutReason: 'НБ' }[cell.attendance] ?? '?'}
                          </span>
                        ) : (
                          <span className="text-ink-200">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Legend */}
          <div className="flex gap-4 mt-3 text-xs text-ink-500 flex-wrap">
            <span className="text-emerald-700 font-bold">П — Присутній</span>
            <span className="text-amber-600 font-bold">З — Запізнився</span>
            <span className="text-sky-600 font-bold">НБ+ — НБ з причиною</span>
            <span className="text-rose-600 font-bold">НБ — Відсутній</span>
          </div>
        </div>
      )}
    </Layout>
  );
}
