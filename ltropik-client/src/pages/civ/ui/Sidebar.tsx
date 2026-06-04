import { useState } from 'react';
import { UNITS } from '../units';
import { CIVS } from '../civs';
import { cx } from '../../../components/ui';
import { BuildPanel } from './BuildPanel';
import { TrainPanel } from './TrainPanel';
import type { GameState, Action, Unit } from '../types';

type Tab = 'units' | 'build' | 'train' | 'log' | 'chat';

interface Props {
  game: GameState;
  dispatch: React.Dispatch<Action>;
  onShowTech: () => void;
  onShowSave: () => void;
  onEndTurn: () => void;
  chatInput: string;
  setChatInput: (v: string) => void;
  onSendChat: () => void;
}

function UnitCard({ u, isSelected, dispatch }: { u: Unit; isSelected: boolean; dispatch: React.Dispatch<Action> }) {
  const def = UNITS[u.type];
  return (
    <button
      onClick={() => dispatch({ type: 'SELECT_UNIT', id: u.id })}
      className={cx(
        'flex items-center gap-2 p-2 rounded-xl text-left text-xs transition w-full',
        isSelected ? 'bg-blue-700 border border-blue-400' : u.moves === 0 ? 'bg-slate-800/50 opacity-60 border border-slate-700' : 'bg-slate-800 hover:bg-slate-700 border border-slate-700'
      )}>
      <span className="text-base flex-shrink-0">{def.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-white truncate">{def.label}</p>
          {(u.level ?? 1) > 1 && <span className="text-amber-400 text-[9px] ml-1">L{u.level}</span>}
        </div>
        <div className="h-1.5 bg-slate-600 rounded overflow-hidden mt-0.5">
          <div className="h-full rounded transition-all" style={{ width: `${(u.hp / u.maxHp) * 100}%`, background: u.hp / u.maxHp > 0.6 ? '#22c55e' : u.hp / u.maxHp > 0.3 ? '#f59e0b' : '#ef4444' }} />
        </div>
        <p className="text-slate-500 text-[9px]">HP {u.hp}/{u.maxHp}</p>
      </div>
      <div className="flex flex-col items-end flex-shrink-0">
        <span className={cx('text-xs', u.moves > 0 ? 'text-emerald-400' : 'text-slate-600')}>{u.moves}↑</span>
        {u.distracted && <span className="text-xs">😵</span>}
      </div>
    </button>
  );
}

export function Sidebar({ game, dispatch, onShowTech, onShowSave, onEndTurn, chatInput, setChatInput, onSendChat }: Props) {
  const [panel, setPanel] = useState<Tab>('units');

  const playerUnits = game.units.filter(u => u.owner === 'player');
  const enemyCount  = game.units.filter(u => u.owner === 'enemy').length;
  const barbCount   = game.units.filter(u => u.owner === 'barbarian').length;
  const selUnit     = game.units.find(u => u.id === game.selectedUnitId);
  const civ         = game.civId ? CIVS[game.civId] : null;

  return (
    <div className="flex flex-col gap-2.5 w-64 flex-shrink-0">
      {/* Civ badge */}
      {civ && (
        <div className="bg-slate-900 rounded-2xl px-3 py-2 flex items-center gap-2 border border-slate-700">
          <span className="text-2xl">{civ.icon}</span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-white">{game.playerName}</p>
            <p className="text-[10px] text-slate-400">{civ.name} · Хід {game.turn}/{game.maxTurns}</p>
          </div>
        </div>
      )}

      {/* Selected unit card */}
      {selUnit && (
        <div className="bg-slate-900 text-white rounded-2xl p-3 border border-blue-800">
          <p className="text-[10px] text-slate-400 uppercase font-bold mb-1.5">Обраний юніт</p>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">{UNITS[selUnit.type].icon}</span>
            <div>
              <p className="font-bold text-sm">{UNITS[selUnit.type].label}</p>
              <p className="text-[10px] text-slate-400">{UNITS[selUnit.type].desc}</p>
            </div>
          </div>
          <div className="h-2 bg-slate-700 rounded overflow-hidden mb-1">
            <div className="h-full rounded transition-all" style={{ width: `${(selUnit.hp / selUnit.maxHp) * 100}%`, background: selUnit.hp / selUnit.maxHp > 0.6 ? '#22c55e' : '#f59e0b' }} />
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 mb-2">
            <span>HP {selUnit.hp}/{selUnit.maxHp}</span>
            <span>Рух {selUnit.moves}/{selUnit.maxMoves}</span>
            <span>L{selUnit.level ?? 1}</span>
          </div>
          <button onClick={() => dispatch({ type: 'SELECT_UNIT', id: null })} className="w-full bg-slate-700 hover:bg-slate-600 rounded-xl py-1 text-xs transition">Скасувати</button>
        </div>
      )}

      {/* Action buttons row */}
      <div className="flex gap-1.5">
        <button onClick={onShowTech} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white rounded-xl py-2 text-[10px] font-bold transition border border-slate-600">
          🔬 Технології
        </button>
        <button onClick={onShowSave} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white rounded-xl py-2 text-[10px] font-bold transition border border-slate-600">
          💾 Зберегти
        </button>
        {game.effects.aoeAbility && !game.aoeUsed && (
          <button
            onClick={() => game.inspiration >= 10 && dispatch({ type: 'USE_AOE' })}
            className={cx('flex-1 rounded-xl py-2 text-[10px] font-bold transition border', game.inspiration >= 10 ? 'bg-purple-700 hover:bg-purple-600 text-white border-purple-500' : 'bg-slate-800 text-slate-600 border-slate-700 cursor-not-allowed')}>
            ✨ Burst
          </button>
        )}
      </div>

      {/* Panel tabs */}
      <div className="bg-slate-900 text-white rounded-2xl overflow-hidden border border-slate-700 flex-1">
        <div className="flex border-b border-slate-700">
          {(['units', 'build', 'train', 'log', 'chat'] as Tab[]).map(p => (
            <button key={p} onClick={() => setPanel(p)}
              className={cx('flex-1 py-2 text-[9px] font-bold uppercase tracking-wide transition', panel === p ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-white')}>
              {{ units: '⚔️', build: '🏛️', train: '🏋️', log: '📜', chat: '💬' }[p]}
            </button>
          ))}
        </div>

        <div className="p-2.5">
          {panel === 'units' && (
            <div className="flex flex-col gap-1.5">
              <div className="flex gap-2 text-[9px] text-slate-500 font-bold uppercase mb-1">
                <span>Твої: {playerUnits.length}</span>
                <span className="text-red-500">Вороги: {enemyCount}</span>
                <span className="text-orange-500">Варвари: {barbCount}</span>
              </div>
              <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                {playerUnits.map(u => (
                  <UnitCard key={u.id} u={u} isSelected={game.selectedUnitId === u.id} dispatch={dispatch} />
                ))}
              </div>
            </div>
          )}

          {panel === 'build' && <BuildPanel game={game} dispatch={dispatch} />}
          {panel === 'train' && <TrainPanel game={game} dispatch={dispatch} />}

          {panel === 'log' && (
            <div className="flex flex-col gap-0.5 max-h-56 overflow-y-auto">
              {game.log.map((msg, i) => (
                <p key={i} className={cx('text-[10px] leading-tight py-0.5', i === 0 ? 'text-amber-300 font-semibold' : 'text-slate-500')}>{msg}</p>
              ))}
            </div>
          )}

          {panel === 'chat' && (
            <div className="flex flex-col gap-1">
              <div className="max-h-40 overflow-y-auto flex flex-col gap-0.5">
                {game.chatMessages.length === 0 && <p className="text-slate-600 text-[10px] text-center py-4">Немає повідомлень</p>}
                {game.chatMessages.map((m, i) => (
                  <p key={i} className="text-[10px]"><span className="text-slate-400">{m.from}:</span> <span className="text-white">{m.text}</span></p>
                ))}
              </div>
              {game.roomCode && (
                <div className="flex gap-1 mt-1">
                  <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && onSendChat()}
                    placeholder="Повідомлення…" className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-lg px-2 py-1 text-[10px] focus:outline-none" />
                  <button onClick={onSendChat} className="bg-brand-600 hover:bg-brand-500 text-white rounded-lg px-2 py-1 text-[10px] transition">↑</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Victory conditions */}
      <div className="bg-slate-900 rounded-2xl p-2.5 text-[9px] border border-slate-700">
        <p className="font-bold text-slate-300 mb-1.5">🏆 Умови перемоги:</p>
        {[
          { icon: '📚', label: 'Knowledge', desc: 'Вся гілка Академія + Мережа Знань', phase: 'won_knowledge', color: 'text-blue-400' },
          { icon: '⚔️', label: 'Military', desc: 'Знищи всіх ворогів', phase: 'won_military', color: 'text-red-400' },
          { icon: '🛡️', label: 'Survival', desc: `Вижи ${game.maxTurns} ходів`, phase: 'won_survival', color: 'text-amber-400' },
        ].map(v => (
          <p key={v.label} className={cx('flex gap-1 mb-0.5', game.phase === v.phase ? v.color : 'text-slate-500')}>
            {v.icon} <span className="font-bold">{v.label}</span> — {v.desc}
          </p>
        ))}
      </div>

      {/* Multiplayer status */}
      {game.roomCode && (
        <div className="bg-blue-950/40 rounded-2xl p-2.5 border border-blue-800 text-[10px]">
          <p className="text-blue-400 font-bold">🌐 Мультиплеєр · {game.roomCode}</p>
          <p className={game.isMyTurn ? 'text-emerald-400' : 'text-slate-500'}>
            {game.isMyTurn ? '✅ Твій хід!' : '⏳ Хід суперника...'}
          </p>
        </div>
      )}

      {/* End turn */}
      <button
        onClick={onEndTurn}
        disabled={game.phase !== 'playing' || !game.isMyTurn}
        className={cx(
          'w-full py-3.5 rounded-2xl font-extrabold text-sm transition-all',
          game.phase === 'playing' && game.isMyTurn
            ? 'bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-500 hover:to-brand-600 text-white shadow-lg'
            : 'bg-slate-800 text-slate-600 cursor-not-allowed'
        )}>
        {game.isMyTurn ? '↩️ Завершити хід' : '⏳ Чекаємо...'}
      </button>

      {/* Legend */}
      <div className="bg-slate-900 rounded-2xl p-2.5 text-[9px] text-slate-500 border border-slate-700">
        <p className="font-bold text-slate-400 mb-1">📖 Підказка:</p>
        <p>• Клікни юніт → зелені hex = рух, червоні = атака</p>
        <p>• 🌾🪨⚙️💛 — ресурси на тайлах, зайди щоб зібрати</p>
        <p>• 💀 Варварські табори раз на 5 ходів спавнять варварів</p>
        <p>• Хід 22 — з'являється Boss 🌑 Темрява!</p>
        <p>• XP дає юнітам рівні (L2, L3) з бонусами</p>
      </div>
    </div>
  );
}
