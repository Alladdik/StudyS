import { useEffect, useState, useCallback } from 'react';
import { Layout } from '../components/Layout';
import {
  getProfile, updateProfile, generateTelegramCode, unlinkTelegram,
  type Profile,
} from '../api/profile';
import { Card, Loader, toast, cx } from '../components/ui';
import { useDarkMode } from '../hooks/useDarkMode';
import api from '../api/client';

// ── Push Notifications card ──────────────────────────────────────────────
function PushNotificationsCard() {
  const [status, setStatus] = useState<'unknown' | 'granted' | 'denied' | 'loading'>('unknown');
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if (!('Notification' in window)) return;
    setStatus(Notification.permission as any);
    navigator.serviceWorker.ready.then(reg => reg.pushManager.getSubscription()).then(sub => {
      setSubscribed(!!sub);
    }).catch(() => {});
  }, []);

  const toggle = useCallback(async () => {
    setStatus('loading');
    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();

      if (existing) {
        await existing.unsubscribe();
        await api.delete('/push/unsubscribe', { data: { endpoint: existing.endpoint } }).catch(() => {});
        setSubscribed(false);
        setStatus('granted');
        toast('info', 'Push-сповіщення вимкнено');
        return;
      }

      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setStatus('denied'); return; }

      // Subscribe (applicationServerKey is optional if backend sends generic pushes)
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: undefined as any,
      }).catch(() => null);

      if (!sub) { setStatus('denied'); return; }

      const key = sub.getKey('p256dh');
      const auth = sub.getKey('auth');
      await api.post('/push/subscribe', {
        endpoint: sub.endpoint,
        p256dh: key ? btoa(String.fromCharCode(...new Uint8Array(key))) : '',
        auth: auth ? btoa(String.fromCharCode(...new Uint8Array(auth))) : '',
      }).catch(() => {});

      setSubscribed(true);
      setStatus('granted');
      toast('success', 'Push-сповіщення увімкнено!');
    } catch (err: any) {
      toast('error', 'Не вдалося налаштувати сповіщення');
      setStatus(Notification.permission as any);
    }
  }, []);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">{subscribed ? '🔔' : '🔕'}</span>
          <div>
            <p className="font-bold text-ink-900 dark:text-white text-sm">Push-сповіщення</p>
            <p className="text-xs text-ink-400">
              {status === 'denied' ? 'Заблоковано браузером — дозвольте в налаштуваннях'
                : subscribed ? 'Увімкнено' : 'Отримуйте сповіщення про нові уроки та оцінки'}
            </p>
          </div>
        </div>
        <button
          onClick={toggle}
          disabled={status === 'loading' || status === 'denied'}
          className={cx(
            'relative w-12 h-6 rounded-full transition-colors duration-200 flex-shrink-0 disabled:opacity-50',
            subscribed ? 'bg-brand-600' : 'bg-ink-200'
          )}
        >
          <span className={cx(
            'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white dark:bg-[#e8eaf0] shadow-sm transition-transform duration-200',
            subscribed ? 'translate-x-6' : 'translate-x-0'
          )} />
        </button>
      </div>
    </Card>
  );
}

