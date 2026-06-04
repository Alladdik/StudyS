import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ReactNode, ButtonHTMLAttributes } from 'react';

/* ---------- helpers ---------- */
export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

const AVATAR_COLORS = [
  'bg-brand-100 text-brand-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-sky-100 text-sky-700',
  'bg-rose-100 text-rose-700',
  'bg-fuchsia-100 text-fuchsia-700',
];
function colorFromString(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

/* ---------- Card ---------- */
export function Card({ children, className, hover, ...rest }:
  { children: ReactNode; className?: string; hover?: boolean } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('card', hover && 'card-hover', className)} {...rest}>
      {children}
    </div>
  );
}

/* ---------- Button ---------- */
type BtnVariant = 'primary' | 'soft' | 'ghost' | 'danger';
export function Button({
  children, variant = 'primary', loading, className, ...rest
}: { children: ReactNode; variant?: BtnVariant; loading?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const variantCls =
    variant === 'primary' ? 'btn-primary' :
    variant === 'soft' ? 'btn-soft' :
    variant === 'danger' ? 'btn text-white bg-rose-500 hover:bg-rose-600 shadow-[0_8px_24px_rgba(244,63,94,.25)]' :
    'btn-ghost';
  return (
    <button className={cx('btn', variant !== 'danger' && variantCls, variant === 'danger' && variantCls, className)}
      disabled={loading || rest.disabled} {...rest}>
      {loading && <Spinner className="w-4 h-4" />}
      {children}
    </button>
  );
}

/* ---------- Badge ---------- */
export type BadgeTone = 'brand' | 'green' | 'amber' | 'rose' | 'blue' | 'gray';
const BADGE_TONES: Record<BadgeTone, string> = {
  brand: 'bg-brand-50 text-brand-700 ring-brand-100',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  amber: 'bg-amber-50 text-amber-700 ring-amber-100',
  rose: 'bg-rose-50 text-rose-700 ring-rose-100',
  blue: 'bg-sky-50 text-sky-700 ring-sky-100',
  gray: 'bg-ink-100 text-ink-600 ring-ink-200',
};
export function Badge({ children, tone = 'gray', className }:
  { children: ReactNode; tone?: BadgeTone; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ring-inset', BADGE_TONES[tone], className)}>
      {children}
    </span>
  );
}

/* ---------- Avatar ---------- */
export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
  const sz = size === 'lg' ? 'w-12 h-12 text-base' : size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';
  return (
    <div className={cx('rounded-full flex items-center justify-center font-bold flex-shrink-0', sz, colorFromString(name))}>
      {initials || '?'}
    </div>
  );
}

/* ---------- PageHeader ---------- */
export function PageHeader({ title, subtitle, actions }:
  { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-extrabold text-ink-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-ink-500 text-sm mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}

/* ---------- EmptyState ---------- */
export function EmptyState({ icon = '📭', title, hint, action }:
  { icon?: string; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20">
      <div className="w-20 h-20 rounded-3xl bg-ink-100 flex items-center justify-center text-4xl mb-4">{icon}</div>
      <p className="text-ink-700 font-semibold text-lg">{title}</p>
      {hint && <p className="text-ink-400 text-sm mt-1 max-w-xs">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ---------- Spinner ---------- */
export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cx('animate-spin', className)} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export function Loader({ label = 'Завантаження…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-ink-400">
      <Spinner className="w-7 h-7 text-brand-500" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

/* ---------- StatCard ---------- */
export function StatCard({ icon, value, label, tone = 'brand', delay = 0 }:
  { icon: ReactNode; value: ReactNode; label: string; tone?: BadgeTone; delay?: number }) {
  const iconBg: Record<BadgeTone, string> = {
    brand: 'bg-brand-100 text-brand-600',
    green: 'bg-emerald-100 text-emerald-600',
    amber: 'bg-amber-100 text-amber-600',
    rose: 'bg-rose-100 text-rose-600',
    blue: 'bg-sky-100 text-sky-600',
    gray: 'bg-ink-100 text-ink-600',
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      className="card p-5">
      <div className={cx('w-11 h-11 rounded-2xl flex items-center justify-center text-xl mb-3', iconBg[tone])}>{icon}</div>
      <div className="text-2xl font-extrabold text-ink-900">{value}</div>
      <div className="text-xs text-ink-400 mt-0.5 font-medium">{label}</div>
    </motion.div>
  );
}

/* ---------- Tabs (segmented) ---------- */
let tabsInstanceCounter = 0;
export function Tabs<T extends string>({ tabs, value, onChange }:
  { tabs: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  // FIX: Unique layoutId per Tabs instance — prevents framer-motion animation cross-contamination
  const [layoutId] = React.useState(() => `tab-pill-${++tabsInstanceCounter}`);
  return (
    <div className="inline-flex p-1 bg-ink-100 rounded-2xl gap-1">
      {tabs.map((t) => (
        <button key={t.value} onClick={() => onChange(t.value)}
          className={cx('relative px-4 py-2 rounded-xl text-sm font-semibold transition-colors',
            value === t.value ? 'text-brand-700' : 'text-ink-500 hover:text-ink-700')}>
          {value === t.value && (
            <motion.span layoutId={layoutId} className="absolute inset-0 bg-white rounded-xl shadow-sm" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />
          )}
          <span className="relative z-10">{t.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------- Modal ---------- */
export function Modal({ open, onClose, children, className }:
  { open: boolean; onClose: () => void; children: ReactNode; className?: string }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/40 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.94, opacity: 0, y: 12 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.94, opacity: 0, y: 12 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className={cx('bg-white rounded-3xl shadow-2xl w-full', className ?? 'max-w-md')}>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------- Toast ---------- */
type ToastType = 'success' | 'error' | 'info';
interface ToastMsg { id: number; type: ToastType; text: string; }

let _toastCounter = 0;
let _showToast: ((t: ToastType, text: string) => void) | null = null;

export function toast(type: ToastType, text: string) {
  _showToast?.(type, text);
}

const TOAST_ICONS: Record<ToastType, string> = { success: '✅', error: '❌', info: 'ℹ️' };
const TOAST_COLORS: Record<ToastType, string> = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  error: 'bg-rose-50 border-rose-200 text-rose-800',
  info: 'bg-brand-50 border-brand-200 text-brand-800',
};

export function Toaster() {
  const [toasts, setToasts] = React.useState<ToastMsg[]>([]);

  React.useEffect(() => {
    _showToast = (type, text) => {
      const id = ++_toastCounter;
      setToasts((prev) => [...prev, { id, type, text }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
    };
    return () => { _showToast = null; };
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-[999] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div key={t.id}
            initial={{ opacity: 0, x: 60, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className={cx('flex items-center gap-2.5 px-4 py-3 rounded-2xl border shadow-lg text-sm font-semibold max-w-xs pointer-events-auto', TOAST_COLORS[t.type])}>
            <span>{TOAST_ICONS[t.type]}</span>
            <span>{t.text}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
