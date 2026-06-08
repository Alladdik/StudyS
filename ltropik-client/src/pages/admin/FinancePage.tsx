import { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Card, Badge, Loader, EmptyState, toast, cx } from '../../components/ui';
import api from '../../api/client';
import { getCourses } from '../../api/courses';
import { getUsers } from '../../api/users';
import type { Course } from '../../types';
import type { UserItem } from '../../api/users';

interface Transaction {
  id: string; amount: number; currency: string; status: string;
  externalTxId: string | null; createdAt: string;
  studentName: string; studentEmail: string; courseTitle: string | null;
}

const STATUS_TONE: Record<string, 'green' | 'amber' | 'rose' | 'gray'> = {
  Success: 'green', Pending: 'amber', Failed: 'rose',
};

export function FinancePage() {
  const [tab, setTab] = useState<'transactions' | 'export'>('transactions');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Export
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<UserItem[]>([]);
  const [exportCourseId, setExportCourseId] = useState('');
  const [exportStudentId, setExportStudentId] = useState('');
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    loadTransactions();
    getCourses().then(r => setCourses(r.data)).catch(() => {});
    getUsers({ role: 'Student', pageSize: 500 }).then(r => setStudents(r.data.items)).catch(() => {});
  }, []);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ total: number; items: Transaction[] }>('/analytics/transactions');
      setTransactions(data.items);
      setTotal(data.total);
    } catch { toast('error', 'Помилка завантаження транзакцій'); }
    finally { setLoading(false); }
  };

  const totalRevenue = transactions.filter(t => t.status === 'Success').reduce((s, t) => s + t.amount, 0);

  async function downloadFile(url: string, filename: string) {
    setExporting(filename);
    try {
      const res = await api.get(url, { responseType: 'blob' });
      const contentType = String(res.headers['content-type'] ?? 'application/octet-stream');
      const blob = new Blob([res.data], { type: contentType });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
      toast('success', 'Файл завантажено');
    } catch { toast('error', 'Помилка завантаження файлу'); }
    finally { setExporting(null); }
  }

  return (
    <Layout title="Фінанси та Експорт" subtitle="Транзакції, звіти, вивантаження даних">

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {([['transactions', '💳 Транзакції'], ['export', '📥 Експорт']] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={cx('chip transition-all', tab === t ? 'bg-brand-600 text-white' : 'bg-white dark:bg-[#1e2033] text-ink-500 dark:text-[#9aa2bd] ring-1 ring-ink-200 dark:ring-[#2d3148]')}>
            {label}
          </button>
        ))}
      </div>

      {/* ── TRANSACTIONS ── */}
      {tab === 'transactions' && (
        loading ? <Loader /> : (
          <>
            {/* Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              <Card className="p-4">
                <p className="text-xs text-ink-400 mb-1">Всього транзакцій</p>
                <p className="text-2xl font-extrabold text-ink-900 dark:text-white">{total}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-ink-400 mb-1">Успішних</p>
                <p className="text-2xl font-extrabold text-emerald-600">{transactions.filter(t => t.status === 'Success').length}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-ink-400 mb-1">Загальний дохід</p>
                <p className="text-2xl font-extrabold text-amber-600">{totalRevenue.toLocaleString()} ₴</p>
              </Card>
            </div>

            {transactions.length === 0 ? (
              <EmptyState icon="💳" title="Транзакцій немає" hint="Тут з'являться платежі після підключення платіжної системи" />
            ) : (
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-ink-100 dark:border-[#282c44] bg-ink-50/60 dark:bg-[#151722]/60">
                        {['Студент', 'Курс', 'Сума', 'Статус', 'ID транзакції', 'Дата'].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-bold text-ink-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map(t => (
                        <tr key={t.id} className="border-b border-ink-50 dark:border-[#1e2033] last:border-0 hover:bg-ink-50/40 dark:hover:bg-[#1e2033]/60 transition">
                          <td className="px-4 py-3">
                            <p className="font-semibold text-ink-800 dark:text-[#e8eaf0] text-xs">{t.studentName}</p>
                            <p className="text-ink-400 text-[10px]">{t.studentEmail}</p>
                          </td>
                          <td className="px-4 py-3 text-ink-600 dark:text-[#9aa2bd] text-xs max-w-[140px] truncate">{t.courseTitle ?? '—'}</td>
                          <td className="px-4 py-3 font-bold text-ink-900 dark:text-white">{t.amount} {t.currency}</td>
                          <td className="px-4 py-3"><Badge tone={STATUS_TONE[t.status] ?? 'gray'}>{t.status}</Badge></td>
                          <td className="px-4 py-3 font-mono text-[10px] text-ink-400 max-w-[120px] truncate">{t.externalTxId ?? '—'}</td>
                          <td className="px-4 py-3 text-ink-400 text-xs whitespace-nowrap">{new Date(t.createdAt).toLocaleString('uk-UA')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </>
        )
      )}

      {/* ── EXPORT ── */}
      {tab === 'export' && (
        <div className="grid sm:grid-cols-2 gap-4 max-w-2xl">
          {/* Journal export */}
          <Card className="p-5 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-xl flex-shrink-0">📊</div>
              <div>
                <p className="font-bold text-ink-900 dark:text-white text-sm">Журнал курсу</p>
                <p className="text-xs text-ink-400">Відвідуваність та оцінки — Excel</p>
              </div>
            </div>
            <select value={exportCourseId} onChange={e => setExportCourseId(e.target.value)} className="input text-sm">
              <option value="">— Оберіть курс —</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
            <button
              onClick={() => exportCourseId && downloadFile(`/export/journal/${exportCourseId}`, `journal_${Date.now()}.xlsx`)}
              disabled={!exportCourseId || exporting !== null}
              className="btn btn-primary text-sm py-2 disabled:opacity-40">
              {exporting ? '⏳ Завантаження…' : '📥 Завантажити Excel'}
            </button>
          </Card>

          {/* Student report */}
          <Card className="p-5 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center text-xl flex-shrink-0">👤</div>
              <div>
                <p className="font-bold text-ink-900 dark:text-white text-sm">Звіт студента</p>
                <p className="text-xs text-ink-400">Всі курси, оцінки, прогрес — Excel</p>
              </div>
            </div>
            <select value={exportStudentId} onChange={e => setExportStudentId(e.target.value)} className="input text-sm">
              <option value="">— Оберіть студента —</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}
            </select>
            <button
              onClick={() => exportStudentId && downloadFile(`/export/student/${exportStudentId}`, `student_report_${Date.now()}.xlsx`)}
              disabled={!exportStudentId || exporting !== null}
              className="btn btn-primary text-sm py-2 disabled:opacity-40">
              {exporting ? '⏳ Завантаження…' : '📥 Завантажити Excel'}
            </button>
          </Card>
        </div>
      )}
    </Layout>
  );
}
