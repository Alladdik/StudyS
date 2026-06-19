import { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { getShopItems, createShopItem, deleteShopItem, seedShop, type ShopItem } from '../../api/shop';
import { Card, Badge, Modal, Loader, EmptyState, toast } from '../../components/ui';

const TYPE_OPTIONS = [
  { value: 'hint',            label: '💡 Підказка' },
  { value: 'skip_absence',    label: '🛡️ Пропуск' },
  { value: 'unlock_material', label: '📖 Матеріал' },
  { value: 'certificate',     label: '🏆 Сертифікат' },
  { value: 'custom',          label: '🎁 Інше' },
];

export function ShopAdminPage() {
  const [items, setItems]       = useState<ShopItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', icon: '🎁', type: 'custom', coinsPrice: 50, maxPerStudent: '' });
  const [saving, setSaving]     = useState(false);

  const load = () =>
    getShopItems().then(r => setItems(r.data)).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createShopItem({
        ...form,
        maxPerStudent: form.maxPerStudent ? Number(form.maxPerStudent) : undefined,
      });
      toast('success', 'Товар додано!');
      setShowCreate(false);
      setForm({ name: '', description: '', icon: '🎁', type: 'custom', coinsPrice: 50, maxPerStudent: '' });
      load();
    } catch {
      toast('error', 'Помилка');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Прибрати «${name}» з магазину?`)) return;
    await deleteShopItem(id);
    toast('success', 'Товар деактивовано');
    load();
  }

  async function handleSeed() {
    try {
      await seedShop();
      toast('success', '5 товарів додано!');
      load();
    } catch (e: any) {
      toast('error', e?.response?.data?.error ?? 'Помилка');
    }
  }

  if (loading) return <Layout title="Магазин (Адмін)"><Loader /></Layout>;

  return (
    <Layout title="Магазин монет" subtitle="Управління товарами">
      <div className="flex gap-3 mb-5">
        <button onClick={() => setShowCreate(true)} className="btn btn-primary">+ Новий товар</button>
        {items.length === 0 && (
          <button onClick={handleSeed} className="btn btn-soft">🌱 Додати стандартні</button>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState icon="🛒" title="Товарів немає" action={
          <button onClick={handleSeed} className="btn btn-primary">🌱 Додати стандартні</button>
        } />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(item => (
            <Card key={item.id} className="p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <span className="text-4xl">{item.icon}</span>
                <button onClick={() => handleDelete(item.id, item.name)}
                  className="text-ink-300 dark:text-[#4d5470] hover:text-rose-500 transition text-sm">✕</button>
              </div>
              <div>
                <p className="font-extrabold text-ink-900 dark:text-white">{item.name}</p>
                <p className="text-sm text-ink-500 dark:text-[#6b7394] mt-0.5">{item.description}</p>
              </div>
              <div className="flex items-center justify-between mt-auto pt-2 border-t border-ink-100 dark:border-[#1c3a2a]">
                <span className="font-bold text-amber-600">🪙 {item.coinsPrice}</span>
                <Badge tone="gray">{item.type}</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} className="max-w-md">
        <form onSubmit={handleCreate} className="p-7">
          <h3 className="font-extrabold text-xl text-ink-900 dark:text-white mb-5">Новий товар</h3>
          <div className="flex gap-3 mb-3">
            <div className="w-20">
              <label className="label">Емодзі</label>
              <input value={form.icon} onChange={e => setForm(f => ({...f, icon: e.target.value}))}
                className="input text-2xl text-center" maxLength={2} />
            </div>
            <div className="flex-1">
              <label className="label">Назва</label>
              <input required value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
                className="input" placeholder="Підказка до ДЗ" />
            </div>
          </div>
          <div className="mb-3">
            <label className="label">Опис</label>
            <input required value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
              className="input" placeholder="Що отримає студент" />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="label">Тип</label>
              <select value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))} className="input">
                {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Ціна (монети)</label>
              <input type="number" required min={1} value={form.coinsPrice}
                onChange={e => setForm(f => ({...f, coinsPrice: Number(e.target.value)}))} className="input" />
            </div>
          </div>
          <div className="mb-5">
            <label className="label">Макс. купівель на студента (порожньо = необмежено)</label>
            <input type="number" min={1} value={form.maxPerStudent}
              onChange={e => setForm(f => ({...f, maxPerStudent: e.target.value}))} className="input" placeholder="—" />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowCreate(false)} className="btn btn-soft flex-1">Скасувати</button>
            <button type="submit" disabled={saving} className="btn btn-primary flex-1">
              {saving ? '⏳…' : '✅ Додати'}
            </button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
