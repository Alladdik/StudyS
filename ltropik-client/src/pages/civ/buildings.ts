import type { BuildingId } from './types';

export interface BuildingDef {
  icon: string;
  label: string;
  cost: number;
  desc: string;
  requires?: BuildingId[];
  kPerTurn?: number;
  ePerTurn?: number;
  iPerTurn?: number;
  coinsPerTurn?: number;
  unitHpBonus?: number;
  fogRadius?: number;
  isWonder?: boolean;
  isVictory?: boolean;
}

export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  // ── Core ───────────────────────────────────────────────────────────────────
  school:       { icon: '🏫', label: 'Школа',              cost: 0,   desc: '+2📚/хід (стартова)',                                 kPerTurn: 2 },
  library:      { icon: '📖', label: 'Бібліотека',         cost: 30,  desc: '+4📚/хід, відкриває дослідження T2',                  kPerTurn: 4,   requires: ['school'] },
  cafeteria:    { icon: '🍎', label: 'Їдальня',            cost: 20,  desc: '+3⚡/хід, юніти +10% HP',                            ePerTurn: 3,   requires: ['school'] },
  training:     { icon: '🏋️', label: 'Тренувальний майд.',  cost: 25,  desc: '+2⚡/хід, виробн. юнітів -1 хід',                   ePerTurn: 2,   requires: ['school'] },
  lab:          { icon: '🔬', label: 'Лабораторія',        cost: 50,  desc: '+3💡/хід, відкриває Innovation T3',                  iPerTurn: 3,   requires: ['library'] },
  theater:      { icon: '🎭', label: 'Театр',              cost: 35,  desc: '+2💡/хід, більше позитивних подій',                  iPerTurn: 2,   requires: ['cafeteria'] },
  observatory:  { icon: '🔭', label: 'Обсерваторія',       cost: 40,  desc: 'Fog of War: +3 радіус всім юнітам',                  fogRadius: 3,  requires: ['library'] },
  gym:          { icon: '💪', label: 'Спортзал',           cost: 30,  desc: 'Воїни та Кавалерія +30% HP',                        unitHpBonus: 30, requires: ['training'] },
  market:       { icon: '🛒', label: 'Ринок',              cost: 25,  desc: '+3🪙/хід, відкриває Commerce T2',                   coinsPerTurn: 3, requires: ['school'] },
  watchtower:   { icon: '🗼', label: 'Вежа Спостереження', cost: 20,  desc: 'Видно варварські табори з будь-якої точки',          fogRadius: 2,  requires: ['training'] },
  // ── Endgame ────────────────────────────────────────────────────────────────
  greatHall:    { icon: '🏛️', label: 'Велика Зала',        cost: 80,  desc: '+25% до всіх ресурсів',                             requires: ['library', 'cafeteria', 'theater'] },
  knowledgeNet: { icon: '🌐', label: 'Мережа Знань',       cost: 100, desc: '🏆 Умова перемоги — Knowledge Victory',              isVictory: true, requires: ['greatHall', 'lab'] },
  // ── Wonders (one-time, world) ───────────────────────────────────────────────
  wonder_wall:      { icon: '🧱', label: '✨ Велика Стіна',       cost: 60,  desc: 'ЧУДО: Всі юніти +30% до захисту, ще +2 HP відновлення', isWonder: true, requires: ['gym'] },
  wonder_colosseum: { icon: '🏟️', label: '✨ Колізей',            cost: 70,  desc: 'ЧУДО: +8⚡/хід, всі юніти +20% атаки',                   isWonder: true, ePerTurn: 8, requires: ['theater'] },
  wonder_oracle:    { icon: '🔮', label: '✨ Оракул',              cost: 80,  desc: 'ЧУДО: +5💡/хід, видно всі варварські табори, +2 підказки', isWonder: true, iPerTurn: 5, requires: ['observatory', 'lab'] },
};

export function computePerTurn(
  buildings: BuildingId[],
  greatHallBonus: boolean,
  allResBonus: number,
): { kPerTurn: number; ePerTurn: number; iPerTurn: number; coinsPerTurn: number } {
  let k = 0, e = 0, i = 0, c = 0;
  for (const bid of buildings) {
    const d = BUILDINGS[bid];
    k += d.kPerTurn ?? 0;
    e += d.ePerTurn ?? 0;
    i += d.iPerTurn ?? 0;
    c += d.coinsPerTurn ?? 0;
  }
  const pct = 1 + (allResBonus + (greatHallBonus ? 25 : 0)) / 100;
  return {
    kPerTurn: Math.round(k * pct),
    ePerTurn: Math.round(e * pct),
    iPerTurn: Math.round(i * pct),
    coinsPerTurn: Math.round(c * pct),
  };
}
