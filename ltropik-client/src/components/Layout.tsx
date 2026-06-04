import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { cx } from './ui';
import { NotificationBell } from './NotificationBell';
import { SpotlightSearch } from './SpotlightSearch';
import { useProfile } from '../hooks/useProfile';
import { useDarkMode } from '../hooks/useDarkMode';

interface Props { children: React.ReactNode; title?: string; subtitle?: string; }

const icon = (d: string) => (
  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={d} />
  </svg>
);

const NAV: Record<string, { label: string; href: string; icon: ReactElement }[]> = {
  Student: [
    { label: 'Щоденник',   href: '/student/diary',       icon: icon('M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z') },
    { label: 'Мої курси',  href: '/student/courses',      icon: icon('M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253') },
    { label: 'Розклад',    href: '/calendar',             icon: icon('M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z') },
    { label: 'Магазин',    href: '/student/shop',         icon: icon('M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z') },
    { label: 'Месенджер',  href: '/messenger',            icon: icon('M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z') },
    { label: 'Кімнати',    href: '/rooms',                icon: icon('M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z') },
    { label: 'Досягнення', href: '/student/achievements', icon: icon('M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z') },
  ],
  Teacher: [
    { label: 'Головна',      href: '/teacher/dashboard',   icon: icon('M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z') },
    { label: 'Курси',        href: '/admin/courses',        icon: icon('M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253') },
    { label: 'Заявки',       href: '/teacher/requests',     icon: icon('M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2') },
    { label: 'Перевірка ДЗ', href: '/teacher/review',       icon: icon('M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4') },
    { label: 'Журнал',       href: '/teacher/journal',      icon: icon('M3 10h18M3 14h18M3 6h18M3 18h18') },
    { label: 'Журнал оцінок',href: '/teacher/gradebook',    icon: icon('M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z') },
    { label: 'Банк питань',  href: '/admin/question-bank',  icon: icon('M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z') },
    { label: 'Розклад',      href: '/calendar',             icon: icon('M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z') },
    { label: 'Кімнати',      href: '/rooms',                icon: icon('M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z') },
    { label: 'Месенджер',    href: '/messenger',            icon: icon('M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z') },
  ],
  Admin: [
    { label: 'Головна',      href: '/admin',                   icon: icon('M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z') },
    { label: 'Курси',        href: '/admin/courses',           icon: icon('M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253') },
    { label: 'Шкали оцінок', href: '/admin/grade-scales',      icon: icon('M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z') },
    { label: 'Аналітика',    href: '/admin/analytics',         icon: icon('M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z') },
    { label: 'Викладачі',    href: '/admin/teacher-analytics', icon: icon('M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0') },
    { label: 'Заявки',       href: '/admin/requests',          icon: icon('M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2') },
    { label: 'Магазин',      href: '/admin/shop',              icon: icon('M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z') },
    { label: 'Користувачі',  href: '/admin/users',             icon: icon('M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z') },
    { label: 'Групи',        href: '/admin/groups',            icon: icon('M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z') },
    { label: 'Банк питань',  href: '/admin/question-bank',     icon: icon('M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z') },
    { label: 'Розклад',      href: '/calendar',                icon: icon('M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z') },
    { label: 'Кімнати',      href: '/rooms',                   icon: icon('M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z') },
    { label: 'Журнал дій',  href: '/admin/audit-logs',        icon: icon('M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z') },
    { label: 'Health',       href: '/admin/system',             icon: icon('M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z') },
    { label: 'Налаштування', href: '/admin/settings',          icon: icon('M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z') },
  ],
  Parent: [
    { label: 'Кабінет',   href: '/parent/dashboard', icon: icon('M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z') },
    { label: 'Розклад',   href: '/calendar',          icon: icon('M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z') },
    { label: 'Месенджер', href: '/messenger',         icon: icon('M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z') },
  ],
  Manager: [
    { label: 'Головна',      href: '/manager',                 icon: icon('M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z') },
    { label: 'Курси',        href: '/admin/courses',           icon: icon('M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253') },
    { label: 'Шкали оцінок', href: '/admin/grade-scales',      icon: icon('M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z') },
    { label: 'Аналітика',    href: '/admin/analytics',         icon: icon('M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z') },
    { label: 'Викладачі',    href: '/admin/teacher-analytics', icon: icon('M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0') },
    { label: 'Заявки',       href: '/admin/requests',          icon: icon('M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2') },
    { label: 'Магазин',      href: '/admin/shop',              icon: icon('M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z') },
    { label: 'Користувачі',  href: '/admin/users',             icon: icon('M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z') },
    { label: 'Групи',        href: '/admin/groups',            icon: icon('M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z') },
    { label: 'Банк питань',  href: '/admin/question-bank',     icon: icon('M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z') },
    { label: 'Журнал оцінок',href: '/teacher/gradebook',       icon: icon('M3 10h18M3 14h18M3 6h18M3 18h18') },
    { label: 'Розклад',      href: '/calendar',                icon: icon('M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z') },
    { label: 'Кімнати',      href: '/rooms',                   icon: icon('M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z') },
    { label: 'Месенджер',    href: '/messenger',               icon: icon('M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z') },
  ],
};

