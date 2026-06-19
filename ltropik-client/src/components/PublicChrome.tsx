import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuthStore } from '../store/authStore';
import { useDarkMode } from '../hooks/useDarkMode';
import { cx } from './ui';

/** Where to send a logged-in user when they click "Мій кабінет". */
export function dashboardPath(role: string | null): string {
  switch (role) {
    case 'Admin':   return '/admin';
    case 'Teacher': return '/teacher/dashboard';
    case 'Student': return '/student/diary';
    case 'Parent':  return '/parent/dashboard';
    case 'Manager': return '/manager';
    default:        return '/login';
  }
}

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-mint-500 to-brand-700 flex items-center justify-center shadow-[0_0_16px_rgba(0,230,118,.4)]">
        <span className="text-forest-950 font-extrabold text-lg">L</span>
      </div>
      <span className="font-extrabold text-ink-900 dark:text-white text-xl tracking-tight">LTropik</span>
    </Link>
  );
}

/** Theme toggle reused on every public page. */
function ThemeToggle() {
  const { dark, toggle } = useDarkMode();
  return (
    <button
      onClick={toggle}
      aria-label="Перемкнути тему"
      className="w-9 h-9 rounded-xl flex items-center justify-center text-ink-500 dark:text-[#9aa2bd] hover:bg-ink-100 dark:hover:bg-[#102a1d] transition">
      {dark ? '🌙' : '☀️'}
    </button>
  );
}

/** Sticky top bar shared by the home, catalog and course-detail pages. */
export function PublicNav() {
  const { token, role } = useAuthStore();
  return (
    <header className="sticky top-0 z-30 backdrop-blur bg-white/80 dark:bg-[#0a1912]/80 border-b border-ink-100 dark:border-[#1c3a2a]">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Logo />
        <nav className="flex items-center gap-1.5 sm:gap-3">
          <Link to="/courses"
            className="hidden sm:inline-flex px-3 py-2 rounded-xl text-sm font-semibold text-ink-600 dark:text-[#9aa2bd] hover:text-brand-600 dark:hover:text-brand-400 transition">
            Курси
          </Link>
          <ThemeToggle />
          {token ? (
            <Link to={dashboardPath(role)} className="btn btn-primary text-sm px-5 py-2">
              Мій кабінет
            </Link>
          ) : (
            <>
              <Link to="/login"
                className="px-3 py-2 rounded-xl text-sm font-semibold text-ink-600 dark:text-[#9aa2bd] hover:text-brand-600 dark:hover:text-brand-400 transition">
                Увійти
              </Link>
              <Link to="/register" className="btn btn-primary text-sm px-5 py-2">
                Реєстрація
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-ink-100 dark:border-[#1c3a2a] mt-16">
      <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <Logo />
        <div className="flex items-center gap-5 text-sm text-ink-500 dark:text-[#6b7394]">
          <Link to="/courses" className="hover:text-brand-600 dark:hover:text-brand-400 transition">Курси</Link>
          <Link to="/login" className="hover:text-brand-600 dark:hover:text-brand-400 transition">Увійти</Link>
          <Link to="/register" className="hover:text-brand-600 dark:hover:text-brand-400 transition">Реєстрація</Link>
        </div>
        <p className="text-xs text-ink-400 dark:text-[#4d5470]">
          © {new Date().getFullYear()} LTropik · Онлайн-школа
        </p>
      </div>
    </footer>
  );
}

/** Five-star rating row used across public pages. */
export function Stars({ rating, className }: { rating?: number | null; className?: string }) {
  if (!rating) return <span className="text-xs text-ink-400 dark:text-[#4d5470]">Без оцінок</span>;
  return (
    <div className={cx('flex items-center gap-1', className)}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={cx('text-sm', i <= Math.round(rating) ? 'text-amber-400' : 'text-ink-200 dark:text-[#1f4d36]')}>★</span>
      ))}
      <span className="text-xs text-ink-500 dark:text-[#9aa2bd] ml-1 font-semibold">{rating.toFixed(1)}</span>
    </div>
  );
}

/** Public page background wrapper. */
export function PublicPage({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-ink-50 dark:from-[#0a1912] dark:via-[#0a1912] dark:to-[#0c2419]">
      {children}
    </div>
  );
}
