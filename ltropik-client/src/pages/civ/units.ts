import type { UnitType, UnitOwner } from './types';

export interface UnitDef {
  icon: string;
  label: string;
  maxHp: number;
  maxMoves: number;
  attack: number;
  range: number;
  trainCost: number;       // knowledge
  trainEnergy: number;
  trainTurns: number;
  owner: UnitOwner;
  special?: 'heal' | 'block' | 'aoe' | 'distract' | 'dodge' | 'regen' | 'settle' | 'negotiate' | 'siege';
  desc: string;
}

export const UNITS: Record<UnitType, UnitDef> = {
  // ── Player units ───────────────────────────────────────────────────────────
  warrior:       { icon: '⚔️', label: 'Воїн',           maxHp: 20, maxMoves: 2, attack: 8,  range: 1, trainCost: 10, trainEnergy: 15, trainTurns: 2, owner: 'player', desc: 'Базовий бойовий юніт' },
  scholar:       { icon: '📚', label: 'Вчений',          maxHp: 10, maxMoves: 3, attack: 4,  range: 1, trainCost: 8,  trainEnergy: 10, trainTurns: 1, owner: 'player', special: 'heal',      desc: 'Лікує сусідні юніти, проходить через гори' },
  archer:        { icon: '🏹', label: 'Лучник',          maxHp: 14, maxMoves: 2, attack: 7,  range: 2, trainCost: 15, trainEnergy: 18, trainTurns: 2, owner: 'player', desc: 'Атакує з дальності 2' },
  guardian:      { icon: '🛡️', label: 'Захисник',        maxHp: 35, maxMoves: 1, attack: 5,  range: 1, trainCost: 20, trainEnergy: 22, trainTurns: 2, owner: 'player', special: 'block',     desc: 'Блокує половину пошкоджень від ворогів' },
  sage:          { icon: '🧙', label: 'Мудрець',         maxHp: 12, maxMoves: 2, attack: 6,  range: 1, trainCost: 25, trainEnergy: 28, trainTurns: 3, owner: 'player', special: 'aoe',       desc: 'AOE атака по сусідніх гексах навколо цілі' },
  hero:          { icon: '🚀', label: 'Герой',           maxHp: 30, maxMoves: 3, attack: 12, range: 1, trainCost: 35, trainEnergy: 35, trainTurns: 3, owner: 'player', desc: 'Найсильніший юніт, одиниця на гру' },
  aiUnit:        { icon: '🤖', label: 'AI Дрон',         maxHp: 22, maxMoves: 3, attack: 10, range: 2, trainCost: 28, trainEnergy: 30, trainTurns: 2, owner: 'player', desc: 'Дрон з дальньою атакою та великою мобільністю' },
  cavalry:       { icon: '🐎', label: 'Кавалерія',       maxHp: 18, maxMoves: 4, attack: 9,  range: 1, trainCost: 22, trainEnergy: 25, trainTurns: 2, owner: 'player', desc: 'Дуже швидкий юніт — 4 переміщення на хід' },
  catapult:      { icon: '💣', label: 'Катапульта',      maxHp: 16, maxMoves: 1, attack: 14, range: 3, trainCost: 30, trainEnergy: 35, trainTurns: 3, owner: 'player', special: 'siege',     desc: 'Дальність 3, висока атака, дуже повільна' },
  settler:       { icon: '🏕️', label: 'Поселенець',      maxHp: 8,  maxMoves: 2, attack: 0,  range: 0, trainCost: 40, trainEnergy: 40, trainTurns: 4, owner: 'player', special: 'settle',    desc: 'Заснуй нове місто на будь-якому луговому гексі' },
  diplomat:      { icon: '🤝', label: 'Дипломат',        maxHp: 8,  maxMoves: 3, attack: 0,  range: 1, trainCost: 20, trainEnergy: 20, trainTurns: 2, owner: 'player', special: 'negotiate', desc: 'Нейтралізує ворогів та умиротворює варварів' },

  // ── Enemy civ units ────────────────────────────────────────────────────────
  lazy:          { icon: '😴', label: 'Ледачий',         maxHp: 10, maxMoves: 1, attack: 3,  range: 1, trainCost: 0, trainEnergy: 0, trainTurns: 0, owner: 'enemy', desc: 'Слабкий, повільний ворог' },
  phoneAddict:   { icon: '📱', label: 'Залежний',        maxHp: 8,  maxMoves: 3, attack: 4,  range: 1, trainCost: 0, trainEnergy: 0, trainTurns: 0, owner: 'enemy', special: 'distract', desc: 'Відволікає суміжні юніти гравця' },
  gamer:         { icon: '🎮', label: 'Геймер',          maxHp: 15, maxMoves: 2, attack: 6,  range: 1, trainCost: 0, trainEnergy: 0, trainTurns: 0, owner: 'enemy', special: 'dodge', desc: 'Ухиляється від кожної другої атаки' },
  procrastinator:{ icon: '👻', label: 'Прокрастинатор',  maxHp: 20, maxMoves: 2, attack: 8,  range: 1, trainCost: 0, trainEnergy: 0, trainTurns: 0, owner: 'enemy', special: 'regen', desc: 'Регенерує 3HP на хід' },
  darkness:      { icon: '🌑', label: 'Темрява',         maxHp: 60, maxMoves: 2, attack: 15, range: 1, trainCost: 0, trainEnergy: 0, trainTurns: 0, owner: 'enemy', special: 'aoe', desc: 'БОSS — AOE атака, надзвичайно міцний' },

  // ── Barbarian units ────────────────────────────────────────────────────────
  barbarian:     { icon: '🪓', label: 'Варвар',          maxHp: 12, maxMoves: 2, attack: 5,  range: 1, trainCost: 0, trainEnergy: 0, trainTurns: 0, owner: 'barbarian', desc: 'Дикун із табору варварів' },
  barbarianChief:{ icon: '💢', label: 'Ватажок',         maxHp: 25, maxMoves: 2, attack: 10, range: 1, trainCost: 0, trainEnergy: 0, trainTurns: 0, owner: 'barbarian', special: 'aoe', desc: 'Могутній ватажок варварів із AOE' },
};

export function getEnemyWave(turn: number): UnitType {
  if (turn <= 8)  return 'lazy';
  if (turn <= 14) return 'phoneAddict';
  if (turn <= 20) return 'gamer';
  if (turn <= 26) return 'procrastinator';
  return 'darkness';
}
