import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { verifyEmail } from '../api/auth';

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState('');
  // Guard against React 18 Strict Mode double-invocation (token is single-use)
  const calledRef = useRef(false);

  useEffect(() => {
    if (!token) { setStatus('error'); setError('Посилання недійсне'); return; }
    if (calledRef.current) return;
    calledRef.current = true;

    let cancelled = false;
    verifyEmail(token)
      .then(() => { if (!cancelled) setStatus('success'); })
      .catch(err => {
        if (cancelled) return;
        setStatus('error');
        setError(err?.response?.data?.error ?? 'Токен недійсний або прострочений');
      });
    return () => { cancelled = true; };
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-white dark:bg-[#0f1018]">
      <motion.div
        initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .4 }}
        className="w-full max-w-sm text-center"
      >
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-extrabold"
            style={{ background: 'linear-gradient(135deg,#7350ff,#5526db)' }}>L</div>
          <span className="font-extrabold text-xl text-ink-900 dark:text-white">LTropik</span>
        </div>

        {status === 'loading' && (
          <>
            <div className="text-5xl mb-4 animate-pulse">📧</div>
            <p className="text-ink-600 dark:text-[#8891b0] font-semibold">Перевіряємо посилання…</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-2xl font-extrabold text-ink-900 dark:text-white mb-2">Email підтверджено!</h2>
            <p className="text-ink-500 dark:text-[#8891b0] text-sm mb-6">
              Ваш акаунт активовано. Тепер ви можете увійти.
            </p>
            <Link to="/login" className="btn btn-primary">Увійти в акаунт</Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-5xl mb-4">❌</div>
            <h2 className="text-2xl font-extrabold text-ink-900 dark:text-white mb-2">Помилка підтвердження</h2>
            <p className="text-ink-500 dark:text-[#8891b0] text-sm mb-6">{error}</p>
            <Link to="/login" className="btn btn-ghost">← На сторінку входу</Link>
          </>
        )}
      </motion.div>
    </div>
  );
}
