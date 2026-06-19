import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { resetPassword } from '../api/auth';
import { Spinner } from '../components/ui';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();

  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) { setError('Паролі не збігаються'); return; }
    if (newPw.length < 6) { setError('Мінімум 6 символів'); return; }
    setError(''); setLoading(true);
    try {
      await resetPassword(token, newPw);
      setDone(true);
      timerRef.current = setTimeout(() => navigate('/login'), 2500);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Токен недійсний або прострочений');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <p className="text-ink-600 font-semibold mb-4">Посилання недійсне або прострочене</p>
          <Link to="/forgot-password" className="btn btn-primary">Запросити новий лист</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-white dark:bg-[#0a1912]">
      <motion.div
        initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .4 }}
        className="w-full max-w-sm"
      >
        <div className="mb-8 flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-extrabold"
            style={{ background: 'linear-gradient(135deg,#0c8a51,#0b6f43)' }}>L</div>
          <span className="font-extrabold text-xl text-ink-900 dark:text-white">LTropik</span>
        </div>

        {done ? (
          <motion.div initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }}>
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-2xl font-extrabold text-ink-900 dark:text-white mb-2">Пароль змінено!</h2>
            <p className="text-ink-500 text-sm">Перенаправляємо до входу…</p>
          </motion.div>
        ) : (
          <>
            <h2 className="text-[2rem] font-extrabold tracking-tight mb-1 text-ink-900 dark:text-white">
              Новий пароль
            </h2>
            <p className="text-sm mb-8 text-ink-400 dark:text-[#8891b0]">
              Введіть новий пароль для вашого акаунту
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div>
                <label className="label">Новий пароль</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    placeholder="мін. 6 символів"
                    value={newPw}
                    onChange={e => setNewPw(e.target.value)}
                    required minLength={6}
                    className="input"
                    style={{ paddingRight: '3rem' }}
                  />
                  <button type="button" onClick={() => setShowPw(p => !p)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-400 hover:text-brand-500 transition">
                    {showPw
                      ? <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
                      : <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>}
                  </button>
                </div>
              </div>

              <div>
                <label className="label">Підтвердіть пароль</label>
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="повторіть пароль"
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  required
                  className="input"
                />
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="rounded-xl px-4 py-3 bg-rose-50 border border-rose-200 text-sm font-semibold text-rose-700">
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <button type="submit" disabled={loading} className="btn btn-primary w-full"
                style={{ padding: '1rem', fontSize: '1rem', borderRadius: '1rem' }}>
                {loading ? <><Spinner className="w-4 h-4" /> Зберігаю…</> : '🔒 Зберегти пароль'}
              </button>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}
