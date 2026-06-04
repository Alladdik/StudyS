import { motion } from 'framer-motion';
import type { GameState, Action } from '../types';

interface Props {
  game: GameState;
  dispatch: React.Dispatch<Action>;
}

export function EventModal({ game, dispatch }: Props) {
  const ev = game.currentEvent;
  if (!ev) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className={`bg-slate-900 text-white rounded-2xl w-full max-w-lg p-7 border-2 ${ev.good ? 'border-amber-500' : 'border-rose-600'}`}
      >
        {/* Header */}
        <div className="flex items-center gap-4 mb-5">
          <span className="text-5xl">{ev.icon}</span>
          <div>
            <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${ev.good ? 'text-amber-400' : 'text-rose-400'}`}>
              {ev.good ? '✨ Позитивна подія' : '⚠️ Несподіванка'}
            </p>
            <h2 className="text-xl font-extrabold text-white">{ev.title}</h2>
          </div>
        </div>

        {/* Description */}
        <p className="text-slate-300 text-sm leading-relaxed mb-7 pl-1">{ev.desc}</p>

        {/* Choices */}
        <div className="flex flex-col gap-3">
          {ev.choices.map((choice, idx) => (
            <button
              key={idx}
              onClick={() => dispatch({ type: 'CHOOSE_EVENT', choiceIdx: idx as 0 | 1 })}
              className={`w-full text-left p-4 rounded-xl border transition-all hover:scale-[1.02] ${
                idx === 0
                  ? 'bg-brand-900/30 border-brand-600 hover:bg-brand-800/40'
                  : 'bg-slate-800/50 border-slate-600 hover:bg-slate-700/50'
              }`}
            >
              <p className="font-bold text-white text-sm mb-1">{choice.label}</p>
              <p className="text-slate-400 text-xs">{choice.desc}</p>
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
