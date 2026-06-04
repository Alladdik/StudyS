import type { GameState, Action, Phase, UnitType, BuildingId, TechId, GameEffects } from './types';
import { CIVS } from './civs';
import { TERRAIN, canPass } from './terrain';
import { BUILDINGS, computePerTurn } from './buildings';
import { TECHS, mergeEffects } from './techs';
import { UNITS, getEnemyWave } from './units';
import { pickEvent } from './events';
import { generateMap, initUnits, hexDist, COLS, ROWS } from './mapGen';

const rng = (lo: number, hi: number) => Math.floor(Math.random() * (hi - lo + 1)) + lo;

function makeInitState(): GameState {
  return {
    phase: 'menu',
    civId: null,
    turn: 1,
    maxTurns: 35,
    playerName: '',
    knowledge: 20,
    energy: 15,
    inspiration: 5,
    coins: 10,
    kPerTurn: 2,
    ePerTurn: 1,
    iPerTurn: 0,
    coinsPerTurn: 0,
    grid: [],
    units: [],
    buildings: ['school'],
    techs: [],
    researchQueue: null,
    trainingQueue: null,
    trainTurnsLeft: 0,
    selectedUnitId: null,
    effects: {},
    currentEvent: null,
    eventCooldown: 3,
    log: ['📜 Ласкаво просимо до Академії Знань!'],
    heroUsed: false,
    aoeUsed: false,
    multiplayerRole: null,
    roomCode: null,
    isMyTurn: true,
    opponentName: null,
    chatMessages: [],
  };
}

function recalc(s: GameState): GameState {
  const eff = mergeEffects(s.techs);
  const civ = s.civId ? CIVS[s.civId] : null;
  const combined: Partial<GameEffects> = {
    ...eff,
    kBonus: (eff.kBonus ?? 0) + (civ?.kBonus ?? 0),
    eBonus: (eff.eBonus ?? 0) + (civ?.eBonus ?? 0),
    iBonus: (eff.iBonus ?? 0) + (civ?.iBonus ?? 0),
    coinsBonus: (eff.coinsBonus ?? 0) + (civ?.coinsBonus ?? 0),
    bridgePassable: !!(eff.bridgePassable || civ?.riverPassable),
  };
  const { kPerTurn, ePerTurn, iPerTurn, coinsPerTurn } = computePerTurn(
    s.buildings,
    s.buildings.includes('greatHall'),
    combined.allResBonus ?? 0,
  );
  return {
    ...s,
    effects: combined,
    kPerTurn: kPerTurn + (combined.kBonus ?? 0),
    ePerTurn: ePerTurn + (combined.eBonus ?? 0),
    iPerTurn: iPerTurn + (combined.iBonus ?? 0),
    coinsPerTurn: coinsPerTurn + (combined.coinsBonus ?? 0),
  };
}

function addLog(s: GameState, msg: string): string[] {
  return [msg, ...s.log].slice(0, 14);
}

