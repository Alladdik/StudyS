import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { CalendarView } from '../components/CalendarView';
import { getSchedule, createSchedule, updateSchedule, deleteSchedule } from '../api/schedule';
import { getCourses, getCourseMembers } from '../api/courses';
import api from '../api/client';
import type { ScheduleEntry, Course } from '../types';
import { useAuthStore } from '../store/authStore';
import { Card, Loader, Modal, toast } from '../components/ui';

interface Module { id: string; title: string; lessons: { id: string; title: string }[]; }
interface TeacherMember { teacherId: string; name: string; email: string; }

export function CalendarPage() {
  const { role } = useAuthStore();
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Month navigation state lifted from CalendarView
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState({ year: today.getFullYear(), month: today.getMonth() });

  // Form state (New Schedule)
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [duration, setDuration] = useState(60);
  const [notes, setNotes] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [saving, setSaving] = useState(false);

  // Constructor state (View Details / Edit Details)
  const [activeEntry, setActiveEntry] = useState<ScheduleEntry | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editStartsAt, setEditStartsAt] = useState('');
  const [editDuration, setEditDuration] = useState(60);
  const [editNotes, setEditNotes] = useState('');
  const [editTeacherId, setEditTeacherId] = useState('');
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Course teachers list (shared between create & edit modes)
  const [courseTeachers, setCourseTeachers] = useState<TeacherMember[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);

  // Fetch calendar entries for the selected month range
  function fetchEntries(monthState = currentMonth) {
    // Range: start of selected month to end of selected month
    const from = new Date(monthState.year, monthState.month, 1);
    const to = new Date(monthState.year, monthState.month + 1, 0, 23, 59, 59);
    return getSchedule(from.toISOString(), to.toISOString())
      .then((r) => setEntries(r.data));
  }

  // Refetch when month changes
  useEffect(() => {
    setLoading(true);
    fetchEntries(currentMonth).finally(() => setLoading(false));
  }, [currentMonth]);

  // Fetch courses list for dropdown
  useEffect(() => {
    if (role === 'Teacher' || role === 'Admin') {
      getCourses().then((r) => setCourses(r.data));
    }
  }, [role]);

  // Reset lesson choices and load modules & teachers when Course is selected in New Schedule Modal
  useEffect(() => {
    setSelectedLessonId('');
    setSelectedTeacherId('');
    if (!selectedCourseId) {
      setModules([]);
      setCourseTeachers([]);
      return;
    }
    // Load modules for lesson select dropdown
    api.get<Course & { modules: Module[] }>(`/courses/${selectedCourseId}`).then((r) => {
      setModules(r.data.modules ?? []);
    });
    // Load teachers for teacher select dropdown (Admin needs this)
    if (role === 'Admin' || role === 'Teacher') {
      getCourseMembers(selectedCourseId).then((r) => {
        setCourseTeachers(r.data.teachers || []);
      });
    }
  }, [selectedCourseId, role]);

  // Load teachers list when editing an existing schedule entry
  useEffect(() => {
    if (!activeEntry) {
      if (!selectedCourseId) setCourseTeachers([]);
      return;
    }
    setLoadingTeachers(true);
    getCourseMembers(activeEntry.courseId)
      .then((r) => {
        setCourseTeachers(r.data.teachers || []);
      })
      .catch(() => setCourseTeachers([]))
      .finally(() => setLoadingTeachers(false));
  }, [activeEntry, selectedCourseId]);

  // Handle Day Click in calendar grid: pre-fill date and show Create Modal
  function handleDayClick(date: Date) {
    if (role !== 'Teacher' && role !== 'Admin') return;
    const tzOffset = date.getTimezoneOffset() * 60000;
    const localTime = new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
    setStartsAt(localTime);
    setSelectedCourseId('');
    setSelectedLessonId('');
    setNotes('');
    setDuration(60);
    setSelectedTeacherId('');
    setShowCreate(true);
  }

  // Handle Event Click in calendar grid: open Constructor Modal (View details)
  function handleEventClick(entry: ScheduleEntry) {
    setActiveEntry(entry);
    setIsEditing(false);
    
    // Set edit form values
    const d = new Date(entry.startsAt);
    const tzOffset = d.getTimezoneOffset() * 60000;
    const localTime = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
    setEditStartsAt(localTime);
    setEditDuration(entry.durationMinutes);
    setEditNotes(entry.notes ?? '');
    setEditTeacherId(entry.teacherId);
  }

  // Handle Schedule Creation
  async function handleCreate() {
    if (!selectedLessonId || !startsAt) return;
    setSaving(true);
    try {
      await createSchedule({
        lessonId: selectedLessonId,
        startsAt: new Date(startsAt).toISOString(),
        durationMinutes: duration,
        notes: notes || undefined,
        teacherId: selectedTeacherId || undefined
      });
      await fetchEntries(currentMonth);
      setShowCreate(false);
      setSelectedLessonId('');
      setStartsAt('');
      setNotes('');
      setSelectedTeacherId('');
    } catch (err: any) {
      console.error(err);
      toast('error', err.response?.data?.error || 'Помилка при створенні');
    } finally {
      setSaving(false);
    }
  }

  // Handle Schedule Update
  async function handleUpdate() {
    if (!activeEntry) return;
    setUpdating(true);
    try {
      await updateSchedule(activeEntry.id, {
        startsAt: new Date(editStartsAt).toISOString(),
        durationMinutes: editDuration,
        notes: editNotes || undefined,
        teacherId: editTeacherId || undefined
      });
      await fetchEntries(currentMonth);
      setActiveEntry(null);
    } catch (err: any) {
      console.error(err);
      toast('error', err.response?.data?.error || 'Помилка при оновленні');
    } finally {
      setUpdating(false);
    }
  }

  // Handle Delete Confirmation from List
  async function handleDelete(id: string) {
    if (!confirm('Ви впевнені, що хочете видалити це заняття?')) return;
    try {
      await deleteSchedule(id);
      setEntries((p) => p.filter((e) => e.id !== id));
    } catch (err) {
      console.error(err);
      toast('error', 'Помилка при видаленні');
    }
  }

  // Handle Delete Confirmation from Details Modal
  async function handleDeleteConfirm() {
    if (!activeEntry) return;
    if (!confirm('Ви впевнені, що хочете видалити це заняття?')) return;
    setDeleting(true);
    try {
      await deleteSchedule(activeEntry.id);
      setEntries((p) => p.filter((e) => e.id !== activeEntry.id));
      setActiveEntry(null);
    } catch (err) {
      console.error(err);
      toast('error', 'Помилка при видаленні');
    } finally {
      setDeleting(false);
    }
  }

  // Handle drag-drop rescheduling
  async function handleEventDrop(entry: ScheduleEntry, newDate: Date) {
    if (role !== 'Teacher' && role !== 'Admin') return;
    const originalDate = new Date(entry.startsAt);
    // Preserve time, change date
    newDate.setHours(originalDate.getHours(), originalDate.getMinutes(), 0, 0);
    const newIso = newDate.toISOString();
    // Optimistic update
    setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, startsAt: newIso } : e));
    try {
      await updateSchedule(entry.id, { startsAt: newIso, durationMinutes: entry.durationMinutes });
    } catch {
      toast('error', 'Не вдалося перемістити заняття');
      await fetchEntries(currentMonth);
    }
  }

  if (loading) return <Layout title="Розклад"><Loader /></Layout>;

  const canCreate = role === 'Teacher' || role === 'Admin';

  return (
    <Layout title="Розклад" subtitle="Заплановані заняття">
      <div className="flex flex-col gap-6 max-w-4xl">
        {canCreate && (
          <div className="flex justify-between items-center bg-brand-50/40 p-4 border border-brand-100 rounded-2xl">
            <span className="text-xs text-brand-700 font-medium">
              💡 Порада: натисніть на порожню комірку щоб запланувати урок. Перетягніть заняття на інший день щоб перенести його.
            </span>
            <button onClick={() => {
              setStartsAt('');
              setSelectedCourseId('');
              setSelectedLessonId('');
              setNotes('');
              setDuration(60);
              setSelectedTeacherId('');
              setShowCreate(true);
            }} className="btn btn-primary shadow-sm">+ Заняття</button>
          </div>
        )}

        <Card className="p-5">
          <CalendarView
            entries={entries}
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
            onDayClick={canCreate ? handleDayClick : undefined}
            onEventClick={handleEventClick}
            onEventDrop={canCreate ? handleEventDrop : undefined}
          />
        </Card>

        {/* Upcoming list */}
        <div>
          <h2 className="font-bold text-ink-900 dark:text-white mb-3">Найближчі заняття</h2>
          <div className="flex flex-col gap-2">
            {entries
              .filter((e) => new Date(e.startsAt) >= new Date())
              .slice(0, 10)
              .map((e) => (
                <Card
                  key={e.id}
                  onClick={() => handleEventClick(e)}
                  className="p-3 flex items-center gap-4 cursor-pointer hover:border-brand-200 transition"
                >
                  <div className="flex-shrink-0 w-12 text-center">
                    <p className="text-xl font-extrabold text-brand-600">{new Date(e.startsAt).getDate()}</p>
                    <p className="text-[10px] text-ink-400">
                      {new Date(e.startsAt).toLocaleString('uk-UA', { month: 'short' })}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-ink-800 dark:text-[#e8eaf0] text-sm truncate">{e.lessonTitle}</p>
                    <p className="text-xs text-ink-400 truncate">{e.courseTitle} · {e.teacherName}</p>
                  </div>
                  <div className="text-sm text-ink-600 dark:text-[#9aa2bd] font-medium flex-shrink-0">
                    {new Date(e.startsAt).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                    <span className="text-ink-300 dark:text-[#4d5470] ml-1">{e.durationMinutes} хв</span>
                  </div>
                  {canCreate && (
                    <button
                      onClick={(evt) => {
                        evt.stopPropagation();
                        handleDelete(e.id);
                      }}
                      className="text-ink-300 dark:text-[#4d5470] hover:text-rose-500 transition ml-2 p-1.5"
                    >
                      ✕
                    </button>
                  )}
                </Card>
              ))}
            {entries.filter((e) => new Date(e.startsAt) >= new Date()).length === 0 && (
              <p className="text-ink-400 text-sm text-center py-6">Запланованих занять немає</p>
            )}
          </div>
        </div>
      </div>

      {/* Create modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} className="max-w-md">
        <div className="p-6">
          <h2 className="font-extrabold text-ink-900 dark:text-white text-lg mb-5">Нове заняття</h2>
          <div className="flex flex-col gap-4">
            {courses.length === 0 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/40 rounded-xl text-xs text-amber-700 dark:text-amber-400">
                ⚠️ У вас немає активних або призначених курсів. Переконайтеся, що ви зареєстровані як викладач принаймні для одного курсу.
              </div>
            )}
            <div>
              <label className="label">Курс</label>
              <select value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)} className="input" disabled={courses.length === 0}>
                <option value="">Оберіть курс</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            {selectedCourseId && modules.length === 0 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/40 rounded-xl text-xs text-amber-700 dark:text-amber-400">
                ⚠️ Цей курс не має жодного модуля чи уроку. Додайте їх у Конструкторі курсів перед плануванням.
              </div>
            )}
            <div>
              <label className="label">Урок</label>
              <select value={selectedLessonId} onChange={(e) => setSelectedLessonId(e.target.value)} className="input" disabled={!selectedCourseId || modules.length === 0}>
                <option value="">Оберіть урок</option>
                {modules.flatMap((m) => m.lessons.map((l) => (
                  <option key={l.id} value={l.id}>{m.title} › {l.title}</option>
                )))}
              </select>
            </div>
            <div>
              <label className="label">Дата та час</label>
              <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">Тривалість (хвилин)</label>
              <input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="input" min={15} max={300} />
            </div>
            {role === 'Admin' && selectedCourseId && (
              <div>
                <label className="label">Викладач</label>
                <select value={selectedTeacherId} onChange={(e) => setSelectedTeacherId(e.target.value)} className="input">
                  <option value="">Виберіть викладача (авто-вибір першого, якщо порожньо)</option>
                  {courseTeachers.map((t) => (
                    <option key={t.teacherId} value={t.teacherId}>{t.name} ({t.email})</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="label">Нотатки</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} className="input" placeholder="Необов'язково" />
            </div>
            <button onClick={handleCreate} disabled={saving || !selectedLessonId || !startsAt} className="btn btn-primary w-full mt-2">
              {saving ? 'Збереження…' : 'Зберегти'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Constructor (Details / Edit) Modal */}
      <Modal open={!!activeEntry} onClose={() => setActiveEntry(null)} className="max-w-md">
        {activeEntry && (
          <div className="p-6">
            <div className="flex justify-between items-start mb-5">
              <h2 className="font-extrabold text-ink-900 dark:text-white text-lg">
                {isEditing ? 'Редагування заняття' : 'Деталі заняття'}
              </h2>
              <button onClick={() => setActiveEntry(null)} className="text-ink-400 hover:text-ink-600 transition">✕</button>
            </div>

            {!isEditing ? (
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-xs text-ink-400 font-bold uppercase tracking-wider">Курс</p>
                  <p className="font-semibold text-ink-800 dark:text-[#e8eaf0]">{activeEntry.courseTitle}</p>
                </div>
                <div>
                  <p className="text-xs text-ink-400 font-bold uppercase tracking-wider">Урок</p>
                  <p className="font-semibold text-ink-800 dark:text-[#e8eaf0]">{activeEntry.lessonTitle}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-ink-400 font-bold uppercase tracking-wider">Час початку</p>
                    <p className="font-semibold text-ink-800 dark:text-[#e8eaf0]">
                      {new Date(activeEntry.startsAt).toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-ink-400 font-bold uppercase tracking-wider">Тривалість</p>
                    <p className="font-semibold text-ink-800 dark:text-[#e8eaf0]">{activeEntry.durationMinutes} хвилин</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-ink-400 font-bold uppercase tracking-wider">Викладач</p>
                  <p className="font-semibold text-ink-800 dark:text-[#e8eaf0]">{activeEntry.teacherName}</p>
                </div>
                {activeEntry.notes && (
                  <div>
                    <p className="text-xs text-ink-400 font-bold uppercase tracking-wider">Нотатки</p>
                    <p className="text-sm text-ink-700 dark:text-[#b0b8d0] bg-ink-50 dark:bg-[#102a1d] rounded-lg p-2.5 mt-1 border border-ink-100 dark:border-[#1c3a2a]">{activeEntry.notes}</p>
                  </div>
                )}

                {canCreate && (
                  <div className="flex gap-2.5 mt-4 pt-4 border-t border-ink-100 dark:border-[#1c3a2a]">
                    <button onClick={() => setIsEditing(true)} className="btn btn-secondary flex-1">Редагувати</button>
                    <button onClick={handleDeleteConfirm} disabled={deleting} className="btn bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-700/50 flex-shrink-0">
                      {deleting ? 'Видалення...' : 'Видалити'}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div>
                  <label className="label">Дата та час</label>
                  <input type="datetime-local" value={editStartsAt} onChange={(e) => setEditStartsAt(e.target.value)} className="input" />
                </div>
                <div>
                  <label className="label">Тривалість (хвилин)</label>
                  <input type="number" value={editDuration} onChange={(e) => setEditDuration(Number(e.target.value))} className="input" min={15} max={300} />
                </div>
                {role === 'Admin' && (
                  <div>
                    <label className="label">Викладач</label>
                    {loadingTeachers ? (
                      <div className="text-xs text-ink-400">Завантаження викладачів...</div>
                    ) : (
                      <select value={editTeacherId} onChange={(e) => setEditTeacherId(e.target.value)} className="input">
                        <option value="">Виберіть викладача</option>
                        {courseTeachers.map((t) => (
                          <option key={t.teacherId} value={t.teacherId}>{t.name} ({t.email})</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
                <div>
                  <label className="label">Нотатки</label>
                  <input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="input" placeholder="Необов'язково" />
                </div>

                <div className="flex gap-2.5 mt-4 pt-4 border-t border-ink-100">
                  <button onClick={handleUpdate} disabled={updating || !editStartsAt} className="btn btn-primary flex-1">
                    {updating ? 'Збереження...' : 'Зберегти'}
                  </button>
                  <button onClick={() => setIsEditing(false)} className="btn btn-secondary">Скасувати</button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </Layout>
  );
}