const ROLE_LABELS: Record<string, string> = { Admin: 'Адміністратор', Teacher: 'Викладач', Student: 'Студент', Parent: 'Батьки', Manager: 'Менеджер' };

// ── Theme Toggle button ───────────────────────────────────────────────────────
function ThemeToggle({ dark, toggle }: { dark: boolean; toggle: () => void }) {
  return (
    <motion.button
      onClick={toggle}
      title={dark ? 'Перейти на світлу тему' : 'Перейти на темну тему'}
      whileTap={{ scale: 0.88 }}
      className={cx(
        'relative w-9 h-9 rounded-xl border flex items-center justify-center transition-colors duration-200',
        dark
          ? 'bg-[#1e2033] border-[#282c44] text-amber-400 hover:bg-[#252840] hover:border-brand-600'
          : 'bg-ink-50 border-ink-200 text-ink-500 hover:bg-brand-50 hover:border-brand-300 hover:text-brand-600'
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        {dark ? (
          <motion.svg
            key="moon"
            initial={{ rotate: -30, opacity: 0, scale: 0.7 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 30, opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.18 }}
            className="w-4 h-4"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </motion.svg>
        ) : (
          <motion.svg
            key="sun"
            initial={{ rotate: 30, opacity: 0, scale: 0.7 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: -30, opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.18 }}
            className="w-4 h-4"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
          </motion.svg>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

function NavList({ links, pathname, onNavigate }:
  { links: { label: string; href: string; icon: ReactElement }[]; pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {links.map((l) => {
        const active = (l.href === '/admin' || l.href === '/manager')
          ? pathname === l.href
          : pathname === l.href || pathname.startsWith(l.href + '/');
        return (
          <Link key={l.href} to={l.href} onClick={onNavigate}
            className={cx('relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors',
              active ? 'text-brand-700 dark:text-brand-400' : 'text-ink-500 dark:text-[#6b7394] hover:text-ink-800 dark:hover:text-[#e8eaf0] hover:bg-ink-50 dark:hover:bg-[#1e2033]')}>
            {active && (
              <motion.span layoutId="nav-active" className="absolute inset-0 bg-brand-50 dark:bg-brand-900/30 rounded-xl ring-1 ring-brand-100 dark:ring-brand-800/40"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }} />
            )}
            <span className={cx('relative z-10', active && 'text-brand-600')}>{l.icon}</span>
            <span className="relative z-10">{l.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

interface AdminBackup {
  token: string;
  userId: string;
  role: string;
  impersonatedUserName: string;
  impersonatedUserEmail: string;
}

function readBackup(): AdminBackup | null {
  try {
    const s = localStorage.getItem('ltropik-admin-backup');
    if (!s) return null;
    const b = JSON.parse(s) as AdminBackup;
    // Guard: backup must have valid token and role to restore
    if (!b.token || !b.userId || !b.role) return null;
    return b;
  } catch { return null; }
}

export function Layout({ children, title, subtitle }: Props) {
  const { role, login, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const { profile } = useProfile();
  const { dark, toggle: toggleDark } = useDarkMode();

  // Keep backup in React state so it's reactive and clears immediately on click
  const [backup, setBackup] = useState<AdminBackup | null>(readBackup);

  // Sync backup state if localStorage changes (e.g. from handleImpersonate in another component)
  useEffect(() => {
    setBackup(readBackup());
  }, [role]); // re-sync whenever role changes (impersonation triggers role change)

  // Cmd+K / Ctrl+K to open spotlight
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSpotlightOpen(o => !o);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const links = (role && NAV[role]) || [];

  const Brand = (
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-[var(--shadow-glow)]">
        <span className="text-white font-extrabold text-lg">L</span>
      </div>
      <span className="font-extrabold text-ink-900 dark:text-white text-lg tracking-tight">LTropik</span>
    </div>
  );

  const SidebarBody = (
    <>
      <div className="px-5 py-5">{Brand}</div>
      <div className="px-3 flex-1 overflow-y-auto">
        {role && (
          <p className="px-3.5 text-[11px] font-bold uppercase tracking-wider text-ink-300 dark:text-[#3d4460] mb-2">Меню</p>
        )}
        <NavList links={links} pathname={location.pathname} onNavigate={() => setMobileOpen(false)} />
      </div>

      {/* User footer */}
      <div className="p-3 border-t border-ink-100 dark:border-[#282c44]">
        <Link to="/profile"
          className="flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-ink-50 dark:hover:bg-[#1e2033] transition group">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {profile ? `${profile.firstName[0]}${profile.lastName[0]}` : (role ?? '?')[0]}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink-800 dark:text-[#e8eaf0] truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition">
              {profile ? `${profile.firstName} ${profile.lastName}` : (ROLE_LABELS[role ?? ''] ?? 'Гість')}
            </p>
            <p className="text-xs text-ink-400">
              {profile?.telegramLinked
                ? <span className="text-emerald-500 font-medium">✓ Telegram</span>
                : 'Профіль'}
            </p>
          </div>
          <button onClick={e => { e.preventDefault(); logout(); navigate('/login'); }} title="Вийти"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-400 hover:text-rose-500 hover:bg-rose-50 transition flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </Link>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex text-ink-800 dark:text-[#e8eaf0]">
      <SpotlightSearch open={spotlightOpen} onClose={() => setSpotlightOpen(false)} />
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-shrink-0 flex-col bg-white/80 dark:bg-[#131522cc] backdrop-blur-xl border-r border-ink-100 dark:border-[#282c44] sticky top-0 h-screen">
        {SidebarBody}
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)} className="fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-sm lg:hidden" />
            <motion.aside initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 360, damping: 34 }}
              className="fixed inset-y-0 left-0 z-50 w-64 flex flex-col bg-white dark:bg-[#131522] border-r border-ink-100 dark:border-[#282c44] lg:hidden">
              {SidebarBody}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        {backup && (
          <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white px-4 py-2.5 text-center text-xs sm:text-sm font-semibold flex items-center justify-center gap-3 shadow-md z-50">
            <span>🕵️ Ви переглядаєте кабінет як <strong>{backup.impersonatedUserName}</strong> ({backup.impersonatedUserEmail})</span>
            <button
              onClick={() => {
                if (!backup) return;
                // 1. Clear backup from state AND localStorage FIRST
                //    so the banner disappears immediately on this render
                setBackup(null);
                localStorage.removeItem('ltropik-admin-backup');
                // 2. Restore admin session
                login(backup.token, backup.userId, backup.role as never);
                // 3. Navigate after React flushes the role update
                setTimeout(() => navigate('/admin/users'), 0);
              }}
              className="bg-white text-orange-700 px-3 py-1 rounded-xl text-xs font-extrabold hover:bg-orange-50 transition shadow-sm flex-shrink-0"
            >
              Повернутися до Адміна
            </button>
          </div>
        )}
        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-white/80 dark:bg-[#131522cc] backdrop-blur-xl border-b border-ink-100 dark:border-[#282c44]">
          <button onClick={() => setMobileOpen(true)} className="w-9 h-9 rounded-xl border border-ink-200 flex items-center justify-center text-ink-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          {Brand}
          <div className="ml-auto flex items-center gap-1.5">
            <button onClick={() => setSpotlightOpen(true)} title="Пошук"
              className="w-9 h-9 rounded-xl border border-ink-200 dark:border-[#282c44] flex items-center justify-center text-ink-500 dark:text-[#9aa2bd] hover:text-brand-600 transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
            <ThemeToggle dark={dark} toggle={toggleDark} />
            <NotificationBell />
          </div>
        </div>

        {/* Desktop header */}
        <div className="hidden lg:flex items-center justify-between px-8 pt-5 pb-2">
          <div>
            {title && <h1 className="text-2xl font-extrabold text-ink-900 dark:text-white tracking-tight">{title}</h1>}
            {subtitle && <p className="text-ink-500 dark:text-[#6b7394] text-sm mt-1">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            {/* Search */}
            <button onClick={() => setSpotlightOpen(true)}
              className="flex items-center gap-2 pl-3 pr-4 py-2 text-sm bg-ink-50 dark:bg-[#1e2033] border border-ink-200 dark:border-[#282c44] rounded-xl text-ink-400 dark:text-[#4d5470] hover:border-brand-300 hover:text-ink-600 dark:hover:text-[#9aa2bd] transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="w-36 text-left">Пошук…</span>
              <kbd className="ml-auto flex items-center px-1.5 py-0.5 text-[10px] font-bold bg-white dark:bg-[#252840] border border-ink-200 dark:border-[#2d3148] rounded text-ink-400">
                ⌘K
              </kbd>
            </button>

            {/* Dark / Light toggle */}
            <ThemeToggle dark={dark} toggle={toggleDark} />

            <NotificationBell />
          </div>
        </div>

        <div className="flex-1 p-5 lg:px-8 lg:pb-10 lg:pt-4">
          {/* Mobile title */}
          {title && <h1 className="lg:hidden text-xl font-extrabold text-ink-900 mb-4">{title}</h1>}
          <div className="animate-in">{children}</div>
        </div>
      </main>
    </div>
  );
}
