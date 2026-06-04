import { useReducer, useRef, useState, useEffect, useCallback } from 'react';
import { Layout } from '../../components/Layout';
import { reducer, makeInitState } from './reducer';
import { useRenderer, useMinimap } from './renderer';
import { useMultiplayer } from './useMultiplayer';
import { autoSave } from './useSaveLoad';
import { hexToPixel, COLS, ROWS, HEX_SIZE, HW, HH } from './mapGen';
import { UNITS } from './units';
import type { CivId, FloatText, Phase, Action } from './types';
import { MainMenu } from './ui/MainMenu';
import { CivSelect } from './ui/CivSelect';
import { EventModal } from './ui/EventModal';
import { TechTree } from './ui/TechTree';
import { SaveLoadModal } from './ui/SaveLoadModal';
import { MultiplayerModal } from './ui/MultiplayerModal';
import { Sidebar } from './ui/Sidebar';
import api from '../../api/client';

// ── Canvas dimensions ─────────────────────────────────────────────────────────
const W = Math.ceil(HW * COLS + HEX_SIZE * 2.4);
const H = Math.ceil(HH * 0.75 * ROWS + HH * 0.75 + HEX_SIZE);

// ── End screen phase info ─────────────────────────────────────────────────────
const PHASE_INFO: Record<Exclude<Phase, 'playing' | 'menu' | 'civSelect' | 'eventPause'>, { icon: string; title: string; color: string }> = {
  won_knowledge: { icon: '📚', title: 'Перемога Знань!',    color: 'from-blue-900/50 to-blue-800/30 border-blue-500' },
  won_military:  { icon: '⚔️', title: 'Військова Перемога!', color: 'from-emerald-900/50 to-emerald-800/30 border-emerald-500' },
  won_survival:  { icon: '🛡️', title: 'Перемога Виживання!', color: 'from-amber-900/50 to-amber-800/30 border-amber-500' },
  lost:          { icon: '💀', title: 'Академія впала...',    color: 'from-rose-900/50 to-rose-800/30 border-rose-600' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function getHexAt(px: number, py: number): { col: number; row: number } | null {
  let best: { col: number; row: number } | null = null;
  let bestD = Infinity;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const { x, y } = hexToPixel(c, r);
      const d = Math.hypot(px - x, py - y);
      if (d < bestD) { bestD = d; best = { col: c, row: r }; }
    }
  }
  return bestD < HEX_SIZE + 4 ? best : null;
}

