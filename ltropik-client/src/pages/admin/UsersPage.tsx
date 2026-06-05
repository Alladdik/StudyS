import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Layout } from '../../components/Layout';
import { getUsers, getUserById, createUser, blockUser, unblockUser, updateUser, deleteUser, impersonateUser } from '../../api/users';
import type { UserItem } from '../../api/users';
import { getCourses, enrollStudent, assignTeacher } from '../../api/courses';
import { getChildrenForParent, linkParent, unlinkParent } from '../../api/parent';
import type { Child } from '../../api/parent';
import { Badge, Loader, EmptyState, toast, cx } from '../../components/ui';
import type { BadgeTone } from '../../components/ui';
import type { Course } from '../../types';
import { useAuthStore } from '../../store/authStore';

// ── Constants ─────────────────────────────────────────────────────────────────
const ROLES = ['All', 'Admin', 'Teacher', 'Student', 'Parent', 'Manager'] as const;
const ROLE_LABELS: Record<string, string> = { Admin: 'Адмін', Teacher: 'Викладач', Student: 'Студент', Parent: 'Батьки', Manager: 'Менеджер' };
const ROLE_TONES: Record<string, BadgeTone> = { Admin: 'rose', Teacher: 'blue', Student: 'green', Parent: 'brand', Manager: 'amber' };
const ROLE_EMOJIS: Record<string, string> = { Admin: '👑', Teacher: '🧑‍🏫', Student: '🎓', Parent: '👨‍👩‍👧', Manager: '🗂️' };
const PAGE_SIZE = 25;

// ── Password helpers ──────────────────────────────────────────────────────────
const CHARS = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#';
function genPassword(len = 12): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(len))).map(b => CHARS[b % CHARS.length]).join('');
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Av({ name, size = 36, role }: { name: string; size?: number; role?: string }) {
  const initials = name.split(' ').map(p => p[0] ?? '').slice(0, 2).join('').toUpperCase();
  const palettes: Record<string, string> = {
    Admin: 'from-rose-500 to-rose-700',
    Teacher: 'from-blue-500 to-blue-700',
    Student: 'from-emerald-500 to-emerald-700',
    Parent: 'from-brand-500 to-brand-700',
  };
  const grad = palettes[role ?? ''] ?? 'from-slate-400 to-slate-600';
  return (
    <div className={`rounded-full bg-gradient-to-br ${grad} flex items-center justify-center text-white font-bold flex-shrink-0`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials || '?'}
    </div>
  );
}

// ── Inline editable field ─────────────────────────────────────────────────────
function InlineField({ label, value, onSave, type = 'text', placeholder }: {
  label: string; value: string; onSave: (v: string) => Promise<void>;
  type?: string; placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = async () => {
    if (draft === value) { setEditing(false); return; }
    setSaving(true);
    try { await onSave(draft); setEditing(false); }
    catch { setDraft(value); }
    finally { setSaving(false); }
  };

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);
  useEffect(() => { setDraft(value); }, [value]);

  return (
    <div>
      <p className="text-[11px] font-bold text-ink-400 uppercase tracking-wider mb-1">{label}</p>
      {editing ? (
        <div className="flex gap-1">
          <input ref={inputRef} type={type} value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false); } }}
            onBlur={commit}
            placeholder={placeholder}
            className="input py-1.5 text-sm flex-1" />
          {saving && <span className="text-ink-400 text-xs self-center">…</span>}
        </div>
      ) : (
        <button onClick={() => setEditing(true)}
          className="w-full text-left px-3 py-1.5 rounded-xl text-sm text-ink-800 dark:text-[#e8eaf0] bg-ink-50 dark:bg-[#1e2033] hover:bg-brand-50 dark:hover:bg-brand-900/20 hover:text-brand-700 dark:hover:text-brand-400 border border-transparent hover:border-brand-100 dark:hover:border-brand-800/40 transition group flex items-center justify-between">
          <span className="truncate">{value || <span className="text-ink-300 italic">{placeholder ?? 'Не вказано'}</span>}</span>
          <span className="opacity-0 group-hover:opacity-100 text-brand-400 text-xs flex-shrink-0 ml-2">✎</span>
        </button>
      )}
    </div>
  );
}