export function reducer(state: GameState, action: Action): GameState {
  if (state.phase !== 'playing' && state.phase !== 'eventPause' && action.type !== 'START_GAME' && action.type !== 'RESTART' && action.type !== 'LOAD_STATE' && action.type !== 'MULTIPLAYER_TURN_RECEIVED' && action.type !== 'CHAT_RECEIVED') return state;

  switch (action.type) {

    case 'RESTART': return makeInitState();

    case 'LOAD_STATE': return { ...action.state, phase: 'playing' };

    case 'CHAT_RECEIVED':
      return { ...state, chatMessages: [...state.chatMessages, { from: action.from, text: action.text }].slice(-30) };

    case 'MULTIPLAYER_TURN_RECEIVED': {
      try {
        const parsed = JSON.parse(action.stateJson) as GameState;
        // Convert arrays back from serialized form
        return { ...parsed, isMyTurn: true, phase: 'playing' };
      } catch { return state; }
    }

    case 'START_GAME': {
      const civ = CIVS[action.civId];
      const grid = generateMap();
      const units = initUnits(action.civId);
      const buildings: BuildingId[] = ['school'];
      const techs: TechId[] = [];
      const effects = mergeEffects(techs);
      const { kPerTurn, ePerTurn, iPerTurn, coinsPerTurn } = computePerTurn(buildings, false, 0);
      return {
        ...makeInitState(),
        phase: 'playing',
        civId: action.civId,
        playerName: action.playerName,
        knowledge: 25 + (civ.kBonus * 2),
        energy: 15 + (civ.eBonus * 2),
        inspiration: 5 + civ.iBonus,
        coins: 10 + (civ.coinsBonus * 2),
        kPerTurn: kPerTurn + civ.kBonus,
        ePerTurn: ePerTurn + civ.eBonus,
        iPerTurn: iPerTurn + civ.iBonus,
        coinsPerTurn: coinsPerTurn + civ.coinsBonus,
        grid, units,
        buildings, techs, effects,
        log: [`🏛️ Цивілізація «${civ.name}» заснована! ${civ.bonus}`],
      };
    }

    case 'SELECT_UNIT': {
      if (state.phase !== 'playing') return state;
      const u = state.units.find(u => u.id === action.id && u.owner === 'player');
      if (u?.moves === 0 || u?.hasActed) return { ...state, selectedUnitId: null };
      return { ...state, selectedUnitId: action.id };
    }

    case 'CHOOSE_EVENT': {
      if (!state.currentEvent) return { ...state, phase: 'playing' };
      const choice = state.currentEvent.choices[action.choiceIdx];
      const partial = choice.apply(state);
      return { ...state, ...partial, currentEvent: null, phase: 'playing' };
    }

    case 'MOVE_OR_ATTACK': {
      if (state.phase !== 'playing') return state;
      const sel = state.units.find(u => u.id === state.selectedUnitId);
      if (!sel || sel.moves === 0 || sel.hasActed) return { ...state, selectedUnitId: null };

      const { col, row } = action;
      const targetUnit = state.units.find(u => u.col === col && u.row === row);
      const cell = state.grid[row]?.[col];
      if (!cell) return state;
      const dist = hexDist(sel.col, sel.row, col, row);
      const def = UNITS[sel.type];

      // ── Settler: found city ──────────────────────────────────────────────
      if (sel.type === 'settler' && !targetUnit && cell.terrain === 'meadow' && dist <= sel.moves) {
        const newGrid = state.grid.map(rowArr => rowArr.map(c =>
          c.col === col && c.row === row ? { ...c, terrain: 'playerCity' as const } : c
        ));
        const newUnits = state.units.filter(u => u.id !== sel.id);
        return recalc({ ...state, grid: newGrid, units: newUnits, selectedUnitId: null,
          log: addLog(state, `🏕️ Нове місто засновано на (${col},${row})!`) });
      }

      // ── Attack ───────────────────────────────────────────────────────────
      if (targetUnit && targetUnit.owner !== 'player' && dist <= (def.range ?? 1)) {
        let dmg = def.attack + ((sel.level ?? 1) - 1) * 2;

        // Group bonus
        if ((state.effects.unitGroupBonusPct ?? 0) > 0) {
          const allies = state.units.filter(u => u.owner === 'player' && u.id !== sel.id && hexDist(u.col, u.row, sel.col, sel.row) === 1).length;
          if (allies > 0) dmg = Math.round(dmg * (1 + (state.effects.unitGroupBonusPct ?? 0) / 100));
        }

        // Target resistances
        if (targetUnit.type === 'guardian') dmg = Math.ceil(dmg / 2);
        if (targetUnit.type === 'gamer' && targetUnit.hasActed) dmg = 0; // dodge

        // Colosseum attack bonus
        if (state.buildings.includes('wonder_colosseum')) dmg = Math.round(dmg * 1.2);

        let newHp = targetUnit.hp - dmg;
        const killed = newHp <= 0;

        let newUnits = state.units.map(u => {
          if (u.id === targetUnit.id) return { ...u, hp: newHp };
          if (u.id === sel.id) {
            const newXp = (u.xp ?? 0) + (killed ? 30 : 10);
            const newLevel = newXp >= 60 ? 3 : newXp >= 30 ? 2 : 1;
            return { ...u, moves: 0, hasActed: true, xp: newXp, level: newLevel };
          }
          return u;
        }).filter(u => u.hp > 0);

        // Scholar heals after kill
        if (killed && sel.type === 'scholar' && state.effects.scholarHeals) {
          newUnits = newUnits.map(u => {
            if (u.owner === 'player' && hexDist(u.col, u.row, sel.col, sel.row) === 1)
              return { ...u, hp: Math.min(u.maxHp, u.hp + 3) };
            return u;
          });
        }

        const xpReward = killed ? (targetUnit.owner === 'barbarian' ? 20 : 40) : 0;
        const coinsReward = killed ? (targetUnit.owner === 'barbarian' ? 15 : 20) : 0;

        const allEnemyDead = newUnits.filter(u => u.owner === 'enemy').length === 0;
        const newPhase: Phase = allEnemyDead ? 'won_military' : state.phase;

        // Check if barbarian camp cleared
        let newGrid = state.grid;
        if (killed && targetUnit.owner === 'barbarian') {
          const stillBarbs = newUnits.filter(u => u.owner === 'barbarian' && hexDist(u.col, u.row, sel.col, sel.row) <= 3).length;
          if (stillBarbs === 0) {
            newGrid = state.grid.map(rowArr => rowArr.map(c =>
              c.hasCamp && hexDist(c.col, c.row, sel.col, sel.row) <= 3 ? { ...c, hasCamp: false } : c
            ));
          }
        }

        return {
          ...state,
          units: newUnits,
          grid: newGrid,
          knowledge: state.knowledge + (killed ? xpReward / 2 : 0),
          coins: state.coins + coinsReward,
          selectedUnitId: null,
          phase: newPhase,
          log: addLog(state, killed
            ? `⚔️ ${UNITS[targetUnit.type].label} знищено! +${xpReward / 2}📚 +${coinsReward}🪙`
            : `💥 Атака на ${UNITS[targetUnit.type].label}: −${dmg}HP`),
        };
      }

      // ── Sage AOE ─────────────────────────────────────────────────────────
      if (sel.type === 'sage' && dist <= 2 && targetUnit?.owner !== 'player') {
        const aoeDmg = 5 + ((sel.level ?? 1) - 1) * 2;
        const newUnits = state.units.map(u => {
          if (u.owner !== 'player' && hexDist(u.col, u.row, col, row) <= 1)
            return { ...u, hp: u.hp - aoeDmg };
          if (u.id === sel.id) return { ...u, hasActed: true, moves: 0 };
          return u;
        }).filter(u => u.hp > 0);
        const allDead = newUnits.filter(u => u.owner === 'enemy').length === 0;
        return { ...state, units: newUnits, selectedUnitId: null, phase: allDead ? 'won_military' : state.phase, log: addLog(state, `🧙 Мудрець: AOE −${aoeDmg}HP по всіх ворогах поруч!`) };
      }

      // ── Move ─────────────────────────────────────────────────────────────
      if (targetUnit) return state; // occupied
      if (!canPass(cell.terrain, sel.type, state.effects, state.civId)) return state;
      const moveCost = TERRAIN[cell.terrain]?.moveCost ?? 1;
      if (dist > Math.floor(sel.moves / moveCost) && moveCost > 1) {
        if (dist > sel.moves) return state;
      } else {
        if (dist > sel.moves) return state;
      }

      // Harvest bonus
      let bonusK = 0, bonusI = 0, bonusC = 0;
      if (!cell.harvested && (cell.terrain === 'ancientLib' || cell.terrain === 'crystal' || cell.terrain === 'village')) {
        bonusK = cell.terrain === 'ancientLib' ? TERRAIN.ancientLib.knowledgeBonus : 0;
        bonusI = cell.terrain === 'crystal' ? TERRAIN.crystal.inspirationBonus : 0;
        bonusC = cell.terrain === 'village' ? TERRAIN.village.coinsBonus : 0;
      }
      // Resource bonus
      if (cell.resource && !cell.harvested) {
        if (cell.resource === 'food') { bonusK += 5; }
        if (cell.resource === 'gold') { bonusC += 10; }
        if (cell.resource === 'iron') { bonusK += 3; }
        if (cell.resource === 'stone') { bonusK += 2; }
      }

      const fogRadius = 2 + (state.buildings.includes('observatory') ? 3 : 0) + (state.buildings.includes('watchtower') ? 2 : 0) + (state.effects.visionBonus ?? 0);
      const newGrid = state.grid.map(rowArr => rowArr.map(c => {
        const isTarget = c.col === col && c.row === row;
        if (hexDist(c.col, c.row, col, row) <= fogRadius) return { ...c, explored: true, ...(isTarget && (bonusK + bonusI + bonusC > 0) ? { harvested: true } : {}) };
        return c;
      }));

      const xpMove = TERRAIN[cell.terrain]?.knowledgeBonus ?? 0;
      // Nature folk heal in forest
      const healInForest = state.civId === 'natureFolk' && cell.terrain === 'forest' ? 2 : 0;

      return {
        ...state,
        units: state.units.map(u => u.id === sel.id
          ? { ...u, col, row, moves: u.moves - dist, hp: Math.min(u.maxHp, u.hp + healInForest) }
          : u),
        grid: newGrid,
        knowledge: state.knowledge + xpMove + bonusK,
        inspiration: state.inspiration + bonusI,
        coins: state.coins + bonusC,
        selectedUnitId: null,
        log: bonusK + bonusI + bonusC > 0
          ? addLog(state, `💰 Скарб: +${bonusK}📚 +${bonusI}💡 +${bonusC}🪙`)
          : state.log,
      };
    }

    case 'USE_AOE': {
      if (state.aoeUsed || !state.effects.aoeAbility || state.inspiration < 10) return state;
      const newUnits = state.units.map(u =>
        u.owner !== 'player' ? { ...u, hp: u.hp - 10 } : u
      ).filter(u => u.hp > 0);
      const allDead = newUnits.filter(u => u.owner === 'enemy').length === 0;
      return { ...state, units: newUnits, aoeUsed: true, inspiration: state.inspiration - 10, phase: allDead ? 'won_military' : state.phase, log: addLog(state, '✨ Burst of Insight: -10HP всім ворогам!') };
    }

    case 'BUILD': {
      const def = BUILDINGS[action.building];
      if (!def) return state;
      if (state.buildings.includes(action.building)) return state;
      if (state.knowledge < def.cost) return state;
      if (def.requires?.some(r => !state.buildings.includes(r))) return state;
      const newBuildings = [...state.buildings, action.building];
      return recalc({ ...state, buildings: newBuildings, knowledge: state.knowledge - def.cost, log: addLog(state, `🏗️ Побудовано: ${def.icon} ${def.label}`) });
    }

    case 'RESEARCH': {
      const tech = TECHS[action.tech];
      if (!tech || state.techs.includes(action.tech)) return state;
      if (tech.requires && !state.techs.includes(tech.requires)) return state;
      const cost = Math.round(tech.cost * (1 + (CIVS[state.civId ?? '']?.techCostPct ?? 0) / 100));
      if (state.knowledge < cost) return state;
      const newTechs = [...state.techs, action.tech];
      const newEff = mergeEffects(newTechs);
      const allAcademy: TechId[] = ['basicLearning', 'advStudies', 'researchMethods', 'sciRevolution', 'universalKnowledge'];
      const knowledgeWin = allAcademy.every(t => newTechs.includes(t)) && state.buildings.includes('knowledgeNet');
      const newState = recalc({ ...state, techs: newTechs, knowledge: state.knowledge - cost, effects: newEff });
      return { ...newState, phase: knowledgeWin ? 'won_knowledge' : newState.phase, log: addLog(newState, `🔬 Досліджено: ${tech.icon} ${tech.label}!`) };
    }

    case 'TRAIN': {
      const def = UNITS[action.unitType];
      if (!def || def.owner !== 'player') return state;
      if (state.energy < def.trainEnergy) return state;
      if (state.trainingQueue) return state;
      const turns = state.buildings.includes('training') ? Math.max(1, def.trainTurns - 1) : def.trainTurns;
      return { ...state, energy: state.energy - def.trainEnergy, trainingQueue: action.unitType, trainTurnsLeft: turns, log: addLog(state, `🏋️ Тренування ${def.icon} ${def.label} (${turns} хід${turns > 1 ? 'и' : ''})`) };
    }

    case 'END_TURN': {
      if (!state.isMyTurn) return state;
      let s = { ...state, selectedUnitId: null };

      // 1. Resources
      s.knowledge   = Math.min(999, s.knowledge + s.kPerTurn);
      s.energy      = Math.min(999, s.energy + s.ePerTurn);
      s.inspiration = Math.min(999, s.inspiration + s.iPerTurn);
      s.coins       = Math.min(9999, s.coins + s.coinsPerTurn);

      // Terrain bonuses for player units
      for (const u of s.units.filter(u => u.owner === 'player')) {
        const cell = s.grid[u.row]?.[u.col];
        if (!cell) continue;
        const td = TERRAIN[cell.terrain];
        s.knowledge   += td.knowledgeBonus;
        s.energy      += Math.max(0, td.energyBonus);  // desert can be negative
        s.inspiration += td.inspirationBonus;
        s.coins       += td.coinsBonus;
        // Heal in forest (nature folk), great wall heal
        if (td.healBonus) {
          s.units = s.units.map(u2 => u2.id === u.id ? { ...u2, hp: Math.min(u2.maxHp, u2.hp + td.healBonus!) } : u2);
        }
        // Hanging gardens (wonder_wall) heal
        if (s.buildings.includes('wonder_wall')) {
          s.units = s.units.map(u2 => u2.owner === 'player' ? { ...u2, hp: Math.min(u2.maxHp, u2.hp + 2) } : u2);
        }
      }

      // 2. Training
      if (s.trainingQueue && s.trainTurnsLeft > 0) {
        s.trainTurnsLeft--;
        if (s.trainTurnsLeft === 0) {
          const def = UNITS[s.trainingQueue];
          const playerCity = s.grid.flat().find(c => c.terrain === 'playerCity');
          if (playerCity) {
            const hp = Math.round(def.maxHp * (1 + (s.effects.warriorHpPct ?? 0) / 100) * (s.civId === 'legion' && s.trainingQueue === 'warrior' ? 1.6 : 1));
            const moves = def.maxMoves + (s.effects.unitMoveBonus ?? 0);
            s.units = [...s.units, { id: `u${Date.now()}`, type: s.trainingQueue, col: playerCity.col + 1, row: playerCity.row, hp, maxHp: hp, moves, maxMoves: moves, owner: 'player', xp: 0, level: 1 }];
            s.log = addLog(s, `✅ ${def.icon} ${def.label} готовий!`);
          }
          s.trainingQueue = null;
        }
      }

      // 3. Procrastinator regen
      s.units = s.units.map(u =>
        u.type === 'procrastinator' ? { ...u, hp: Math.min(u.maxHp, u.hp + 3) } : u
      );

      // 4. Barbarian spawning from camps
      if (s.turn % 5 === 0 && !s.effects.barbarianPeace) {
        for (const row of s.grid) {
          for (const cell of row) {
            if (cell.hasCamp) {
              const type: UnitType = s.turn > 20 ? 'barbarianChief' : 'barbarian';
              const def = UNITS[type];
              s.units = [...s.units, { id: `barb_${Date.now()}_${cell.col}`, type, col: cell.col - 1, row: cell.row, hp: def.maxHp, maxHp: def.maxHp, moves: def.maxMoves, maxMoves: def.maxMoves, owner: 'barbarian', xp: 0, level: 1 }];
              s.log = addLog(s, `💀 Варвари з табору (${cell.col},${cell.row}): +1 ${def.icon}!`);
            }
          }
        }
      }

      // 5. Enemy AI moves
      const playerCity = s.grid.flat().find(c => c.terrain === 'playerCity');
      s.units = s.units.map(u => {
        if (u.owner === 'player') return { ...u, moves: u.maxMoves, hasActed: false, distracted: false };

        // Barbarians move toward nearest non-barbarian
        const targets = s.units.filter(u2 => u2.owner !== u.owner);
        if (targets.length === 0) return u;

        const nearTarget = targets.reduce((best, t) =>
          hexDist(u.col, u.row, t.col, t.row) < hexDist(u.col, u.row, best.col, best.row) ? t : best,
          playerCity ?? targets[0]
        );

        let { col, row } = u;
        let bestD = hexDist(col, row, nearTarget.col, nearTarget.row);
        const dirs = [
          { c: col + 1, r: row }, { c: col - 1, r: row },
          { c: col, r: row + 1 }, { c: col, r: row - 1 },
          { c: col + (row & 1 ? 1 : 0), r: row + 1 },
          { c: col + (row & 1 ? 0 : -1), r: row - 1 },
        ];
        for (const d of dirs) {
          if (d.c < 0 || d.r < 0 || d.c >= COLS || d.r >= ROWS) continue;
          const t = s.grid[d.r]?.[d.c]?.terrain;
          if (!t || t === 'mountain') continue;
          if (s.units.some(u2 => u2.col === d.c && u2.row === d.r && u2.id !== u.id)) continue;
          const dd = hexDist(d.c, d.r, nearTarget.col, nearTarget.row);
          if (dd < bestD) { bestD = dd; col = d.c; row = d.r; }
        }
        return { ...u, col, row };
      });

      // 6. Enemy & barbarian attacks
      let playerUnits = s.units.filter(u => u.owner === 'player');
      const nonPlayerUnits = s.units.filter(u => u.owner !== 'player');
      let newLog = [...s.log];

      nonPlayerUnits.forEach(en => {
        const adjacent = playerUnits.filter(p => hexDist(p.col, p.row, en.col, en.row) <= (UNITS[en.type].range ?? 1));
        if (adjacent.length === 0) return;
        const target = adjacent[0];
        let dmg = UNITS[en.type].attack;
        if (en.type === 'darkness') dmg += 5;
        if (target.type === 'guardian') dmg = Math.ceil(dmg / 2);
        if (s.buildings.includes('wonder_wall')) dmg = Math.round(dmg * 0.7); // Great Wall defense
        const newHp = Math.max(s.effects.unitMinHp1 ? 1 : 0, target.hp - dmg);
        playerUnits = playerUnits.map(p => p.id === target.id ? { ...p, hp: newHp } : p);
        newLog = addLog({ ...s, log: newLog }, `⚠️ ${UNITS[en.type].icon} атакує ${UNITS[target.type].icon}: -${dmg}HP`);
      });
      s.units = [...playerUnits.filter(u => u.hp > 0), ...nonPlayerUnits];

      // PhoneAddict distract
      s.units = s.units.map(u => {
        if (u.owner !== 'player') return u;
        const distractor = s.units.find(e => e.type === 'phoneAddict' && hexDist(e.col, e.row, u.col, u.row) === 1);
        return distractor ? { ...u, distracted: true, moves: Math.max(1, u.moves - 1) } : u;
      });

      // 7. Enemy wave every 3 turns
      if (s.turn % 3 === 0) {
        const waveType = getEnemyWave(s.turn);
        const def = UNITS[waveType];
        const spawnRow = rng(Math.floor(ROWS / 4), Math.floor(3 * ROWS / 4));
        s.units = [...s.units, { id: `e${Date.now()}`, type: waveType, col: COLS - 1, row: spawnRow, hp: def.maxHp, maxHp: def.maxHp, moves: def.maxMoves, maxMoves: def.maxMoves, owner: 'enemy', xp: 0, level: 1 }];
        newLog = addLog({ ...s, log: newLog }, `👾 Нова хвиля: ${def.icon} ${def.label}!`);
      }

      // 8. Boss at turn 22
      if (s.turn === 22 && !s.units.some(u => u.type === 'darkness')) {
        const def = UNITS.darkness;
        s.units = [...s.units, { id: 'boss1', type: 'darkness', col: COLS - 1, row: Math.floor(ROWS / 2), hp: def.maxHp, maxHp: def.maxHp, moves: def.maxMoves, maxMoves: def.maxMoves, owner: 'enemy', xp: 0, level: 1 }];
        newLog = addLog({ ...s, log: newLog }, '🌑 БОSS ТЕМРЯВА з\'явився!!! Це фінальна загроза!');
      }

      // 9. Random event
      let newEvent = s.currentEvent;
      const newCooldown = s.eventCooldown - 1;
      if (newCooldown <= 0 && !s.currentEvent) {
        const ev = pickEvent(s.turn, s.effects.eventsMore ?? false);
        if (ev) {
          newEvent = ev;
          newLog = addLog({ ...s, log: newLog }, `📢 Подія: ${ev.icon} ${ev.title}`);
        }
      }

      // 10. Lose conditions
      const enemyOnCity = s.units.filter(u => u.owner === 'enemy' || u.owner === 'barbarian')
        .some(u => s.grid.flat().find(c => c.terrain === 'playerCity' && c.col === u.col && c.row === u.row));
      const allPlayerDead = s.units.filter(u => u.owner === 'player').length === 0;
      const newTurn = s.turn + 1;
      const survivalWin = newTurn > s.maxTurns && !enemyOnCity && !allPlayerDead;
      const phase: Phase = enemyOnCity || allPlayerDead ? 'lost'
        : survivalWin ? 'won_survival'
        : newEvent ? 'eventPause'
        : (s.phase === 'won_knowledge' || s.phase === 'won_military') ? s.phase
        : 'playing';

      return recalc({
        ...s,
        turn: newTurn,
        phase,
        currentEvent: newEvent,
        eventCooldown: newCooldown <= 0 ? rng(2, 5) : newCooldown,
        log: newLog,
        isMyTurn: s.multiplayerRole ? false : true,
      });
    }

    default: return state;
  }
}

export { makeInitState };
