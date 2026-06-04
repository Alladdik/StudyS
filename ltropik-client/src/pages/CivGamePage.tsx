/**
 * Академія Знань — повноцінна hex-grid стратегія
 * Карта 22×14, 7 юнітів, 5 ворогів, 3-гілкове дерево технологій,
 * 10 будівель, 8 подій, 3 умови перемоги, fog-of-war, анімації.
 */
import {
  useEffect, useLayoutEffect, useReducer, useRef, useState,
} from 'react';
import { Layout } from '../components/Layout';
import { cx } from '../components/ui';
import api from '../api/client';

// ─────────────────────────────────────────────────────────────────────────────
// Constants & helpers
// ─────────────────────────────────────────────────────────────────────────────
const COLS = 22, ROWS = 14;
const HEX_SIZE = 32;
const HW = Math.sqrt(3) * HEX_SIZE;
const HH = 2 * HEX_SIZE;

function hexToPixel(col: number, row: number) {
  return {
    x: HW * (col + (row & 1) * 0.5) + HEX_SIZE,
    y: HH * 0.75 * row + HEX_SIZE,
  };
}

function hexCorners(cx: number, cy: number, r = HEX_SIZE - 2) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as [number, number];
  });
}

function hexDist(c1: number, r1: number, c2: number, r2: number) {
  const ax = c1 - Math.floor(r1 / 2);
  const az = r1;
  const bx = c2 - Math.floor(r2 / 2);
  const bz = r2;
  return Math.max(Math.abs(ax - bx), Math.abs(az - bz), Math.abs((ax + az) - (bx + bz)));
}

