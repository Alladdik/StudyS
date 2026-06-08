import { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Card, Modal, Badge, Loader, EmptyState, toast, cx } from '../../components/ui';
import api from '../../api/client';
import { getUsers } from '../../api/users';
import type { UserItem } from '../../api/users';

interface BadgeItem {
  id: string; name: string; description: string; icon: string;
  condition: string; conditionValue: number; coinsReward: number; holders: number;
}
interface QuestItem {
  id: string; type: string; title: string; description: string;
  icon: string; coinsReward: number; isActive: boolean;
}
interface LeaderEntry { studentId: string; name: string; coins: number; streak: number; maxStreak: number; }

const EMPTY_BADGE = { name: '', description: '', icon: '🏆', condition: 'homeworks_passed', conditionValue: 1, coinsReward: 0 };
const EMPTY_QUEST = { type: 'login', title: '', description: '', icon: '⭐', coinsReward: 10, isActive: true };

export function GamificationPage() {
  const [tab, setTab] = useState<'badges' | 'quests' | 'leaderboard' | 'award'>('badges');
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const [quests, setQuests] = useState<QuestItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [students, setStudents] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Badge modal
  const [showBadgeForm, setShowBadgeForm] = useState(false);
  const [editBadge, setEditBadge] = useState<BadgeItem | null>(null);
  const [badgeForm, setBadgeForm] = useState(EMPTY_BADGE);
  const [badgeSaving, setBadgeSaving] = useState(false);

  // Quest modal
  const [showQuestForm, setShowQuestForm] = useState(false);
  const [editQuest, setEditQuest] = useState<QuestItem | null>(null);
  const [questForm, setQuestForm] = useState(EMPTY_QUEST);
  const [questSaving, setQuestSaving] = useState(false);

  // Award coins
  const [awardUserId, setAwardUserId] = useState('');
  const [awardAmount, setAwardAmount] = useState(50);
  const [awardReason, setAwardReason] = useState('');
  const [awarding, setAwarding] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [b, q, l, s] = await Promise.all([
        api.get<BadgeItem[]>('/gamification/admin/badges'),
        api.get<QuestItem[]>('/gamification/admin/quests'),
        api.get<LeaderEntry[]>('/gamification/leaderboard'),
        getUsers({ role: 'Student', pageSize: 500 }),
      ]);
      setBadges(b.data);
      setQuests(q.data);
      setLeaderboard(l.data);
      setStudents(s.data.items);
    } catch { toast('error', 'Помилка завантаження'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // ── Badges ────────────────────────────────────────────────────────────────
  function openCreateBadge() { setBadgeForm(EMPTY_BADGE); setEditBadge(null); setShowBadgeForm(true); }
  function openEditBadge(b: BadgeItem) {
    setBadgeForm({ name: b.name, description: b.description, icon: b.icon, condition: b.condition, conditionValue: b.conditionValue, coinsReward: b.coinsReward });
    setEditBadge(b); setShowBadgeForm(true);
  }
  async function saveBadge(e: React.FormEvent) {
    e.preventDefault(); setBadgeSaving(true);
    try {
      if (editBadge) await api.put(`/gamification/admin/badges/${editBadge.id}`, badgeForm);
      else await api.post('/gamification/admin/badges', badgeForm);
      toast('success', editBadge ? 'Бейдж оновлено' : 'Бейдж створено');
      setShowBadgeForm(false); load();
    } catch { toast('error', 'Помилка збереження'); }
    finally { setBadgeSaving(false); }
  }
  async function deleteBadge(id: string) {
    if (!confirm('Видалити бейдж?')) return;
    await api.delete(`/gamification/admin/badges/${id}`);
    toast('success', 'Бейдж видалено'); load();
  }
  async function seedBadges() {
    try { await api.post('/gamification/badges/seed'); toast('success', '8 бейджів додано!'); load(); }
    catch (e: any) { toast('error', e?.response?.data?.error ?? 'Помилка'); }
  }

  // ── Quests ────────────────────────────────────────────────────────────────
  function openCreateQuest() { setQuestForm(EMPTY_QUEST); setEditQuest(null); setShowQuestForm(true); }
  function openEditQuest(q: QuestItem) {
    setQuestForm({ type: q.type, title: q.title, description: q.description, icon: q.icon, coinsReward: q.coinsReward, isActive: q.isActive });
    setEditQuest(q); setShowQuestForm(true);
  }
  async function saveQuest(e: React.FormEvent) {
    e.preventDefault(); setQuestSaving(true);
    try {
      if (editQuest) await api.put(`/gamification/admin/quests/${editQuest.id}`, questForm);
      else await api.post('/gamification/admin/quests', questForm);
      toast('success', editQuest ? 'Завдання оновлено' : 'Завдання створено');
      setShowQuestForm(false); load();
    } catch { toast('error', 'Помилка збереження'); }
    finally { setQuestSaving(false); }
  }
  async function deleteQuest(id: string) {
    if (!confirm('Видалити завдання?')) return;
    await api.delete(`/gamification/admin/quests/${id}`);
    toast('success', 'Завдання видалено'); load();
  }
  async function seedQuests() {
    try { await api.post('/dailyquests/seed'); toast('success', '3 завдання додано!'); load(); }
    catch (e: any) { toast('error', e?.response?.data?.error ?? 'Помилка'); }
  }

  // ── Award ─────────────────────────────────────────────────────────────────
  async function handleAward(e: React.FormEvent) {
    e.preventDefault(); if (!awardUserId) return; setAwarding(true);
    try {
      await api.post(`/gamification/admin/award/${awardUserId}`, { amount: awardAmount, reason: awardReason });
      toast('success', `${awardAmount > 0 ? '+' : ''}${awardAmount} монет видано!`);
      setAwardUserId(''); setAwardAmount(50); setAwardReason('');
      load();
    } catch { toast('error', 'Помилка видачі монет'); }
    finally { setAwarding(false); }
  }

  if (loading) return <Layout title="Гейміфікація"><Loader /></Layout>;

  return (
    <Layout title="Гейміфікація" subtitle="Бейджі, щоденні завдання, монети, лідерборд">

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {([['badges','🏅 Бейджі'],['quests','🎯 Квести'],['leaderboard','🏆 Лідерборд'],['award','🪙 Монети']] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={cx('chip transition-all', tab === t ? 'bg-brand-600 text-white' : 'bg-white dark:bg-[#1e2033] text-ink-500 dark:text-[#9aa2bd] ring-1 ring-ink-200 dark:ring-[#2d3148]')}>
            {label}
          </button>
        ))}
      </div>

      {/* ── BADGES ── */}
      {tab === 'badges' && (
        <>
          <div className="flex gap-2 mb-4">
            <button onClick={openCreateBadge} className="btn btn-primary">+ Новий бейдж</button>
            {badges.length === 0 && <button onClick={seedBadges} className="btn btn-soft">🌱 Стандартні бейджі</button>}
          </div>
          {badges.length === 0 ? (
            <EmptyState icon="🏅" title="Бейджів немає" hint="Натисніть «Стандартні бейджі» для швидкого старту" />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {badges.map(b => (
                <Card key={b.id} className="p-4 flex flex-col gap-2">
                  <div className="flex items-start justify-between">
                    <span className="text-3xl">{b.icon}</span>
                    <Badge tone="gray">{b.holders} студентів</Badge>
                  </div>
                  <div>
                    <p className="font-extrabold text-ink-900 dark:text-white">{b.name}</p>
                    <p className="text-xs text-ink-500 dark:text-[#6b7394] mt-0.5">{b.description}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-ink-400 mt-auto">
                    <span className="bg-ink-50 dark:bg-[#1e2033] px-2 py-0.5 rounded-lg">{b.condition} ≥ {b.conditionValue}</span>
                    <span className="text-amber-600 font-bold">🪙 {b.coinsReward}</span>
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-ink-100 dark:border-[#282c44]">
                    <button onClick={() => openEditBadge(b)} className="btn btn-soft text-xs py-1 px-3 flex-1">✏️ Редагувати</button>
                    <button onClick={() => deleteBadge(b.id)} className="btn text-xs py-1 px-3 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20">🗑</button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── QUESTS ── */}
      {tab === 'quests' && (
        <>
          <div className="flex gap-2 mb-4">
            <button onClick={openCreateQuest} className="btn btn-primary">+ Новий квест</button>
            {quests.length === 0 && <button onClick={seedQuests} className="btn btn-soft">🌱 Стандартні квести</button>}
          </div>
          {quests.length === 0 ? (
            <EmptyState icon="🎯" title="Квестів немає" hint="Натисніть «Стандартні квести» для швидкого старту" />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {quests.map(q => (
                <Card key={q.id} className={cx('p-4 flex flex-col gap-2', !q.isActive && 'opacity-60')}>
                  <div className="flex items-start justify-between">
                    <span className="text-3xl">{q.icon}</span>
                    <Badge tone={q.isActive ? 'green' : 'gray'}>{q.isActive ? 'Активний' : 'Вимкнено'}</Badge>
                  </div>
                  <div>
                    <p className="font-extrabold text-ink-900 dark:text-white">{q.title}</p>
                    <p className="text-xs text-ink-500 dark:text-[#6b7394] mt-0.5">{q.description}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-ink-400 mt-auto">
                    <span className="bg-ink-50 dark:bg-[#1e2033] px-2 py-0.5 rounded-lg font-mono">{q.type}</span>
                    <span className="text-amber-600 font-bold">🪙 {q.coinsReward}</span>
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-ink-100 dark:border-[#282c44]">
                    <button onClick={() => openEditQuest(q)} className="btn btn-soft text-xs py-1 px-3 flex-1">✏️ Редагувати</button>
                    <button onClick={() => deleteQuest(q.id)} className="btn text-xs py-1 px-3 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20">🗑</button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── LEADERBOARD ── */}
      {tab === 'leaderboard' && (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 dark:border-[#282c44] bg-ink-50/60 dark:bg-[#151722]/60">
                {['#', 'Студент', 'Монети', 'Серія', 'Макс. серія'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-bold text-ink-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((e, i) => (
                <tr key={e.studentId} className="border-b border-ink-50 dark:border-[#1e2033] last:border-0 hover:bg-ink-50/40 dark:hover:bg-[#1e2033]/60 transition">
                  <td className="px-5 py-3 font-bold text-ink-400">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                  </td>
                  <td className="px-5 py-3 font-semibold text-ink-800 dark:text-[#e8eaf0]">{e.name}</td>
                  <td className="px-5 py-3 font-bold text-amber-600">🪙 {e.coins}</td>
                  <td className="px-5 py-3"><Badge tone="brand">{e.streak} дн.</Badge></td>
                  <td className="px-5 py-3 text-ink-400">{e.maxStreak} дн.</td>
                </tr>
              ))}
            </tbody>
          </table>
          {leaderboard.length === 0 && <p className="text-center text-ink-400 py-10">Лідерборд порожній</p>}
        </Card>
      )}

      {/* ── AWARD COINS ── */}
      {tab === 'award' && (
        <div className="max-w-md">
          <Card className="p-6">
            <h2 className="font-extrabold text-ink-900 dark:text-white text-lg mb-5">🪙 Видати / зняти монети</h2>
            <form onSubmit={handleAward} className="flex flex-col gap-4">
              <div>
                <label className="label">Студент</label>
                <select value={awardUserId} onChange={e => setAwardUserId(e.target.value)} className="input" required>
                  <option value="">— Оберіть студента —</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.email})</option>)}
                </select>
              </div>
              <div>
                <label className="label">Кількість монет (від'ємне = зняти)</label>
                <input type="number" value={awardAmount} onChange={e => setAwardAmount(Number(e.target.value))}
                  className="input" placeholder="50" />
              </div>
              <div>
                <label className="label">Причина (для аудиту)</label>
                <input value={awardReason} onChange={e => setAwardReason(e.target.value)}
                  className="input" placeholder="Виграш конкурсу, виправлення помилки…" required />
              </div>
              <button type="submit" disabled={awarding || !awardUserId} className="btn btn-primary">
                {awarding ? '⏳…' : `${awardAmount >= 0 ? '+' : ''}${awardAmount} 🪙 Застосувати`}
              </button>
            </form>
          </Card>
        </div>
      )}

      {/* Badge form modal */}
      <Modal open={showBadgeForm} onClose={() => setShowBadgeForm(false)} className="max-w-md">
        <form onSubmit={saveBadge} className="p-6 space-y-3">
          <h3 className="font-extrabold text-ink-900 dark:text-white text-lg mb-4">
            {editBadge ? 'Редагувати бейдж' : 'Новий бейдж'}
          </h3>
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="label">Емодзі</label>
              <input value={badgeForm.icon} onChange={e => setBadgeForm(f => ({...f, icon: e.target.value}))} className="input text-center text-2xl" maxLength={2} required />
            </div>
            <div className="col-span-3">
              <label className="label">Назва</label>
              <input value={badgeForm.name} onChange={e => setBadgeForm(f => ({...f, name: e.target.value}))} className="input" required />
            </div>
          </div>
          <div>
            <label className="label">Опис</label>
            <input value={badgeForm.description} onChange={e => setBadgeForm(f => ({...f, description: e.target.value}))} className="input" required />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Умова</label>
              <select value={badgeForm.condition} onChange={e => setBadgeForm(f => ({...f, condition: e.target.value}))} className="input">
                <option value="homeworks_passed">homeworks_passed</option>
                <option value="tests_passed">tests_passed</option>
                <option value="streak">streak</option>
                <option value="max_streak">max_streak</option>
                <option value="coins">coins</option>
              </select>
            </div>
            <div>
              <label className="label">Значення</label>
              <input type="number" min={1} value={badgeForm.conditionValue} onChange={e => setBadgeForm(f => ({...f, conditionValue: Number(e.target.value)}))} className="input" required />
            </div>
          </div>
          <div>
            <label className="label">Нагорода монет</label>
            <input type="number" min={0} value={badgeForm.coinsReward} onChange={e => setBadgeForm(f => ({...f, coinsReward: Number(e.target.value)}))} className="input" />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => setShowBadgeForm(false)} className="btn btn-soft flex-1">Скасувати</button>
            <button type="submit" disabled={badgeSaving} className="btn btn-primary flex-1">{badgeSaving ? '⏳…' : 'Зберегти'}</button>
          </div>
        </form>
      </Modal>

      {/* Quest form modal */}
      <Modal open={showQuestForm} onClose={() => setShowQuestForm(false)} className="max-w-md">
        <form onSubmit={saveQuest} className="p-6 space-y-3">
          <h3 className="font-extrabold text-ink-900 dark:text-white text-lg mb-4">
            {editQuest ? 'Редагувати квест' : 'Новий квест'}
          </h3>
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="label">Емодзі</label>
              <input value={questForm.icon} onChange={e => setQuestForm(f => ({...f, icon: e.target.value}))} className="input text-center text-2xl" maxLength={2} required />
            </div>
            <div className="col-span-3">
              <label className="label">Назва</label>
              <input value={questForm.title} onChange={e => setQuestForm(f => ({...f, title: e.target.value}))} className="input" required />
            </div>
          </div>
          <div>
            <label className="label">Опис</label>
            <input value={questForm.description} onChange={e => setQuestForm(f => ({...f, description: e.target.value}))} className="input" required />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Тип (тригер)</label>
              <select value={questForm.type} onChange={e => setQuestForm(f => ({...f, type: e.target.value}))} className="input">
                <option value="login">login</option>
                <option value="view_lesson">view_lesson</option>
                <option value="submit_homework">submit_homework</option>
                <option value="pass_test">pass_test</option>
                <option value="custom">custom</option>
              </select>
            </div>
            <div>
              <label className="label">Монет</label>
              <input type="number" min={1} value={questForm.coinsReward} onChange={e => setQuestForm(f => ({...f, coinsReward: Number(e.target.value)}))} className="input" required />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={questForm.isActive} onChange={e => setQuestForm(f => ({...f, isActive: e.target.checked}))} />
            <span className="text-sm font-medium text-ink-700 dark:text-[#b0b8d0]">Активний</span>
          </label>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => setShowQuestForm(false)} className="btn btn-soft flex-1">Скасувати</button>
            <button type="submit" disabled={questSaving} className="btn btn-primary flex-1">{questSaving ? '⏳…' : 'Зберегти'}</button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
