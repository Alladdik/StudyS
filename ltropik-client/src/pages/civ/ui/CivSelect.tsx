import { useState } from 'react';
import { CIVS } from '../civs';
import type { CivId, Action } from '../types';

interface Props {
  onStart: (civId: CivId, name: string) => void;
  onBack: () => void;
  dispatch: React.Dispatch<Action>;
}

export function CivSelect({ onStart, onBack }: Props) {
  const [selected, setSelected] = useState<CivId | null>(null);
  const [name, setName] = useState('');

  const civList = Object.values(CIVS);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-3xl">
        <button onClick={onBack} className="text-slate-400 hover:text-white text-sm mb-6 flex items-center gap-1 transition">
          ← Назад
        </button>

        <h2 className="text-3xl font-extrabold text-white mb-2 text-center">Обери цивілізацію</h2>
        <p className="text-slate-400 text-center mb-8 text-sm">Кожна цивілізація має унікальні переваги та стиль гри</p>

        {/* Civ cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {civList.map(civ => (
            <button
              key={civ.id}
              onClick={() => setSelected(civ.id)}
              className={`text-left p-5 rounded-2xl border-2 transition-all ${
                selected === civ.id
                  ? 'border-amber-400 bg-amber-900/20 shadow-lg shadow-amber-900/30'
                  : 'border-slate-700 bg-slate-800/50 hover:border-slate-500'
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-4xl">{civ.icon}</span>
                <div>
                  <p className="font-extrabold text-white text-lg">{civ.name}</p>
                  <div className="flex gap-1 mt-1">
                    {civ.kBonus > 0 && <span className="text-[10px] bg-blue-900/40 text-blue-400 px-1.5 py-0.5 rounded-md">+{civ.kBonus}📚</span>}
                    {civ.eBonus > 0 && <span className="text-[10px] bg-emerald-900/40 text-emerald-400 px-1.5 py-0.5 rounded-md">+{civ.eBonus}⚡</span>}
                    {civ.iBonus > 0 && <span className="text-[10px] bg-purple-900/40 text-purple-400 px-1.5 py-0.5 rounded-md">+{civ.iBonus}💡</span>}
                    {civ.coinsBonus > 0 && <span className="text-[10px] bg-amber-900/40 text-amber-400 px-1.5 py-0.5 rounded-md">+{civ.coinsBonus}🪙</span>}
                  </div>
                </div>
                {selected === civ.id && <span className="ml-auto text-amber-400 text-xl">✓</span>}
              </div>
              <p className="text-slate-400 text-xs mb-2">{civ.description}</p>
              <p className="text-amber-300 text-xs font-semibold">⭐ {civ.bonus}</p>
            </button>
          ))}
        </div>

        {/* Player name */}
        {selected && (
          <div className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700 mb-6">
            <label className="text-slate-300 text-sm font-semibold block mb-2">Твоє ім'я (необов'язково)</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={CIVS[selected].name + ' Правитель'}
              className="w-full bg-slate-900 border border-slate-600 text-white rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-brand-500"
              maxLength={30}
            />
          </div>
        )}

        {/* Start button */}
        <button
          onClick={() => selected && onStart(selected, name.trim() || (CIVS[selected].name + ' Правитель'))}
          disabled={!selected}
          className={`w-full py-4 rounded-2xl font-extrabold text-lg transition-all ${
            selected
              ? 'bg-gradient-to-r from-brand-600 to-brand-700 text-white hover:from-brand-500 hover:to-brand-600 shadow-lg shadow-brand-900/50'
              : 'bg-slate-700 text-slate-500 cursor-not-allowed'
          }`}
        >
          {selected ? `🚀 Розпочати з ${CIVS[selected].name}` : 'Обери цивілізацію'}
        </button>
      </div>
    </div>
  );
}
