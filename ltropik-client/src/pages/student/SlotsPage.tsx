import { useEffect, useRef, useState } from 'react';
import { Layout } from '../../components/Layout';
import { getProgress } from '../../api/gamification';
import api from '../../api/client';
import { cx } from '../../components/ui';

const SYMBOLS = [
  { icon: '📚', label: 'Книга',   weight: 30 },
  { icon: '🎯', label: 'Ціль',    weight: 25 },
  { icon: '💡', label: 'Ідея',    weight: 20 },
  { icon: '⭐', label: 'Зірка',   weight: 15 },
  { icon: '🏆', label: 'Кубок',   weight: 7  },
  { icon: '💎', label: 'Діамант', weight: 3  },
];

const PAYOUTS: Record<string, number> = {
  '💎💎💎': 500,
  '🏆🏆🏆': 200,
  '⭐⭐⭐': 80,
  '💡💡💡': 50,
  '🎯🎯🎯': 30,
  '📚📚📚': 20,
};

const SPIN_COST = 10;
const REEL_COUNT = 3;
const VISIBLE = 3; // symbols per reel visible

function weightedRandom(): string {
  const total = SYMBOLS.reduce((s, sym) => s + sym.weight, 0);
  let r = Math.random() * total;
  for (const sym of SYMBOLS) {
    r -= sym.weight;
    if (r <= 0) return sym.icon;
  }
  return SYMBOLS[0].icon;
}

function calcPayout(reels: string[][]): { multiplier: number; label: string } {
  const middle = reels.map(r => r[1]); // middle row
  const key = middle.join('');
  if (PAYOUTS[key]) return { multiplier: PAYOUTS[key], label: `ДЖЕКПОТ! ${key}` };

  // Two matching
  if (middle[0] === middle[1] || middle[1] === middle[2] || middle[0] === middle[2]) {
    return { multiplier: 5, label: '🎉 Два однакових!' };
  }
  return { multiplier: 0, label: '' };
}

