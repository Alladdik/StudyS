import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { register, login } from '../api/auth';
import { useAuthStore } from '../store/authStore';
import type { UserRole } from '../types';
import { Spinner, cx } from '../components/ui';

type Role = 'Student' | 'Teacher' | 'Parent';

const ROLES: { value: Role; label: string; icon: string; desc: string }[] = [
  { value: 'Student', label: 'Студент', icon: '🎓', desc: 'Навчаюсь на курсах' },
  { value: 'Teacher', label: 'Викладач', icon: '👩‍🏫', desc: 'Веду уроки та перевіряю ДЗ' },
  { value: 'Parent', label: 'Батьки', icon: '👨‍👩‍👧', desc: 'Слідкую за успіхами дитини' },
];

const roleRedirects: Record<string, string> = {
  Admin: '/admin', Teacher: '/teacher/review',
  Student: '/student/diary', Parent: '/parent/dashboard',
};

export function RegisterPage() {
  const navigate = useNavigate();
  const { login: storeLogin } = useAuthStore();

  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<Role>('Student');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirm) { setError('Паролі не співпадають'); return; }
    if (password.length < 6) { setError('Пароль мінімум 6 символів'); return; }

    setLoading(true);
    try {
      await register({ email, password, firstName, lastName, role });

      // Auto-login after register
      const { data } = await login(email, password);
      storeLogin(data.accessToken, data.userId, data.role as UserRole);
      navigate(roleRedirects[data.role] ?? '/');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Помилка реєстрації. Спробуйте ще раз.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">

      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col justify-between p-14"
        style={{ background: 'linear-gradient(145deg, #0b6f43 0%, #0c8a51 45%, #12a160 100%)' }}>
        <div className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '48px 48px' }} />
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-white/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <span className="text-white font-extrabold text-xl">L</span>
          </div>
          <span className="text-white font-extrabold text-xl tracking-tight">LTropik</span>
        </div>

        <div className="relative z-10">
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .1 }}
            className="text-5xl font-extrabold text-white leading-[1.1] tracking-tight">
            Приєднуйся<br />до спільноти<br />тих, хто вчиться
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .2 }}
            className="text-white/60 text-lg mt-5 max-w-xs leading-relaxed">
            Зареєструйся та почни свою навчальну подорож просто зараз.
          </motion.p>
          <div className="mt-10 flex flex-col gap-3 max-w-xs">
            {[{ icon: '📚', text: 'Доступ до всіх курсів' }, { icon: '🎥', text: 'Відеокімнати та чат' }, { icon: '🏆', text: 'Сертифікати та досягнення' }].map((f, i) => (
              <motion.div key={f.text} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .3 + i * .1 }}
                className="flex items-center gap-3.5 bg-white/10 border border-white/15 rounded-2xl px-5 py-3.5">
                <span className="text-2xl">{f.icon}</span>
                <span className="text-white/90 text-sm font-semibold">{f.text}</span>
              </motion.div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-white/30 text-xs">© 2025 LTropik · Всі права захищені</p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-white dark:bg-[#0a1912] overflow-y-auto">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .4 }}
          className="w-full max-w-sm py-6">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-extrabold"
              style={{ background: 'linear-gradient(135deg,#0c8a51,#0b6f43)' }}>L</div>
            <span className="font-extrabold text-xl text-ink-900">LTropik</span>
          </div>

          <h2 className="text-3xl font-extrabold tracking-tight text-ink-900 dark:text-white mb-1">Реєстрація</h2>
          <p className="text-sm text-ink-400 dark:text-[#6b7394] mb-6">Створіть акаунт безкоштовно</p>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-6">
            {[1, 2].map((s) => (
              <div key={s} className={cx('flex items-center gap-2', s < 2 && 'flex-1')}>
                <div className={cx('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition',
                  step >= s ? 'bg-brand-600 text-white' : 'bg-ink-100 dark:bg-[#102a1d] text-ink-400 dark:text-[#6b7394]')}>
                  {step > s ? '✓' : s}
                </div>
                <span className={cx('text-xs font-medium', step >= s ? 'text-brand-600 dark:text-brand-400' : 'text-ink-300 dark:text-[#3a4a40]')}>
                  {s === 1 ? 'Хто ви?' : 'Дані'}
                </span>
                {s < 2 && <div className={cx('flex-1 h-px', step > s ? 'bg-brand-300 dark:bg-brand-700' : 'bg-ink-100 dark:bg-[#1c3a2a]')} />}
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <p className="text-sm font-semibold text-ink-600 dark:text-[#9aa2bd] mb-3">Оберіть вашу роль:</p>
                <div className="flex flex-col gap-2.5">
                  {ROLES.map((r) => (
                    <button key={r.value} type="button" onClick={() => setRole(r.value)}
                      className={cx('flex items-center gap-3.5 p-4 rounded-2xl border-2 text-left transition',
                        role === r.value
                          ? 'border-brand-400 bg-brand-50 dark:bg-brand-900/20 dark:border-brand-600'
                          : 'border-ink-100 dark:border-[#1c3a2a] hover:border-brand-200 dark:hover:border-brand-700 hover:bg-ink-50 dark:hover:bg-[#102a1d]')}>
                      <span className="text-3xl">{r.icon}</span>
                      <div>
                        <p className={cx('font-bold text-sm', role === r.value ? 'text-brand-700 dark:text-brand-400' : 'text-ink-800 dark:text-[#e8eaf0]')}>{r.label}</p>
                        <p className="text-xs text-ink-400 dark:text-[#6b7394]">{r.desc}</p>
                      </div>
                      {role === r.value && (
                        <div className="ml-auto w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                <button onClick={() => setStep(2)}
                  className="btn btn-primary w-full mt-6" style={{ padding: '1rem', fontSize: '1rem', borderRadius: '1rem' }}>
                  Далі →
                </button>
              </motion.div>
            ) : (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Ім'я</label>
                      <input value={firstName} onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Іван" required className="input" />
                    </div>
                    <div>
                      <label className="label">Прізвище</label>
                      <input value={lastName} onChange={(e) => setLastName(e.target.value)}
                        placeholder="Петренко" required className="input" />
                    </div>
                  </div>

                  <div>
                    <label className="label">Email</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com" required className="input" />
                  </div>

                  <div>
                    <label className="label">Пароль</label>
                    <div className="relative">
                      <input type={showPass ? 'text' : 'password'} value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="мін. 6 символів" required className="input pr-11" />
                      <button type="button" onClick={() => setShowPass(!showPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-brand-500">
                        {showPass ? '🙈' : '👁'}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="label">Повторіть пароль</label>
                    <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                      placeholder="••••••••" required className="input" />
                  </div>

                  <AnimatePresence>
                    {error && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        className="flex items-center gap-2 rounded-xl px-4 py-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800/50">
                        <span className="text-rose-500 text-sm">⚠️</span>
                        <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">{error}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex gap-2 mt-1">
                    <button type="button" onClick={() => setStep(1)}
                      className="btn btn-soft flex-1" style={{ padding: '.875rem' }}>
                      ← Назад
                    </button>
                    <button type="submit" disabled={loading}
                      className="btn btn-primary flex-1" style={{ padding: '.875rem', fontSize: '1rem', borderRadius: '1rem' }}>
                      {loading ? <><Spinner className="w-4 h-4" /> Реєстрація…</> : 'Зареєструватись'}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-6 pt-5 border-t border-ink-100 dark:border-[#1c3a2a] text-center">
            <p className="text-sm text-ink-400 dark:text-[#6b7394]">
              Вже є акаунт?{' '}
              <Link to="/login" className="font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors">Увійти</Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
