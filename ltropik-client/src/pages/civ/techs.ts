import type { TechId, TechBranch, GameEffects } from './types';

export interface TechDef {
  branch: TechBranch;
  tier: number;
  icon: string;
  label: string;
  cost: number;
  desc: string;
  requires?: TechId;
  effect: Partial<GameEffects>;
}

export const TECHS: Record<TechId, TechDef> = {
  // ── 📚 Academy ────────────────────────────────────────────────────────────
  basicLearning:      { branch: 'academy',    tier: 1, icon: '📖', label: 'Базове навчання',     cost: 15,  desc: '+2📚/хід', effect: { kBonus: 2 } },
  advStudies:         { branch: 'academy',    tier: 2, icon: '🎓', label: 'Поглиблені студії',   cost: 30,  desc: '+2📚/хід, Вчений + лікування', requires: 'basicLearning', effect: { kBonus: 2, scholarHeals: true } },
  researchMethods:    { branch: 'academy',    tier: 3, icon: '🔍', label: 'Методи досліджень',   cost: 60,  desc: '+3📚/хід, Вчений пасує гори', requires: 'advStudies', effect: { kBonus: 3 } },
  sciRevolution:      { branch: 'academy',    tier: 4, icon: '⚗️', label: 'Наукова революція',   cost: 100, desc: '+2💡/хід, AI юніт', requires: 'researchMethods', effect: { iBonus: 2, unlockAi: true } },
  universalKnowledge: { branch: 'academy',    tier: 5, icon: '🌟', label: 'Всесвітнє Знання',    cost: 150, desc: '🏆 Knowledge Victory + 5📚/хід', requires: 'sciRevolution', effect: { kBonus: 5, allResBonus: 15 } },

  // ── ⚔️ Defense ────────────────────────────────────────────────────────────
  basicTraining:      { branch: 'defense',    tier: 1, icon: '🪖', label: 'Базова підготовка',   cost: 15,  desc: 'Воїни +20% HP, Лучник', effect: { warriorHpPct: 20, unlockArcher: true } },
  tactics:            { branch: 'defense',    tier: 2, icon: '📍', label: 'Тактика',             cost: 30,  desc: 'Всі юніти +1 переміщення', requires: 'basicTraining', effect: { unitMoveBonus: 1 } },
  teamStrategy:       { branch: 'defense',    tier: 3, icon: '🤝', label: 'Командна стратегія',  cost: 60,  desc: 'Сусідні юніти +25% атаки, Захисник', requires: 'tactics', effect: { unitGroupBonusPct: 25, unlockGuardian: true } },
  eliteForces:        { branch: 'defense',    tier: 4, icon: '⭐', label: 'Елітні сили',         cost: 100, desc: 'Герой + Кавалерія', requires: 'teamStrategy', effect: { unlockHero: true, unlockCavalry: true } },
  ironWill:           { branch: 'defense',    tier: 5, icon: '💪', label: 'Нескоренна Воля',     cost: 150, desc: 'Юніти не вмирають нижче 1HP', requires: 'eliteForces', effect: { unitMinHp1: true } },

  // ── 💡 Innovation ────────────────────────────────────────────────────────
  creativeThin:       { branch: 'innovation', tier: 1, icon: '💡', label: 'Творче мислення',     cost: 15,  desc: '+1💡/хід, Ріки прохідні', effect: { iBonus: 1, bridgePassable: true } },
  problemSolv:        { branch: 'innovation', tier: 2, icon: '🧩', label: 'Вирішення задач',     cost: 30,  desc: 'Більше позитивних подій, Мудрець', requires: 'creativeThin', effect: { eventsMore: true, unlockSage: true } },
  aiAssist:           { branch: 'innovation', tier: 3, icon: '🤖', label: 'AI Помічник',         cost: 60,  desc: 'AI юніт + Катапульта', requires: 'problemSolv', effect: { unlockAi: true, unlockCatapult: true } },
  synthKnow:          { branch: 'innovation', tier: 4, icon: '🔮', label: 'Синтез знань',        cost: 100, desc: '+25% до всіх ресурсів', requires: 'aiAssist', effect: { allResBonus: 25 } },
  transcendence:      { branch: 'innovation', tier: 5, icon: '✨', label: 'Трансцендентність',   cost: 150, desc: 'AOE здібність Burst of Insight', requires: 'synthKnow', effect: { aoeAbility: true, allResBonus: 10 } },

  // ── 💰 Commerce ───────────────────────────────────────────────────────────
  tradeRoutes:        { branch: 'commerce',   tier: 1, icon: '🛤️', label: 'Торговельні шляхи',  cost: 15,  desc: '+2🪙/хід, Дипломат', effect: { coinsBonus: 2, unlockDiplomat: true } },
  banking:            { branch: 'commerce',   tier: 2, icon: '🏦', label: 'Банківська справа',   cost: 30,  desc: '+3🪙/хід, +1⚡/хід', requires: 'tradeRoutes', effect: { coinsBonus: 3, eBonus: 1 } },
  merchants:          { branch: 'commerce',   tier: 3, icon: '🤝', label: 'Купці',               cost: 60,  desc: '+15% до всіх ресурсів', requires: 'banking', effect: { allResBonus: 15 } },
  monopoly:           { branch: 'commerce',   tier: 4, icon: '💹', label: 'Монополія',           cost: 100, desc: '+8🪙/хід, +2📚/хід', requires: 'merchants', effect: { coinsBonus: 8, kBonus: 2 } },
  goldAge:            { branch: 'commerce',   tier: 5, icon: '👑', label: 'Золота доба',         cost: 150, desc: '+35% до всіх ресурсів, Поселенець', requires: 'monopoly', effect: { allResBonus: 35, unlockSettler: true } },

  // ── 🤝 Diplomacy ─────────────────────────────────────────────────────────
  envoys:             { branch: 'diplomacy',  tier: 1, icon: '✉️', label: 'Посланці',            cost: 15,  desc: '+2💡/хід, Варвари нейтральні', effect: { iBonus: 2, barbarianPeace: true } },
  treaties:           { branch: 'diplomacy',  tier: 2, icon: '📜', label: 'Договори',            cost: 30,  desc: '+2 радіус видимості', requires: 'envoys', effect: { visionBonus: 2 } },
  espionage:          { branch: 'diplomacy',  tier: 3, icon: '🕵️', label: 'Шпіонаж',             cost: 60,  desc: '+20% атаки проти ворожих міст', requires: 'treaties', effect: { unitGroupBonusPct: 20 } },
  alliances:          { branch: 'diplomacy',  tier: 4, icon: '🤲', label: 'Альянси',             cost: 100, desc: '+3 до всіх ресурсів/хід', requires: 'espionage', effect: { kBonus: 3, eBonus: 3, iBonus: 3 } },
  worldOrder:         { branch: 'diplomacy',  tier: 5, icon: '🌍', label: 'Світовий порядок',    cost: 150, desc: '+30% до всіх ресурсів, +5 видимість', requires: 'alliances', effect: { allResBonus: 30, visionBonus: 5 } },
};

