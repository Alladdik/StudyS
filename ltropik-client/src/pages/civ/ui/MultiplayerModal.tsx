import { useState } from 'react';
import { createRoom, joinRoom, setReady } from '../useMultiplayer';
import { CIVS } from '../civs';
import type { CivId, GameState, Action } from '../types';

interface Props {
  game: GameState;
  dispatch: React.Dispatch<Action>;
  onClose: () => void;
  onJoinedRoom: (code: string, role: 'host' | 'guest') => void;
}

export function MultiplayerModal({ game, dispatch, onClose, onJoinedRoom }: Props) {
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [code, setCode] = useState('');
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [role, setRole] = useState<'host' | 'guest' | null>(null);
  const [selectedCiv, setSelectedCiv] = useState<CivId>('academy');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [readySent, setReadySent] = useState(false);
  const [chatInput, setChatInput] = useState('');

  async function handleCreate() {
    setLoading(true); setError('');
    try {
      const code = await createRoom();
      setRoomCode(code);
      setRole('host');
    } catch { setError('Помилка створення кімнати'); }
    finally { setLoading(false); }
  }

  async function handleJoin() {
    if (!code.trim()) return;
    setLoading(true); setError('');
    try {
      await joinRoom(code.trim().toUpperCase());
      setRoomCode(code.trim().toUpperCase());
      setRole('guest');
    } catch { setError('Кімнату не знайдено або вона зайнята'); }
    finally { setLoading(false); }
  }

  async function handleReady() {
    if (!roomCode) return;
    setLoading(true);
    try {
      await setReady(roomCode, selectedCiv);
      setReadySent(true);
      onJoinedRoom(roomCode, role!);
    } catch { setError('Помилка'); }
    finally { setLoading(false); }
  }

  const chatMsgs = game.chatMessages;

  // Stage 1: Choose create/join
  if (!roomCode) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 text-white rounded-2xl w-full max-w-md p-6 border border-slate-700">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-extrabold">👥 Мультиплеєр</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-400 transition">✕</button>
        </div>

        <div className="flex gap-2 mb-5">
          {(['create', 'join'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${tab === t ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
              {t === 'create' ? '🏠 Створити кімнату' : '🚪 Приєднатися'}
            </button>
          ))}
        </div>

        {tab === 'create' && (
          <div>
            <p className="text-slate-400 text-sm mb-4">Створи кімнату та поділися кодом із другом. Він введе код і ви можете почати гру.</p>
            <button onClick={handleCreate} disabled={loading} className="w-full py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-bold transition disabled:opacity-50">
              {loading ? 'Створюємо...' : '🏠 Створити кімнату'}
            </button>
          </div>
        )}

        {tab === 'join' && (
          <div>
            <p className="text-slate-400 text-sm mb-3">Введи 6-значний код кімнати від друга:</p>
            <input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="ABCD12"
              maxLength={6}
              className="w-full bg-slate-800 border border-slate-600 text-white rounded-xl px-4 py-3 text-center font-mono text-xl tracking-widest focus:outline-none focus:border-brand-500 mb-3"
            />
            <button onClick={handleJoin} disabled={loading || code.length < 6} className="w-full py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-bold transition disabled:opacity-50">
              {loading ? 'Приєднуємося...' : '🚪 Приєднатися'}
            </button>
          </div>
        )}

        {error && <p className="mt-3 text-rose-400 text-sm text-center">{error}</p>}
      </div>
    </div>
  );

  // Stage 2: Lobby — choose civ, wait for ready
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 text-white rounded-2xl w-full max-w-md p-6 border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-extrabold">🎮 Лобі</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-400 transition">✕</button>
        </div>

        {/* Room code */}
        <div className="bg-slate-800 rounded-xl p-3 mb-4 flex items-center justify-between">
          <span className="text-slate-400 text-sm">Код кімнати:</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xl text-amber-400 font-bold">{roomCode}</span>
            <button onClick={() => navigator.clipboard.writeText(roomCode!)} className="text-xs text-slate-400 hover:text-white bg-slate-700 px-2 py-1 rounded-lg transition">📋 Копіювати</button>
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2 mb-4">
          <span className={`w-2.5 h-2.5 rounded-full ${role === 'host' ? 'bg-blue-400' : 'bg-emerald-400'}`} />
          <span className="text-sm text-slate-300">Ти: {role === 'host' ? '🏠 Господар' : '🚪 Гість'}</span>
        </div>

        {/* Civ select (mini) */}
        {!readySent && (
          <>
            <p className="text-slate-400 text-xs font-bold uppercase mb-2">Твоя цивілізація:</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {Object.values(CIVS).map(civ => (
                <button key={civ.id} onClick={() => setSelectedCiv(civ.id)} className={`p-2.5 rounded-xl border text-sm transition ${selectedCiv === civ.id ? 'border-amber-400 bg-amber-900/20' : 'border-slate-700 bg-slate-800/50 hover:border-slate-500'}`}>
                  <span className="text-2xl">{civ.icon}</span>
                  <p className="font-bold text-xs mt-1">{civ.name}</p>
                </button>
              ))}
            </div>
            <button onClick={handleReady} disabled={loading} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition disabled:opacity-50 mb-4">
              {loading ? 'Відправляємо...' : '✅ Готовий до гри!'}
            </button>
          </>
        )}

        {readySent && (
          <div className="bg-emerald-900/30 border border-emerald-600 rounded-xl p-3 mb-4 text-center">
            <p className="text-emerald-400 font-bold">✅ Ти готовий!</p>
            <p className="text-slate-400 text-xs mt-1">Чекаємо на іншого гравця...</p>
            <div className="mt-2 flex gap-1 justify-center">
              {[0,1,2].map(i => (
                <div key={i} className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          </div>
        )}

        {/* Chat */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
          <div className="h-24 overflow-y-auto p-2 flex flex-col gap-1">
            {chatMsgs.length === 0 && <p className="text-slate-600 text-xs text-center mt-3">Немає повідомлень</p>}
            {chatMsgs.map((m, i) => (
              <p key={i} className="text-xs"><span className="text-slate-400">{m.from}:</span> <span className="text-white">{m.text}</span></p>
            ))}
          </div>
          <div className="flex border-t border-slate-700">
            <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && chatInput.trim()) { dispatch({ type: 'CHAT_RECEIVED', from: 'Ти', text: chatInput }); setChatInput(''); }}} placeholder="Повідомлення..." className="flex-1 bg-transparent text-white text-xs px-3 py-2 focus:outline-none placeholder-slate-600" />
          </div>
        </div>

        {error && <p className="mt-3 text-rose-400 text-sm text-center">{error}</p>}
      </div>
    </div>
  );
}
