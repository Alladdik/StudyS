// ─── Terrain ─────────────────────────────────────────────────────────────────
export type TerrainId =
  | 'meadow' | 'forest' | 'mountain' | 'river' | 'desert' | 'tundra' | 'swamp'
  | 'ancientLib' | 'crystal' | 'village'
  | 'barbarianCamp'
  | 'playerCity' | 'enemyCity' | 'neutralCity';

// ─── Civilizations ────────────────────────────────────────────────────────────
export type CivId = 'academy' | 'legion' | 'innovators' | 'natureFolk';

export interface CivDef {
  id: CivId;
  name: string;
  icon: string;
  color: string;
  description: string;
  bonus: string;
  startUnits: UnitType[];
  kBonus: number;
  eBonus: number;
  iBonus: number;
  coinsBonus: number;
  techCostPct: number;
  forestPassable: boolean;
  riverPassable: boolean;
}

// ─── Buildings ────────────────────────────────────────────────────────────────
export type BuildingId =
  | 'school' | 'library' | 'cafeteria' | 'training' | 'lab'
  | 'theater' | 'observatory' | 'gym' | 'market' | 'watchtower'
  | 'greatHall' | 'knowledgeNet'
  | 'wonder_wall' | 'wonder_colosseum' | 'wonder_oracle';

// ─── Tech tree ────────────────────────────────────────────────────────────────
export type TechBranch = 'academy' | 'defense' | 'innovation' | 'commerce' | 'diplomacy';
export type TechId =
  // Academy
  | 'basicLearning' | 'advStudies' | 'researchMethods' | 'sciRevolution' | 'universalKnowledge'
  // Defense
  | 'basicTraining' | 'tactics' | 'teamStrategy' | 'eliteForces' | 'ironWill'
  // Innovation
  | 'creativeThin' | 'problemSolv' | 'aiAssist' | 'synthKnow' | 'transcendence'
  // Commerce
  | 'tradeRoutes' | 'banking' | 'merchants' | 'monopoly' | 'goldAge'
  // Diplomacy
  | 'envoys' | 'treaties' | 'espionage' | 'alliances' | 'worldOrder';

export interface GameEffects {
  kBonus: number;
  eBonus: number;
  iBonus: number;
  coinsBonus: number;
  allResBonus: number;
  warriorHpPct: number;
  unitMoveBonus: number;
  unitGroupBonusPct: number;
  unitMinHp1: boolean;
  scholarHeals: boolean;
  eventsMore: boolean;
  unlockArcher: boolean;
  unlockSage: boolean;
  unlockGuardian: boolean;
  unlockHero: boolean;
  unlockAi: boolean;
  unlockCavalry: boolean;
  unlockCatapult: boolean;
  unlockSettler: boolean;
  unlockDiplomat: boolean;
  aoeAbility: boolean;
  bridgePassable: boolean;
  barbarianPeace: boolean;
  visionBonus: number;
}

// ─── Units ────────────────────────────────────────────────────────────────────
export type UnitType =
  // Player
  | 'warrior' | 'scholar' | 'archer' | 'guardian' | 'sage'
  | 'hero' | 'aiUnit' | 'cavalry' | 'catapult' | 'settler' | 'diplomat'
  // Enemy civ
  | 'lazy' | 'phoneAddict' | 'gamer' | 'procrastinator' | 'darkness'
  // Barbarians
  | 'barbarian' | 'barbarianChief';

export type UnitOwner = 'player' | 'enemy' | 'barbarian';

export interface Unit {
  id: string;
  type: UnitType;
  col: number;
  row: number;
  hp: number;
  maxHp: number;
  moves: number;
  maxMoves: number;
  owner: UnitOwner;
  hasActed?: boolean;
  distracted?: boolean;
  xp?: number;           // experience — levels up unit
  level?: number;        // 1-3, +10% stats per level
}

// ─── Grid ─────────────────────────────────────────────────────────────────────
export interface Cell {
  col: number;
  row: number;
  terrain: TerrainId;
  explored: boolean;
  harvested?: boolean;
  hasCamp?: boolean;      // barbarian camp still active
  campCooldown?: number;  // turns until next spawn
  resource?: 'iron' | 'stone' | 'food' | 'gold'; // bonus resource
}

// ─── Events ──────────────────────────────────────────────────────────────────
export interface EventChoice {
  label: string;
  desc: string;
  apply: (s: GameState) => Partial<GameState>;
}

export interface GameEvent {
  id: string;
  icon: string;
  title: string;
  desc: string;
  good: boolean;
  choices: [EventChoice, EventChoice];
}

// ─── Floating damage ─────────────────────────────────────────────────────────
export interface FloatText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  born: number;  // Date.now()
}

// ─── Game State ───────────────────────────────────────────────────────────────
export type Phase =
  | 'menu' | 'civSelect'
  | 'playing' | 'eventPause'
  | 'won_knowledge' | 'won_military' | 'won_survival' | 'lost';

export type MultiplayerRole = 'host' | 'guest' | null;

export interface GameState {
  // Meta
  phase: Phase;
  civId: CivId | null;
  turn: number;
  maxTurns: number;
  playerName: string;

  // Resources
  knowledge: number;
  energy: number;
  inspiration: number;
  coins: number;
  kPerTurn: number;
  ePerTurn: number;
  iPerTurn: number;
  coinsPerTurn: number;

  // Map
  grid: Cell[][];
  units: Unit[];

  // Progress
  buildings: BuildingId[];
  techs: TechId[];
  researchQueue: TechId | null;
  trainingQueue: UnitType | null;
  trainTurnsLeft: number;

  // Interaction
  selectedUnitId: string | null;
  effects: Partial<GameEffects>;

  // Events
  currentEvent: GameEvent | null;
  eventCooldown: number;

  // Log
  log: string[];

  // Abilities
  heroUsed: boolean;
  aoeUsed: boolean;

  // Multiplayer
  multiplayerRole: MultiplayerRole;
  roomCode: string | null;
  isMyTurn: boolean;
  opponentName: string | null;
  chatMessages: { from: string; text: string }[];
}

// ─── Actions ─────────────────────────────────────────────────────────────────
export type Action =
  | { type: 'START_GAME'; civId: CivId; playerName: string }
  | { type: 'SELECT_UNIT'; id: string | null }
  | { type: 'MOVE_OR_ATTACK'; col: number; row: number }
  | { type: 'BUILD'; building: BuildingId }
  | { type: 'RESEARCH'; tech: TechId }
  | { type: 'TRAIN'; unitType: UnitType }
  | { type: 'USE_AOE' }
  | { type: 'CHOOSE_EVENT'; choiceIdx: 0 | 1 }
  | { type: 'END_TURN' }
  | { type: 'LOAD_STATE'; state: GameState }
  | { type: 'MULTIPLAYER_TURN_RECEIVED'; stateJson: string }
  | { type: 'CHAT_RECEIVED'; from: string; text: string }
  | { type: 'RESTART' };
