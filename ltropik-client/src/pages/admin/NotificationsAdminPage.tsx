import { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Card, Badge, Loader, toast, cx } from '../../components/ui';
import api from '../../api/client';

interface NotifItem {
  id: string; type: string; title: string; body: string;
  isRead: boolean; actionUrl: string | null; createdAt: string;
  userName: string; userEmail: string;
}

const ROLES = [
  { value: '', label: 'Всі користувачі' },
  { value: 'Student', label: 'Студенти' },
  { value: 'Teacher', label: 'Викладачі' },
  { value: 'Parent', label: 'Батьки' },
  { value: 'Manager', label: 'Менеджери' },
];

export function NotificationsAdminPage() {
  const [tab, setTab] = useState<'send' | 'history'>('send');
  const [history, setHistory] = useState<NotifItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyTotal, setHistoryTotal] = useState(0);

  // Send form
  const [form, setForm] = useState({ title: '', body: '', role: '', actionUrl: '' });
  const [sending, setSending] = useState(false);
  const [sentCount, setSentCount] = useState<number | null>(null);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const { data } = await api.get<{ total: number; items: NotifItem[] }>('/notifications/admin/history');
      setHistory(data.items);
      setHistoryTotal(data.total);
    } catch { toast('error', 'Помилка завантаження'); }
    finally { setHistoryLoading(false); }
  };

  useEffect(() => { if (tab === 'history') loadHistory(); }, [tab]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) return;
    setSending(true); setSentCount(null);
    try {
      const { data } = await api.post<{ sent: number }>('/notifications/broadcast', {
        title: form.title, body: form.body,
        role: form.role || null, actionUrl: form.actionUrl || null,
      });
      setSentCount(data.sent);
      toast('success', `Надіслано ${data.sent} отримувачам`);
      setForm({ title: '', body: '', role: '', actionUrl: '' });
      if (tab === 'history') loadHistory();
    } catch { toast('error', 'Помилка надсилання'); }
    finally { setSending(false); }
  }

  return (
    <Layout title="Сповіщення" subtitle="Розсилка та журнал всіх сповіщень">

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {([['send', '📢 Надіслати'], ['history', '📋 Журнал']] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={cx('chip transition-all', tab === t ? 'bg-brand-600 text-white' : 'bg-white dark:bg-[#1e2033] text-ink-500 dark:text-[#9aa2bd] ring-1 ring-ink-200 dark:ring-[#2d3148]')}>
            {label}
          </button>
        ))}
      </div>

      {/* ── SEND ── */}
      {tab === 'send' && (
        <div className="max-w-lg">
          <Card className="p-6">
            <h2 className="font-extrabold text-ink-900 dark:text-white text-lg mb-5">📢 Розсилка сповіщень</h2>
            <form onSubmit={handleSend} className="flex flex-col gap-4">
              <div>
                <label className="label">Отримувачі</label>
                <select value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value}))} className="input">
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Заголовок</label>
                <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))}
                  className="input" placeholder="Важливе оголошення!" required />
              </div>
              <div>
                <label className="label">Текст</label>
                <textarea value={form.body} onChange={e => setForm(f => ({...f, body: e.target.value}))}
                  className="input resize-none" rows={3} placeholder="Текст сповіщення…" required />
              </div>
              <div>
                <label className="label">Посилання (необов'язково)</label>
                <input value={form.actionUrl} onChange={e => setForm(f => ({...f, actionUrl: e.target.value}))}
                  className="input" placeholder="/admin/courses або https://…" />
              </div>
              <button type="submit" disabled={sending} className="btn btn-primary py-3">
                {sending ? '⏳ Надсилаю…' : '📢 Надіслати сповіщення'}
              </button>
              {sentCount !== null && (
                <p className="text-center text-sm text-emerald-600 dark:text-emerald-400 font-semibold">
                  ✅ Надіслано {sentCount} отримувачам
                </p>
              )}
            </form>
          </Card>

          {/* Quick templates */}
          <div className="mt-5">
            <p className="text-xs font-bold text-ink-400 uppercase tracking-wider mb-3">Швидкі шаблони</p>
            <div className="flex flex-col gap-2">
              {[
                { title: '📅 Нагадування про заняття', body: 'Нагадуємо, що сьогодні заплановано заняття. Перевірте розклад!', role: 'Student' },
                { title: '📝 Нагадування про ДЗ', body: 'У вас є невиконані домашні завдання. Не забудьте здати!', role: 'Student' },
                { title: '🚀 Нова функція на платформі', body: 'Ми додали нову функцію! Зайдіть щоб спробувати.', role: '' },
                { title: '⚠️ Технічні роботи', body: 'Сьогодні з 23:00 до 01:00 плануються технічні роботи. Платформа буде недоступна.', role: '' },
              ].map((tmpl, i) => (
                <button key={i} onClick={() => setForm(f => ({...f, title: tmpl.title, body: tmpl.body, role: tmpl.role}))}
                  className="text-left px-3 py-2 rounded-xl bg-ink-50 dark:bg-[#1e2033] hover:bg-brand-50 dark:hover:bg-brand-900/20 text-sm transition">
                  <span className="font-semibold text-ink-800 dark:text-[#e8eaf0]">{tmpl.title}</span>
                  <span className="ml-2 text-xs text-ink-400">{tmpl.role || 'Всі'}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── HISTORY ── */}
      {tab === 'history' && (
        historyLoading ? <Loader /> : (
          <>
            <p className="text-sm text-ink-400 mb-4">Всього {historyTotal} сповіщень у системі</p>
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink-100 dark:border-[#282c44] bg-ink-50/60 dark:bg-[#151722]/60">
                      {['Отримувач', 'Заголовок', 'Текст', 'Статус', 'Дата'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-bold text-ink-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(n => (
                      <tr key={n.id} className="border-b border-ink-50 dark:border-[#1e2033] last:border-0 hover:bg-ink-50/40 dark:hover:bg-[#1e2033]/60 transition">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-ink-800 dark:text-[#e8eaf0] text-xs">{n.userName}</p>
                          <p className="text-ink-400 text-[10px]">{n.userEmail}</p>
                        </td>
                        <td className="px-4 py-3 font-semibold text-ink-700 dark:text-[#b0b8d0] text-xs max-w-[180px] truncate">{n.title}</td>
                        <td className="px-4 py-3 text-ink-500 dark:text-[#6b7394] text-xs max-w-[200px] truncate">{n.body}</td>
                        <td className="px-4 py-3">
                          <Badge tone={n.isRead ? 'gray' : 'brand'}>{n.isRead ? 'Прочитано' : 'Нове'}</Badge>
                        </td>
                        <td className="px-4 py-3 text-ink-400 text-xs whitespace-nowrap">
                          {new Date(n.createdAt).toLocaleString('uk-UA')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {history.length === 0 && <p className="text-center text-ink-400 py-10">Сповіщень немає</p>}
              </div>
            </Card>
          </>
        )
      )}
    </Layout>
  );
}