// ── Password reset block ──────────────────────────────────────────────────────
function PasswordBlock({ userId, onSaved }: { userId: string; onSaved: () => void }) {
  const [newPw, setNewPw] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedPw, setSavedPw] = useState<string | null>(null);

  const save = async () => {
    if (!newPw.trim()) return;
    setSaving(true);
    try {
      const { data: user } = await getUserById(userId);
      await updateUser(userId, { email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, password: newPw });
      setSavedPw(newPw);
      setNewPw('');
      toast('success', 'Пароль змінено!');
      onSaved();
    } catch { toast('error', 'Помилка зміни пароля'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <p className="text-[11px] font-bold text-ink-400 uppercase tracking-wider mb-1">Пароль</p>

      {savedPw && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          className="mb-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200">
          <span className="text-emerald-700 text-xs font-mono flex-1">{savedPw}</span>
          <button onClick={() => { navigator.clipboard.writeText(savedPw); toast('success', 'Скопійовано'); }}
            className="text-emerald-600 hover:text-emerald-800 text-xs">📋</button>
          <button onClick={() => setSavedPw(null)} className="text-emerald-400 hover:text-emerald-600 text-xs">✕</button>
        </motion.div>
      )}

      <div className="flex gap-1">
        <div className="relative flex-1">
          <input type={show ? 'text' : 'password'} value={newPw}
            onChange={e => setNewPw(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && save()}
            placeholder="Новий пароль…"
            className="input py-1.5 text-sm w-full pr-8" />
          <button onClick={() => setShow(s => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600 text-xs">
            {show ? '🙈' : '👁'}
          </button>
        </div>
        <button onClick={() => setNewPw(genPassword())}
          title="Згенерувати пароль"
          className="px-2 py-1.5 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-600 text-sm border border-brand-100 transition">
          🎲
        </button>
        <button onClick={save} disabled={!newPw || saving}
          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition disabled:opacity-40">
          {saving ? '…' : 'Зберегти'}
        </button>
      </div>
    </div>
  );
}

// ── User drawer ───────────────────────────────────────────────────────────────
interface DrawerProps {
  user: UserItem;
  courses: Course[];
  students: UserItem[];
  onClose: () => void;
  onRefresh: () => void;
  isManager?: boolean;
}

function UserDrawer({ user, courses, students, onClose, onRefresh, isManager }: DrawerProps) {
  const navigate = useNavigate();
  const [data, setData] = useState(user);
  const [children, setChildren] = useState<Child[]>([]);
  const [linkStudentId, setLinkStudentId] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [enrollCourseId, setEnrollCourseId] = useState('');
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState('');

  useEffect(() => {
    setData(user);
    if (user.role === 'Parent') {
      getChildrenForParent(user.id).then(r => setChildren(r.data)).catch(() => setChildren([]));
    }
  }, [user]);

  const save = useCallback(async (patch: Partial<{ email: string; firstName: string; lastName: string; role: string }>) => {
    const updated = { ...data, ...patch };
    await updateUser(data.id, { email: updated.email, firstName: updated.firstName, lastName: updated.lastName, role: updated.role });
    setData(updated);
    onRefresh();
    toast('success', 'Збережено');
  }, [data, onRefresh]);

  const handleBlock = async () => {
    setActionLoading('block');
    try {
      await (data.isBlocked ? unblockUser(data.id) : blockUser(data.id));
      setData(d => ({ ...d, isBlocked: !d.isBlocked }));
      toast('success', data.isBlocked ? 'Розблоковано' : 'Заблоковано');
      onRefresh();
    } catch { toast('error', 'Помилка'); }
    finally { setActionLoading(''); }
  };

  const handleImpersonate = async () => {
    try {
      // Save admin backup BEFORE the async call so we capture the current (admin) auth state
      const auth = useAuthStore.getState();
      if (!auth.token || !auth.userId || !auth.role) {
        toast('error', 'Помилка авторизації — спробуйте перезайти');
        return;
      }

      const res = await impersonateUser(data.id);

      // Save admin credentials to localStorage backup
      localStorage.setItem('ltropik-admin-backup', JSON.stringify({
        token: auth.token,
        userId: auth.userId,
        role: auth.role,
        impersonatedUserName: `${data.firstName} ${data.lastName}`,
        impersonatedUserEmail: data.email,
      }));

      // Switch to impersonated user — update store first
      useAuthStore.getState().login(res.data.accessToken, res.data.userId, res.data.role as never);

      toast('success', `Увійшли як ${data.firstName}`);
      onClose();

      // setTimeout(0): let React flush the Zustand role update before ProtectedRoute
      // renders the new route — otherwise React 19 batching causes stale role read → /unauthorized
      const routes: Record<string, string> = { Student: '/student/diary', Teacher: '/teacher/dashboard', Admin: '/admin', Parent: '/parent/dashboard', Manager: '/manager' };
      const target = routes[res.data.role] ?? '/';
      setTimeout(() => navigate(target), 0);
    } catch {
      toast('error', 'Не вдалося увійти під цим акаунтом');
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Видалити акаунт ${data.firstName} ${data.lastName}? Цю дію неможливо скасувати.`)) return;
    try {
      await deleteUser(data.id);
      toast('success', 'Акаунт видалено');
      onClose(); onRefresh();
    } catch { toast('error', 'Помилка видалення'); }
  };

  const handleEnroll = async () => {
    if (!enrollCourseId) return;
    setEnrollLoading(true);
    try {
      if (data.role === 'Student') await enrollStudent(enrollCourseId, data.id);
      else await assignTeacher(enrollCourseId, data.id);
      toast('success', `Зараховано на курс`);
      setEnrollCourseId('');
    } catch { toast('error', 'Помилка зарахування'); }
    finally { setEnrollLoading(false); }
  };

  const handleLink = async () => {
    if (!linkStudentId) return;
    setLinkLoading(true);
    try {
      await linkParent(data.id, linkStudentId);
      toast('success', 'Учня прив\'язано');
      setLinkStudentId('');
      const r = await getChildrenForParent(data.id);
      setChildren(r.data);
    } catch { toast('error', 'Помилка прив\'язки'); }
    finally { setLinkLoading(false); }
  };

  const handleUnlink = async (studentId: string) => {
    try {
      await unlinkParent(data.id, studentId);
      setChildren(c => c.filter(ch => ch.id !== studentId));
      toast('success', 'Зв\'язок видалено');
    } catch { toast('error', 'Помилка'); }
  };

  const copyEmail = () => { navigator.clipboard.writeText(data.email); toast('success', 'Email скопійовано'); };

  return (
    <>
      {/* Backdrop */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" />

      {/* Drawer */}
      <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 340, damping: 34 }}
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md flex flex-col bg-white dark:bg-[#1a1c2e] shadow-2xl dark:shadow-black/50 overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-ink-100 dark:border-[#282c44] bg-white dark:bg-[#1a1c2e] flex-shrink-0">
          <Av name={`${data.firstName} ${data.lastName}`} role={data.role} size={44} />
          <div className="flex-1 min-w-0">
            <p className="font-extrabold text-ink-900 truncate">{data.firstName} {data.lastName}</p>
            <p className="text-xs text-ink-400 truncate">{data.email}</p>
          </div>
          <Badge tone={ROLE_TONES[data.role] ?? 'gray'}>{ROLE_EMOJIS[data.role]} {ROLE_LABELS[data.role] ?? data.role}</Badge>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-ink-100 dark:bg-[#252840] hover:bg-ink-200 dark:hover:bg-[#2d3148] flex items-center justify-center text-ink-500 transition ml-1">✕</button>
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-5 py-3 border-b border-ink-50 dark:border-[#282c44] bg-ink-50/50 dark:bg-[#151722]/50 flex-shrink-0 flex-wrap">
          {!isManager && (
            <button onClick={handleImpersonate}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition">
              🔑 Увійти як цей користувач
            </button>
          )}
          <button onClick={copyEmail}
            className="py-2 px-3 rounded-xl bg-white dark:bg-[#1e2033] border border-ink-200 dark:border-[#2d3148] hover:bg-ink-50 dark:hover:bg-[#252840] text-ink-600 dark:text-[#9aa2bd] text-xs font-semibold transition">
            📋 Email
          </button>
          {!isManager && (
            <button onClick={handleBlock} disabled={actionLoading === 'block'}
              className={cx('py-2 px-3 rounded-xl text-xs font-semibold transition',
                data.isBlocked ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/50 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30'
                  : 'bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-700/50 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/30')}>
              {data.isBlocked ? '✅ Розблокувати' : '🔒 Заблокувати'}
            </button>
          )}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Profile fields */}
          <div className="bg-white dark:bg-[#1e2033] rounded-2xl border border-ink-100 dark:border-[#282c44] p-4 space-y-3">
            <p className="text-xs font-bold text-ink-400 uppercase tracking-wider">Персональні дані</p>
            <div className="grid grid-cols-2 gap-3">
              <InlineField label="Ім'я" value={data.firstName}
                onSave={v => save({ firstName: v })} placeholder="Ім'я" />
              <InlineField label="Прізвище" value={data.lastName}
                onSave={v => save({ lastName: v })} placeholder="Прізвище" />
            </div>
            <InlineField label="Email" value={data.email} type="email"
              onSave={v => save({ email: v })} placeholder="email@example.com" />
          </div>

          {/* Role */}
          <div className="bg-white dark:bg-[#1e2033] rounded-2xl border border-ink-100 dark:border-[#282c44] p-4">
            <p className="text-[11px] font-bold text-ink-400 uppercase tracking-wider mb-2">Роль</p>
            {isManager ? (
              <Badge tone={ROLE_TONES[data.role] ?? 'gray'}>{ROLE_EMOJIS[data.role]} {ROLE_LABELS[data.role] ?? data.role}</Badge>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {['Admin', 'Manager', 'Teacher', 'Student', 'Parent'].map(r => (
                  <button key={r} onClick={() => save({ role: r })}
                    className={cx('flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold border transition',
                      data.role === r
                        ? 'border-brand-300 dark:border-brand-600 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                        : 'border-ink-200 dark:border-[#2d3148] bg-white dark:bg-[#1e2033] text-ink-500 dark:text-[#9aa2bd] hover:border-brand-200 dark:hover:border-brand-700 hover:bg-brand-50/50 dark:hover:bg-brand-900/20')}>
                    {ROLE_EMOJIS[r]} {ROLE_LABELS[r]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Password */}
          <div className="bg-white dark:bg-[#1e2033] rounded-2xl border border-ink-100 dark:border-[#282c44] p-4">
            <PasswordBlock userId={data.id} onSaved={onRefresh} />
          </div>

          {/* Course enrollment */}
          {(data.role === 'Student' || data.role === 'Teacher') && (
            <div className="bg-white dark:bg-[#1e2033] rounded-2xl border border-ink-100 dark:border-[#282c44] p-4">
              <p className="text-[11px] font-bold text-ink-400 uppercase tracking-wider mb-2">
                {data.role === 'Student' ? 'Записати на курс' : 'Призначити на курс'}
              </p>
              <div className="flex gap-2">
                <select value={enrollCourseId} onChange={e => setEnrollCourseId(e.target.value)} className="input flex-1 text-sm py-1.5">
                  <option value="">— Обери курс —</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
                <button onClick={handleEnroll} disabled={!enrollCourseId || enrollLoading}
                  className="px-4 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold transition disabled:opacity-40">
                  {enrollLoading ? '…' : '+ Зарахувати'}
                </button>
              </div>
            </div>
          )}

          {/* Parent linking */}
          {data.role === 'Parent' && (
            <div className="bg-white dark:bg-[#1e2033] rounded-2xl border border-ink-100 dark:border-[#282c44] p-4">
              <p className="text-[11px] font-bold text-ink-400 uppercase tracking-wider mb-2">Діти</p>
              {children.length === 0
                ? <p className="text-ink-400 text-xs italic">Не прив'язано жодного учня</p>
                : <div className="space-y-1.5 mb-3">
                    {children.map(ch => (
                      <div key={ch.id} className="flex items-center justify-between bg-ink-50 dark:bg-[#252840] rounded-xl px-3 py-1.5">
                        <span className="text-sm font-medium text-ink-700 dark:text-[#e8eaf0]">{ch.firstName} {ch.lastName}</span>
                        <button onClick={() => handleUnlink(ch.id)}
                          className="text-xs text-rose-500 hover:text-rose-700 transition">Відв'язати</button>
                      </div>
                    ))}
                  </div>
              }
              <div className="flex gap-2">
                <select value={linkStudentId} onChange={e => setLinkStudentId(e.target.value)} className="input flex-1 text-sm py-1.5">
                  <option value="">— Учень —</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}
                </select>
                <button onClick={handleLink} disabled={!linkStudentId || linkLoading}
                  className="px-4 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold transition disabled:opacity-40">
                  {linkLoading ? '…' : 'Прив\'язати'}
                </button>
              </div>
            </div>
          )}

          {/* Meta */}
          <div className="bg-ink-50 dark:bg-[#151722] rounded-2xl p-4 text-xs text-ink-400 dark:text-[#6b7394] space-y-1">
            <div className="flex justify-between">
              <span>ID</span>
              <button onClick={() => { navigator.clipboard.writeText(data.id); toast('success', 'ID скопійовано'); }}
                className="font-mono text-ink-600 hover:text-brand-600 transition">{data.id.slice(0, 8)}…</button>
            </div>
            <div className="flex justify-between">
              <span>Реєстрація</span>
              <span>{new Date(data.createdAt).toLocaleDateString('uk-UA')}</span>
            </div>
            <div className="flex justify-between">
              <span>Статус</span>
              <span className={data.isBlocked ? 'text-rose-500' : 'text-emerald-600'}>
                {data.isBlocked ? '🔒 Заблоковано' : '✅ Активний'}
              </span>
            </div>
          </div>
        </div>

        {/* Footer: danger zone — Admin only */}
        {!isManager && (
          <div className="px-5 py-3 border-t border-ink-100 dark:border-[#282c44] flex-shrink-0">
            <button onClick={handleDelete}
              className="w-full py-2.5 rounded-2xl text-sm font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/30 border border-rose-200 dark:border-rose-700/50 transition">
              🗑 Видалити акаунт назавжди
            </button>
          </div>
        )}
      </motion.div>
    </>
  );
}

// ── Create user modal ─────────────────────────────────────────────────────────
function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: genPassword(), role: 'Student' });
  const [showPw, setShowPw] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<typeof form | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await createUser(form);
      setCreated(form);
      onCreated();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Помилка — можливо цей email вже зайнятий');
    } finally { setLoading(false); }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white dark:bg-[#1a1c2e] dark:border dark:border-[#282c44] rounded-3xl shadow-2xl dark:shadow-black/50 w-full max-w-md pointer-events-auto overflow-hidden">

          <div className="px-6 py-5 border-b border-ink-100 dark:border-[#282c44] flex items-center justify-between">
            <h2 className="font-extrabold text-ink-900 dark:text-white text-lg">+ Новий акаунт</h2>
            <button onClick={onClose} className="w-8 h-8 rounded-xl bg-ink-100 hover:bg-ink-200 flex items-center justify-center text-ink-500 transition">✕</button>
          </div>

          {created ? (
            <div className="p-6">
              <div className="text-center mb-5">
                <div className="text-4xl mb-2">✅</div>
                <p className="font-bold text-ink-900">Акаунт створено!</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-2 mb-5">
                <p className="text-xs font-bold text-emerald-700 uppercase">Дані для входу</p>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-ink-500">Email</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-sm text-ink-800">{created.email}</span>
                    <button onClick={() => { navigator.clipboard.writeText(created.email); toast('success', 'Скопійовано'); }}
                      className="text-emerald-600 hover:text-emerald-800 text-xs">📋</button>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-ink-500">Пароль</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-sm text-ink-800 dark:text-[#e8eaf0] bg-white dark:bg-[#1e2033] px-2 py-0.5 rounded-lg border border-ink-200 dark:border-[#2d3148]">{created.password}</span>
                    <button onClick={() => { navigator.clipboard.writeText(created.password); toast('success', 'Скопійовано'); }}
                      className="text-emerald-600 hover:text-emerald-800 text-xs">📋</button>
                  </div>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`Email: ${created.email}\nПароль: ${created.password}`);
                    toast('success', 'Дані скопійовано');
                  }}
                  className="w-full mt-2 py-2 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-xs font-bold transition">
                  📋 Скопіювати все
                </button>
              </div>
              <button onClick={onClose} className="btn btn-primary w-full">Готово</button>
            </div>
          ) : (
            <form onSubmit={submit} className="p-6 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Ім'я</label>
                  <input required value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} className="input" placeholder="Іван" />
                </div>
                <div>
                  <label className="label">Прізвище</label>
                  <input required value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} className="input" placeholder="Іваненко" />
                </div>
              </div>
              <div>
                <label className="label">Email</label>
                <input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="input" placeholder="ivan@school.com" />
              </div>
              <div>
                <label className="label">Пароль</label>
                <div className="flex gap-1">
                  <div className="relative flex-1">
                    <input type={showPw ? 'text' : 'password'} required value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="input pr-8" />
                    <button type="button" onClick={() => setShowPw(s => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 text-xs hover:text-ink-600">{showPw ? '🙈' : '👁'}</button>
                  </div>
                  <button type="button" onClick={() => setForm(f => ({ ...f, password: genPassword() }))}
                    title="Згенерувати" className="px-2.5 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-600 border border-brand-100 transition text-sm">🎲</button>
                </div>
              </div>
              <div>
                <label className="label">Роль</label>
                <div className="flex gap-2 flex-wrap">
                  {['Student', 'Teacher', 'Parent', 'Admin'].map(r => (
                    <button type="button" key={r} onClick={() => setForm(f => ({ ...f, role: r }))}
                      className={cx('flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm border transition',
                        form.role === r ? 'border-brand-300 bg-brand-50 text-brand-700 font-bold'
                          : 'border-ink-200 text-ink-500 hover:border-brand-200')}>
                      {ROLE_EMOJIS[r]} {ROLE_LABELS[r]}
                    </button>
                  ))}
                </div>
              </div>
              {error && <p className="text-rose-600 text-sm bg-rose-50 rounded-xl px-3 py-2">{error}</p>}
              <button type="submit" disabled={loading} className="btn btn-primary w-full py-3 mt-2">
                {loading ? '⏳ Створення…' : '✅ Створити акаунт'}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function UsersPage() {
  const { role: currentRole } = useAuthStore();
  const isManager = currentRole === 'Manager';
  const [data, setData] = useState<{ items: UserItem[]; total: number } | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<UserItem[]>([]);

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    getUsers({ page, search: search || undefined, role: roleFilter === 'All' ? undefined : roleFilter, pageSize: PAGE_SIZE })
      .then(r => setData(r.data))
      .catch(() => toast('error', 'Помилка завантаження'))
      .finally(() => setLoading(false));
  }, [page, search, roleFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, roleFilter]);
  useEffect(() => { getCourses().then(r => setCourses(r.data)).catch(() => {}); }, []);
  useEffect(() => { getUsers({ role: 'Student', pageSize: 200 }).then(r => setStudents(r.data.items)).catch(() => {}); }, []);

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  const openUser = (u: UserItem) => setSelectedUser(u);

  return (
    <Layout title="Користувачі" subtitle={`Управління акаунтами · ${data?.total ?? 0} всього`}>

      {/* Top bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input placeholder="Пошук за ім'ям або email…" value={search}
            onChange={e => setSearch(e.target.value)} className="input pl-10" />
        </div>
        <button onClick={() => setShowCreate(true)}
          className="btn btn-primary flex-shrink-0 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          Новий акаунт
        </button>
      </div>

      {/* Role filter */}
      <div className="flex gap-1.5 mb-5 flex-wrap">
        {ROLES.map(r => (
          <button key={r} onClick={() => setRoleFilter(r)}
            className={cx('chip transition-all', roleFilter === r
              ? 'bg-brand-600 text-white shadow-[var(--shadow-glow)]'
              : 'bg-white dark:bg-[#1e2033] text-ink-500 dark:text-[#9aa2bd] ring-1 ring-ink-200 dark:ring-[#2d3148] hover:ring-brand-200')}>
            {r === 'All' ? `Всі (${data?.total ?? '…'})` : `${ROLE_EMOJIS[r]} ${ROLE_LABELS[r]}`}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? <Loader /> : data?.items.length === 0 ? (
        <EmptyState icon="👤" title="Нікого не знайдено" hint="Спробуйте змінити фільтр або пошуковий запит"
          action={<button onClick={() => setShowCreate(true)} className="btn btn-primary">+ Новий акаунт</button>} />
      ) : (
        <div className="bg-white dark:bg-[#1a1c2e] rounded-2xl border border-ink-100 dark:border-[#282c44] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 dark:border-[#282c44] bg-ink-50/60 dark:bg-[#151722]/60">
                  {["Користувач", 'Email', 'Роль', 'Статус', 'Реєстрація', ''].map((h, i) => (
                    <th key={i} className="text-left px-5 py-3 text-[11px] font-bold text-ink-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data?.items.map((user) => (
                  <motion.tr key={user.id} layout
                    className="border-b border-ink-50 dark:border-[#1e2033] last:border-0 hover:bg-brand-50/30 dark:hover:bg-brand-900/10 transition-colors cursor-pointer group"
                    onClick={() => openUser(user)}>

                    {/* Name + avatar */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Av name={`${user.firstName} ${user.lastName}`} role={user.role} size={36} />
                        <div>
                          <p className="font-semibold text-ink-800 dark:text-[#e8eaf0] group-hover:text-brand-700 dark:group-hover:text-brand-400 transition leading-tight">
                            {user.firstName} {user.lastName}
                          </p>
                          {user.isBlocked && <span className="text-[10px] text-rose-500 font-medium">🔒 Заблоковано</span>}
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-ink-600 dark:text-[#9aa2bd] max-w-[200px] truncate">{user.email}</span>
                        <button onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(user.email); toast('success', 'Скопійовано'); }}
                          className="opacity-0 group-hover:opacity-100 text-ink-300 hover:text-brand-500 transition text-xs">📋</button>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-5 py-3">
                      <Badge tone={ROLE_TONES[user.role] ?? 'gray'}>
                        {ROLE_EMOJIS[user.role]} {ROLE_LABELS[user.role] ?? user.role}
                      </Badge>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3">
                      <span className={cx('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
                        user.isBlocked ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400')}>
                        <span className={cx('w-1.5 h-1.5 rounded-full', user.isBlocked ? 'bg-rose-400' : 'bg-emerald-400')} />
                        {user.isBlocked ? 'Заблок.' : 'Активний'}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="px-5 py-3 text-ink-400 text-xs whitespace-nowrap">
                      {new Date(user.createdAt).toLocaleDateString('uk-UA')}
                    </td>

                    {/* Quick actions */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button onClick={e => { e.stopPropagation(); openUser(user); }}
                          className="px-2.5 py-1 rounded-lg bg-brand-50 dark:bg-brand-900/20 hover:bg-brand-100 dark:hover:bg-brand-800/30 text-brand-600 dark:text-brand-400 text-xs font-bold transition">
                          ✎ Редагувати
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-ink-100 dark:border-[#282c44] bg-ink-50/50 dark:bg-[#151722]/50">
              <span className="text-xs text-ink-400">{data?.total} користувачів</span>
              <div className="flex items-center gap-1">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="w-8 h-8 rounded-xl border border-ink-200 dark:border-[#2d3148] flex items-center justify-center text-ink-500 dark:text-[#9aa2bd] hover:bg-ink-100 dark:hover:bg-[#252840] disabled:opacity-30 transition text-sm">←</button>
                <span className="text-xs text-ink-500 dark:text-[#9aa2bd] px-2">{page} / {totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                  className="w-8 h-8 rounded-xl border border-ink-200 dark:border-[#2d3148] flex items-center justify-center text-ink-500 dark:text-[#9aa2bd] hover:bg-ink-100 dark:hover:bg-[#252840] disabled:opacity-30 transition text-sm">→</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Drawer */}
      <AnimatePresence>
        {selectedUser && (
          <UserDrawer
            user={selectedUser}
            courses={courses}
            students={students}
            onClose={() => setSelectedUser(null)}
            onRefresh={() => load(true)}
            isManager={isManager}
          />
        )}
      </AnimatePresence>

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <CreateModal
            onClose={() => setShowCreate(false)}
            onCreated={() => { load(true); }}
          />
        )}
      </AnimatePresence>
    </Layout>
  );
}
