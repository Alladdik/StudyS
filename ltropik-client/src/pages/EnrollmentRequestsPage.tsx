import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import {
  getEnrollmentRequests, approveRequest, rejectRequest,
  type EnrollmentRequest,
} from '../api/enrollment';
import { Card, Badge, Avatar, Modal, Loader, EmptyState, toast } from '../components/ui';

const statusTone: Record<string, 'amber' | 'green' | 'rose'> = {
  Pending: 'amber', Approved: 'green', Rejected: 'rose',
};
const statusLabel: Record<string, string> = {
  Pending: '⏳ Очікує', Approved: '✅ Прийнято', Rejected: '❌ Відхилено',
};

export function EnrollmentRequestsPage() {
  const [requests, setRequests] = useState<EnrollmentRequest[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<'all' | 'Pending' | 'Approved' | 'Rejected'>('Pending');
  const [note, setNote]         = useState('');
  const [actionItem, setActionItem] = useState<{ req: EnrollmentRequest; action: 'approve' | 'reject' } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = () =>
    getEnrollmentRequests()
      .then(r => setRequests(r.data))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter);

  async function handleAction() {
    if (!actionItem) return;
    setSubmitting(true);
    try {
      if (actionItem.action === 'approve') {
        await approveRequest(actionItem.req.id, note);
        toast('success', `${actionItem.req.studentName} зараховано!`);
      } else {
        await rejectRequest(actionItem.req.id, note);
        toast('success', 'Заявку відхилено');
      }
      setActionItem(null);
      setNote('');
      await load();
    } catch {
      toast('error', 'Помилка');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Layout title="Заявки на курси"><Loader /></Layout>;

  return (
    <Layout title="Заявки на курси" subtitle="Управління запитами від студентів">
      {/* Filters */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {(['all', 'Pending', 'Approved', 'Rejected'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`chip ${filter === f ? 'bg-brand-600 text-white' : 'bg-white dark:bg-[#102a1d] text-ink-500 dark:text-[#9aa2bd] ring-1 ring-ink-200 dark:ring-[#1f4d36]'}`}>
            { f === 'all' ? `Всі (${requests.length})`
              : `${statusLabel[f]} (${requests.filter(r => r.status === f).length})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="📋" title="Заявок немає" />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100">
                {['Студент', 'Курс', 'Повідомлення', 'Дата', 'Статус', ''].map(h => (
                  <th key={h} className="text-left px-5 py-3.5 text-xs font-bold text-ink-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(req => (
                <tr key={req.id} className="border-b border-ink-50 dark:border-[#102a1d] last:border-0 hover:bg-ink-50/60 dark:hover:bg-[#102a1d]/60 transition">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={req.studentName} size="sm" />
                      <div>
                        <p className="font-semibold text-ink-800">{req.studentName}</p>
                        <p className="text-xs text-ink-400">{req.studentEmail}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 font-medium text-ink-700">{req.courseTitle}</td>
                  <td className="px-5 py-3.5 text-ink-500 max-w-[200px] truncate">{req.message || '—'}</td>
                  <td className="px-5 py-3.5 text-ink-400">{new Date(req.createdAt).toLocaleDateString('uk-UA')}</td>
                  <td className="px-5 py-3.5">
                    <Badge tone={statusTone[req.status]}>{statusLabel[req.status]}</Badge>
                  </td>
                  <td className="px-5 py-3.5">
                    {req.status === 'Pending' && (
                      <div className="flex gap-1.5">
                        <button onClick={() => setActionItem({ req, action: 'approve' })}
                          className="btn text-xs py-1.5 px-2.5 !bg-emerald-50 !text-emerald-700 hover:!bg-emerald-100">
                          ✓ Прийняти
                        </button>
                        <button onClick={() => setActionItem({ req, action: 'reject' })}
                          className="btn text-xs py-1.5 px-2.5 !bg-rose-50 !text-rose-600 hover:!bg-rose-100">
                          ✕
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Modal open={!!actionItem} onClose={() => setActionItem(null)} className="max-w-md">
        {actionItem && (
          <div className="p-7">
            <h3 className="font-extrabold text-xl text-ink-900 mb-1">
              {actionItem.action === 'approve' ? '✅ Прийняти заявку' : '❌ Відхилити заявку'}
            </h3>
            <p className="text-sm text-ink-500 mb-5">
              {actionItem.req.studentName} → {actionItem.req.courseTitle}
            </p>
            <label className="label">Коментар (необов'язково)</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
              placeholder="Причина або коментар…"
              className="input w-full mb-5 resize-none" />
            <div className="flex gap-3">
              <button onClick={() => setActionItem(null)} className="btn btn-soft flex-1">Скасувати</button>
              <button onClick={handleAction} disabled={submitting}
                className={`btn flex-1 ${actionItem.action === 'approve' ? 'btn-primary' : '!bg-rose-600 text-white'}`}>
                {submitting ? '⏳…' : actionItem.action === 'approve' ? '✅ Прийняти' : '❌ Відхилити'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  );
}
