import { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import api from '../../api/client';
import type { GradeScale } from '../../types';
import { Card, Badge, EmptyState, toast, cx } from '../../components/ui';

export function GradeScalesPage() {
  const [scales, setScales] = useState<GradeScale[]>([]);
  const [name, setName] = useState('');
  const [values, setValues] = useState<Array<{ valueString: string; isPassing: boolean }>>([{ valueString: '', isPassing: true }]);
  const [editingScaleId, setEditingScaleId] = useState<string | null>(null);

  useEffect(() => { fetchScales(); }, []);

  function fetchScales() {
    api.get<GradeScale[]>('/gradescales')
      .then((r) => setScales(r.data))
      .catch(() => toast('error', 'Не вдалося завантажити шкали'));
  }

  const addValue = () => setValues((p) => [...p, { valueString: '', isPassing: true }]);

  async function handleSave() {
    if (!name.trim() || values.some((v) => !v.valueString.trim())) {
      toast('error', 'Заповніть назву шкали та всі значення');
      return;
    }
    const payload = {
      name,
      values: values.filter(v => v.valueString.trim())
    };

    try {
      if (editingScaleId) {
        const { data } = await api.put<GradeScale>(`/gradescales/${editingScaleId}`, payload);
        setScales((prev) => prev.map((s) => s.id === editingScaleId ? data : s));
        toast('success', 'Шкалу оновлено успішно!');
        setEditingScaleId(null);
      } else {
        const { data } = await api.post<GradeScale>('/gradescales', payload);
        setScales((p) => [...p, data]);
        toast('success', 'Шкалу створено успішно!');
      }
      setName('');
      setValues([{ valueString: '', isPassing: true }]);
    } catch (err) {
      toast('error', 'Не вдалося зберегти шкалу оцінювання');
    }
  }

  function handleEdit(scale: GradeScale) {
    setEditingScaleId(scale.id);
    setName(scale.name);
    setValues(scale.values.map(v => ({ valueString: v.valueString, isPassing: v.isPassing })));
  }

  async function handleDelete(id: string) {
    if (!confirm('Ви впевнені, що хочете видалити цю шкалу оцінювання?')) return;
    try {
      await api.delete(`/gradescales/${id}`);
      setScales((prev) => prev.filter((s) => s.id !== id));
      toast('success', 'Шкалу оцінювання видалено!');
      if (editingScaleId === id) {
        setEditingScaleId(null);
        setName('');
        setValues([{ valueString: '', isPassing: true }]);
      }
    } catch {
      toast('error', 'Не вдалося видалити шкалу оцінювання');
    }
  }

  function handleCancelEdit() {
    setEditingScaleId(null);
    setName('');
    setValues([{ valueString: '', isPassing: true }]);
  }

  return (
    <Layout title="Системи оцінювання" subtitle="Налаштовуй власні шкали оцінок для курсів">
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Form Card */}
        <Card className="p-6">
          <h2 className="font-extrabold text-ink-900 text-lg mb-4">
            {editingScaleId ? '✏️ Редагувати шкалу' : '✨ Нова шкала'}
          </h2>
          
          <div className="flex flex-col gap-4">
            <div>
              <label className="label">Назва шкали</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Назва (напр. ECTS, 12-бальна)" className="input" />
            </div>

            <div>
              <label className="label">Значення шкали (від найвищого до найнижчого)</label>
              <div className="flex flex-col gap-2">
                {values.map((v, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input value={v.valueString} onChange={(e) => setValues((p) => p.map((x, j) => j === i ? { ...x, valueString: e.target.value } : x))}
                      placeholder={`Значення ${i + 1} (напр. A, 12, Зараховано)`} className="input py-2 flex-1" />
                    
                    <label className={cx('chip cursor-pointer select-none font-semibold text-xs', 
                      v.isPassing ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100' : 'bg-rose-50 text-rose-700 ring-1 ring-rose-100')}>
                      <input type="checkbox" checked={v.isPassing} onChange={(e) => setValues((p) => p.map((x, j) => j === i ? { ...x, isPassing: e.target.checked } : x))} className="sr-only" />
                      {v.isPassing ? '✓ Зараховано' : '✕ Незараховано'}
                    </label>

                    {values.length > 1 && (
                      <button onClick={() => setValues((p) => p.filter((_, j) => j !== i))} className="text-ink-300 hover:text-rose-500 transition px-1">✕</button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 mt-2">
              <button onClick={addValue} className="btn btn-soft flex-1 text-xs py-2">+ Додати значення</button>
              <button onClick={handleSave} className="btn btn-primary flex-1 text-xs py-2">
                {editingScaleId ? '💾 Зберегти зміни' : '✨ Створити шкалу'}
              </button>
              {editingScaleId && (
                <button onClick={handleCancelEdit} className="btn btn-ghost text-xs py-2 text-rose-500">Скасувати</button>
              )}
            </div>
          </div>
        </Card>

        {/* Existing scales */}
        <Card className="p-6">
          <h2 className="font-extrabold text-ink-900 text-lg mb-4">📊 Існуючі шкали</h2>
          <div className="flex flex-col gap-3">
            {scales.map((s) => (
              <div key={s.id} className="rounded-xl border border-ink-200 p-4 hover:border-brand-300 transition group relative">
                <div className="flex items-center justify-between mb-2.5">
                  <p className="font-bold text-ink-800 text-base">{s.name}</p>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition duration-150">
                    <button onClick={() => handleEdit(s)} className="btn btn-soft text-[10px] py-1 px-2.5" title="Редагувати">
                      ✏️ Ред.
                    </button>
                    <button onClick={() => handleDelete(s.id)} className="btn text-[10px] py-1 px-2.5 !bg-rose-50 text-rose-600 hover:!bg-rose-100" title="Видалити">
                      🗑️ Вид.
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {s.values.map((v) => (
                    <Badge key={v.id} tone={v.isPassing ? 'green' : 'rose'}>
                      {v.valueString}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
            {scales.length === 0 && <EmptyState icon="📊" title="Шкал ще немає" hint="Створіть першу шкалу оцінювання зліва" />}
          </div>
        </Card>
      </div>
    </Layout>
  );
}
