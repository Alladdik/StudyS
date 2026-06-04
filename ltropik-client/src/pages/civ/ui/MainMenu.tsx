import { useState } from 'react';
import type { Action } from '../types';
import { listSaves } from '../useSaveLoad';

interface Props {
  dispatch: React.Dispatch<Action>;
  onNewGame: () => void;
  onLoadGame: () => void;
  onMultiplayer: () => void;
}

export function MainMenu({ onNewGame, onLoadGame, onMultiplayer }: Props) {
  const saves = listSaves().filter(s => s.slot !== 0);
  const autosave = listSaves().find(s => s.slot === 0);
  const [hovered, setHovered] = useState<string | null>(null);

  const btn = (label: string, key: string, onClick: () => void, sub?: string) => (
    <button
      key={key}
      onClick={onClick}
      onMouseEnter={() => setHovered(key)}
      onMouseLeave={() => setHovered(null)}
      className={`w-full text-left px-6 py-4 rounded-2xl border transition-all duration-200 ${
        hovered === key
          ? 'bg-brand-600 border-brand-500 text-white shadow-lg scale-[1.02]'
          : 'bg-slate-800/60 border-slate-700 text-slate-200 hover:bg-slate-700/60'
      }`}
    >
      <p className="font-bold text-base">{label}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </button>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Title */}
        <div className="text-center mb-10">
          <div className="text-7xl mb-4">🏛️</div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">Академія Знань</h1>
          <p className="text-slate-400 mt-2">Hex-стратегія · Захищай знання від темряви</p>
        </div>

        {/* Menu buttons */}
        <div className="flex flex-col gap-3">
          {btn('🎮 Нова гра', 'new', onNewGame, 'Обери цивілізацію та почни з нуля')}
          {(saves.length > 0 || autosave) && btn('📂 Завантажити', 'load', onLoadGame, `${saves.length} збережень${autosave ? ' + автозбереження' : ''}`)}
          {btn('👥 Мультиплеєр', 'multi', onMultiplayer, 'Грай з друзями онлайн через код кімнати')}
        </div>

        {/* Lore */}
        <div className="mt-10 p-4 bg-slate-800/40 rounded-2xl border border-slate-700/50 text-xs text-slate-500 text-center leading-relaxed">
          <p>Варвари нападають. Темрява наступає. Лише знання може врятувати академію.</p>
          <p className="mt-1">Обери цивілізацію, досліджуй технології, відбивай хвилі ворогів.</p>
        </div>
      </div>
    </div>
  );
}