function rng(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─────────────────────────────────────────────────────────────────────────────
// Terrain
// ─────────────────────────────────────────────────────────────────────────────
type TerrainId =
  | 'meadow' | 'forest' | 'mountain' | 'river'
  | 'ancientLib' | 'crystal' | 'village'
  | 'playerCity' | 'enemyCity';

const TERRAIN_DEF: Record<TerrainId, {
  color: string; borderColor: string; icon: string;
  passable: boolean; scholarOnly?: boolean;
  knowledgeBonus: number; energyBonus: number; inspirationBonus: number;
  label: string;
}> = {
  meadow:     { color: '#86efac', borderColor: '#16a34a', icon: '🌿', passable: true,  knowledgeBonus: 0, energyBonus: 1, inspirationBonus: 0, label: 'Луг' },
  forest:     { color: '#15803d', borderColor: '#052e16', icon: '🌲', passable: true,  knowledgeBonus: 2, energyBonus: 0, inspirationBonus: 0, label: 'Ліс Цікавості' },
  mountain:   { color: '#94a3b8', borderColor: '#475569', icon: '⛰️', passable: false, scholarOnly: true, knowledgeBonus: 3, energyBonus: 0, inspirationBonus: 0, label: 'Гора Випробувань' },
  river:      { color: '#38bdf8', borderColor: '#0369a1', icon: '🌊', passable: false, knowledgeBonus: 0, energyBonus: 0, inspirationBonus: 2, label: 'Ріка Ідей' },
  ancientLib: { color: '#fde68a', borderColor: '#d97706', icon: '📜', passable: true,  knowledgeBonus: 10, energyBonus: 0, inspirationBonus: 0, label: 'Стародавня Бібліотека' },
  crystal:    { color: '#e9d5ff', borderColor: '#7c3aed', icon: '💎', passable: true,  knowledgeBonus: 0, energyBonus: 0, inspirationBonus: 5, label: 'Кристальна Печера' },
  village:    { color: '#fed7aa', borderColor: '#ea580c', icon: '🏘️', passable: true,  knowledgeBonus: 0, energyBonus: 2, inspirationBonus: 0, label: 'Нейтральне Село' },
  playerCity: { color: '#fbbf24', borderColor: '#b45309', icon: '🏫', passable: true,  knowledgeBonus: 5, energyBonus: 3, inspirationBonus: 1, label: 'Академія' },
  enemyCity:  { color: '#f87171', borderColor: '#991b1b', icon: '👹', passable: true,  knowledgeBonus: 0, energyBonus: 0, inspirationBonus: 0, label: 'Лігво Прокрастинаторів' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Buildings
// ─────────────────────────────────────────────────────────────────────────────
type BuildingId =
  | 'school' | 'library' | 'cafeteria' | 'training'
  | 'lab' | 'theater' | 'observatory' | 'gym'
  | 'greatHall' | 'knowledgeNet';

const BUILDING_DEF: Record<BuildingId, {
  icon: string; label: string; cost: number; desc: string;
  requires?: BuildingId[];
  kPerTurn?: number; ePerTurn?: number; iPerTurn?: number;
  unitHpBonus?: number; fogRadius?: number; resBonus?: number;
  isVictory?: boolean;
}> = {
  school:       { icon: '🏫', label: 'Школа',            cost: 0,   desc: '+2📚/хід (базова, стартова)',        kPerTurn: 2 },
  library:      { icon: '📖', label: 'Бібліотека',        cost: 30,  desc: '+4📚/хід, відкриває Academy T2',     kPerTurn: 4, requires: ['school'] },
  cafeteria:    { icon: '🍎', label: 'Їдальня',           cost: 20,  desc: '+3⚡/хід, юніти +10% HP',           ePerTurn: 3, unitHpBonus: 10, requires: ['school'] },
  training:     { icon: '🏋️', label: 'Тренувальний майд.', cost: 25, desc: '+2⚡/хід, -1 хід виробн. юнітів',   ePerTurn: 2, requires: ['school'] },
  lab:          { icon: '🔬', label: 'Лабораторія',       cost: 50,  desc: '+3💡/хід, відкриває Innovation T3',  iPerTurn: 3, requires: ['library'] },
  theater:      { icon: '🎭', label: 'Театр',             cost: 35,  desc: '+2💡/хід, більше позитивних подій',  iPerTurn: 2, requires: ['cafeteria'] },
  observatory:  { icon: '🔭', label: 'Обсерваторія',      cost: 40,  desc: 'Fog of War: +2 радіус всім юнітам', fogRadius: 2, requires: ['library'] },
  gym:          { icon: '💪', label: 'Спортзал',          cost: 30,  desc: 'Воїни +30% HP та +1 атака',         unitHpBonus: 30, requires: ['training'] },
  greatHall:    { icon: '🏛️', label: 'Велика Зала',       cost: 80,  desc: '+25% до всіх ресурсів',             resBonus: 25, requires: ['library', 'cafeteria', 'training', 'theater'] },
  knowledgeNet: { icon: '🌐', label: 'Мережа Знань',      cost: 100, desc: 'Умова перемоги Knowledge Victory',   isVictory: true, requires: ['greatHall', 'lab'] },
};

// ─────────────────────────────────────────────────────────────────────────────
// Tech tree
// ─────────────────────────────────────────────────────────────────────────────
type TechBranch = 'academy' | 'defense' | 'innovation';
type TechId =
  | 'basicLearning' | 'advStudies' | 'researchMethods' | 'sciRevolution' | 'universalKnowledge'
  | 'basicTraining' | 'tactics' | 'teamStrategy' | 'eliteForces' | 'ironWill'
  | 'creativeThin' | 'problemSolv' | 'aiAssist' | 'synthKnow' | 'transcendence';

type TechDef = {
  branch: TechBranch; tier: number; icon: string; label: string;
  cost: number; desc: string; requires?: TechId;
  effect: Partial<GameEffects>;
};

interface GameEffects {
  kBonus: number;       // extra knowledge/turn
  eBonus: number;       // extra energy/turn
  iBonus: number;       // extra inspiration/turn
  allResBonus: number;  // % bonus all resources
  warriorHpPct: number; unitMoveBonus: number;
  unitGroupBonusPct: number; unitMinHp1: boolean;
  scholarHeals: boolean; eventsMore: boolean;
  unlockArcher: boolean; unlockSage: boolean;
  unlockGuardian: boolean; unlockHero: boolean;
  unlockAi: boolean; aoeAbility: boolean;
  bridgePassable: boolean;
}

const TECH: Record<TechId, TechDef> = {
  // ── Academy ──────────────────────────────────────────────────────────────
  basicLearning:      { branch: 'academy',    tier: 1, icon: '📖', label: 'Базове навчання',     cost: 15,  desc: '+2📚/хід', requires: undefined,    effect: { kBonus: 2 } as Partial<GameEffects> },
  advStudies:         { branch: 'academy',    tier: 2, icon: '🎓', label: 'Поглиблені студії',   cost: 30,  desc: 'Бібліотека ×1.5, Scholar', requires: 'basicLearning', effect: { kBonus: 2 } as Partial<GameEffects> },
  researchMethods:    { branch: 'academy',    tier: 3, icon: '🔍', label: 'Методи досліджень',   cost: 60,  desc: '+2📚 кожному виробнику', requires: 'advStudies', effect: { kBonus: 3 } as Partial<GameEffects> },
  sciRevolution:      { branch: 'academy',    tier: 4, icon: '⚗️', label: 'Наукова революція',   cost: 100, desc: 'Лаб ×2, відкриває AI юніт', requires: 'researchMethods', effect: { iBonus: 2, unlockAi: true } as Partial<GameEffects> },
  universalKnowledge: { branch: 'academy',    tier: 5, icon: '🌟', label: 'Всесвітнє Знання',    cost: 150, desc: '🏆 Knowledge Victory можлива', requires: 'sciRevolution', effect: { kBonus: 5, allResBonus: 15 } as Partial<GameEffects> },
  // ── Defense ──────────────────────────────────────────────────────────────
  basicTraining:      { branch: 'defense',    tier: 1, icon: '🪖', label: 'Базова підготовка',   cost: 15,  desc: 'Воїни +20% HP', requires: undefined,    effect: { warriorHpPct: 20, unlockArcher: true } as Partial<GameEffects> },
  tactics:            { branch: 'defense',    tier: 2, icon: '📍', label: 'Тактика',             cost: 30,  desc: 'Всі юніти +1 переміщення', requires: 'basicTraining', effect: { unitMoveBonus: 1 } as Partial<GameEffects> },
  teamStrategy:       { branch: 'defense',    tier: 3, icon: '🤝', label: 'Командна стратегія',  cost: 60,  desc: 'Сусідні юніти +25% атаки', requires: 'tactics', effect: { unitGroupBonusPct: 25, unlockGuardian: true } as Partial<GameEffects> },
  eliteForces:        { branch: 'defense',    tier: 4, icon: '⭐', label: 'Елітні сили',         cost: 100, desc: 'Відкриває Героя, Лучник +range', requires: 'teamStrategy', effect: { unlockHero: true } as Partial<GameEffects> },
  ironWill:           { branch: 'defense',    tier: 5, icon: '💪', label: 'Нескоренна Воля',     cost: 150, desc: 'Юніти не помирають нижче 1 HP', requires: 'eliteForces', effect: { unitMinHp1: true } as Partial<GameEffects> },
  // ── Innovation ───────────────────────────────────────────────────────────
  creativeThin:       { branch: 'innovation', tier: 1, icon: '💡', label: 'Творче мислення',     cost: 15,  desc: 'Scholar: лікує сусідів +3HP', requires: undefined,    effect: { scholarHeals: true } as Partial<GameEffects> },
  problemSolv:        { branch: 'innovation', tier: 2, icon: '🧩', label: 'Вирішення задач',     cost: 30,  desc: 'Ріки прохідні, більше подій', requires: 'creativeThin', effect: { eventsMore: true, bridgePassable: true } as Partial<GameEffects> },
  aiAssist:           { branch: 'innovation', tier: 3, icon: '🤖', label: 'AI Помічник',         cost: 60,  desc: 'Відкриває AI юніт', requires: 'problemSolv', effect: { unlockAi: true, unlockSage: true } as Partial<GameEffects> },
  synthKnow:          { branch: 'innovation', tier: 4, icon: '🔮', label: 'Синтез знань',        cost: 100, desc: '+25% до всіх ресурсів', requires: 'aiAssist', effect: { allResBonus: 25 } as Partial<GameEffects> },
  transcendence:      { branch: 'innovation', tier: 5, icon: '✨', label: 'Трансцендентність',   cost: 150, desc: 'Спец. AOE здібність Burst', requires: 'synthKnow', effect: { aoeAbility: true, allResBonus: 10 } as Partial<GameEffects> },
};

// ─────────────────────────────────────────────────────────────────────────────
// Units
// ─────────────────────────────────────────────────────────────────────────────
type UnitType = 'warrior' | 'scholar' | 'archer' | 'guardian' | 'sage' | 'hero' | 'aiUnit'
              | 'lazy' | 'phoneAddict' | 'gamer' | 'procrastinator' | 'darkness';

interface UnitDef {
  icon: string; label: string; maxHp: number; maxMoves: number;
  attack: number; range: number; trainCost: number; trainEnergy: number;
  owner: 'player' | 'enemy'; special?: string;
}

const UNIT_DEF: Record<UnitType, UnitDef> = {
  warrior:       { icon: '⚔️',  label: 'Воїн',         maxHp: 20, maxMoves: 2, attack: 8,  range: 1, trainCost: 15, trainEnergy: 15, owner: 'player' },
  scholar:       { icon: '📚', label: 'Вчений',        maxHp: 10, maxMoves: 3, attack: 4,  range: 1, trainCost: 10, trainEnergy: 10, owner: 'player', special: 'heal' },
  archer:        { icon: '🏹', label: 'Лучник',        maxHp: 15, maxMoves: 2, attack: 6,  range: 2, trainCost: 20, trainEnergy: 20, owner: 'player' },
  guardian:      { icon: '🛡️',  label: 'Захисник',     maxHp: 35, maxMoves: 1, attack: 6,  range: 1, trainCost: 25, trainEnergy: 25, owner: 'player', special: 'block' },
  sage:          { icon: '🧙', label: 'Мудрець',       maxHp: 12, maxMoves: 2, attack: 5,  range: 1, trainCost: 30, trainEnergy: 30, owner: 'player', special: 'aoe' },
  hero:          { icon: '🚀', label: 'Герой',         maxHp: 30, maxMoves: 3, attack: 12, range: 1, trainCost: 40, trainEnergy: 40, owner: 'player' },
  aiUnit:        { icon: '🤖', label: 'AI Юніт',       maxHp: 25, maxMoves: 3, attack: 10, range: 1, trainCost: 35, trainEnergy: 35, owner: 'player' },
  lazy:          { icon: '😴', label: 'Ледачий',       maxHp: 10, maxMoves: 1, attack: 3,  range: 1, trainCost: 0, trainEnergy: 0, owner: 'enemy' },
  phoneAddict:   { icon: '📱', label: 'Залежний',      maxHp: 8,  maxMoves: 3, attack: 4,  range: 1, trainCost: 0, trainEnergy: 0, owner: 'enemy', special: 'distract' },
  gamer:         { icon: '🎮', label: 'Геймер',        maxHp: 15, maxMoves: 2, attack: 6,  range: 1, trainCost: 0, trainEnergy: 0, owner: 'enemy', special: 'dodge' },
  procrastinator:{ icon: '👻', label: 'Прокрастинатор',maxHp: 20, maxMoves: 2, attack: 8,  range: 1, trainCost: 0, trainEnergy: 0, owner: 'enemy', special: 'regen' },
  darkness:      { icon: '🌑', label: 'Темрява',       maxHp: 50, maxMoves: 2, attack: 15, range: 1, trainCost: 0, trainEnergy: 0, owner: 'enemy', special: 'aoe' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Game State
// ─────────────────────────────────────────────────────────────────────────────
type Phase = 'playing' | 'won_knowledge' | 'won_military' | 'won_survival' | 'lost';

interface Cell { col: number; row: number; terrain: TerrainId; explored: boolean; harvested?: boolean; }
interface Unit {
  id: string; type: UnitType; col: number; row: number;
  hp: number; maxHp: number; moves: number; maxMoves: number;
  owner: 'player' | 'enemy'; hasActed?: boolean; distracted?: boolean;
}

interface GameState {
  turn: number; maxTurns: number; phase: Phase;
  knowledge: number; energy: number; inspiration: number; coins: number;
  kPerTurn: number; ePerTurn: number; iPerTurn: number;
  grid: Cell[][];
  units: Unit[];
  buildings: Set<BuildingId>;
  techs: Set<TechId>;
  researchQueue: TechId | null;
  selectedUnitId: string | null;
  trainingQueue: UnitType | null;
  trainTurnsLeft: number;
  log: string[];
  eventCooldown: number;
  effects: Partial<GameEffects>;
  heroUsed: boolean;
  aoeUsed: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Random Events
// ─────────────────────────────────────────────────────────────────────────────
interface GameEvent { icon: string; label: string; apply: (s: GameState) => Partial<GameState>; good: boolean; }

const EVENTS: GameEvent[] = [
  { icon: '🌟', label: 'Натхненний учень!',  good: true,  apply: s => ({ knowledge: s.knowledge + 10, log: ['🌟 Натхненний учень: +10📚', ...s.log].slice(0, 10) }) },
  { icon: '☄️', label: 'Метеор Знань!',      good: true,  apply: s => ({ knowledge: s.knowledge + 8, inspiration: s.inspiration + 4, log: ['☄️ Метеор Знань: +8📚 +4💡', ...s.log].slice(0, 10) }) },
  { icon: '🎉', label: 'Свято школи!',       good: true,  apply: s => ({ units: s.units.map(u => u.owner === 'player' ? { ...u, hp: Math.min(u.maxHp, u.hp + 5) } : u), log: ['🎉 Свято! Всі юніти +5HP', ...s.log].slice(0, 10) }) },
  { icon: '📜', label: 'Знайдено рукопис!',  good: true,  apply: s => ({ knowledge: s.knowledge + 15, log: ['📜 Знайдено рукопис! +15📚', ...s.log].slice(0, 10) }) },
  { icon: '💌', label: 'Лист від батьків!',  good: true,  apply: s => ({ coins: s.coins + 5, log: ['💌 Лист від батьків: +5🪙', ...s.log].slice(0, 10) }) },
  { icon: '⚠️', label: 'Набіг Темряви!',    good: false, apply: s => {
    const ec = s.grid.flat().find(c => c.terrain === 'enemyCity' && c.explored);
    if (!ec) return {};
    const def = UNIT_DEF['gamer'];
    const newUnit: Unit = { id: `e${Date.now()}`, type: 'gamer', col: COLS - 1, row: rng(0, ROWS - 1), hp: def.maxHp, maxHp: def.maxHp, moves: def.maxMoves, maxMoves: def.maxMoves, owner: 'enemy' };
    return { units: [...s.units, newUnit], log: ['⚠️ Набіг Темряви! +1 Геймер', ...s.log].slice(0, 10) };
  }},
  { icon: '😤', label: 'Конфлікт учнів!',   good: false, apply: s => ({ energy: Math.max(0, s.energy - 5), log: ['😤 Конфлікт учнів: −5⚡', ...s.log].slice(0, 10) }) },
  { icon: '🔥', label: 'Пожежа!',           good: false, apply: s => ({ knowledge: Math.max(0, s.knowledge - 8), log: ['🔥 Пожежа в бібліотеці! −8📚', ...s.log].slice(0, 10) }) },
];

// ─────────────────────────────────────────────────────────────────────────────
// Map generation
// ─────────────────────────────────────────────────────────────────────────────
function generateMap(): Cell[][] {
  const grid: Cell[][] = [];
  for (let r = 0; r < ROWS; r++) {
    grid[r] = [];
    for (let c = 0; c < COLS; c++) {
      let terrain: TerrainId;
      // Fixed positions
      if (c === 0 && r === Math.floor(ROWS / 2))       terrain = 'playerCity';
      else if (c === COLS - 1 && r === Math.floor(ROWS / 2)) terrain = 'enemyCity';
      else if (c === COLS - 2 && r === Math.floor(ROWS / 2 - 2)) terrain = 'enemyCity';
      else {
        const n = Math.random();
        if (n < 0.08)       terrain = 'river';
        else if (n < 0.16)  terrain = 'mountain';
        else if (n < 0.28)  terrain = 'forest';
        else if (n < 0.33)  terrain = 'ancientLib';
        else if (n < 0.36)  terrain = 'crystal';
        else if (n < 0.40)  terrain = 'village';
        else                terrain = 'meadow';
      }
      // Explored initially only near player city
      const explored = hexDist(c, r, 0, Math.floor(ROWS / 2)) <= 3;
      grid[r][c] = { col: c, row: r, terrain, explored };
    }
  }
  return grid;
}

function initUnits(): Unit[] {
  const midRow = Math.floor(ROWS / 2);
  const playerUnits: Unit[] = [
    { id: 'w1', type: 'warrior', col: 1, row: midRow - 1, hp: 20, maxHp: 20, moves: 2, maxMoves: 2, owner: 'player' },
    { id: 'w2', type: 'warrior', col: 1, row: midRow + 1, hp: 20, maxHp: 20, moves: 2, maxMoves: 2, owner: 'player' },
    { id: 's1', type: 'scholar', col: 2, row: midRow,     hp: 10, maxHp: 10, moves: 3, maxMoves: 3, owner: 'player' },
  ];
  const enemyUnits: Unit[] = [
    { id: 'e1', type: 'lazy',    col: COLS - 2, row: midRow - 2, hp: 10, maxHp: 10, moves: 1, maxMoves: 1, owner: 'enemy' },
    { id: 'e2', type: 'lazy',    col: COLS - 2, row: midRow + 2, hp: 10, maxHp: 10, moves: 1, maxMoves: 1, owner: 'enemy' },
    { id: 'e3', type: 'gamer',   col: COLS - 1, row: midRow,     hp: 15, maxHp: 15, moves: 2, maxMoves: 2, owner: 'enemy' },
  ];
  return [...playerUnits, ...enemyUnits];
}

function computePerTurn(buildings: Set<BuildingId>, effects: Partial<GameEffects>) {
  let k = 0, e = 0, i = 0;
  for (const bid of buildings) {
    k += BUILDING_DEF[bid].kPerTurn ?? 0;
    e += BUILDING_DEF[bid].ePerTurn ?? 0;
    i += BUILDING_DEF[bid].iPerTurn ?? 0;
  }
  k += effects.kBonus ?? 0;
  e += effects.eBonus ?? 0;
  i += effects.iBonus ?? 0;
  const pct = 1 + ((effects.allResBonus ?? 0) + (buildings.has('greatHall') ? 25 : 0)) / 100;
  return { kPerTurn: Math.round(k * pct), ePerTurn: Math.round(e * pct), iPerTurn: Math.round(i * pct) };
}

function mergeEffects(techs: Set<TechId>): Partial<GameEffects> {
  const eff: GameEffects = {
    kBonus: 0, eBonus: 0, iBonus: 0, allResBonus: 0,
    warriorHpPct: 0, unitMoveBonus: 0, unitGroupBonusPct: 0, unitMinHp1: false,
    scholarHeals: false, eventsMore: false,
    unlockArcher: false, unlockSage: false, unlockGuardian: false, unlockHero: false, unlockAi: false,
    aoeAbility: false, bridgePassable: false,
  };
  for (const tid of techs) {
    const fx = TECH[tid].effect as Partial<GameEffects>;
    for (const [k, v] of Object.entries(fx)) {
      const key = k as keyof GameEffects;
      if (typeof v === 'boolean') (eff[key] as boolean) = (eff[key] as boolean) || v;
      else if (typeof v === 'number') (eff[key] as number) += v as number;
    }
  }
  return eff;
}

function initGame(): GameState {
  const buildings = new Set<BuildingId>(['school']);
  const techs = new Set<TechId>();
  const effects = mergeEffects(techs);
  const { kPerTurn, ePerTurn, iPerTurn } = computePerTurn(buildings, effects);
  return {
    turn: 1, maxTurns: 30, phase: 'playing',
    knowledge: 20, energy: 15, inspiration: 5, coins: 0,
    kPerTurn, ePerTurn, iPerTurn,
    grid: generateMap(),
    units: initUnits(),
    buildings,
    techs,
    researchQueue: null,
    selectedUnitId: null,
    trainingQueue: null,
    trainTurnsLeft: 0,
    log: ['📜 Академія заснована! Захисти знання від прокрастинаторів!'],
    eventCooldown: 3,
    effects,
    heroUsed: false,
    aoeUsed: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Reducer
// ─────────────────────────────────────────────────────────────────────────────
type Action =
  | { type: 'SELECT_UNIT'; id: string | null }
  | { type: 'MOVE_OR_ATTACK'; col: number; row: number }
  | { type: 'BUILD'; building: BuildingId }
  | { type: 'RESEARCH'; tech: TechId }
  | { type: 'TRAIN'; unitType: UnitType }
  | { type: 'USE_AOE' }
  | { type: 'END_TURN' }
  | { type: 'RESTART' };

function canPass(terrain: TerrainId, unitType: UnitType, effects: Partial<GameEffects>): boolean {
  const t = TERRAIN_DEF[terrain];
  if (t.passable) return true;
  if (terrain === 'river' && effects.bridgePassable) return true;
  if (terrain === 'mountain' && unitType === 'scholar') return true;
  return false;
}

function getEnemyWave(turn: number): UnitType {
  if (turn <= 10) return 'lazy';
  if (turn <= 15) return 'phoneAddict';
  if (turn <= 20) return 'gamer';
  if (turn <= 25) return 'procrastinator';
  return 'darkness';
}

function reducer(state: GameState, action: Action): GameState {
  if (state.phase !== 'playing' && action.type !== 'RESTART') return state;

  switch (action.type) {
    case 'RESTART': return initGame();

    case 'SELECT_UNIT': {
      const u = state.units.find(u => u.id === action.id && u.owner === 'player');
      if (u?.moves === 0 || u?.hasActed) return { ...state, selectedUnitId: null };
      return { ...state, selectedUnitId: action.id };
    }

    case 'MOVE_OR_ATTACK': {
      const sel = state.units.find(u => u.id === state.selectedUnitId);
      if (!sel || sel.moves === 0) return { ...state, selectedUnitId: null };

      const { col, row } = action;
      const targetUnit = state.units.find(u => u.col === col && u.row === row);
      const cell = state.grid[row][col];
      const dist = hexDist(sel.col, sel.row, col, row);

      // Attack
      if (targetUnit?.owner === 'enemy' && dist <= (UNIT_DEF[sel.type].range ?? 1)) {
        let dmg = UNIT_DEF[sel.type].attack;
        // Group bonus
        const allies = state.units.filter(u => u.owner === 'player' && u.id !== sel.id && hexDist(u.col, u.row, sel.col, sel.row) === 1);
        if ((state.effects.unitGroupBonusPct ?? 0) > 0 && allies.length > 0)
          dmg = Math.round(dmg * (1 + (state.effects.unitGroupBonusPct ?? 0) / 100));

        // Guardian: block half
        if (targetUnit.type === 'guardian') dmg = Math.ceil(dmg / 2);
        // Gamer: dodge every other turn
        if (targetUnit.type === 'gamer' && targetUnit.hasActed) dmg = 0;

        let newHp = targetUnit.hp - dmg;
        if (state.effects.unitMinHp1 && newHp < 1) newHp = 1;

        const xp = newHp <= 0 ? 40 : 10;
        const coins = newHp <= 0 ? 20 : 0;

        let newUnits = state.units.map(u => {
          if (u.id === targetUnit.id) return { ...u, hp: newHp };
          if (u.id === sel.id) return { ...u, moves: 0, hasActed: true };
          return u;
        }).filter(u => u.hp > 0);

        // Scholar heal nearby after kill
        if (newHp <= 0 && sel.type === 'scholar' && state.effects.scholarHeals) {
          newUnits = newUnits.map(u => {
            if (u.owner === 'player' && hexDist(u.col, u.row, sel.col, sel.row) === 1)
              return { ...u, hp: Math.min(u.maxHp, u.hp + 3) };
            return u;
          });
        }

        const killed = newHp <= 0;
        const allEnemyDead = newUnits.filter(u => u.owner === 'enemy').length === 0;
        const phase: Phase = allEnemyDead ? 'won_military' : state.phase;

        return {
          ...state,
          units: newUnits,
          knowledge: state.knowledge + (killed ? xp / 2 : 0),
          coins: state.coins + coins,
          selectedUnitId: null,
          phase,
          log: [killed ? `⚔️ Знищено ${UNIT_DEF[targetUnit.type].label}! +${xp}XP +${coins}🪙`
                       : `💥 Атака: −${dmg}HP`, ...state.log].slice(0, 10),
        };
      }

      // Sage AOE (range 1 around target hex)
      if (sel.type === 'sage' && dist === 1 && targetUnit?.owner === 'enemy') {
        const aoeDmg = 4;
        const newUnits = state.units.map(u => {
          if (u.owner === 'enemy' && hexDist(u.col, u.row, col, row) <= 1)
            return { ...u, hp: u.hp - aoeDmg };
          if (u.id === sel.id) return { ...u, hasActed: true, moves: 0 };
          return u;
        }).filter(u => u.hp > 0);
        const allDead = newUnits.filter(u => u.owner === 'enemy').length === 0;
        return { ...state, units: newUnits, selectedUnitId: null, phase: allDead ? 'won_military' : state.phase, log: ['🧙 Мудрець: AOE −4HP по ворогах поруч!', ...state.log].slice(0, 10) };
      }

      // Move
      if (!canPass(cell.terrain, sel.type, state.effects)) return state;
      if (dist > sel.moves) return state;
      if (targetUnit) return state; // occupied

      // Harvest bonus from tile
      let bonusK = 0, bonusI = 0;
      if (!cell.harvested && (cell.terrain === 'ancientLib' || cell.terrain === 'crystal')) {
        bonusK = cell.terrain === 'ancientLib' ? TERRAIN_DEF.ancientLib.knowledgeBonus : 0;
        bonusI = cell.terrain === 'crystal' ? TERRAIN_DEF.crystal.inspirationBonus : 0;
      }

      // Explore fog
      const fogRadius = 2 + (state.buildings.has('observatory') ? 2 : 0) + (state.effects.unitMoveBonus ?? 0);
      const newGrid = state.grid.map(rowArr => rowArr.map(c => {
        if (hexDist(c.col, c.row, col, row) <= fogRadius) return { ...c, explored: true };
        if (c.col === col && c.row === row && bonusK + bonusI > 0) return { ...c, harvested: true };
        return c;
      }));

      const xpMove = TERRAIN_DEF[cell.terrain].knowledgeBonus;

      return {
        ...state,
        units: state.units.map(u => u.id === sel.id
          ? { ...u, col, row, moves: u.moves - dist }
          : u),
        grid: newGrid,
        knowledge: state.knowledge + xpMove + bonusK,
        inspiration: state.inspiration + bonusI,
        selectedUnitId: null,
        log: bonusK > 0 || bonusI > 0
          ? [`📍 Знайдено скарб: +${bonusK}📚 +${bonusI}💡`, ...state.log].slice(0, 10)
          : xpMove > 0
            ? [`🗺️ ${TERRAIN_DEF[cell.terrain].label}: +${xpMove}📚`, ...state.log].slice(0, 10)
            : state.log,
      };
    }

    case 'USE_AOE': {
      if (state.aoeUsed || !(state.effects.aoeAbility)) return state;
      // AOE burst: -10HP to all enemies visible
      const newUnits = state.units.map(u => {
        if (u.owner === 'enemy') return { ...u, hp: u.hp - 10 };
        return u;
      }).filter(u => u.hp > 0);
      const allDead = newUnits.filter(u => u.owner === 'enemy').length === 0;
      return {
        ...state, units: newUnits, aoeUsed: true,
        inspiration: state.inspiration - 10,
        phase: allDead ? 'won_military' : state.phase,
        log: ['✨ Трансцендентність: Burst of Insight -10HP всім ворогам!', ...state.log].slice(0, 10),
      };
    }

    case 'BUILD': {
      const def = BUILDING_DEF[action.building];
      if (state.buildings.has(action.building)) return state;
      if (state.knowledge < def.cost) return state;
      if (def.requires?.some(r => !state.buildings.has(r))) return state;

      const newBuildings = new Set(state.buildings);
      newBuildings.add(action.building);
      const { kPerTurn, ePerTurn, iPerTurn } = computePerTurn(newBuildings, state.effects);

      return {
        ...state,
        buildings: newBuildings,
        knowledge: state.knowledge - def.cost,
        kPerTurn, ePerTurn, iPerTurn,
        log: [`🏗️ Побудовано: ${def.icon} ${def.label}`, ...state.log].slice(0, 10),
      };
    }

    case 'RESEARCH': {
      const tech = TECH[action.tech];
      if (state.techs.has(action.tech)) return state;
      if (tech.requires && !state.techs.has(tech.requires)) return state;
      if (state.knowledge < tech.cost) return state;

      const newTechs = new Set(state.techs);
      newTechs.add(action.tech);
      const effects = mergeEffects(newTechs);
      const { kPerTurn, ePerTurn, iPerTurn } = computePerTurn(state.buildings, effects);

      // Check Knowledge Victory
      const allAcademy: TechId[] = ['basicLearning','advStudies','researchMethods','sciRevolution','universalKnowledge'];
      const knowledgeWin = allAcademy.every(t => newTechs.has(t)) && state.buildings.has('knowledgeNet');

      return {
        ...state,
        techs: newTechs,
        knowledge: state.knowledge - tech.cost,
        effects, kPerTurn, ePerTurn, iPerTurn,
        phase: knowledgeWin ? 'won_knowledge' : state.phase,
        log: [`🔬 Досліджено: ${tech.icon} ${tech.label}!`, ...state.log].slice(0, 10),
      };
    }

    case 'TRAIN': {
      const def = UNIT_DEF[action.unitType];
      if (state.energy < def.trainEnergy) return state;
      const turnsNeeded = state.buildings.has('training') ? 1 : 2;
      return {
        ...state,
        energy: state.energy - def.trainEnergy,
        trainingQueue: action.unitType,
        trainTurnsLeft: turnsNeeded,
        log: [`🏋️ Тренування: ${def.icon} ${def.label} (${turnsNeeded} ходи)`, ...state.log].slice(0, 10),
      };
    }

    case 'END_TURN': {
      let s = { ...state };

      // 1. Collect resources
      s.knowledge  = Math.min(999, s.knowledge + s.kPerTurn);
      s.energy     = Math.min(999, s.energy + s.ePerTurn);
      s.inspiration = Math.min(999, s.inspiration + s.iPerTurn);

      // Terrain bonuses for player units on special tiles
      for (const u of s.units.filter(u => u.owner === 'player')) {
        const cell = s.grid[u.row][u.col];
        s.knowledge   += TERRAIN_DEF[cell.terrain].knowledgeBonus;
        s.energy      += TERRAIN_DEF[cell.terrain].energyBonus;
        s.inspiration += TERRAIN_DEF[cell.terrain].inspirationBonus;
      }

      // 2. Training
      if (s.trainingQueue && s.trainTurnsLeft > 0) {
        s.trainTurnsLeft--;
        if (s.trainTurnsLeft === 0) {
          const def = UNIT_DEF[s.trainingQueue];
          const playerCity = s.grid.flat().find(c => c.terrain === 'playerCity')!;
          const hp = Math.round(def.maxHp * (1 + (s.effects.warriorHpPct ?? 0) / 100));
          const hp2 = Math.round(hp * (1 + (s.buildings.has('cafeteria') ? 10 : 0) / 100));
          const moves = def.maxMoves + (s.effects.unitMoveBonus ?? 0);
          s.units = [...s.units, {
            id: `u${Date.now()}`, type: s.trainingQueue,
            col: playerCity.col + 1, row: playerCity.row,
            hp: hp2, maxHp: hp2, moves, maxMoves: moves, owner: 'player',
          }];
          s.log = [`✅ Юніт готовий: ${def.icon} ${def.label}!`, ...s.log].slice(0, 10);
          s.trainingQueue = null;
        }
      }

      // 3. Enemy Procrastinator regen
      s.units = s.units.map(u => {
        if (u.type === 'procrastinator' && u.owner === 'enemy')
          return { ...u, hp: Math.min(u.maxHp, u.hp + 3) };
        return u;
      });

      // 4. Enemy AI
      const playerCity = s.grid.flat().find(c => c.terrain === 'playerCity')!;
      s.units = s.units.map(u => {
        if (u.owner !== 'enemy') return { ...u, moves: u.maxMoves, hasActed: false, distracted: false };
        // Move toward nearest player unit or city
        const targets = s.units.filter(u2 => u2.owner === 'player');
        const cityTarget = { col: playerCity.col, row: playerCity.row };
        const nearTarget = [...targets, cityTarget].reduce((best, t) => {
          return hexDist(u.col, u.row, t.col, t.row) < hexDist(u.col, u.row, best.col, best.row) ? t : best;
        });
        // Step toward target
        let { col, row } = u;
        let bestD = hexDist(col, row, nearTarget.col, nearTarget.row);
        const dirs = [
          { c: col + 1, r: row }, { c: col - 1, r: row },
          { c: col, r: row + 1 }, { c: col, r: row - 1 },
          { c: col + (row & 1 ? 1 : -1), r: row + 1 },
          { c: col + (row & 1 ? 1 : -1), r: row - 1 },
        ];
        for (const d of dirs) {
          if (d.c < 0 || d.r < 0 || d.c >= COLS || d.r >= ROWS) continue;
          const cellT = s.grid[d.r][d.c].terrain;
          if (!canPass(cellT, u.type, s.effects) && cellT !== 'playerCity') continue;
          if (s.units.some(u2 => u2.col === d.c && u2.row === d.r && u2.id !== u.id)) continue;
          const dd = hexDist(d.c, d.r, nearTarget.col, nearTarget.row);
          if (dd < bestD) { bestD = dd; col = d.c; row = d.r; }
        }
        return { ...u, col, row };
      });

      // Enemy attacks player units
      let playerUnitsAlive = s.units.filter(u => u.owner === 'player');
      let enemyDone = s.units.filter(u => u.owner === 'enemy');
      let newLog = [...s.log];

      enemyDone.forEach(en => {
        const adjacent = playerUnitsAlive.filter(p => hexDist(p.col, p.row, en.col, en.row) <= 1);
        if (adjacent.length > 0) {
          const target = adjacent[0];
          let dmg = UNIT_DEF[en.type].attack;
          if (en.type === 'darkness') dmg += 5;
          if (target.type === 'guardian') dmg = Math.ceil(dmg / 2);
          const newHp = Math.max(s.effects.unitMinHp1 ? 1 : 0, target.hp - dmg);
          playerUnitsAlive = playerUnitsAlive.map(p => p.id === target.id ? { ...p, hp: newHp } : p);
          if (dmg > 0) newLog = [`⚠️ ${UNIT_DEF[en.type].label} атакує ${UNIT_DEF[target.type].label}: -${dmg}HP`, ...newLog].slice(0, 10);
        }
      });
      s.units = [...playerUnitsAlive.filter(u => u.hp > 0), ...enemyDone];

      // PhoneAddict distract effect
      s.units = s.units.map(u => {
        if (u.owner !== 'player') return u;
        const distractor = s.units.find(e => e.type === 'phoneAddict' && hexDist(e.col, e.row, u.col, u.row) === 1);
        if (distractor) return { ...u, maxMoves: Math.max(1, u.maxMoves - 1), distracted: true };
        return u;
      });

      // 5. Enemy spawns every 3 turns
      if (s.turn % 3 === 0) {
        const waveType = getEnemyWave(s.turn);
        const def = UNIT_DEF[waveType];
        const spawnRow = rng(0, ROWS - 1);
        s.units = [...s.units, {
          id: `e${Date.now()}${waveType}`,
          type: waveType, col: COLS - 1, row: spawnRow,
          hp: def.maxHp, maxHp: def.maxHp,
          moves: def.maxMoves, maxMoves: def.maxMoves, owner: 'enemy',
        }];
        newLog = [`👾 Нова хвиля: ${def.icon} ${def.label}!`, ...newLog].slice(0, 10);
      }

      // 6. Events
      const cooldown = s.eventCooldown - 1;
      if (cooldown <= 0 && Math.random() < (s.effects.eventsMore ? 0.6 : 0.3)) {
        const positiveChance = s.buildings.has('theater') ? 0.7 : 0.5;
        const pool = Math.random() < positiveChance
          ? EVENTS.filter(e => e.good)
          : EVENTS.filter(e => !e.good);
        const ev = pool[rng(0, pool.length - 1)];
        const partial = ev.apply(s);
        Object.assign(s, partial);
        s.eventCooldown = rng(2, 4);
      } else {
        s.eventCooldown = cooldown;
      }

      s.log = newLog;

      // 7. Check defeats
      const enemyOnCity = s.units.filter(u => u.owner === 'enemy')
        .some(u => s.grid.flat().find(c => c.terrain === 'playerCity' && c.col === u.col && c.row === u.row));
      const allPlayerDead = s.units.filter(u => u.owner === 'player').length === 0;

      // 8. Darkness boss spawns at turn 20
      if (s.turn === 20 && !s.units.some(u => u.type === 'darkness')) {
        const def = UNIT_DEF.darkness;
        s.units = [...s.units, { id: 'boss1', type: 'darkness', col: COLS - 1, row: Math.floor(ROWS / 2), hp: def.maxHp, maxHp: def.maxHp, moves: def.maxMoves, maxMoves: def.maxMoves, owner: 'enemy' }];
        s.log = ['🌑 УВАГА: Темрява прийшла! Boss з\'явився!', ...s.log].slice(0, 10);
      }

      const newTurn = s.turn + 1;
      const survivalWin = newTurn > s.maxTurns && !enemyOnCity && !allPlayerDead;

      const phase: Phase = enemyOnCity || allPlayerDead ? 'lost'
        : survivalWin ? 'won_survival'
        : s.phase === 'won_knowledge' || s.phase === 'won_military' ? s.phase
        : 'playing';

      return { ...s, turn: newTurn, phase };
    }

    default: return state;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Renderer hook
// ─────────────────────────────────────────────────────────────────────────────
function useRenderer(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  game: GameState,
  hovered: { col: number; row: number } | null,
) {
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    const sel = game.units.find(u => u.id === game.selectedUnitId);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = game.grid[r][c];
        const { x, y } = hexToPixel(c, r);
        const corners = hexCorners(x, y);

        const drawHex = (fill: string, stroke: string, alpha = 1) => {
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.moveTo(corners[0][0], corners[0][1]);
          for (let i = 1; i < 6; i++) ctx.lineTo(corners[i][0], corners[i][1]);
          ctx.closePath();
          ctx.fillStyle = fill;
          ctx.fill();
          ctx.strokeStyle = stroke;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.globalAlpha = 1;
        };

        if (!cell.explored) {
          drawHex('#1e293b', '#334155');
          ctx.font = '10px Arial';
          ctx.fillStyle = '#334155';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('?', x, y);
          continue;
        }

        const td = TERRAIN_DEF[cell.terrain];
        drawHex(td.color, td.borderColor);

        // Reachable overlay
        if (sel && !sel.hasActed) {
          const dist = hexDist(sel.col, sel.row, c, r);
          if (dist > 0 && dist <= sel.moves && canPass(cell.terrain, sel.type, game.effects)) {
            const targetUnit = game.units.find(u => u.col === c && u.row === r);
            if (!targetUnit || targetUnit.owner === 'enemy') {
              drawHex(targetUnit?.owner === 'enemy' ? 'rgba(239,68,68,0.35)' : 'rgba(34,197,94,0.3)',
                targetUnit?.owner === 'enemy' ? '#ef4444' : '#22c55e', 0.6);
            }
          }
        }

        // Hover
        if (hovered?.col === c && hovered?.row === r) {
          ctx.globalAlpha = 0.25;
          ctx.beginPath();
          ctx.moveTo(corners[0][0], corners[0][1]);
          for (let i = 1; i < 6; i++) ctx.lineTo(corners[i][0], corners[i][1]);
          ctx.closePath();
          ctx.fillStyle = '#fff';
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        // Icon
        if (td.icon) {
          ctx.font = `${HEX_SIZE * 0.7}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(td.icon, x, y + 2);
        }
      }
    }

    // Draw units
    for (const u of game.units) {
      const { x, y } = hexToPixel(u.col, u.row);
      const isSelected = u.id === game.selectedUnitId;
      const def = UNIT_DEF[u.type];
      const isPlayer = u.owner === 'player';

      // Shadow
      ctx.beginPath();
      ctx.arc(x, y, 13, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fill();

      // Circle
      ctx.beginPath();
      ctx.arc(x, y - 4, 13, 0, Math.PI * 2);
      const baseColor = isPlayer
        ? (u.type === 'hero' ? '#f59e0b' : u.type === 'aiUnit' ? '#a855f7' : isSelected ? '#22c55e' : '#3b82f6')
        : (u.type === 'darkness' ? '#7f1d1d' : '#ef4444');
      ctx.fillStyle = baseColor;
      ctx.fill();
      if (isSelected) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        // Pulse ring
        ctx.beginPath();
        ctx.arc(x, y - 4, 17, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Icon
      ctx.font = `${HEX_SIZE * 0.55}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(def.icon, x, y - 4);

      // HP bar
      const bw = 24, bh = 3.5;
      const bx = x - bw / 2, by = y + 11;
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(bx, by, bw, bh);
      const hpRatio = u.hp / u.maxHp;
      ctx.fillStyle = hpRatio > 0.5 ? '#22c55e' : hpRatio > 0.25 ? '#f59e0b' : '#ef4444';
      ctx.fillRect(bx, by, bw * hpRatio, bh);

      // Distracted indicator
      if (u.distracted) {
        ctx.font = '10px Arial';
        ctx.fillText('😵', x + 12, y - 14);
      }
    }
  }, [game, hovered, canvasRef]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tech Tree UI
// ─────────────────────────────────────────────────────────────────────────────
function TechTreeModal({ game, dispatch, onClose }: {
  game: GameState;
  dispatch: React.Dispatch<Action>;
  onClose: () => void;
}) {
  const branches: { id: TechBranch; label: string; color: string; techs: TechId[] }[] = [
    { id: 'academy',    label: '📚 Академія',    color: '#3b82f6', techs: ['basicLearning','advStudies','researchMethods','sciRevolution','universalKnowledge'] },
    { id: 'defense',    label: '⚔️ Захист',       color: '#ef4444', techs: ['basicTraining','tactics','teamStrategy','eliteForces','ironWill'] },
    { id: 'innovation', label: '💡 Інновація',    color: '#a855f7', techs: ['creativeThin','problemSolv','aiAssist','synthKnow','transcendence'] },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 text-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-extrabold">🔬 Дерево Технологій</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">✕</button>
        </div>
        <p className="text-slate-400 text-sm mb-6">
          💡 Поточний баланс: <span className="text-blue-400 font-bold">{game.knowledge}📚</span>
        </p>

        <div className="flex flex-col gap-8">
          {branches.map(branch => (
            <div key={branch.id}>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-0.5 flex-1 rounded" style={{ background: branch.color }} />
                <p className="font-extrabold text-sm px-2" style={{ color: branch.color }}>{branch.label}</p>
                <div className="h-0.5 flex-1 rounded" style={{ background: branch.color }} />
              </div>

              <div className="flex items-center gap-2">
                {branch.techs.map((tid, i) => {
                  const tech = TECH[tid];
                  const learned = game.techs.has(tid);
                  const canLearn = game.knowledge >= tech.cost
                    && (!tech.requires || game.techs.has(tech.requires))
                    && !learned;
                  const blocked = !learned && tech.requires && !game.techs.has(tech.requires);

                  return (
                    <div key={tid} className="flex items-center">
                      {i > 0 && (
                        <div className={cx('w-6 h-0.5', learned || game.techs.has(branch.techs[i - 1]) ? 'opacity-80' : 'opacity-20')}
                          style={{ background: branch.color }} />
                      )}
                      <button
                        onClick={() => canLearn && dispatch({ type: 'RESEARCH', tech: tid })}
                        className={cx(
                          'relative flex flex-col items-center gap-1 p-3 rounded-xl border-2 w-28 text-center transition-all',
                          learned ? 'border-emerald-500 bg-emerald-900/40'
                            : canLearn ? 'border-amber-400 bg-amber-900/30 hover:bg-amber-900/50 cursor-pointer'
                            : blocked ? 'border-slate-700 bg-slate-800/50 opacity-40 cursor-not-allowed'
                            : 'border-slate-600 bg-slate-800/50 opacity-60 cursor-not-allowed'
                        )}>
                        {learned && (
                          <div className="absolute -top-2 -right-2 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-xs">✓</div>
                        )}
                        <span className="text-2xl">{tech.icon}</span>
                        <p className="text-[10px] font-bold leading-tight">{tech.label}</p>
                        <p className="text-[9px] text-slate-400 leading-tight">{tech.desc}</p>
                        <p className={cx('text-xs font-bold mt-1', canLearn ? 'text-amber-400' : 'text-slate-500')}>
                          {tech.cost}📚
                        </p>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-slate-800 rounded-xl text-sm text-slate-300">
          <p className="font-bold mb-2 text-white">🏆 Умови перемоги через технології:</p>
          <p>📚 <span className="text-blue-400">Knowledge Victory</span> — досліди всю гілку Академія + побудуй Мережу Знань</p>
          <p>💡 <span className="text-purple-400">Трансцендентність</span> — стає доступна спецздатність Burst of Insight (-10HP всім)</p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Build Panel
// ─────────────────────────────────────────────────────────────────────────────
function BuildPanel({ game, dispatch }: { game: GameState; dispatch: React.Dispatch<Action> }) {
  const allBuildings = Object.keys(BUILDING_DEF) as BuildingId[];

  return (
    <div className="grid grid-cols-1 gap-1.5 max-h-52 overflow-y-auto pr-1">
      {allBuildings.map(bid => {
        const def = BUILDING_DEF[bid];
        const built = game.buildings.has(bid);
        const reqs = def.requires ?? [];
        const reqsMet = reqs.every(r => game.buildings.has(r));
        const canBuild = !built && reqsMet && game.knowledge >= def.cost;

        return (
          <button key={bid}
            onClick={() => canBuild && dispatch({ type: 'BUILD', building: bid })}
            className={cx(
              'flex items-center gap-2 p-2 rounded-xl text-left text-xs transition',
              built ? 'bg-emerald-900/40 border border-emerald-700'
                : canBuild ? 'bg-amber-900/30 border border-amber-600 hover:bg-amber-900/50 cursor-pointer'
                : 'bg-slate-800/50 border border-slate-700 opacity-50 cursor-not-allowed'
            )}>
            <span className="text-lg flex-shrink-0">{def.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white text-[11px]">{def.label}</p>
              <p className="text-slate-400 text-[9px] truncate">{def.desc}</p>
            </div>
            {built ? <span className="text-emerald-400 text-xs">✓</span>
              : <span className="text-amber-400 font-bold text-xs flex-shrink-0">{def.cost}📚</span>}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Train Panel
// ─────────────────────────────────────────────────────────────────────────────
function TrainPanel({ game, dispatch }: { game: GameState; dispatch: React.Dispatch<Action> }) {
  const playerTypes: UnitType[] = ['warrior', 'scholar'];
  if (game.effects.unlockArcher) playerTypes.push('archer');
  if (game.effects.unlockGuardian) playerTypes.push('guardian');
  if (game.effects.unlockSage) playerTypes.push('sage');
  if (game.effects.unlockHero && !game.heroUsed) playerTypes.push('hero');
  if (game.effects.unlockAi) playerTypes.push('aiUnit');

  return (
    <div className="flex flex-col gap-1.5">
      {game.trainingQueue && (
        <div className="bg-blue-900/40 border border-blue-600 rounded-xl p-2 text-xs text-blue-300">
          🏋️ Тренується: {UNIT_DEF[game.trainingQueue].icon} ({game.trainTurnsLeft} ходів)
        </div>
      )}
      {!game.trainingQueue && playerTypes.map(ut => {
        const def = UNIT_DEF[ut];
        const can = game.energy >= def.trainEnergy;
        return (
          <button key={ut}
            onClick={() => can && dispatch({ type: 'TRAIN', unitType: ut })}
            className={cx(
              'flex items-center gap-2 p-2 rounded-xl text-left text-xs transition',
              can ? 'bg-blue-900/30 border border-blue-600 hover:bg-blue-900/50 cursor-pointer'
                : 'bg-slate-800/50 border border-slate-700 opacity-40 cursor-not-allowed'
            )}>
            <span className="text-lg">{def.icon}</span>
            <div className="flex-1">
              <p className="font-semibold text-white">{def.label}</p>
              <p className="text-slate-400 text-[9px]">HP:{def.maxHp} Mv:{def.maxMoves} Atk:{def.attack}</p>
            </div>
            <span className="text-cyan-400 font-bold">{def.trainEnergy}⚡</span>
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export function CivGamePage() {
  const [game, dispatch] = useReducer(reducer, undefined, initGame);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hovered, setHovered] = useState<{ col: number; row: number } | null>(null);
  const [panel, setPanel] = useState<'units' | 'build' | 'train' | 'log'>('units');
  const [showTech, setShowTech] = useState(false);

  useRenderer(canvasRef, game, hovered);

  // Award coins on win
  useEffect(() => {
    if (game.phase.startsWith('won')) {
      const coins = game.phase === 'won_knowledge' ? 200
        : game.phase === 'won_military' ? 150
        : 100;
      // Send as JSON body — ASP.NET [FromBody] int accepts bare JSON number
      api.post('/gamification/award-coins', coins, {
        headers: { 'Content-Type': 'application/json' }
      }).catch(() => {});
    }
  }, [game.phase]);

  const W = Math.ceil(HW * COLS + HEX_SIZE * 2);
  const H = Math.ceil(HH * 0.75 * ROWS + HH * 0.75 + HEX_SIZE);

  function getHexAt(px: number, py: number) {
    let best: { col: number; row: number } | null = null;
    let bestD = Infinity;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const { x, y } = hexToPixel(c, r);
        const d = Math.hypot(px - x, py - y);
        if (d < bestD) { bestD = d; best = { col: c, row: r }; }
      }
    return bestD < HEX_SIZE + 4 ? best : null;
  }

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

  const playerUnits = game.units.filter(u => u.owner === 'player');
  const enemyUnits  = game.units.filter(u => u.owner === 'enemy');
  const selUnit     = game.units.find(u => u.id === game.selectedUnitId);

  const phaseInfo: Record<Phase, { icon: string; label: string; color: string }> = {
    won_knowledge: { icon: '🏆', label: 'Перемога Знань!',    color: 'bg-blue-50 border-blue-300' },
    won_military:  { icon: '⚔️', label: 'Військова Перемога!', color: 'bg-emerald-50 border-emerald-300' },
    won_survival:  { icon: '🛡️', label: 'Перемога Виживання!', color: 'bg-amber-50 border-amber-300' },
    lost:          { icon: '💀', label: 'Академія впала...',    color: 'bg-rose-50 border-rose-300' },
    playing:       { icon: '', label: '', color: '' },
  };

  return (
    <Layout title="Академія Знань" subtitle="Hex-стратегія · Захищай знання від прокрастинаторів">
      {showTech && <TechTreeModal game={game} dispatch={dispatch} onClose={() => setShowTech(false)} />}

      {game.phase !== 'playing' && (
        <div className={cx('mb-4 p-5 rounded-2xl text-center border-2', phaseInfo[game.phase].color)}>
          <p className="text-4xl mb-2">{phaseInfo[game.phase].icon}</p>
          <p className="font-extrabold text-xl">{phaseInfo[game.phase].label}</p>
          <p className="text-ink-500 mt-1">📚 {game.knowledge} | ⚡ {game.energy} | 💡 {game.inspiration} | 🪙 {game.coins}</p>
          <button onClick={() => dispatch({ type: 'RESTART' })} className="btn btn-primary mt-4 px-8">
            🔄 Нова Гра
          </button>
        </div>
      )}

      {/* Resource bar */}
      <div className="flex flex-wrap items-center gap-3 mb-3 bg-slate-900 text-white rounded-2xl px-5 py-3">
        {[
          { icon: '📚', val: game.knowledge, rate: game.kPerTurn, label: 'Знання' },
          { icon: '⚡', val: game.energy,    rate: game.ePerTurn, label: 'Енергія' },
          { icon: '💡', val: game.inspiration, rate: game.iPerTurn, label: 'Натхнення' },
          { icon: '🪙', val: game.coins, rate: 0, label: 'Монети' },
        ].map(r => (
          <div key={r.label} className="flex items-center gap-1.5">
            <span>{r.icon}</span>
            <span className="font-bold text-lg">{r.val}</span>
            {r.rate > 0 && <span className="text-emerald-400 text-xs">+{r.rate}/хід</span>}
          </div>
        ))}
        <div className="ml-auto flex items-center gap-2 text-sm">
          <span className="text-slate-400">Хід</span>
          <span className="font-extrabold text-amber-400">{game.turn}/{game.maxTurns}</span>
        </div>
      </div>

      <div className="flex gap-3 flex-col xl:flex-row">
        {/* Canvas */}
        <div className="overflow-x-auto rounded-2xl border border-slate-700 shadow-2xl flex-shrink-0">
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

        {/* Sidebar */}
        <div className="flex flex-col gap-3 min-w-[220px] max-w-[280px]">
          {/* Selected unit */}
          {selUnit && (
            <div className="bg-slate-900 text-white rounded-2xl p-3">
              <p className="text-xs text-slate-400 uppercase font-bold mb-2">Обраний юніт</p>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{UNIT_DEF[selUnit.type].icon}</span>
                <div>
                  <p className="font-bold">{UNIT_DEF[selUnit.type].label}</p>
                  <p className="text-xs text-slate-400">{selUnit.col},{selUnit.row}</p>
                </div>
              </div>
              <div className="h-2 bg-slate-700 rounded overflow-hidden mb-1">
                <div className="h-full bg-emerald-500 rounded" style={{ width: `${(selUnit.hp / selUnit.maxHp) * 100}%` }} />
              </div>
              <p className="text-xs text-slate-400 mb-2">HP {selUnit.hp}/{selUnit.maxHp} · Ходи {selUnit.moves}/{selUnit.maxMoves}</p>
              <button onClick={() => dispatch({ type: 'SELECT_UNIT', id: null })}
                className="w-full bg-slate-700 hover:bg-slate-600 rounded-xl py-1 text-xs transition">
                Скасувати вибір
              </button>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <button onClick={() => setShowTech(true)}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-white rounded-xl py-2 text-xs font-bold transition border border-slate-600">
              🔬 Технології
            </button>
            {game.effects.aoeAbility && !game.aoeUsed && (
              <button
                onClick={() => game.inspiration >= 10 && dispatch({ type: 'USE_AOE' })}
                className={cx(
                  'flex-1 rounded-xl py-2 text-xs font-bold transition border',
                  game.inspiration >= 10
                    ? 'bg-purple-700 hover:bg-purple-600 text-white border-purple-500'
                    : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                )}>
                ✨ Burst (-10💡)
              </button>
            )}
          </div>

          {/* Panel tabs */}
          <div className="bg-slate-900 text-white rounded-2xl overflow-hidden">
            <div className="flex border-b border-slate-700">
              {(['units', 'build', 'train', 'log'] as const).map(p => (
                <button key={p} onClick={() => setPanel(p)}
                  className={cx(
                    'flex-1 py-2 text-[10px] font-bold uppercase tracking-wide transition',
                    panel === p ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-white'
                  )}>
                  {{ units: '⚔️', build: '🏛️', train: '🏋️', log: '📜' }[p]}
                </button>
              ))}
            </div>

            <div className="p-3">
              {panel === 'units' && (
                <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto">
                  <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">
                    Твої ({playerUnits.length}) · Вороги ({enemyUnits.length})
                  </p>
                  {playerUnits.map(u => (
                    <button key={u.id}
                      onClick={() => dispatch({ type: 'SELECT_UNIT', id: u.id })}
                      className={cx(
                        'flex items-center gap-2 p-2 rounded-xl text-left text-xs transition',
                        game.selectedUnitId === u.id ? 'bg-blue-700 border border-blue-400'
                          : u.moves === 0 ? 'bg-slate-800 opacity-60'
                          : 'bg-slate-800 hover:bg-slate-700 border border-slate-700'
                      )}>
                      <span>{UNIT_DEF[u.type].icon}</span>
                      <div className="flex-1">
                        <p className="font-semibold">{UNIT_DEF[u.type].label}</p>
                        <div className="h-1.5 bg-slate-600 rounded overflow-hidden mt-0.5">
                          <div className="h-full bg-emerald-500 rounded" style={{ width: `${(u.hp / u.maxHp) * 100}%` }} />
                        </div>
                      </div>
                      <span className="text-slate-400">{u.moves}↑</span>
                    </button>
                  ))}
                </div>
              )}

              {panel === 'build' && <BuildPanel game={game} dispatch={dispatch} />}
              {panel === 'train' && <TrainPanel game={game} dispatch={dispatch} />}
              {panel === 'log' && (
                <div className="flex flex-col gap-1 max-h-56 overflow-y-auto">
                  {game.log.map((msg, i) => (
                    <p key={i} className={cx('text-[10px]', i === 0 ? 'text-white font-semibold' : 'text-slate-500')}>{msg}</p>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* End turn */}
          <button
            onClick={() => dispatch({ type: 'END_TURN' })}
            disabled={game.phase !== 'playing'}
            className="btn btn-primary py-3 text-sm disabled:opacity-50 font-extrabold">
            ↩️ Завершити хід
          </button>

          {/* Legend */}
          <div className="bg-slate-900 rounded-2xl p-3 text-[10px] text-slate-400">
            <p className="font-bold text-slate-300 mb-1">📖 Як грати:</p>
            <p>• Клікни юніт → вибери ціль для руху/атаки</p>
            <p>• Зелені hex = доступні для руху</p>
            <p>• Червоні hex = атакувати ворога</p>
            <p>• Нові ресурси: 📜Бібліотека, 💎Печера</p>
            <p>• Кожні 3 ходи — нова хвиля ворогів</p>
            <p>• Хід 20 — Boss🌑 Темрява!</p>
          </div>

          {/* Victory conditions */}
          <div className="bg-slate-900 rounded-2xl p-3 text-[10px]">
            <p className="font-bold text-white mb-2">🏆 Умови перемоги:</p>
            <div className="flex flex-col gap-1">
              <p className={cx('flex items-center gap-1', game.phase === 'won_knowledge' ? 'text-blue-400' : 'text-slate-400')}>
                📚 Knowledge — Research Academy T5 + Мережа Знань
              </p>
              <p className={cx('flex items-center gap-1', game.phase === 'won_military' ? 'text-emerald-400' : 'text-slate-400')}>
                ⚔️ Military — Знищи всіх ворогів
              </p>
              <p className={cx('flex items-center gap-1', game.phase === 'won_survival' ? 'text-amber-400' : 'text-slate-400')}>
                🛡️ Survival — Вижи {game.maxTurns} ходів
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