export const BRANCH_META: Record<string, { label: string; color: string; icon: string; techs: TechId[] }> = {
  academy:    { label: '📚 Академія',    color: '#3b82f6', icon: '📚', techs: ['basicLearning','advStudies','researchMethods','sciRevolution','universalKnowledge'] },
  defense:    { label: '⚔️ Захист',      color: '#ef4444', icon: '⚔️', techs: ['basicTraining','tactics','teamStrategy','eliteForces','ironWill'] },
  innovation: { label: '💡 Інновація',   color: '#a855f7', icon: '💡', techs: ['creativeThin','problemSolv','aiAssist','synthKnow','transcendence'] },
  commerce:   { label: '💰 Торгівля',    color: '#f59e0b', icon: '💰', techs: ['tradeRoutes','banking','merchants','monopoly','goldAge'] },
  diplomacy:  { label: '🤝 Дипломатія',  color: '#10b981', icon: '🤝', techs: ['envoys','treaties','espionage','alliances','worldOrder'] },
};

export function mergeEffects(techs: TechId[]): Partial<GameEffects> {
  const eff: GameEffects = {
    kBonus: 0, eBonus: 0, iBonus: 0, coinsBonus: 0, allResBonus: 0,
    warriorHpPct: 0, unitMoveBonus: 0, unitGroupBonusPct: 0, unitMinHp1: false,
    scholarHeals: false, eventsMore: false,
    unlockArcher: false, unlockSage: false, unlockGuardian: false,
    unlockHero: false, unlockAi: false, unlockCavalry: false,
    unlockCatapult: false, unlockSettler: false, unlockDiplomat: false,
    aoeAbility: false, bridgePassable: false,
    barbarianPeace: false, visionBonus: 0,
  };
  for (const tid of techs) {
    const fx = TECHS[tid].effect;
    for (const [k, v] of Object.entries(fx)) {
      const key = k as keyof GameEffects;
      if (typeof v === 'boolean') (eff[key] as boolean) = (eff[key] as boolean) || v;
      else if (typeof v === 'number') (eff[key] as number) += v as number;
    }
  }
  return eff;
}
