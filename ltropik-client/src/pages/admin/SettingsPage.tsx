import { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Card, toast } from '../../components/ui';
import api from '../../api/client';

interface SettingMeta { value: string | null; isSecret: boolean; isSet: boolean; }
type Settings = Record<string, SettingMeta>;

interface Section {
  title: string;
  icon: string;
  description: string;
  fields: { key: string; label: string; placeholder: string; type?: string }[];
}

const SECTIONS: Section[] = [
  {
    title: 'OpenAI', icon: '🤖', description: 'API для AI-ментора та автоперевірки домашніх завдань',
    fields: [
      { key: 'OpenAI:ApiKey', label: 'API ключ', placeholder: 'sk-...', type: 'password' },
      { key: 'OpenAI:Model', label: 'Модель', placeholder: 'gpt-4o-mini' },
    ],
  },
  {
    title: 'Google Gemini', icon: '✨', description: 'Альтернатива OpenAI — якщо вказано, буде використано замість OpenAI',
    fields: [
      { key: 'Gemini:ApiKey', label: 'API ключ', placeholder: 'AIza...', type: 'password' },
      { key: 'Gemini:Model', label: 'Модель', placeholder: 'gemini-1.5-flash' },
    ],
  },
  {
    title: 'Telegram-бот', icon: '✈️', description: 'Сповіщення студентам, батькам і 2FA через Telegram',
    fields: [
      { key: 'Telegram:BotToken', label: 'Bot Token', placeholder: '123456:ABC-...', type: 'password' },
    ],
  },
  {
    title: 'Email (SMTP)', icon: '📧', description: 'Відправка листів (сповіщення, сертифікати)',
    fields: [
      { key: 'Email:SmtpHost', label: 'SMTP хост', placeholder: 'smtp.gmail.com' },
      { key: 'Email:SmtpPort', label: 'SMTP порт', placeholder: '587' },
      { key: 'Email:FromAddress', label: 'Email відправника', placeholder: 'noreply@school.com' },
      { key: 'Email:FromName', label: "Ім'я відправника", placeholder: 'LTropik School' },
      { key: 'Email:Username', label: 'Логін SMTP', placeholder: 'user@gmail.com' },
      { key: 'Email:Password', label: 'Пароль SMTP', placeholder: '••••••••', type: 'password' },
    ],
  },
  {
    title: 'Загальне', icon: '⚙️', description: 'Системні налаштування платформи',
    fields: [
      { key: 'Frontend:Url', label: 'URL фронтенду (для CORS)', placeholder: 'https://school.com' },
    ],
  },
];

