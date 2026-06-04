import type { TerrainId, UnitType, GameEffects, CivId } from './types';

export interface TerrainDef {
  color: string;
  borderColor: string;
  glowColor?: string;
  icon: string;
  label: string;
  passable: boolean;
  moveCost: number;          // movement points to enter (default 1)
  knowledgeBonus: number;
  energyBonus: number;
  inspirationBonus: number;
  coinsBonus: number;
  healBonus?: number;        // HP healed per turn for units standing here
}

export const TERRAIN: Record<TerrainId, TerrainDef> = {
  meadow:       { color: '#86efac', borderColor: '#16a34a', icon: '🌿', label: 'Луг',                passable: true,  moveCost: 1, knowledgeBonus: 0,  energyBonus: 1,  inspirationBonus: 0, coinsBonus: 0 },
  forest:       { color: '#15803d', borderColor: '#052e16', icon: '🌲', label: 'Ліс',                passable: true,  moveCost: 2, knowledgeBonus: 2,  energyBonus: 0,  inspirationBonus: 0, coinsBonus: 0, healBonus: 1 },
  mountain:     { color: '#94a3b8', borderColor: '#475569', icon: '⛰️', label: 'Гора',               passable: false, moveCost: 3, knowledgeBonus: 3,  energyBonus: 0,  inspirationBonus: 0, coinsBonus: 0 },
  river:        { color: '#38bdf8', borderColor: '#0369a1', icon: '🌊', label: 'Ріка',               passable: false, moveCost: 2, knowledgeBonus: 0,  energyBonus: 0,  inspirationBonus: 2, coinsBonus: 1 },
  desert:       { color: '#fde68a', borderColor: '#d97706', icon: '🏜️', label: 'Пустеля',           passable: true,  moveCost: 2, knowledgeBonus: 0,  energyBonus: -1, inspirationBonus: 0, coinsBonus: 0 },
  tundra:       { color: '#e2e8f0', borderColor: '#94a3b8', icon: '❄️', label: 'Тундра',             passable: true,  moveCost: 2, knowledgeBonus: 0,  energyBonus: 0,  inspirationBonus: 0, coinsBonus: 0 },
  swamp:        { color: '#6b7280', borderColor: '#374151', icon: '🌫️', label: 'Болото',             passable: true,  moveCost: 3, knowledgeBonus: 0,  energyBonus: 0,  inspirationBonus: 1, coinsBonus: 0 },
  ancientLib:   { color: '#fbbf24', borderColor: '#d97706', glowColor: '#f59e0b', icon: '📜', label: 'Стародавня Бібліотека', passable: true, moveCost: 1, knowledgeBonus: 12, energyBonus: 0, inspirationBonus: 0, coinsBonus: 0 },
  crystal:      { color: '#e9d5ff', borderColor: '#7c3aed', glowColor: '#a855f7', icon: '💎', label: 'Кристальна Печера',    passable: true, moveCost: 1, knowledgeBonus: 0,  energyBonus: 0, inspirationBonus: 6, coinsBonus: 3 },
  village:      { color: '#fed7aa', borderColor: '#ea580c', icon: '🏘️', label: 'Нейтральне Село',    passable: true,  moveCost: 1, knowledgeBonus: 0,  energyBonus: 2,  inspirationBonus: 0, coinsBonus: 5 },
  barbarianCamp:{ color: '#7f1d1d', borderColor: '#450a0a', glowColor: '#dc2626', icon: '💀', label: 'Табір Варварів',      passable: true,  moveCost: 1, knowledgeBonus: 0,  energyBonus: 0, inspirationBonus: 0, coinsBonus: 0 },
  playerCity:   { color: '#fbbf24', borderColor: '#b45309', glowColor: '#f59e0b', icon: '🏫', label: 'Академія',            passable: true,  moveCost: 1, knowledgeBonus: 5,  energyBonus: 3, inspirationBonus: 1, coinsBonus: 2 },
  enemyCity:    { color: '#f87171', borderColor: '#991b1b', icon: '👹', label: 'Лігво Ворогів',       passable: true,  moveCost: 1, knowledgeBonus: 0,  energyBonus: 0,  inspirationBonus: 0, coinsBonus: 0 },
  neutralCity:  { color: '#e2e8f0', borderColor: '#94a3b8', icon: '🏙️', label: 'Нейтральне Місто',   passable: true,  moveCost: 1, knowledgeBonus: 2,  energyBonus: 2,  inspirationBonus: 1, coinsBonus: 3 },
};

export function canPass(
  terrain: TerrainId,
  unitType: UnitType,
  effects: Partial<GameEffects>,
  civId: CivId | null,
): boolean {
  const t = TERRAIN[terrain];
  if (!t) return false;
  if (terrain === 'mountain') return unitType === 'scholar' || unitType === 'catapult';
  if (terrain === 'river') {
    return !!(effects.bridgePassable || civId === 'natureFolk' || civId === 'innovators');
  }
  if (terrain === 'forest') {
    return t.passable && (civId === 'natureFolk' || true); // forests always passable just cost 2
  }
  return t.passable;
}