export function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const { dark, toggle: toggleDark } = useDarkMode();

  // Edit form
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw]         = useState('');
  const [saveLoading, setSaveLoading] = useState(false);

  // Telegram linking
  const [linkCode, setLinkCode]       = useState<string | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);
  const [unlinkLoading, setUnlinkLoading] = useState(false);
  const [copied, setCopied]           = useState(false);

  const load = () =>
    getProfile().then(r => {
      setProfile(r.data);
      setFirstName(r.data.firstName);
      setLastName(r.data.lastName);
    }).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveLoading(true);
    try {
      await updateProfile({
        firstName: firstName || undefined,
        lastName:  lastName  || undefined,
        currentPassword: currentPw || undefined,
        newPassword:     newPw     || undefined,
      });
      toast('success', 'Профіль оновлено!');
      setCurrentPw(''); setNewPw('');
      load();
    } catch (err: any) {
      toast('error', err?.response?.data?.error ?? 'Помилка збереження');
    } finally {
      setSaveLoading(false);
    }
  }

  async function handleGenerateCode() {
    setCodeLoading(true);
    try {
      const r = await generateTelegramCode();
      setLinkCode(r.data.code);
    } catch {
      toast('error', 'Не вдалося згенерувати код');
    } finally {
      setCodeLoading(false);
    }
  }

  async function handleUnlink() {
    setUnlinkLoading(true);
    try {
      await unlinkTelegram();
      toast('success', 'Telegram відключено');
      setLinkCode(null);
      load();
    } catch {
      toast('error', 'Помилка відключення');
    } finally {
      setUnlinkLoading(false);
    }
  }

  function copyCode() {
    if (!linkCode) return;
    navigator.clipboard.writeText(`/link ${linkCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const ROLE_LABELS: Record<string, string> = {
    Admin: 'Адміністратор', Teacher: 'Викладач',
    Student: 'Студент', Parent: 'Батьки',
  };

  if (loading) return <Layout title="Профіль"><Loader /></Layout>;
  if (!profile) return null;

  return (
    <Layout title="Профіль" subtitle="Особисті дані та налаштування акаунту">
      <div className="max-w-xl flex flex-col gap-6">

        {/* ── Avatar + role ──────────────────────────────── */}
        <Card className="p-6 flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-700 flex items-center justify-center text-white text-2xl font-extrabold flex-shrink-0 shadow-[var(--shadow-glow)]">
            {profile.firstName[0]}{profile.lastName[0]}
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-ink-900 dark:text-white">
              {profile.firstName} {profile.lastName}
            </h2>
            <p className="text-sm text-ink-400">{profile.email}</p>
            <span className="inline-block mt-1.5 text-xs font-bold bg-brand-50 text-brand-700 px-2.5 py-1 rounded-full ring-1 ring-brand-100">
              {ROLE_LABELS[profile.role] ?? profile.role}
            </span>
          </div>
        </Card>

        {/* ── Edit form ──────────────────────────────────── */}
        <Card className="p-6">
          <h3 className="font-extrabold text-ink-900 dark:text-white text-base mb-5">Редагувати дані</h3>
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Ім'я</label>
                <input className="input" value={firstName}
                  onChange={e => setFirstName(e.target.value)} />
              </div>
              <div>
                <label className="label">Прізвище</label>
                <input className="input" value={lastName}
                  onChange={e => setLastName(e.target.value)} />
              </div>
            </div>

            <hr className="border-ink-100 dark:border-[#282c44]" />
            <p className="text-xs text-ink-400 font-semibold uppercase tracking-wide">Зміна пароля (необов'язково)</p>

            <div>
              <label className="label">Поточний пароль</label>
              <input type="password" className="input" value={currentPw}
                onChange={e => setCurrentPw(e.target.value)} placeholder="••••••" />
            </div>
            <div>
              <label className="label">Новий пароль</label>
              <input type="password" className="input" value={newPw}
                onChange={e => setNewPw(e.target.value)} placeholder="мін. 6 символів" minLength={6} />
            </div>

            <button type="submit" disabled={saveLoading} className="btn btn-primary self-start px-6">
              {saveLoading ? '⏳ Зберігаю…' : '💾 Зберегти'}
            </button>
          </form>
        </Card>

        {/* ── Telegram ───────────────────────────────────── */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">✈️</span>
            <div>
              <h3 className="font-extrabold text-ink-900 dark:text-white text-base">Telegram-бот</h3>
              <p className="text-sm text-ink-400">Отримуйте сповіщення про оцінки, розклад та ДЗ</p>
            </div>
          </div>

          {profile.telegramLinked ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                <span className="text-emerald-500 text-lg">✅</span>
                <div>
                  <p className="text-sm font-semibold text-emerald-800">Telegram підключено</p>
                  <p className="text-xs text-emerald-600 font-mono">{profile.telegramId}</p>
                </div>
              </div>
              <button onClick={handleUnlink} disabled={unlinkLoading}
                className="btn text-sm py-2 !bg-rose-50 !text-rose-600 hover:!bg-rose-100 self-start disabled:opacity-50">
                {unlinkLoading ? '…' : '🔌 Відключити Telegram'}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <ol className="text-sm text-ink-600 space-y-1.5 list-none">
                <li className="flex gap-2"><span className="text-brand-500 font-bold">1.</span> Знайдіть бота в Telegram (назва в налаштуваннях школи)</li>
                <li className="flex gap-2"><span className="text-brand-500 font-bold">2.</span> Натисніть кнопку нижче — отримайте код</li>
                <li className="flex gap-2"><span className="text-brand-500 font-bold">3.</span> Надішліть боту команду <code className="bg-ink-100 dark:bg-[#252840] px-1.5 py-0.5 rounded text-xs font-mono">/link КОД</code></li>
              </ol>

              {linkCode ? (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-ink-500 font-semibold">Команда для бота (натисніть щоб скопіювати):</p>
                  <button onClick={copyCode}
                    className={cx(
                      'flex items-center gap-3 bg-ink-900 text-white rounded-xl px-5 py-3 font-mono text-lg font-bold tracking-widest transition',
                      copied ? 'bg-emerald-600' : 'hover:bg-ink-700'
                    )}>
                    <span>/link {linkCode}</span>
                    <span className="ml-auto text-base">{copied ? '✅' : '📋'}</span>
                  </button>
                  <p className="text-xs text-ink-400">Код одноразовий — після прив'язки він зникне</p>
                  <button onClick={handleGenerateCode} disabled={codeLoading}
                    className="btn btn-soft text-sm py-2 self-start disabled:opacity-50">
                    {codeLoading ? '…' : '🔄 Оновити код'}
                  </button>
                </div>
              ) : (
                <button onClick={handleGenerateCode} disabled={codeLoading}
                  className="btn btn-primary self-start px-6 disabled:opacity-50">
                  {codeLoading ? '⏳ Генерую…' : '🔑 Отримати код'}
                </button>
              )}
            </div>
          )}
        </Card>

        {/* ── Push notifications ─────────────────────────── */}
        {'Notification' in window && 'serviceWorker' in navigator && (
          <PushNotificationsCard />
        )}

        {/* ── Dark mode ──────────────────────────────────── */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xl">{dark ? '🌙' : '☀️'}</span>
              <div>
                <p className="font-bold text-ink-900 dark:text-white text-sm">Темна тема</p>
                <p className="text-xs text-ink-400">{dark ? 'Увімкнена' : 'Вимкнена'}</p>
              </div>
            </div>
            <button
              onClick={toggleDark}
              className={cx(
                'relative w-12 h-6 rounded-full transition-colors duration-200 flex-shrink-0',
                dark ? 'bg-brand-600' : 'bg-ink-200'
              )}
            >
              <span className={cx(
                'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white dark:bg-[#e8eaf0] shadow-sm transition-transform duration-200',
                dark ? 'translate-x-6' : 'translate-x-0'
              )} />
            </button>
          </div>
        </Card>

        {/* ── Account info ───────────────────────────────── */}
        <Card className="p-5">
          <div className="flex justify-between text-sm text-ink-500">
            <span>Акаунт створено</span>
            <span className="font-semibold text-ink-700 dark:text-[#c8cad8]">
              {new Date(profile.createdAt).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
        </Card>

      </div>
    </Layout>
  );
}