export function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({});
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  useEffect(() => {
    api.get<Settings>('/appsettings')
      .then(r => setSettings(r.data))
      .catch(() => toast('error', 'Не вдалося завантажити налаштування'))
      .finally(() => setLoading(false));
  }, []);

  function handleChange(key: string, value: string) {
    setEdits(prev => ({ ...prev, [key]: value }));
  }

  async function saveSection(section: Section) {
    setSaving(section.title);
    const payload: Record<string, string | null> = {};
    let hasChanges = false;

    for (const field of section.fields) {
      if (edits[field.key] !== undefined) {
        payload[field.key] = edits[field.key] || null;
        hasChanges = true;
      }
    }

    if (!hasChanges) { setSaving(null); toast('info', 'Немає змін для збереження'); return; }

    try {
      await api.put('/appsettings', payload);
      toast('success', `${section.title} — збережено`);
      const r = await api.get<Settings>('/appsettings');
      setSettings(r.data);
      const newEdits = { ...edits };
      section.fields.forEach(f => delete newEdits[f.key]);
      setEdits(newEdits);
    } catch {
      toast('error', 'Помилка збереження');
    } finally {
      setSaving(null);
    }
  }

  async function testTelegram() {
    setTesting('telegram');
    try {
      const r = await api.post<{ ok: boolean; raw: string }>('/appsettings/test/telegram');
      if (r.data.ok) toast('success', 'Telegram підключено успішно');
    } catch (e: any) {
      toast('error', e?.response?.data?.error ?? 'Помилка перевірки Telegram');
    } finally { setTesting(null); }
  }

  async function testAi() {
    setTesting('ai');
    try {
      const r = await api.post<{ ok: boolean; preview: string }>('/appsettings/test/ai');
      if (r.data.ok) toast('success', `AI відповів: ${r.data.preview}`);
    } catch (e: any) {
      toast('error', e?.response?.data?.error ?? 'Помилка перевірки AI');
    } finally { setTesting(null); }
  }

  if (loading) return (
    <Layout title="Налаштування">
      <div className="flex items-center justify-center h-64 text-ink-400">Завантаження…</div>
    </Layout>
  );

  return (
    <Layout title="Налаштування" subtitle="Підключення зовнішніх сервісів та конфігурація платформи">
      <div className="max-w-2xl flex flex-col gap-6">

        {SECTIONS.map(section => (
          <Card key={section.title} className="p-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-ink-900 dark:text-white flex items-center gap-2">
                  <span className="text-2xl">{section.icon}</span>
                  {section.title}
                </h2>
                <p className="text-sm text-ink-400 mt-0.5">{section.description}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                {/* Test buttons */}
                {section.title === 'Telegram-бот' && (
                  <button onClick={testTelegram} disabled={testing === 'telegram'}
                    className="btn btn-soft text-sm px-3 py-1.5">
                    {testing === 'telegram' ? '…' : 'Перевірити'}
                  </button>
                )}
                {(section.title === 'OpenAI' || section.title === 'Google Gemini') && (
                  <button onClick={testAi} disabled={testing === 'ai'}
                    className="btn btn-soft text-sm px-3 py-1.5">
                    {testing === 'ai' ? '…' : 'Перевірити AI'}
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {section.fields.map(field => {
                const meta = settings[field.key];
                const currentEdit = edits[field.key];
                const displayValue = currentEdit !== undefined
                  ? currentEdit
                  : (meta?.isSet && meta?.isSecret ? '' : (meta?.value ?? ''));

                return (
                  <div key={field.key}>
                    <label className="flex items-center gap-2 text-sm font-semibold text-ink-700 mb-1.5">
                      {field.label}
                      {meta?.isSet && (
                        <span className="text-xs font-normal px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
                          ✓ задано
                        </span>
                      )}
                    </label>
                    <input
                      type={field.type === 'password' ? 'password' : 'text'}
                      placeholder={field.type === 'password' && meta?.isSet
                        ? '(залиште порожнім щоб не змінювати)'
                        : field.placeholder}
                      value={displayValue}
                      onChange={e => handleChange(field.key, e.target.value)}
                      className="input w-full font-mono text-sm"
                      autoComplete="off"
                    />
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => saveSection(section)}
                disabled={saving === section.title}
                className="btn btn-primary px-5 py-2 text-sm"
              >
                {saving === section.title ? 'Збереження…' : 'Зберегти'}
              </button>
            </div>
          </Card>
        ))}

        {/* Danger zone */}
        <Card className="p-6 border-rose-100">
          <h2 className="text-lg font-bold text-rose-700 mb-1">Зона небезпеки</h2>
          <p className="text-sm text-ink-400 mb-4">
            JWT Secret задається через <code className="bg-ink-100 dark:bg-[#163a28] px-1 rounded">appsettings.json → Jwt:Key</code> і
            вимагає перезапуску сервера (зміна скасує всі активні сесії).
          </p>
          <p className="text-sm text-ink-400">
            Рядок підключення до БД: <code className="bg-ink-100 dark:bg-[#163a28] px-1 rounded">ConnectionStrings:Postgres</code> — теж через appsettings.json або змінну середовища.
          </p>
        </Card>

      </div>
    </Layout>
  );
}
