import { BUILDINGS } from '../buildings';
import type { BuildingId, GameState, Action } from '../types';
import { cx } from '../../../components/ui';

interface Props { game: GameState; dispatch: React.Dispatch<Action> }

export function BuildPanel({ game, dispatch }: Props) {
  const allBuildings = Object.keys(BUILDINGS) as BuildingId[];
  return (
    <div className="flex flex-col gap-1.5 max-h-60 overflow-y-auto pr-1">
      {allBuildings.map(bid => {
        const def = BUILDINGS[bid];
        const built = game.buildings.includes(bid);
        const reqsMet = (def.requires ?? []).every(r => game.buildings.includes(r));
        const canBuild = !built && reqsMet && game.knowledge >= def.cost;
        return (
          <button key={bid}
            onClick={() => canBuild && dispatch({ type: 'BUILD', building: bid })}
            className={cx(
              'flex items-center gap-2 p-2 rounded-xl text-left text-xs transition',
              def.isWonder ? (built ? 'bg-amber-900/30 border border-amber-600' : canBuild ? 'bg-amber-900/20 border border-amber-500 hover:bg-amber-900/40 cursor-pointer' : 'bg-slate-800/30 border border-slate-700 opacity-40 cursor-not-allowed')
              : built ? 'bg-emerald-900/30 border border-emerald-700'
              : canBuild ? 'bg-amber-900/20 border border-amber-600 hover:bg-amber-900/35 cursor-pointer'
              : 'bg-slate-800/30 border border-slate-700 opacity-40 cursor-not-allowed'
            )}>
            <span className="text-lg flex-shrink-0">{def.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white text-[11px] truncate">{def.label}</p>
              <p className="text-slate-400 text-[9px] truncate leading-tight">{def.desc}</p>
            </div>
            {built
              ? <span className="text-emerald-400 text-xs flex-shrink-0">✓</span>
              : <span className="text-amber-400 font-bold text-xs flex-shrink-0">{def.cost}📚</span>}
          </button>
        );
      })}
    </div>
  );
}
