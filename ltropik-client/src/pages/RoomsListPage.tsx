import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Layout } from '../components/Layout';
import { getRooms, createRoom, endRoom, deleteRoom } from '../api/rooms';
import type { RoomInfo } from '../api/rooms';
import { getCourses } from '../api/courses';
import type { Course } from '../types';
import { Modal, Loader, toast } from '../components/ui';
import { useAuthStore } from '../store/authStore';

type ConfirmAction = { type: 'end' | 'delete'; room: RoomInfo } | null;

function LiveBadge() {
  return (
    <span className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full"
      style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}>
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      Живий ефір
    </span>
  );
}

function EmptyBadge() {
  return (
    <span className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full"
      style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />
      Очікування
    </span>
  );
}

export function RoomsListPage() {
  const navigate = useNavigate();
  const { role, userId } = useAuthStore();
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', courseId: '' });
  const [confirm, setConfirm] = useState<ConfirmAction>(null);
  const [busy, setBusy] = useState(false);

  const canCreate = role === 'Teacher' || role === 'Admin';

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    getRooms().then(r => setRooms(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    getCourses().then(r => setCourses(r.data)).catch(() => {});
    const interval = setInterval(() => load(true), 10_000);
    return () => clearInterval(interval);
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setCreating(true);
    try {
      const { data } = await createRoom({ title: form.title, courseId: form.courseId || undefined });
      toast('success', `Кімната «${form.title}» створена!`);
      setShowCreate(false);
      setForm({ title: '', courseId: '' });
      navigate(`/room/${data.id}`);
    } catch { toast('error', 'Не вдалося створити кімнату'); }
    finally { setCreating(false); }
  };

  const runConfirm = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.type === 'end') { await endRoom(confirm.room.id); toast('success', 'Кімнату завершено'); }
      else { await deleteRoom(confirm.room.id); toast('success', 'Кімнату видалено'); }
      setRooms(prev => prev.filter(r => r.id !== confirm.room.id));
      setConfirm(null);
    } catch { toast('error', 'Сталася помилка'); }
    finally { setBusy(false); }
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });

  return (
    <Layout title="Кімнати" subtitle="Відеоуроки з дошкою, чатом і показом екрана">

      {/* Header row */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 text-sm text-ink-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          {rooms.length} активних
        </div>
        {canCreate && (
          <motion.button
            whileTap={{ scale: 0.96 }} whileHover={{ scale: 1.02 }}
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2.5 px-5 py-2.5 rounded-2xl text-sm font-bold text-white transition"
            style={{ background: 'linear-gradient(135deg,#6535f6,#8d5cf6)', boxShadow: '0 4px 20px rgba(101,53,246,0.35)' }}>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
            </svg>
            Нова кімната
          </motion.button>
        )}
      </div>

      {loading ? (
        <Loader />
      ) : rooms.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center py-24 gap-5">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-5xl" style={{ background: 'rgba(101,53,246,0.1)' }}>🎥</div>
          <div className="text-center">
            <p className="text-lg font-bold text-ink-800 mb-1">Немає активних кімнат</p>
            <p className="text-sm text-ink-400 max-w-xs">
              {canCreate ? 'Натисни «Нова кімната» щоб розпочати відеоурок' : 'Кімнати з\'являться тут автоматично, коли викладач їх відкриє'}
            </p>
          </div>
          {canCreate && (
            <button onClick={() => setShowCreate(true)} className="btn btn-primary">🎥 Розпочати урок</button>
          )}
        </motion.div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <AnimatePresence>
            {rooms.map((room, i) => {
              const isMyRoom = room.hostId === userId;
              const isLive = room.participantCount > 0;

              return (
                <motion.div key={room.id}
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94 }} transition={{ delay: i * 0.04, type: 'spring', stiffness: 400, damping: 32 }}
                  whileHover={{ y: -2 }} className="cursor-pointer group"
                  onClick={() => navigate(`/room/${room.id}`)}>

                  <div className="relative rounded-2xl overflow-hidden border transition-all duration-200"
                    style={{
                      background: isLive ? 'linear-gradient(145deg,rgba(26,28,40,1),rgba(30,20,50,1))' : 'rgba(255,255,255,0.97)',
                      borderColor: isLive ? 'rgba(101,53,246,0.25)' : 'rgba(0,0,0,0.07)',
                      boxShadow: isLive ? '0 0 0 1px rgba(101,53,246,0.15), 0 4px 24px rgba(0,0,0,0.15)' : '0 2px 12px rgba(0,0,0,0.06)',
                    }}>

                    {/* Live glow border animation */}
                    {isLive && (
                      <motion.div animate={{ opacity: [0.4, 0.7, 0.4] }} transition={{ repeat: Infinity, duration: 2.5 }}
                        className="absolute inset-0 rounded-2xl pointer-events-none"
                        style={{ boxShadow: 'inset 0 0 0 1.5px rgba(101,53,246,0.4)' }} />
                    )}

                    <div className="p-5">
                      {/* Top row: icon + badges */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105"
                          style={{ background: isLive ? 'linear-gradient(135deg,#6535f6,#8d5cf6)' : 'linear-gradient(135deg,#ede9fe,#ddd6fe)' }}>
                          <svg className={`w-6 h-6 ${isLive ? 'text-white' : 'text-brand-600'}`} fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                          </svg>
                        </div>
                        <div className="flex flex-wrap gap-1.5 justify-end">
                          {isLive ? <LiveBadge /> : <EmptyBadge />}
                          {isMyRoom && (
                            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                              style={{ background: 'rgba(101,53,246,0.12)', color: '#8b5cf6' }}>Моя</span>
                          )}
                        </div>
                      </div>

                      {/* Room title */}
                      <h3 className={`font-extrabold text-[15px] leading-tight mb-1.5 transition-colors ${isLive ? 'text-white' : 'text-ink-900 group-hover:text-brand-700'}`}>
                        {room.title}
                      </h3>
                      <p className={`text-xs mb-0.5 ${isLive ? 'text-white/50' : 'text-ink-500'}`}>
                        👤 {room.hostName}
                      </p>
                      {room.courseName && (
                        <p className={`text-xs ${isLive ? 'text-purple-400' : 'text-ink-400'}`}>
                          📚 {room.courseName}
                        </p>
                      )}

                      {/* Bottom: time + participants + actions */}
                      <div className="flex items-center justify-between mt-4 pt-3"
                        style={{ borderTop: `1px solid ${isLive ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}` }}>

                        <div className="flex items-center gap-3">
                          <span className={`text-xs ${isLive ? 'text-white/40' : 'text-ink-400'}`}>
                            🕐 {formatTime(room.createdAt)}
                          </span>
                          {isLive && (
                            <span className="text-xs font-semibold text-emerald-400">
                              👥 {room.participantCount} онлайн
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          {/* Copy link */}
                          <button
                            onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/room/${room.id}`); toast('success', 'Посилання скопійовано'); }}
                            className={`w-8 h-8 rounded-xl flex items-center justify-center transition ${isLive ? 'text-white/30 hover:text-white/70 hover:bg-white/10' : 'text-ink-300 hover:text-brand-500 hover:bg-brand-50'}`}
                            title="Скопіювати посилання">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                            </svg>
                          </button>

                          {(isMyRoom || role === 'Admin') && (
                            <>
                              <button
                                onClick={() => setConfirm({ type: 'end', room })}
                                className={`w-8 h-8 rounded-xl flex items-center justify-center transition ${isLive ? 'text-white/30 hover:text-amber-400 hover:bg-amber-900/20' : 'text-ink-300 hover:text-amber-500 hover:bg-amber-50'}`}
                                title="Завершити">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z M9 9h6v6H9z"/>
                                </svg>
                              </button>
                              <button
                                onClick={() => setConfirm({ type: 'delete', room })}
                                className={`w-8 h-8 rounded-xl flex items-center justify-center transition ${isLive ? 'text-white/30 hover:text-rose-400 hover:bg-rose-900/20' : 'text-ink-300 hover:text-rose-500 hover:bg-rose-50'}`}
                                title="Видалити">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                </svg>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Join button at bottom */}
                    <div className="px-5 pb-4">
                      <div className={`w-full py-2.5 rounded-xl text-xs font-bold text-center transition-all ${isLive ? 'text-white' : 'text-brand-600 group-hover:text-brand-700'}`}
                        style={{ background: isLive ? 'rgba(101,53,246,0.3)' : 'rgba(101,53,246,0.08)' }}>
                        {isLive ? '🔴 Приєднатись до дзвінка' : '🎥 Увійти в кімнату'}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Create modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} className="max-w-sm">
        <form onSubmit={handleCreate} className="p-7">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#6535f6,#8d5cf6)' }}>🎥</div>
            <div>
              <h3 className="font-extrabold text-ink-900 text-lg leading-tight">Нова кімната</h3>
              <p className="text-ink-400 text-xs">Відеоурок з дошкою та чатом</p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="label">Назва кімнати</label>
              <input required autoFocus value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="Урок з алгебри, Консультація…" className="input" />
            </div>
            <div>
              <label className="label">Курс (необов'язково)</label>
              <select value={form.courseId} onChange={e => setForm({ ...form, courseId: e.target.value })} className="input">
                <option value="">— Без курсу —</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
              {form.courseId && (
                <p className="text-xs text-emerald-600 mt-1.5 flex items-center gap-1.5">🔔 Студенти курсу отримають сповіщення</p>
              )}
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button type="button" onClick={() => setShowCreate(false)} className="btn btn-soft flex-1">Скасувати</button>
            <button type="submit" disabled={creating || !form.title.trim()} className="btn btn-primary flex-1">
              {creating ? '⏳ Створення…' : '🎥 Розпочати'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm end/delete */}
      <Modal open={!!confirm} onClose={() => !busy && setConfirm(null)} className="max-w-sm">
        {confirm && (
          <div className="p-7">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 ${confirm.type === 'delete' ? 'bg-rose-50' : 'bg-amber-50'}`}>
              {confirm.type === 'delete' ? '🗑️' : '⏹️'}
            </div>
            <h3 className="font-extrabold text-ink-900 text-xl text-center mb-2">
              {confirm.type === 'delete' ? 'Видалити кімнату?' : 'Завершити кімнату?'}
            </h3>
            <p className="text-ink-500 text-sm text-center mb-6">
              {confirm.type === 'delete'
                ? `«${confirm.room.title}» буде видалено назавжди.`
                : `«${confirm.room.title}» стане неактивною, усіх буде від'єднано.`}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirm(null)} disabled={busy} className="btn btn-soft flex-1">Скасувати</button>
              <button onClick={runConfirm} disabled={busy}
                className={`btn flex-1 text-white ${confirm.type === 'delete' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-amber-500 hover:bg-amber-600'}`}>
                {busy ? '…' : confirm.type === 'delete' ? 'Видалити' : 'Завершити'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  );
}
