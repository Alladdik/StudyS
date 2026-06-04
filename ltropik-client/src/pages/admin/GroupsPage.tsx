import { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { getGroups, createGroup, deleteGroup, getGroup, addMember, removeMember } from '../../api/groups';
import { getUsers } from '../../api/users';
import type { UserItem } from '../../api/users';
import type { StudentGroup, GroupMember } from '../../types';
import { Card, Modal, Loader, EmptyState, toast, cx } from '../../components/ui';

export function GroupsPage() {
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [selected, setSelected] = useState<(StudentGroup & { members?: GroupMember[] }) | null>(null);
  const [allStudents, setAllStudents] = useState<UserItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      getGroups(),
      // BUG FIX: getUsers returns a paged object {items}, not an array.
      getUsers({ role: 'Student', pageSize: 500 }).catch(() => ({ data: { items: [] as UserItem[] } })),
    ]).then(([g, u]) => {
      setGroups(g.data);
      setAllStudents(u.data.items ?? []);
    }).catch(() => toast('error', 'Помилка завантаження')).finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await createGroup({ name: newName, description: newDesc });
      const r = await getGroups();
      setGroups(r.data);
      setShowCreate(false); setNewName(''); setNewDesc('');
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    await deleteGroup(id);
    setGroups((p) => p.filter((g) => g.id !== id));
    if (selected?.id === id) setSelected(null);
  }

  async function selectGroup(g: StudentGroup) {
    const r = await getGroup(g.id);
    setSelected(r.data);
  }

  async function handleAddMember(studentId: string) {
    if (!selected) return;
    await addMember(selected.id, studentId);
    const r = await getGroup(selected.id);
    setSelected(r.data);
  }

  async function handleRemoveMember(studentId: string) {
    if (!selected) return;
    await removeMember(selected.id, studentId);
    const r = await getGroup(selected.id);
    setSelected(r.data);
  }

  if (loading) return <Layout title="Групи"><Loader /></Layout>;

  const memberIds = new Set(selected?.members?.map((m) => m.studentId) ?? []);
  const available = allStudents.filter((s) => !memberIds.has(s.id));

  return (
    <Layout title="Групи / Класи" subtitle="Організація студентів у групи">
      <div className="flex flex-col lg:flex-row gap-4 lg:h-[calc(100vh-200px)]">
        {/* Group list */}
        <Card className="lg:w-64 p-4 flex flex-col gap-2 flex-shrink-0 lg:overflow-y-auto">
          <button onClick={() => setShowCreate(true)} className="btn btn-primary w-full text-sm">+ Нова група</button>
          {groups.length === 0 && <p className="text-ink-400 text-sm text-center py-4">Груп немає</p>}
          {groups.map((g) => (
            <div key={g.id} className={cx('flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition',
              selected?.id === g.id ? 'bg-brand-50 ring-1 ring-brand-100' : 'hover:bg-ink-50')}
              onClick={() => selectGroup(g)}>
              <div className="min-w-0">
                <p className={cx('text-sm font-semibold truncate', selected?.id === g.id ? 'text-brand-700' : 'text-ink-800')}>{g.name}</p>
                <p className="text-xs text-ink-400">{g.memberCount} студентів</p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); handleDelete(g.id); }}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-ink-300 hover:text-rose-500 hover:bg-rose-50 transition flex-shrink-0 ml-1">✕</button>
            </div>
          ))}
        </Card>

        {/* Detail */}
        {selected ? (
          <Card className="flex-1 p-6 lg:overflow-y-auto">
            <h2 className="font-extrabold text-ink-900 text-lg mb-1">{selected.name}</h2>
            {selected.description && <p className="text-ink-400 text-sm mb-5">{selected.description}</p>}

            <h3 className="font-bold text-ink-700 mb-3">Учасники ({selected.members?.length ?? 0})</h3>
            <div className="flex flex-col gap-2 mb-6">
              {(selected.members ?? []).map((m) => (
                <div key={m.studentId} className="flex items-center justify-between py-2 border-b border-ink-50">
                  <div>
                    <p className="text-sm font-semibold text-ink-800">{m.studentName}</p>
                    <p className="text-xs text-ink-400">{m.email}</p>
                  </div>
                  <button onClick={() => handleRemoveMember(m.studentId)} className="text-xs text-rose-400 hover:text-rose-600">Видалити</button>
                </div>
              ))}
              {(selected.members?.length ?? 0) === 0 && <p className="text-ink-300 text-sm">Учасників немає</p>}
            </div>

            {available.length > 0 && (
              <div>
                <h3 className="font-bold text-ink-700 mb-3">Додати студента</h3>
                <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto">
                  {available.map((s) => (
                    <button key={s.id} onClick={() => handleAddMember(s.id)}
                      className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-ink-50 transition text-left">
                      <div>
                        <p className="text-sm font-medium text-ink-800">{s.firstName} {s.lastName}</p>
                        <p className="text-xs text-ink-400">{s.email}</p>
                      </div>
                      <span className="text-brand-500 text-sm">+ Додати</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Card>
        ) : (
          <Card className="flex-1 flex items-center justify-center">
            <EmptyState icon="👥" title="Оберіть групу" hint="Виберіть групу зі списку зліва" />
          </Card>
        )}
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} className="max-w-sm">
        <div className="p-6">
          <h2 className="font-extrabold text-ink-900 text-lg mb-5">Нова група</h2>
          <div className="flex flex-col gap-3">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Назва групи" className="input" />
            <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Опис (необов'язково)" className="input" />
            <button onClick={handleCreate} disabled={saving || !newName.trim()} className="btn btn-primary">
              {saving ? 'Збереження…' : 'Створити'}
            </button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
}
