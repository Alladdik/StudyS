import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as signalR from '@microsoft/signalr';
import { getNotifications, getUnreadCount, markAllRead } from '../api/notifications';
import api from '../api/client';
import { useAuthStore } from '../store/authStore';
import type { AppNotification } from '../types';
import { cx } from './ui';

export function NotificationBell() {
  const { token } = useAuthStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [connStatus, setConnStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [testSent, setTestSent] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(() => {
    if (!token) return;
    getUnreadCount().then((r) => setCount(r.data.count)).catch(() => {});
  }, [token]);

  useEffect(() => { refreshCount(); }, [refreshCount]);

  // SignalR real-time push
  useEffect(() => {
    if (!token) return;
    setConnStatus('connecting');

    const conn = new signalR.HubConnectionBuilder()
      .withUrl('/hubs/notifications', {
        accessTokenFactory: () => token,
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    conn.on('Notification', (notif: AppNotification) => {
      setNotifications((prev) => [notif, ...prev.slice(0, 49)]);
      setCount((c) => c + 1);
    });

    conn.onreconnecting(() => setConnStatus('connecting'));
    conn.onreconnected(() => { setConnStatus('connected'); refreshCount(); });
    conn.onclose(() => setConnStatus('disconnected'));

    conn.start()
      .then(() => setConnStatus('connected'))
      .catch((err) => {
        if (err && err.toString().includes('stopped')) return;
        setConnStatus('disconnected');
      });

    return () => { conn.stop(); };
  }, [token, refreshCount]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function handleOpen() {
    if (!open) {
      const r = await getNotifications().catch(() => ({ data: [] as AppNotification[] }));
      setNotifications(r.data);
    }
    setOpen((p) => !p);
  }

  async function handleMarkAll() {
    await markAllRead().catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setCount(0);
  }

  async function handleTest() {
    setTestSent(true);
    await api.post('/notifications/test').catch(() => {});
    setTimeout(() => setTestSent(false), 3000);
  }

  function handleClick(notif: AppNotification) {
    setOpen(false);
    if (notif.actionUrl) navigate(notif.actionUrl);
  }

  const connDot =
    connStatus === 'connected' ? 'bg-emerald-400' :
    connStatus === 'connecting' ? 'bg-amber-400 animate-pulse' :
    'bg-rose-400';

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button onClick={handleOpen}
        title={`Сповіщення — ${connStatus === 'connected' ? 'live' : connStatus === 'connecting' ? 'підключення…' : 'offline'}`}
        className="relative w-9 h-9 rounded-xl flex items-center justify-center text-ink-500 hover:bg-ink-100 transition">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
            {count > 99 ? '99+' : count}
          </span>
        )}
        {/* Live dot */}
        <span className={cx('absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full border border-white', connDot)} />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-2xl border border-ink-100 z-50 overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-ink-100">
              <div className="flex items-center gap-2">
                <span className="font-bold text-ink-900 text-sm">Сповіщення</span>
                <span className={cx('text-[10px] px-1.5 py-0.5 rounded-full font-semibold',
                  connStatus === 'connected' ? 'bg-emerald-100 text-emerald-700' :
                  connStatus === 'connecting' ? 'bg-amber-100 text-amber-700' :
                  'bg-rose-100 text-rose-700')}>
                  {connStatus === 'connected' ? '● live' : connStatus === 'connecting' ? '● …' : '● offline'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleTest} disabled={testSent}
                  className="text-xs px-2 py-1 rounded-lg bg-brand-50 text-brand-600 hover:bg-brand-100 disabled:opacity-60 transition"
                  title="Перевірити що дзвінок працює">
                  {testSent ? '✓ ok' : '🔔 тест'}
                </button>
                {count > 0 && (
                  <button onClick={handleMarkAll} className="text-xs text-ink-400 hover:text-brand-600 transition">
                    Прочитати все
                  </button>
                )}
              </div>
            </div>

            {/* List */}
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-10 text-center text-ink-400 text-sm">
                  <div className="text-3xl mb-2">🔕</div>
                  <p className="font-medium">Сповіщень немає</p>
                  <p className="text-xs text-ink-300 mt-1">Натисни <strong>🔔 тест</strong> — якщо з'явиться, дзвінок працює</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <button key={n.id} onClick={() => handleClick(n)}
                    className={cx('w-full text-left px-4 py-3 border-b border-ink-50 last:border-0 hover:bg-ink-50 transition',
                      !n.isRead && 'bg-brand-50/50')}>
                    <div className="flex items-start gap-3">
                      <span className={cx('w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
                        !n.isRead ? 'bg-brand-500' : 'bg-ink-200')} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-ink-800 truncate">{n.title}</p>
                        <p className="text-xs text-ink-500 mt-0.5 line-clamp-2">{n.body}</p>
                        <p className="text-[10px] text-ink-300 mt-1">
                          {new Date(n.createdAt).toLocaleString('uk-UA')}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
