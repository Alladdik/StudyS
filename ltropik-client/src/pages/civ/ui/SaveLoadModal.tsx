import { useState } from 'react';
import { listSaves, saveGame, loadGame, deleteSave } from '../useSaveLoad';
import type { GameState, Action } from '../types';
import { CIVS } from '../civs';

interface Props {
  game: GameState;
  dispatch: React.Dispatch<Action>;
  onClose: () => void;
}

export function SaveLoadModal({ game, dispatch, onClose }: Props) {
  const [saves, setSaves] = useState(listSaves);
  const [msg, setMsg] = useState('');

  function refresh() { setSaves(listSaves()); }

  function doSave(slot: number) {
    saveGame(game, slot);
    refresh();
    setMsg(`✅ Збережено у слот ${slot}`);
    setTimeout(() => setMsg(''), 2000);
  }

  function doLoad(slot: number) {
    const s = loadGame(slot);
    if (!s) { setMsg('❌ Помилка завантаження'); return; }
    dispatch({ type: 'LOAD_STATE', state: s });
    onClose();
  }

  function doDelete(slot: number) {
    deleteSave(slot);
    refresh();
    setMsg('🗑️ Видалено');
    setTimeout(() => setMsg(''), 1500);
  }

  const slots = [1, 2, 3];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 text-white rounded-2xl w-full max-w-md p-6 border border-slate-700">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-extrabold">💾 Збереження</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-400 transition">✕</button>
        </div>

        {msg && <div className="mb-4 text-sm text-center text-amber-300 bg-amber-900/20 rounded-xl py-2">{msg}</div>}

        {/* Autosave */}
        {(() => {
          const auto = saves.find(s => s.slot === 0);
          return auto ? (
            <div className="mb-4 p-3 bg-slate-800/50 rounded-xl border border-slate-700 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase">Автозбереження</p>
                <p className="text-sm text-white">{CIVS[auto.civId]?.name ?? auto.civId} · Хід {auto.turn}</p>
                <p className="text-xs text-slate-500">{auto.savedAt}</p>
              </div>
              <button onClick={() => doLoad(0)} className="text-xs bg-blue-700 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg transition">Завантажити</button>
            </div>
          ) : null;
        })()}

        {/* Manual slots */}
        <div className="flex flex-col gap-3">
          {slots.map(slot => {
            const save = saves.find(s => s.slot === slot);
            return (
              <div key={slot} className="p-3 bg-slate-800/40 rounded-xl border border-slate-700 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-400 uppercase mb-0.5">Слот {slot}</p>
                  {save ? (
                    <>
                      <p className="text-sm text-white font-semibold">{CIVS[save.civId]?.name ?? save.civId} · Хід {save.turn}</p>
                      <p className="text-xs text-slate-500">{save.savedAt}</p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-500 italic">Порожній слот</p>
                  )}
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button onClick={() => doSave(slot)} className="text-xs bg-emerald-700 hover:bg-emerald-600 text-white px-2.5 py-1.5 rounded-lg transition">Зберегти</button>
                  {save && <button onClick={() => doLoad(slot)} className="text-xs bg-blue-700 hover:bg-blue-600 text-white px-2.5 py-1.5 rounded-lg transition">Завантажити</button>}
                  {save && <button onClick={() => doDelete(slot)} className="text-xs bg-rose-800 hover:bg-rose-700 text-white px-2 py-1.5 rounded-lg transition">🗑️</button>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
