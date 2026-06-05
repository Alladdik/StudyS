import { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { getCourses, createCourse, addModule, addLesson, getCourseMembers, removeTeacher, unenrollStudent, submitCourseReview, approveCourse, rejectCourse, deleteCourse, updateCourse, enrollStudent, assignTeacher } from '../../api/courses';
import { getUsers } from '../../api/users';
import type { Course, Module, ContentBlock } from '../../types';
import api from '../../api/client';
import { Card, Modal, Loader, EmptyState, toast, cx } from '../../components/ui';
import { FileUpload } from '../../components/FileUpload';
import { useAuthStore } from '../../store/authStore';

const BLOCK_TYPES: ContentBlock['type'][] = ['TextBlock', 'VideoBlock', 'AudioBlock', 'CodeSandboxBlock', 'FileBlock'];
const blockIcons: Record<string, string> = { TextBlock: '📝', VideoBlock: '🎬', AudioBlock: '🎧', CodeSandboxBlock: '💻', FileBlock: '📎' };
const blockLabels: Record<string, string> = { TextBlock: 'Текст', VideoBlock: 'Відео', AudioBlock: 'Аудіо', CodeSandboxBlock: 'Код', FileBlock: 'Файл' };

export function CourseBuilderPage() {
  const { role } = useAuthStore();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selected, setSelected] = useState<Course & { modules?: Module[] } | null>(null);
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [newLessonTitle, setNewLessonTitle] = useState('');
  const [selectedModuleId, setSelectedModuleId] = useState('');
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [showBlockPicker, setShowBlockPicker] = useState(false);
  
  // Course editing
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState('');

  // Members modal
  const [showMembers, setShowMembers] = useState(false);
  const [members, setMembers] = useState<{
    teachers: Array<{ teacherId: string; name: string; email: string }>;
    students: Array<{ studentId: string; name: string; email: string }>;
  } | null>(null);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [allTeachers, setAllTeachers] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [allStudents, setAllStudents] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [addMemberLoading, setAddMemberLoading] = useState(false);

  async function handleOpenMembers() {
    if (!selected) return;
    setShowMembers(true);
    setLoadingMembers(true);
    setSelectedTeacherId('');
    setSelectedStudentId('');
    try {
      const { data } = await getCourseMembers(selected.id);
      setMembers(data);

      // Load all teachers and students in system
      const [tRes, sRes] = await Promise.all([
        getUsers({ role: 'Teacher', pageSize: 1000 }),
        getUsers({ role: 'Student', pageSize: 1000 })
      ]);
      setAllTeachers(tRes.data.items.map(u => ({ id: u.id, name: `${u.firstName} ${u.lastName}`, email: u.email })));
      setAllStudents(sRes.data.items.map(u => ({ id: u.id, name: `${u.firstName} ${u.lastName}`, email: u.email })));
    } catch {
      toast('error', 'Не вдалося завантажити список учасників');
    } finally {
      setLoadingMembers(false);
    }
  }

  async function handleRemoveTeacher(teacherId: string) {
    if (!selected || !members) return;
    try {
      await removeTeacher(selected.id, teacherId);
      setMembers(prev => prev ? {
        ...prev,
        teachers: prev.teachers.filter(t => t.teacherId !== teacherId)
      } : null);
      toast('success', 'Викладача вилучено з курсу');
    } catch {
      toast('error', 'Не вдалося вилучити викладача');
    }
  }

  async function handleRemoveStudent(studentId: string) {
    if (!selected || !members) return;
    try {
      await unenrollStudent(selected.id, studentId);
      setMembers(prev => prev ? {
        ...prev,
        students: prev.students.filter(s => s.studentId !== studentId)
      } : null);
      toast('success', 'Студента вилучено з курсу');
    } catch {
      toast('error', 'Не вдалося вилучити студента');
    }
  }

  async function handleAddTeacher() {
    if (!selected || !selectedTeacherId) return;
    setAddMemberLoading(true);
    try {
      await assignTeacher(selected.id, selectedTeacherId);
      const teacher = allTeachers.find(t => t.id === selectedTeacherId);
      if (teacher && members) {
        setMembers({
          ...members,
          teachers: [...members.teachers, { teacherId: teacher.id, name: teacher.name, email: teacher.email }]
        });
      }
      setSelectedTeacherId('');
      toast('success', 'Викладача призначено на курс!');
    } catch (err: any) {
      toast('error', err.response?.data?.error || 'Не вдалося призначити викладача');
    } finally {
      setAddMemberLoading(false);
    }
  }

  async function handleAddStudent() {
    if (!selected || !selectedStudentId) return;
    setAddMemberLoading(true);
    try {
      await enrollStudent(selected.id, selectedStudentId);
      const student = allStudents.find(s => s.id === selectedStudentId);
      if (student && members) {
        setMembers({
          ...members,
          students: [...members.students, { studentId: student.id, name: student.name, email: student.email }]
        });
      }
      setSelectedStudentId('');
      toast('success', 'Студента записано на курс!');
    } catch (err: any) {
      toast('error', err.response?.data?.error || 'Не вдалося записати студента');
    } finally {
      setAddMemberLoading(false);
    }
  }

  async function handleRenameCourse() {
    if (!selected || !editTitleValue.trim()) return;
    try {
      const { data } = await updateCourse(selected.id, { title: editTitleValue });
      setSelected({ ...selected, title: data.title });
      setCourses(prev => prev.map(c => c.id === selected.id ? { ...c, title: data.title } : c));
      setIsEditingTitle(false);
      toast('success', 'Назву курсу змінено!');
    } catch {
      toast('error', 'Не вдалося оновити назву курсу');
    }
  }

  async function handleDeleteCourse(id: string) {
    if (!confirm('Ви впевнені, що хочете видалити цей курс? Усі модулі та уроки будуть назавжди видалені.')) return;
    try {
      await deleteCourse(id);
      setCourses(prev => prev.filter(c => c.id !== id));
      if (selected?.id === id) setSelected(null);
      toast('success', 'Курс успішно видалено!');
    } catch {
      toast('error', 'Не вдалося видалити курс');
    }
  }

  useEffect(() => { getCourses().then((r) => setCourses(r.data)); }, []);

  async function selectCourse(course: Course) {
    const { data } = await api.get<Course & { modules: Module[] }>(`/courses/${course.id}`);
    setSelected(data);
  }
  async function handleCreateCourse() {
    if (!newCourseTitle.trim()) return;
    try {
      const { data } = await createCourse({ title: newCourseTitle });
      setCourses((p) => [...p, data]);
      setNewCourseTitle('');
      toast('success', 'Курс успішно створено!');
    } catch (err: any) {
      toast('error', err.response?.data?.error || 'Помилка створення курсу');
    }
  }
  async function handleAddModule() {
    if (!selected || !newModuleTitle.trim()) return;
    try {
      await addModule(selected.id, { title: newModuleTitle, sortOrder: (selected.modules?.length ?? 0) + 1 });
      setNewModuleTitle('');
      await selectCourse(selected);
      toast('success', 'Модуль додано!');
    } catch (err: any) {
      toast('error', err.response?.data?.error || 'Помилка додавання модуля');
    }
  }
  async function handleAddLesson() {
    if (!selected || !selectedModuleId || !newLessonTitle.trim()) return;
    try {
      const module = selected.modules?.find((m) => m.id === selectedModuleId);
      await addLesson(selected.id, selectedModuleId, { title: newLessonTitle, sortOrder: (module?.lessons.length ?? 0) + 1, contentBlocks: blocks });
      setNewLessonTitle('');
      setBlocks([]);
      await selectCourse(selected);
      toast('success', 'Урок створено!');
    } catch (err: any) {
      toast('error', err.response?.data?.error || 'Помилка створення уроку');
    }
  }
  function addBlock(type: ContentBlock['type']) { setBlocks((p) => [...p, { type, data: {} }]); setShowBlockPicker(false); }

  async function handleSubmitReview() {
    if (!selected) return;
    try {
      await submitCourseReview(selected.id);
      setSelected({ ...selected, status: 'OnReview' });
      setCourses(prev => prev.map(c => c.id === selected.id ? { ...c, status: 'OnReview' } : c));
      toast('success', 'Курс надіслано на розгляд адміну!');
    } catch (err: any) {
      toast('error', err.response?.data?.error || 'Не вдалося надіслати на розгляд');
    }
  }

  async function handleApprove() {
    if (!selected) return;
    try {
      await approveCourse(selected.id);
      setSelected({ ...selected, status: 'Published' });
      setCourses(prev => prev.map(c => c.id === selected.id ? { ...c, status: 'Published' } : c));
      toast('success', 'Курс успішно схвалено та опубліковано!');
    } catch (err: any) {
      toast('error', err.response?.data?.error || 'Не вдалося схвалити курс');
    }
  }

  async function handleReject() {
    if (!selected) return;
    try {
      await rejectCourse(selected.id);
      setSelected({ ...selected, status: 'Draft' });
      setCourses(prev => prev.map(c => c.id === selected.id ? { ...c, status: 'Draft' } : c));
      toast('success', 'Курс відхилено та повернуто в статус чернетки');
    } catch (err: any) {
      toast('error', err.response?.data?.error || 'Не вдалося відхилити курс');
    }
  }

  return (
    <Layout title="Конструктор курсів" subtitle="Створюй курси, модулі та уроки з блоків контенту">
      <div className="flex flex-col lg:flex-row gap-4 lg:h-[calc(100vh-200px)]">
        {/* Course list */}
        <Card className="lg:w-64 p-4 flex flex-col gap-2 lg:overflow-y-auto flex-shrink-0">
          <div className="flex gap-2">
            <input value={newCourseTitle} onChange={(e) => setNewCourseTitle(e.target.value)} placeholder="Новий курс…"
              className="input py-2 text-sm" onKeyDown={(e) => e.key === 'Enter' && handleCreateCourse()} />
            <button onClick={handleCreateCourse} className="btn btn-primary w-10 px-0 flex-shrink-0">+</button>
          </div>
          {courses.map((c) => (
            <button key={c.id} onClick={() => selectCourse(c)}
              className={cx('text-left px-3 py-2.5 rounded-xl text-sm font-medium transition flex flex-col gap-1 w-full', selected?.id === c.id ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400 ring-1 ring-brand-100 dark:ring-brand-800/40' : 'text-ink-600 dark:text-[#9aa2bd] hover:bg-ink-50 dark:hover:bg-[#1e2033]')}>
              <span className="truncate w-full font-bold">{c.title}</span>
              <span className="text-[10px] uppercase font-bold tracking-wider">
                {c.status === 'Draft' && <span className="text-ink-400">Чернетка</span>}
                {c.status === 'OnReview' && <span className="text-amber-500">На розгляді</span>}
                {c.status === 'Published' && <span className="text-emerald-500">Опубліковано</span>}
              </span>
            </button>
          ))}
          {courses.length === 0 && <p className="text-ink-400 text-sm text-center py-6">Курсів ще немає</p>}
        </Card>

        {/* Tree */}
        {selected ? (
          <Card className="flex-1 p-6 lg:overflow-y-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-ink-100">
              <div className="min-w-0 flex-1">
                {isEditingTitle ? (
                  <div className="flex items-center gap-2 max-w-md">
                    <input 
                      value={editTitleValue} 
                      onChange={(e) => setEditTitleValue(e.target.value)} 
                      className="input py-1.5 text-sm flex-1"
                      placeholder="Назва курсу..."
                      onKeyDown={(e) => e.key === 'Enter' && handleRenameCourse()}
                    />
                    <button onClick={handleRenameCourse} className="btn btn-primary text-xs py-1.5 px-3 flex-shrink-0">Зберегти</button>
                    <button onClick={() => setIsEditingTitle(false)} className="btn btn-soft text-xs py-1.5 px-3 flex-shrink-0">Скасувати</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="font-extrabold text-ink-900 text-lg tracking-tight">{selected.title}</h2>
                    {selected.status === 'Draft' && <span className="text-xs bg-ink-100 text-ink-500 font-bold px-2 py-0.5 rounded-lg">Чернетка</span>}
                    {selected.status === 'OnReview' && <span className="text-xs bg-amber-50 text-amber-700 ring-1 ring-amber-100 font-bold px-2 py-0.5 rounded-lg">На розгляді</span>}
                    {selected.status === 'Published' && <span className="text-xs bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 font-bold px-2 py-0.5 rounded-lg">Опубліковано</span>}
                    {role === 'Admin' && (
                      <div className="flex items-center gap-1.5 ml-2">
                        <button 
                          onClick={() => { setIsEditingTitle(true); setEditTitleValue(selected.title); }} 
                          className="text-ink-400 hover:text-brand-600 text-xs transition" 
                          title="Редагувати назву"
                        >
                          ✏️
                        </button>
                        <button 
                          onClick={() => handleDeleteCourse(selected.id)} 
                          className="text-ink-400 hover:text-rose-600 text-xs transition" 
                          title="Видалити курс"
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                {/* Teacher submits for review */}
                {role === 'Teacher' && selected.status === 'Draft' && (
                  <button onClick={handleSubmitReview} className="btn btn-primary text-xs py-1.5 px-3">
                    🚀 На розгляд
                  </button>
                )}
                {/* Admin review buttons */}
                {role === 'Admin' && selected.status === 'OnReview' && (
                  <>
                    <button onClick={handleApprove} className="btn btn-primary text-xs py-1.5 px-3 !bg-emerald-600 hover:!bg-emerald-700">
                      ✓ Схвалити
                    </button>
                    <button onClick={handleReject} className="btn btn-soft text-xs py-1.5 px-3 hover:text-rose-600 hover:bg-rose-50">
                      ✕ Відхилити
                    </button>
                  </>
                )}
                <button onClick={handleOpenMembers} className="btn btn-soft py-1.5 px-3 text-xs flex items-center gap-1.5 flex-shrink-0">
                  👥 Учасники
                </button>
              </div>
            </div>

            <div className="flex gap-2 mb-5">
              <input value={newModuleTitle} onChange={(e) => setNewModuleTitle(e.target.value)} placeholder="Новий модуль…" className="input py-2 flex-1" />
              <button onClick={handleAddModule} className="btn btn-soft">+ Модуль</button>
            </div>

            <div className="flex flex-col gap-3">
              {(selected.modules ?? []).map((m) => (
                <div key={m.id} className={cx('rounded-xl border p-4 transition', selectedModuleId === m.id ? 'border-brand-200 bg-brand-50/40' : 'border-ink-200')}>
                  <button onClick={() => setSelectedModuleId(m.id)} className={cx('font-bold mb-2 flex items-center gap-2 transition', selectedModuleId === m.id ? 'text-brand-700' : 'text-ink-800 hover:text-brand-600')}>
                    <span className="text-ink-300">▸</span> {m.title}
                  </button>
                  <div className="pl-6 flex flex-col gap-1.5">
                    {m.lessons.map((l) => (
                      <div key={l.id} className="text-sm text-ink-600 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-ink-300" /> {l.title}
                      </div>
                    ))}
                    {m.lessons.length === 0 && <p className="text-xs text-ink-300">Уроків немає</p>}
                  </div>
                </div>
              ))}
            </div>

            {selectedModuleId && (
              <div className="mt-5 border-t border-ink-100 pt-5">
                <p className="text-sm text-ink-500 mb-3">Додати урок до: <strong className="text-ink-800">{selected.modules?.find((m) => m.id === selectedModuleId)?.title}</strong></p>
                <input value={newLessonTitle} onChange={(e) => setNewLessonTitle(e.target.value)} placeholder="Назва уроку…" className="input mb-3" />

                {blocks.length > 0 && (
                  <div className="flex flex-col gap-2 mb-3">
                    {blocks.map((b, i) => (
                      <div key={i} className="flex flex-col gap-2 bg-ink-50 rounded-xl px-3 py-2.5 text-sm">
                        <div className="flex items-center gap-2">
                          <span>{blockIcons[b.type]}</span>
                          <span className="font-medium text-ink-700">{blockLabels[b.type]}</span>
                          <button onClick={() => setBlocks((p) => p.filter((_, j) => j !== i))} className="ml-auto text-ink-300 hover:text-rose-500 transition">✕</button>
                        </div>
                        {/* Inline data editors per block type */}
                        {b.type === 'TextBlock' && (
                          <textarea rows={3} placeholder="Текст…" value={String(b.data.text ?? '')}
                            onChange={(e) => { const u = [...blocks]; u[i] = { ...b, data: { ...b.data, text: e.target.value } }; setBlocks(u); }}
                            className="input resize-none text-sm" />
                        )}
                        {(b.type === 'VideoBlock' || b.type === 'AudioBlock') && (
                          <input placeholder="URL…" value={String(b.data.url ?? '')}
                            onChange={(e) => { const u = [...blocks]; u[i] = { ...b, data: { ...b.data, url: e.target.value } }; setBlocks(u); }}
                            className="input text-sm" />
                        )}
                        {b.type === 'FileBlock' && (
                          <div>
                            {b.data.url
                              ? <div className="flex items-center gap-2">
                                  <a href={String(b.data.url)} target="_blank" rel="noreferrer" className="text-brand-600 text-xs underline truncate">{String(b.data.name ?? b.data.url)}</a>
                                  <button onClick={() => { const u = [...blocks]; u[i] = { ...b, data: {} }; setBlocks(u); }} className="text-ink-300 hover:text-rose-500 text-xs">змінити</button>
                                </div>
                              : <FileUpload label="Завантажити файл" onUploaded={(url, name) => {
                                  const u = [...blocks]; u[i] = { ...b, data: { url, name } }; setBlocks(u);
                                }} />
                            }
                          </div>
                        )}
                        {b.type === 'CodeSandboxBlock' && (
                          <input placeholder="CodeSandbox URL…" value={String(b.data.sandboxId ?? '')}
                            onChange={(e) => { const u = [...blocks]; u[i] = { ...b, data: { ...b.data, sandboxId: e.target.value } }; setBlocks(u); }}
                            className="input text-sm" />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="relative mb-3">
                  <button onClick={() => setShowBlockPicker((p) => !p)} className="w-full px-3 py-2.5 border-2 border-dashed border-ink-200 rounded-xl text-sm text-ink-400 hover:border-brand-300 hover:text-brand-500 transition">
                    + Додати блок контенту
                  </button>
                  {showBlockPicker && (
                    <div className="absolute left-0 top-12 bg-white dark:bg-[#1a1c2e] border border-ink-200 dark:border-[#282c44] rounded-2xl shadow-xl dark:shadow-black/40 z-10 p-2 flex flex-col gap-0.5 min-w-52">
                      {BLOCK_TYPES.map((type) => (
                        <button key={type} onClick={() => addBlock(type)} className="text-left px-3 py-2.5 hover:bg-brand-50 rounded-xl text-sm flex items-center gap-2.5 transition">
                          <span className="text-lg">{blockIcons[type]}</span> {blockLabels[type]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button onClick={handleAddLesson} className="btn btn-primary">Зберегти урок</button>
              </div>
            )}
          </Card>
        ) : (
          <Card className="flex-1 flex items-center justify-center">
            <EmptyState icon="🏗️" title="Обери або створи курс" hint="Виберіть курс зі списку зліва, щоб почати редагування" />
          </Card>
        )}
      </div>

      <Modal open={showMembers} onClose={() => setShowMembers(false)} className="max-w-lg">
        <div className="p-6">
          <h2 className="font-extrabold text-ink-900 text-lg mb-5">Учасники курсу «{selected?.title}»</h2>
          {loadingMembers ? (
            <div className="py-8"><Loader /></div>
          ) : members ? (
            <div className="flex flex-col gap-6">
              {/* Teachers */}
              <div>
                <h3 className="font-bold text-ink-700 text-sm mb-3">Викладачі ({members.teachers.length})</h3>
                
                {role === 'Admin' && (
                  <div className="bg-ink-50/60 dark:bg-[#1e2033]/60 p-3.5 rounded-2xl mb-3 flex gap-2 items-center">
                    <select
                      value={selectedTeacherId}
                      onChange={(e) => setSelectedTeacherId(e.target.value)}
                      className="input flex-1 py-1.5 text-xs bg-white"
                    >
                      <option value="">— обрати викладача —</option>
                      {allTeachers
                        .filter(t => !members.teachers.some(mt => mt.teacherId === t.id))
                        .map(t => <option key={t.id} value={t.id}>{t.name} ({t.email})</option>)}
                    </select>
                    <button
                      onClick={handleAddTeacher}
                      disabled={!selectedTeacherId || addMemberLoading}
                      className="btn btn-primary text-xs py-1.5 px-3 flex-shrink-0"
                    >
                      Додати
                    </button>
                  </div>
                )}

                <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1">
                  {members.teachers.map((t) => (
                    <div key={t.teacherId} className="flex items-center justify-between py-2 border-b border-ink-50 last:border-0 text-sm">
                      <div>
                        <p className="font-semibold text-ink-800">{t.name}</p>
                        <p className="text-xs text-ink-400">{t.email}</p>
                      </div>
                      <button onClick={() => handleRemoveTeacher(t.teacherId)} className="text-xs text-rose-500 hover:text-rose-700 font-medium transition">Вилучити</button>
                    </div>
                  ))}
                  {members.teachers.length === 0 && <p className="text-xs text-ink-400 italic">Немає призначених викладачів</p>}
                </div>
              </div>

              {/* Students */}
              <div>
                <h3 className="font-bold text-ink-700 text-sm mb-3">Записані студенти ({members.students.length})</h3>
                
                {role === 'Admin' && (
                  <div className="bg-ink-50/60 dark:bg-[#1e2033]/60 p-3.5 rounded-2xl mb-3 flex gap-2 items-center">
                    <select
                      value={selectedStudentId}
                      onChange={(e) => setSelectedStudentId(e.target.value)}
                      className="input flex-1 py-1.5 text-xs bg-white"
                    >
                      <option value="">— обрати учня —</option>
                      {allStudents
                        .filter(s => !members.students.some(ms => ms.studentId === s.id))
                        .map(s => <option key={s.id} value={s.id}>{s.name} ({s.email})</option>)}
                    </select>
                    <button
                      onClick={handleAddStudent}
                      disabled={!selectedStudentId || addMemberLoading}
                      className="btn btn-primary text-xs py-1.5 px-3 flex-shrink-0"
                    >
                      Додати
                    </button>
                  </div>
                )}

                <div className="flex flex-col gap-2 max-h-52 overflow-y-auto pr-1">
                  {members.students.map((s) => (
                    <div key={s.studentId} className="flex items-center justify-between py-2 border-b border-ink-50 last:border-0 text-sm">
                      <div>
                        <p className="font-semibold text-ink-800">{s.name}</p>
                        <p className="text-xs text-ink-400">{s.email}</p>
                      </div>
                      <button onClick={() => handleRemoveStudent(s.studentId)} className="text-xs text-rose-500 hover:text-rose-700 font-medium transition">Вилучити</button>
                    </div>
                  ))}
                  {members.students.length === 0 && <p className="text-xs text-ink-400 italic">Немає записаних студентів</p>}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-ink-400 text-sm text-center py-4">Не вдалося завантажити дані</p>
          )}
        </div>
      </Modal>
    </Layout>
  );
}