export function SlotsPage() {
  const [coins, setCoins]       = useState(0);
  const [reels, setReels]       = useState<string[][]>(
    () => Array.from({ length: REEL_COUNT }, () => Array.from({ length: VISIBLE }, () => weightedRandom()))
  );
  const [spinning, setSpinning] = useState(false);
  const [result, setResult]     = useState<{ multiplier: number; label: string } | null>(null);
  const [history, setHistory]   = useState<{ result: string; coins: number }[]>([]);
  const [flashWin, setFlashWin] = useState(false);
  const spinRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getProgress().then(r => setCoins(r.data.totalCoins));
  }, []);

  async function spin() {
    if (spinning || coins < SPIN_COST) return;
    setSpinning(true);
    setResult(null);

    // Deduct coins — wrap in try/catch so spinning never gets stuck
    try {
      await api.post('/gamification/spend-coins', SPIN_COST);
      setCoins(c => c - SPIN_COST);
    } catch {
      setSpinning(false);
      return; // не запускаємо анімацію якщо оплата не пройшла
    }

    const DURATION = 1200;
    const INTERVAL = 60;
    const start = Date.now();

    const finalReels = Array.from({ length: REEL_COUNT }, () =>
      Array.from({ length: VISIBLE }, () => weightedRandom())
    );

    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = elapsed / DURATION;

      setReels(prev => prev.map((_reel, i) => {
        if (progress > (i + 1) / (REEL_COUNT + 1)) return finalReels[i];
        return Array.from({ length: VISIBLE }, () => weightedRandom());
      }));

      if (elapsed < DURATION) {
        spinRef.current = setTimeout(tick, INTERVAL);
      } else {
        setReels(finalReels);
        const outcome = calcPayout(finalReels);
        setResult(outcome);
        setSpinning(false);

        if (outcome.multiplier > 0) {
          setFlashWin(true);
          setTimeout(() => setFlashWin(false), 1500);
          // Award coins — оновлюємо UI лише після підтвердження сервера
          api.post<{ totalCoins: number }>('/gamification/award-coins', outcome.multiplier)
            .then(r => setCoins(r.data.totalCoins))  // використовуємо реальне значення з сервера
            .catch(() => {});
          setHistory(h => [{ result: outcome.label, coins: outcome.multiplier }, ...h.slice(0, 9)]);
        } else {
          setHistory(h => [{ result: 'Немає збігів', coins: 0 }, ...h.slice(0, 9)]);
        }
      }
    };

    tick();
  }

  // Cleanup
  useEffect(() => () => { if (spinRef.current) clearTimeout(spinRef.current); }, []);

  return (
    <Layout title="Слот-машина" subtitle="Витрачай монети — може пощастить!">
      <div className="max-w-lg mx-auto">

        {/* Coins balance */}
        <div className="flex items-center justify-between mb-6 p-4 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-2xl">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🪙</span>
            <div>
              <p className="text-2xl font-extrabold text-amber-800">{coins}</p>
              <p className="text-sm text-amber-600">монет</p>
            </div>
          </div>
          <p className="text-sm text-ink-500">Спін коштує <strong>{SPIN_COST}🪙</strong></p>
        </div>

        {/* Machine */}
        <div className={cx(
          'bg-gradient-to-b from-[#1a1040] to-[#0d0820] rounded-3xl p-6 shadow-2xl border-2 transition-all duration-300',
          flashWin ? 'border-amber-400 shadow-amber-500/40' : 'border-purple-900'
        )}>
          {/* Lights */}
          <div className="flex justify-center gap-2 mb-4">
            {['🔴', '🟡', '🟢', '🔵', '🟣', '🟠', '🔴', '🟡', '🟢'].map((c, i) => (
              <span key={i} className={cx('text-xs transition-opacity', spinning && i % 2 === 0 ? 'opacity-100' : 'opacity-40')}>{c}</span>
            ))}
          </div>

          {/* Title */}
          <div className="text-center mb-4">
            <p className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-500">
              🎰 АКАДЕМІЯ ФОРТУНИ
            </p>
          </div>

          {/* Reels */}
          <div className="flex gap-3 justify-center mb-6">
            {reels.map((reel, ri) => (
              <div key={ri}
                className="w-24 bg-white/5 border border-white/10 rounded-2xl overflow-hidden"
                style={{ height: `${VISIBLE * 72}px` }}>
                {reel.map((sym, si) => (
                  <div key={si}
                    className={cx(
                      'h-[72px] flex items-center justify-center text-4xl transition-all',
                      si === 1 && 'bg-white/10' // highlight middle row
                    )}>
                    {sym}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Middle line indicator */}
          <div className="flex items-center gap-2 mb-4 px-2">
            <div className="h-0.5 flex-1 bg-amber-400/50 rounded" />
            <span className="text-xs text-amber-400 font-bold">ВИГРАШНА ЛІНІЯ</span>
            <div className="h-0.5 flex-1 bg-amber-400/50 rounded" />
          </div>

          {/* Result */}
          <div className="text-center h-10 mb-4">
            {result && (
              <p className={cx(
                'text-lg font-extrabold transition-all',
                result.multiplier > 0 ? 'text-amber-300 animate-bounce' : 'text-white/40'
              )}>
                {result.multiplier > 0 ? `${result.label} +${result.multiplier}🪙` : 'Спробуй ще!'}
              </p>
            )}
          </div>

          {/* Spin button */}
          <button
            onClick={spin}
            disabled={spinning || coins < SPIN_COST}
            className={cx(
              'w-full py-4 rounded-2xl font-extrabold text-lg transition-all transform',
              spinning || coins < SPIN_COST
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-amber-400 to-yellow-500 text-amber-900 hover:from-amber-300 hover:to-yellow-400 active:scale-95 shadow-lg shadow-amber-500/30'
            )}>
            {spinning ? '🎰 Крутиться…' : coins < SPIN_COST ? '❌ Мало монет' : `🎰 КРУТИТИ (-${SPIN_COST}🪙)`}
          </button>
        </div>

        {/* Payout table */}
        <div className="mt-5 bg-white border border-ink-100 rounded-2xl p-4">
          <p className="font-bold text-ink-700 text-sm mb-3">💰 Таблиця виплат</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {Object.entries(PAYOUTS).map(([combo, payout]) => (
              <div key={combo} className="flex items-center justify-between bg-ink-50 rounded-xl px-3 py-2">
                <span className="text-lg">{combo}</span>
                <span className="font-extrabold text-amber-600">+{payout}🪙</span>
              </div>
            ))}
            <div className="flex items-center justify-between bg-ink-50 rounded-xl px-3 py-2">
              <span>Два однакових</span>
              <span className="font-extrabold text-amber-600">+5🪙</span>
            </div>
          </div>
        </div>

        {/* History */}
        {history.length > 0 && (
          <div className="mt-4 bg-white border border-ink-100 rounded-2xl p-4">
            <p className="font-bold text-ink-700 text-sm mb-3">📜 Остання гра</p>
            <div className="flex flex-col gap-1.5">
              {history.map((h, i) => (
                <div key={i} className={cx(
                  'flex justify-between text-xs px-3 py-1.5 rounded-xl',
                  h.coins > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-ink-50 text-ink-400'
                )}>
                  <span>{h.result}</span>
                  {h.coins > 0 && <span className="font-bold">+{h.coins}🪙</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
