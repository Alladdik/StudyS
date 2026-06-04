import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { login, verify2fa } from '../api/auth';
import { useAuthStore } from '../store/authStore';
import type { UserRole } from '../types';
import { Spinner } from '../components/ui';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [twoFaMode, setTwoFaMode] = useState(false);
  const [pendingToken, setPendingToken] = useState('');
  const [twoFaCode, setTwoFaCode] = useState('');
  const { login: storeLogin } = useAuthStore();
  const navigate = useNavigate();

  const roleRedirects: Record<string, string> = {
    Admin: '/admin', Teacher: '/teacher/dashboard',
    Student: '/student/diary', Parent: '/parent/dashboard',
    Manager: '/manager',
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data } = await login(email, password);
      if (data.requires2fa && data.pendingToken) {
        setPendingToken(data.pendingToken);
        setTwoFaMode(true);
        return;
      }
      storeLogin(data.accessToken, data.userId, data.role as UserRole);
      navigate(roleRedirects[data.role] ?? '/');
    } catch {
      setError('Невірний email або пароль');
    } finally { setLoading(false); }
  };

  const handle2fa = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data } = await verify2fa(pendingToken, twoFaCode);
      storeLogin(data.accessToken, data.userId, data.role as UserRole);
      navigate(roleRedirects[data.role] ?? '/');
    } catch {
      setError('Невірний або застарілий код');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex">

      {/* ── Left brand panel ─────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col justify-between p-14"
        style={{ background: 'linear-gradient(145deg, #5526db 0%, #7350ff 45%, #8d72ff 100%)' }}>

        {/* grid texture */}
        <div className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '48px 48px' }} />
        {/* glow blobs */}
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-white/15 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 -left-20 w-80 h-80 rounded-full bg-fuchsia-400/20 blur-3xl pointer-events-none" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <span className="text-white font-extrabold text-xl">L</span>
          </div>
          <span className="text-white font-extrabold text-xl tracking-tight">LTropik</span>
        </div>

        {/* Hero text */}
        <div className="relative z-10">
          <motion.h1
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .1 }}
            className="text-5xl font-extrabold text-white leading-[1.1] tracking-tight">
            Навчання,<br />яке надихає<br />кожного
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .2 }}
            className="text-white/60 text-lg mt-5 max-w-xs leading-relaxed">
            Інтерактивні уроки, AI‑ментор та геймифікація — все в одному місці.
          </motion.p>

          <div className="mt-10 flex flex-col gap-3 max-w-xs">
            {[
              { icon: '🎓', text: 'Інтерактивні уроки та тести' },
              { icon: '🤖', text: 'AI‑ментор доступний 24/7' },
              { icon: '🏆', text: 'Бейджі, стріки та рейтинги' },
            ].map((f, i) => (
              <motion.div key={f.text}
                initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .3 + i * .1 }}
                className="flex items-center gap-3.5 bg-white/10 border border-white/15 rounded-2xl px-5 py-3.5">
                <span className="text-2xl">{f.icon}</span>
                <span className="text-white/90 text-sm font-semibold">{f.text}</span>
              </motion.div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-white/30 text-xs">© 2026 LTropik · Всі права захищені</p>
      </div>

      {/* ── Right: form panel ────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">

        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .45, ease: 'easeOut' }}
          className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-extrabold"
              style={{ background: 'linear-gradient(135deg,#7350ff,#5526db)' }}>L</div>
            <span className="font-extrabold text-xl" style={{ color: '#262a3d' }}>LTropik</span>
          </div>

          {twoFaMode ? (
            <>
              <h2 className="text-[2rem] font-extrabold tracking-tight mb-1" style={{ color: '#181b29' }}>
                🔐 Підтвердження
              </h2>
              <p className="text-sm mb-8" style={{ color: '#9aa2bd' }}>
                Ми надіслали 6-значний код у ваш Telegram. Введіть його нижче.
              </p>
              <form onSubmit={handle2fa} className="flex flex-col gap-5">
                <div>
                  <label className="label">Код підтвердження</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    pattern="\d{6}"
                    placeholder="123456"
                    value={twoFaCode}
                    onChange={e => setTwoFaCode(e.target.value.replace(/\D/g, ''))}
                    required
                    className="input text-center text-2xl tracking-[0.5em] font-bold"
                  />
                </div>
                <AnimatePresence>
                  {error && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="flex items-center gap-3 rounded-xl px-4 py-3"
                      style={{ background: '#fff1f2', border: '1.5px solid #fecdd3' }}>
                      <p className="text-sm font-semibold" style={{ color: '#e11d48' }}>{error}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
                <button type="submit" disabled={loading || twoFaCode.length < 6}
                  className="btn btn-primary w-full" style={{ padding: '1rem', fontSize: '1rem', borderRadius: '1rem' }}>
                  {loading ? <><Spinner className="w-4 h-4" /> Перевіряю…</> : 'Підтвердити'}
                </button>
                <button type="button" onClick={() => { setTwoFaMode(false); setTwoFaCode(''); setError(''); }}
                  className="text-sm text-center" style={{ color: '#9aa2bd' }}>
                  ← Назад до входу
                </button>
              </form>
            </>
          ) : (
            <>
          <h2 className="text-[2rem] font-extrabold tracking-tight mb-1" style={{ color: '#181b29' }}>
            З поверненням 👋
          </h2>
          <p className="text-sm mb-8" style={{ color: '#9aa2bd' }}>Увійдіть, щоб продовжити навчання</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">

            {/* Email */}
            <div>
              <label className="label">Email</label>
              <div className="relative">
                {/* icon */}
                <span className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#9aa2bd' }}>
                  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                  </svg>
                </span>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="input"
                  style={{ paddingLeft: '2.75rem' }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="label">Пароль</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#9aa2bd' }}>
                  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                  </svg>
                </span>
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="input"
                  style={{ paddingLeft: '2.75rem', paddingRight: '3rem' }}
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: '#9aa2bd' }}
                  onMouseOver={e => (e.currentTarget.style.color = '#6535f6')}
                  onMouseOut={e => (e.currentTarget.style.color = '#9aa2bd')}>
                  {showPass
                    ? <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
                    : <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>}
                </button>
              </div>
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-3 rounded-xl px-4 py-3"
                  style={{ background: '#fff1f2', border: '1.5px solid #fecdd3' }}>
                  <svg width="16" height="16" fill="none" stroke="#f43f5e" viewBox="0 0 24 24" className="shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <p className="text-sm font-semibold" style={{ color: '#e11d48' }}>{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit */}
            <button type="submit" disabled={loading} className="btn btn-primary w-full mt-1"
              style={{ padding: '1rem', fontSize: '1rem', borderRadius: '1rem' }}>
              {loading
                ? <><Spinner className="w-4 h-4" /> Входжу…</>
                : <>Увійти <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg></>}
            </button>
          </form>

          <div className="mt-4 text-center">
            <Link to="/forgot-password" className="text-sm font-semibold" style={{ color: '#9aa2bd' }}
              onMouseOver={e => (e.currentTarget.style.color = '#6535f6')}
              onMouseOut={e => (e.currentTarget.style.color = '#9aa2bd')}>
              Забули пароль?
            </Link>
          </div>

          <div className="mt-5 pt-6" style={{ borderTop: '1px solid #eef0f6' }}>
            <p className="text-sm text-center" style={{ color: '#9aa2bd' }}>
              Немає акаунту?{' '}
              <Link to="/register" className="font-bold" style={{ color: '#6535f6' }}>Зареєструватись</Link>
            </p>
          </div>

          </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