// ── Main Component ────────────────────────────────────────────────────────────
export function CivGamePage() {
  const [game, rawDispatch] = useReducer(reducer, undefined, makeInitState);
  const [floats, setFloats] = useState<FloatText[]>([]);
  const [hovered, setHovered] = useState<{ col: number; row: number } | null>(null);
  const [showTech, setShowTech] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [showMulti, setShowMulti] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [screen, setScreen] = useState<'menu' | 'civSelect' | 'game'>('menu');

  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const frameRef   = useRef(0);
  const animRef    = useRef<number>(0);

  // Dispatch with floating text side effects
  const dispatch = useCallback((action: Action) => {
    rawDispatch(action);
    // Floating damage/heal texts
    if (action.type === 'MOVE_OR_ATTACK') {
      const sel = game.units.find(u => u.id === game.selectedUnitId);
      const target = game.units.find(u => u.col === action.col && u.row === action.row);
      if (sel && target) {
        const { x, y } = hexToPixel(action.col, action.row);
        const dmg = UNITS[sel.type].attack;
        const newFloat: FloatText = { id: `f${Date.now()}`, x, y: y - 20, text: `-${dmg}`, color: '#ef4444', born: Date.now() };
        setFloats(prev => [...prev.filter(f => Date.now() - f.born < 1200), newFloat]);
      }
    }
  }, [game, rawDispatch]);

  // Animation loop
  useEffect(() => {
    const loop = () => {
      frameRef.current++;
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  // Clean up old floats
  useEffect(() => {
    const t = setInterval(() => setFloats(prev => prev.filter(f => Date.now() - f.born < 1300)), 200);
    return () => clearInterval(t);
  }, []);

  // Autosave on end turn
  useEffect(() => {
    if (game.phase === 'playing' && game.turn > 1) autoSave(game);
  }, [game.turn, game.phase]);

  // Award coins on win
  useEffect(() => {
    if (game.phase.startsWith('won')) {
      const coins = game.phase === 'won_knowledge' ? 200 : game.phase === 'won_military' ? 150 : 100;
      api.post('/gamification/award-coins', coins, { headers: { 'Content-Type': 'application/json' } }).catch(() => {});
    }
  }, [game.phase]);

  // Multiplayer
  const { submitTurn, sendChat } = useMultiplayer({ roomCode: game.roomCode, dispatch });

  // Canvas rendering
  useRenderer(canvasRef, game, hovered, floats, frameRef);
  useMinimap(minimapRef, game);

  // Click on canvas
  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const hex = getHexAt(e.clientX - rect.left, e.clientY - rect.top);
    if (!hex) return;
    const clickedUnit = game.units.find(u => u.col === hex.col && u.row === hex.row);
    if (clickedUnit?.owner === 'player') {
      dispatch({ type: 'SELECT_UNIT', id: clickedUnit.id });
    } else {
      dispatch({ type: 'MOVE_OR_ATTACK', ...hex });
    }
  }

  function handleEndTurn() {
    dispatch({ type: 'END_TURN' });
    if (game.roomCode) {
      submitTurn(JSON.stringify(game));
    }
  }

  function handleSendChat() {
    if (!chatInput.trim()) return;
    dispatch({ type: 'CHAT_RECEIVED', from: game.playerName, text: chatInput });
    sendChat(chatInput);
    setChatInput('');
  }

  // ── Screens ───────────────────────────────────────────────────────────────
  if (screen === 'menu') return (
    <MainMenu
      dispatch={dispatch}
      onNewGame={() => setScreen('civSelect')}
      onLoadGame={() => { setScreen('game'); setShowSave(true); }}
      onMultiplayer={() => { setScreen('game'); setShowMulti(true); }}
    />
  );

  if (screen === 'civSelect') return (
    <CivSelect
      dispatch={dispatch}
      onBack={() => setScreen('menu')}
      onStart={(civId: CivId, name: string) => {
        dispatch({ type: 'START_GAME', civId, playerName: name });
        setScreen('game');
      }}
    />
  );

  // ── Game screen ───────────────────────────────────────────────────────────
  const isEndPhase = game.phase !== 'playing' && game.phase !== 'menu' && game.phase !== 'civSelect' && game.phase !== 'eventPause';
  const phaseInfo = isEndPhase ? PHASE_INFO[game.phase as keyof typeof PHASE_INFO] : null;

  return (
    <Layout title="Академія Знань" subtitle="Hex-стратегія · Захищай знання від темряви та варварів">
      {/* Modals */}
      {game.phase === 'eventPause' && <EventModal game={game} dispatch={dispatch} />}
      {showTech && <TechTree game={game} dispatch={dispatch} onClose={() => setShowTech(false)} />}
      {showSave && <SaveLoadModal game={game} dispatch={dispatch} onClose={() => setShowSave(false)} />}
      {showMulti && (
        <MultiplayerModal
          game={game}
          dispatch={dispatch}
          onClose={() => setShowMulti(false)}
          onJoinedRoom={(code, role) => {
            rawDispatch({ type: 'CHAT_RECEIVED', from: 'Система', text: `Ти в кімнаті ${code} як ${role === 'host' ? 'господар' : 'гість'}` });
            setShowMulti(false);
          }}
        />
      )}

      {/* End phase banner */}
      {phaseInfo && (
        <div className={`mb-4 p-5 rounded-2xl text-center border-2 bg-gradient-to-br ${phaseInfo.color}`}>
          <p className="text-5xl mb-2">{phaseInfo.icon}</p>
          <p className="font-extrabold text-xl text-white">{phaseInfo.title}</p>
          <p className="text-slate-400 mt-1 text-sm">📚 {game.knowledge} | ⚡ {game.energy} | 💡 {game.inspiration} | 🪙 {game.coins}</p>
          <div className="flex gap-2 justify-center mt-4">
            <button onClick={() => dispatch({ type: 'RESTART' })} className="btn btn-soft px-6">🔄 Нова гра</button>
            <button onClick={() => setScreen('menu')} className="btn btn-primary px-6">🏠 Головне меню</button>
          </div>
        </div>
      )}

      {/* Resource bar */}
      <div className="flex flex-wrap items-center gap-4 mb-3 bg-slate-900 text-white rounded-2xl px-5 py-3 border border-slate-800">
        {[
          { icon: '📚', val: game.knowledge, rate: game.kPerTurn, label: 'Знання', color: 'text-blue-400' },
          { icon: '⚡', val: game.energy,     rate: game.ePerTurn, label: 'Енергія', color: 'text-emerald-400' },
          { icon: '💡', val: game.inspiration, rate: game.iPerTurn, label: 'Натхнення', color: 'text-purple-400' },
          { icon: '🪙', val: game.coins, rate: game.coinsPerTurn, label: 'Монети', color: 'text-amber-400' },
        ].map(r => (
          <div key={r.label} className="flex items-center gap-1.5">
            <span className="text-lg">{r.icon}</span>
            <span className="font-bold text-white">{r.val}</span>
            {r.rate > 0 && <span className={`text-xs ${r.color}`}>+{r.rate}/хід</span>}
          </div>
        ))}
        <div className="ml-auto flex items-center gap-3">
          {game.roomCode && (
            <span className={`text-xs font-bold px-2 py-1 rounded-lg ${game.isMyTurn ? 'bg-emerald-900/50 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
              {game.isMyTurn ? '✅ Твій хід' : '⏳ Суперник...'}
            </span>
          )}
          <span className="text-slate-400 text-sm">Хід <span className="font-extrabold text-amber-400">{game.turn}</span>/{game.maxTurns}</span>
        </div>
      </div>

      {/* Game area */}
      <div className="flex gap-3 flex-col xl:flex-row">
        {/* Canvas + minimap wrapper */}
        <div className="flex flex-col gap-2 flex-shrink-0">
          <div className="overflow-x-auto rounded-2xl border border-slate-700 shadow-2xl shadow-slate-950">
            <canvas
              ref={canvasRef}
              width={W}
              height={H}
              onClick={handleClick}
              onMouseMove={e => {
                const rect = canvasRef.current!.getBoundingClientRect();
                setHovered(getHexAt(e.clientX - rect.left, e.clientY - rect.top));
              }}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'crosshair', display: 'block' }}
            />
          </div>

          {/* Mini-map */}
          <div className="rounded-xl border border-slate-700 overflow-hidden self-start">
            <p className="text-[9px] text-slate-500 px-2 pt-1 font-bold uppercase">Мінікарта</p>
            <canvas ref={minimapRef} width={192} height={80} style={{ display: 'block', imageRendering: 'pixelated' }} />
          </div>

          {/* Hovered cell info */}
          {hovered && game.grid[hovered.row]?.[hovered.col]?.explored && (() => {
            const cell = game.grid[hovered.row][hovered.col];
            const unitOnCell = game.units.find(u => u.col === hovered.col && u.row === hovered.row);
            return (
              <div className="bg-slate-900/90 rounded-xl px-3 py-2 text-[10px] text-slate-300 border border-slate-700 backdrop-blur-sm">
                <span className="font-bold text-white mr-2">{cell.terrain}</span>
                {cell.resource && <span className="text-amber-400 mr-2">Ресурс: {cell.resource}</span>}
                {unitOnCell && <span className="text-blue-400">{UNITS[unitOnCell.type].icon} {UNITS[unitOnCell.type].label} HP:{unitOnCell.hp}/{unitOnCell.maxHp}</span>}
              </div>
            );
          })()}
        </div>

        {/* Sidebar */}
        <Sidebar
          game={game}
          dispatch={dispatch}
          onShowTech={() => setShowTech(true)}
          onShowSave={() => setShowSave(true)}
          onEndTurn={handleEndTurn}
          chatInput={chatInput}
          setChatInput={setChatInput}
          onSendChat={handleSendChat}
        />
      </div>
    </Layout>
  );
}
