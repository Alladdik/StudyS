import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { forgotPassword } from '../api/auth';
import { Spinner } from '../components/ui';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Не вдалося надіслати лист. Перевірте налаштування Email у адмін-панелі.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-white dark:bg-[#0f1018]">
      <motion.div
        initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .4 }}
        className="w-full max-w-sm"
      >
        <div className="mb-8 flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-extrabold"
            style={{ background: 'linear-gradient(135deg,#7350ff,#5526db)' }}>L</div>
          <span className="font-extrabold text-xl text-ink-900 dark:text-white">LTropik</span>
        </div>

        {sent ? (
          <motion.div initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }}>
            <div className="text-5xl mb-4">📬</div>
            <h2 className="text-2xl font-extrabold text-ink-900 dark:text-white mb-2">Лист надіслано!</h2>
            <p className="text-ink-500 dark:text-[#8891b0] text-sm mb-6">
              Перевірте свою поштову скриньку <strong>{email}</strong>.
              Посилання діє <strong>30 хвилин</strong>.
            </p>
            <Link to="/login" className="btn btn-primary w-full justify-center">
              ← Повернутися до входу
            </Link>
          </motion.div>
        ) : (
          <>
            <h2 className="text-[2rem] font-extrabold tracking-tight mb-1 text-ink-900 dark:text-white">
              Відновлення пароля
            </h2>
            <p className="text-sm mb-8 text-ink-400 dark:text-[#8891b0]">
              Введіть email — ми надішлемо посилання для скидання пароля
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="input"
                />
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="rounded-xl px-4 py-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/50 text-sm font-semibold text-rose-700 dark:text-rose-400">
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <button type="submit" disabled={loading} className="btn btn-primary w-full"
                style={{ padding: '1rem', fontSize: '1rem', borderRadius: '1rem' }}>
                {loading ? <><Spinner className="w-4 h-4" /> Надсилаю…</> : '📧 Надіслати лист'}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-ink-100 dark:border-[#282c44]">
              <p className="text-sm text-center text-ink-400 dark:text-[#8891b0]">
                Згадали пароль?{' '}
                <Link to="/login" className="font-bold text-brand-600">Увійти</Link>
              </p>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
