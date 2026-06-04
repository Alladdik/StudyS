import { Fragment, useEffect, useState, useCallback } from 'react';
import { Layout } from '../../components/Layout';
import { Card, Spinner } from '../../components/ui';
import api from '../../api/client';

interface AuditLogItem {
  id: string;
  action: string;
  details: string;
  ipAddress: string | null;
  createdAt: string;
  userName: string;
  userEmail: string | null;
}

interface LogsResponse {
  total: number;
  items: AuditLogItem[];
}

const ACTION_COLORS: Record<string, string> = {
  Login: 'bg-emerald-100 text-emerald-700',
  Register: 'bg-sky-100 text-sky-700',
  GradeChanged: 'bg-amber-100 text-amber-700',
  UserBlocked: 'bg-rose-100 text-rose-700',
  UserUnblocked: 'bg-emerald-100 text-emerald-700',
  CourseCreated: 'bg-brand-100 text-brand-700',
  CourseUpdated: 'bg-brand-100 text-brand-700',
  CourseDeleted: 'bg-rose-100 text-rose-700',
  HomeworkReviewed: 'bg-purple-100 text-purple-700',
};

function actionColor(a: string) {
  return ACTION_COLORS[a] ?? 'bg-ink-100 text-ink-600';
}

function fmt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('uk-UA', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function tryParseDetails(raw: string) {
  try {
    const obj = JSON.parse(raw);
    return JSON.stringify(obj, null, 2);
  } catch {
    return raw;
  }
}

const PAGE_SIZE = 50;

export function AuditLogsPage() {
  const [data, setData] = useState<LogsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [actions, setActions] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        ...(search ? { search } : {}),
        ...(action ? { action } : {}),
      });
      const r = await api.get<LogsResponse>(`/admin/audit-logs?${params}`);
      setData(r.data);
    } finally {
      setLoading(false);
    }
  }, [page, search, action]);

  useEffect(() => {
    api.get<string[]>('/admin/audit-logs/actions')
      .then(r => setActions(r.data))
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  return (
    <Layout title="Журнал дій" subtitle="Аудит активності користувачів та системи">
      <div className="flex flex-col gap-5">

        {/* Filters */}
        <Card className="p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Пошук по дії, email, деталях…"
              className="input pl-9 py-2 text-sm"
            />
          </div>
          <select
            value={action}
            onChange={e => { setAction(e.target.value); setPage(1); }}
            className="input py-2 text-sm w-auto min-w-[160px]"
          >
            <option value="">Всі дії</option>
            {actions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <button onClick={load} className="btn btn-soft py-2 text-sm">
            Оновити
          </button>
          <span className="text-xs text-ink-400 ml-auto">
            Всього: <strong>{data?.total ?? 0}</strong>
          </span>
        </Card>

        {/* Table */}
        <Card className="overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Spinner className="w-8 h-8 text-brand-500" />
            </div>
          ) : !data?.items.length ? (
            <div className="text-center py-16 text-ink-400">
              <div className="text-4xl mb-3">📋</div>
              <p className="font-semibold">Записів не знайдено</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-100 bg-ink-50 dark:bg-[#1a1c2e] dark:border-[#282c44]">
                    <th className="px-4 py-3 text-left font-bold text-ink-500 text-xs uppercase tracking-wide">Час</th>
                    <th className="px-4 py-3 text-left font-bold text-ink-500 text-xs uppercase tracking-wide">Користувач</th>
                    <th className="px-4 py-3 text-left font-bold text-ink-500 text-xs uppercase tracking-wide">Дія</th>
                    <th className="px-4 py-3 text-left font-bold text-ink-500 text-xs uppercase tracking-wide">IP</th>
                    <th className="px-4 py-3 text-left font-bold text-ink-500 text-xs uppercase tracking-wide">Деталі</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map(item => (
                    <Fragment key={item.id}>
                      <tr
                        onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                        className="border-b border-ink-50 dark:border-[#1e2033] hover:bg-ink-50 dark:hover:bg-[#1a1c2e] cursor-pointer transition">
                        <td className="px-4 py-3 text-xs text-ink-500 whitespace-nowrap font-mono">{fmt(item.createdAt)}</td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-ink-800 dark:text-[#e8eaf0]">{item.userName}</p>
                          {item.userEmail && <p className="text-xs text-ink-400">{item.userEmail}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${actionColor(item.action)}`}>
                            {item.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-ink-400 font-mono">{item.ipAddress ?? '—'}</td>
                        <td className="px-4 py-3 text-xs text-ink-400 max-w-[200px] truncate">{item.details}</td>
                      </tr>
                      {expanded === item.id && (
                        <tr key={`${item.id}-details`} className="bg-ink-50 dark:bg-[#141624]">
                          <td colSpan={5} className="px-4 py-3">
                            <pre className="text-xs font-mono text-ink-700 dark:text-[#c8cad8] whitespace-pre-wrap break-all bg-white dark:bg-[#1a1c2e] border border-ink-100 dark:border-[#282c44] rounded-xl p-4 max-h-60 overflow-auto">
                              {tryParseDetails(item.details)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="btn btn-ghost py-2 px-4 text-sm disabled:opacity-40">← Назад</button>
            <span className="text-sm text-ink-500">
              Сторінка <strong>{page}</strong> з <strong>{totalPages}</strong>
            </span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="btn btn-ghost py-2 px-4 text-sm disabled:opacity-40">Далі →</button>
          </div>
        )}
      </div>
    </Layout>
  );
}
