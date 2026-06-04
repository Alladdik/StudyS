import { TECHS, BRANCH_META } from '../techs';
import type { TechId, GameState, Action } from '../types';
import { CIVS } from '../civs';
import { cx } from '../../../components/ui';

interface Props {
  game: GameState;
  dispatch: React.Dispatch<Action>;
  onClose: () => void;
}

export function TechTree({ game, dispatch, onClose }: Props) {
  const civCostMod = CIVS[game.civId ?? '']?.techCostPct ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 text-white rounded-2xl w-full max-w-5xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-extrabold">🔬 Дерево Технологій</h2>
            <p className="text-slate-400 text-xs mt-0.5">
              Баланс: <span className="text-blue-400 font-bold">{game.knowledge}📚</span>
              {civCostMod !== 0 && <span className="ml-2 text-emerald-400">({civCostMod > 0 ? '+' : ''}{civCostMod}% вартість)</span>}
            </p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-400 hover:text-white transition">✕</button>
        </div>

        <div className="p-6 flex flex-col gap-8">
          {Object.entries(BRANCH_META).map(([branchId, branch]) => (
            <div key={branchId}>
              {/* Branch header */}
              <div className="flex items-center gap-2 mb-4">
                <div className="h-px flex-1 rounded" style={{ background: branch.color }} />
                <p className="font-extrabold text-sm px-3 py-1 rounded-full text-white" style={{ background: branch.color + '33', border: `1px solid ${branch.color}66` }}>
                  {branch.label}
                </p>
                <div className="h-px flex-1 rounded" style={{ background: branch.color }} />
              </div>

              {/* Tech cards in branch */}
              <div className="flex items-stretch gap-1">
                {branch.techs.map((tid, i) => {
                  const tech = TECHS[tid as TechId];
                  const learned = game.techs.includes(tid as TechId);
                  const prevLearned = i === 0 || game.techs.includes(branch.techs[i - 1] as TechId);
                  const cost = Math.round(tech.cost * (1 + (CIVS[game.civId ?? '']?.techCostPct ?? 0) / 100));
                  const canLearn = !learned && prevLearned && game.knowledge >= cost;
                  const blocked = !learned && !prevLearned;

                  return (
                    <div key={tid} className="flex items-center flex-1">
                      {i > 0 && (
                        <div className={cx('w-3 h-0.5 flex-shrink-0', prevLearned ? 'opacity-80' : 'opacity-15')} style={{ background: branch.color }} />
                      )}
                      <button
                        onClick={() => canLearn && dispatch({ type: 'RESEARCH', tech: tid as TechId })}
                        className={cx(
                          'relative flex flex-col items-center gap-1 p-3 rounded-xl border-2 flex-1 text-center transition-all min-h-[110px] justify-center',
                          learned ? 'border-emerald-500 bg-emerald-900/30'
                            : canLearn ? 'border-amber-400 bg-amber-900/20 hover:bg-amber-900/35 cursor-pointer hover:scale-105'
                            : blocked ? 'border-slate-800 bg-slate-900/50 opacity-30 cursor-not-allowed'
                            : 'border-slate-700 bg-slate-800/30 opacity-50 cursor-not-allowed'
                        )}
                      >
                        {learned && (
                          <div className="absolute -top-2 -right-2 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-[10px]">✓</div>
                        )}
                        <span className="text-2xl">{tech.icon}</span>
                        <p className="text-[10px] font-bold leading-tight text-center">{tech.label}</p>
                        <p className="text-[9px] text-slate-400 leading-tight text-center mt-0.5 line-clamp-2">{tech.desc}</p>
                        {!learned && (
                          <p className={cx('text-[10px] font-bold mt-1', canLearn ? 'text-amber-400' : 'text-slate-600')}>
                            {cost}📚
                          </p>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Victory hint */}
        <div className="px-6 pb-6">
          <div className="bg-slate-800 rounded-xl p-4 text-xs text-slate-400 border border-slate-700">
            <p className="font-bold text-white mb-2">🏆 Шляхи до перемоги через технології:</p>
            <p>📚 <span className="text-blue-400">Knowledge</span> — вся гілка Академія + побудуй Мережу Знань</p>
            <p>✨ <span className="text-purple-400">Трансцендентність</span> — спецздатність AOE Burst of Insight</p>
            <p>💰 <span className="text-amber-400">Золота Доба</span> — макс. торгівля + Поселенець для нових міст</p>
          </div>
        </div>
      </div>
    </div>
  );
}
