import { useEffect, useState } from 'react';
import { getTodayQuests, type DailyQuestStatus } from '../api/quests';
import { cx } from './ui';

export function DailyQuestsWidget() {
  const [quests, setQuests] = useState<DailyQuestStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () =>
    getTodayQuests().then(r => setQuests(r.data)).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  if (loading) return <div className="h-24 animate-pulse bg-ink-50 dark:bg-[#1e2033] rounded-2xl" />;
  if (quests.length === 0) return null;

  const done = quests.filter(q => q.isCompleted).length;
  const total = quests.length;
  const allDone = done === total;

  return (
    <div className={cx(
      'rounded-2xl p-4 border',
      allDone
        ? 'bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border-emerald-200 dark:border-emerald-800/40'
        : 'bg-white dark:bg-[#1a1c2e] border-ink-100 dark:border-[#282c44]'
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎯</span>
          <p className="font-bold text-ink-900 dark:text-white text-sm">Щоденні завдання</p>
        </div>
        <span className={cx(
          'text-xs font-bold px-2 py-1 rounded-full',
          allDone ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-ink-100 dark:bg-[#252840] text-ink-600 dark:text-[#9aa2bd]'
        )}>
          {done}/{total}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-ink-100 dark:bg-[#252840] rounded-full mb-3 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-brand-500 to-emerald-500 rounded-full transition-all duration-500"
          style={{ width: `${(done / total) * 100}%` }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        {quests.map(q => (
          <div key={q.id} className={cx(
            'flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition',
            q.isCompleted ? 'opacity-60' : 'bg-ink-50 dark:bg-[#1e2033]'
          )}>
            <span className="text-base flex-shrink-0">{q.quest.icon}</span>
            <div className="flex-1 min-w-0">
              <p className={cx('font-semibold text-ink-800 dark:text-[#e8eaf0] truncate', q.isCompleted && 'line-through text-ink-400')}>
                {q.quest.title}
              </p>
            </div>
            <span className="text-xs font-bold text-amber-600 flex-shrink-0">+{q.quest.coinsReward}🪙</span>
            {q.isCompleted && <span className="text-emerald-500 text-base flex-shrink-0">✓</span>}
          </div>
        ))}
      </div>

      {allDone && (
        <p className="text-center text-xs text-emerald-600 font-semibold mt-2">
          🎉 Всі завдання виконано! +25🪙 бонус
        </p>
      )}
    </div>
  );
}
