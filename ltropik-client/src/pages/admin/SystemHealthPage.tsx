import { useCallback, useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Card, Spinner } from '../../components/ui';
import api from '../../api/client';

interface HealthData {
  db: { status: 'OK' | 'ERROR'; error?: string; userCount: number };
  redis: { status: 'OK' | 'ERROR'; error?: string };
  process: { uptimeSeconds: number; uptimeHuman: string; memoryMb: number; threads: number };
  generatedAt: string;
}

function StatusBadge({ status }: { status: 'OK' | 'ERROR' | 'LOADING' }) {
  if (status === 'LOADING') return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-ink-100 dark:bg-[#102a1d] text-ink-500 dark:text-[#6b7394]">
      <Spinner className="w-3 h-3" /> Перевірка…
    </span>
  );
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
      status === 'OK' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'OK' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
      {status === 'OK' ? 'Працює' : 'Помилка'}
    </span>
  );
}

function MetricCard({ icon, label, value, sub, tone = 'default' }: {
  icon: string; label: string; value: string | number; sub?: string;
  tone?: 'default' | 'ok' | 'error';
}) {
  const bg = tone === 'ok' ? 'bg-emerald-50 dark:bg-[#0d2418]'
    : tone === 'error' ? 'bg-rose-50 dark:bg-[#2a1018]'
    : 'bg-ink-50 dark:bg-[#0e2218]';
  return (
    <div className={`rounded-2xl p-5 border border-ink-100 dark:border-[#1c3a2a] ${bg}`}>
      <div className="text-2xl mb-2">{icon}</div>
      <p className="text-xs text-ink-400 font-semibold uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-extrabold text-ink-900 dark:text-white">{value}</p>
      {sub && <p className="text-xs text-ink-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export function SystemHealthPage() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // useCallback so setInterval always calls the same stable reference
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await api.get<HealthData>('/admin/system-health');
      setData(r.data);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Не вдалося завантажити статус');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 30s — dep on stable `load` so interval always calls current version
  useEffect(() => {
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <Layout title="Health Dashboard" subtitle="Стан системи — оновлюється кожні 30 секунд">
      <div className="flex flex-col gap-6 max-w-3xl">

        {/* Header bar */}
        <Card className="p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🖥️</span>
            <div>
              <p className="font-extrabold text-ink-900 dark:text-white text-sm">Статус системи</p>
              {data && (
                <p className="text-xs text-ink-400">
                  Оновлено: {new Date(data.generatedAt).toLocaleTimeString('uk-UA')}
                </p>
              )}
            </div>
          </div>
          <button onClick={load} disabled={loading} className="btn btn-soft text-sm py-2 px-4">
            {loading ? <><Spinner className="w-4 h-4" /> Оновлюю…</> : '🔄 Оновити'}
          </button>
        </Card>

        {error && (
          <div className="rounded-2xl bg-rose-50 border border-rose-200 px-5 py-4 text-rose-700 font-semibold text-sm">
            ⚠️ {error}
          </div>
        )}

        {loading && !data ? (
          <div className="flex items-center justify-center h-40">
            <Spinner className="w-8 h-8 text-brand-500" />
          </div>
        ) : data ? (
          <>
            {/* Services */}
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-ink-400 mb-3">Сервіси</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center text-xl">🗄️</div>
                    <div>
                      <p className="font-bold text-ink-900 dark:text-white text-sm">PostgreSQL</p>
                      <p className="text-xs text-ink-400">{data.db.userCount} користувачів</p>
                    </div>
                  </div>
                  <StatusBadge status={data.db.status} />
                </Card>
                <Card className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-xl">⚡</div>
                    <div>
                      <p className="font-bold text-ink-900 dark:text-white text-sm">Redis</p>
                      <p className="text-xs text-ink-400">Кеш і черги</p>
                    </div>
                  </div>
                  <StatusBadge status={data.redis.status} />
                </Card>
              </div>
              {data.db.error && (
                <p className="mt-2 text-xs text-rose-600 font-mono px-1">{data.db.error}</p>
              )}
              {data.redis.error && (
                <p className="mt-2 text-xs text-rose-600 font-mono px-1">{data.redis.error}</p>
              )}
            </div>

            {/* Process metrics */}
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-ink-400 mb-3">Процес</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricCard icon="⏱️" label="Uptime" value={data.process.uptimeHuman} />
                <MetricCard icon="💾" label="Пам'ять" value={`${data.process.memoryMb} MB`} />
                <MetricCard icon="🧵" label="Потоки" value={data.process.threads} />
                <MetricCard
                  icon={data.db.status === 'OK' && data.redis.status === 'OK' ? '✅' : '⚠️'}
                  label="Загальний стан"
                  value={data.db.status === 'OK' && data.redis.status === 'OK' ? 'OK' : 'ПРОБЛЕМА'}
                  tone={data.db.status === 'OK' && data.redis.status === 'OK' ? 'ok' : 'error'}
                />
              </div>
            </div>
          </>
        ) : null}
      </div>
    </Layout>
  );
}
