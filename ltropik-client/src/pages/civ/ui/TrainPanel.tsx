import { UNITS } from '../units';
import type { UnitType, GameState, Action } from '../types';
import { cx } from '../../../components/ui';

interface Props { game: GameState; dispatch: React.Dispatch<Action> }

function getAvailable(game: GameState): UnitType[] {
  const list: UnitType[] = ['warrior', 'scholar'];
  if (game.effects.unlockArcher) list.push('archer');
  if (game.effects.unlockGuardian) list.push('guardian');
  if (game.effects.unlockSage) list.push('sage');
  if (game.effects.unlockHero && !game.heroUsed) list.push('hero');
  if (game.effects.unlockAi) list.push('aiUnit');
  if (game.effects.unlockCavalry) list.push('cavalry');
  if (game.effects.unlockCatapult) list.push('catapult');
  if (game.effects.unlockSettler) list.push('settler');
  if (game.effects.unlockDiplomat) list.push('diplomat');
  return list;
}

export function TrainPanel({ game, dispatch }: Props) {
  const available = getAvailable(game);
  return (
    <div className="flex flex-col gap-1.5 max-h-60 overflow-y-auto pr-1">
      {game.trainingQueue && (
        <div className="bg-blue-900/40 border border-blue-600 rounded-xl p-2.5 text-xs text-blue-300">
          🏋️ Тренується: {UNITS[game.trainingQueue].icon} {UNITS[game.trainingQueue].label} ({game.trainTurnsLeft} ход{game.trainTurnsLeft > 1 ? 'и' : ''})
          <div className="h-1.5 bg-blue-900 rounded mt-1.5 overflow-hidden">
            <div className="h-full bg-blue-400 rounded" style={{ width: `${((UNITS[game.trainingQueue].trainTurns - game.trainTurnsLeft) / UNITS[game.trainingQueue].trainTurns) * 100}%` }} />
          </div>
        </div>
      )}
      {!game.trainingQueue && available.map(ut => {
        const def = UNITS[ut];
        const can = game.energy >= def.trainEnergy;
        return (
          <button key={ut}
            onClick={() => can && dispatch({ type: 'TRAIN', unitType: ut })}
            className={cx(
              'flex items-center gap-2 p-2 rounded-xl text-left text-xs transition',
              can ? 'bg-blue-900/25 border border-blue-700 hover:bg-blue-900/40 cursor-pointer'
                : 'bg-slate-800/30 border border-slate-700 opacity-40 cursor-not-allowed'
            )}>
            <span className="text-lg flex-shrink-0">{def.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white text-[11px]">{def.label}</p>
              <p className="text-slate-400 text-[9px] truncate leading-tight">{def.desc}</p>
              <p className="text-slate-500 text-[9px]">HP:{def.maxHp} Рух:{def.maxMoves} Атк:{def.attack} Rng:{def.range}</p>
            </div>
            <div className="flex flex-col items-end flex-shrink-0 gap-0.5">
              <span className="text-cyan-400 font-bold text-xs">{def.trainEnergy}⚡</span>
              <span className="text-slate-500 text-[9px]">{def.trainTurns}ход</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
