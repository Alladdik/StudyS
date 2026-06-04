import type { GameEvent, GameState } from './types';

const rng = (lo: number, hi: number) => Math.floor(Math.random() * (hi - lo + 1)) + lo;
const addLog = (s: GameState, msg: string) => [msg, ...s.log].slice(0, 12);

export const EVENTS: GameEvent[] = [
  // ── Positive ───────────────────────────────────────────────────────────────
  {
    id: 'wandering_scholar',
    icon: '📜', title: 'Мандрівний Вчений',
    desc: 'До воріт академії підходить старий мудрець із рідкісними манускриптами.',
    good: true,
    choices: [
      { label: '🏠 Запросити до академії', desc: 'Витратити 10⚡ — отримати +25📚',
        apply: s => ({ energy: s.energy - 10, knowledge: s.knowledge + 25, log: addLog(s, '📜 Мудрець поділився знаннями: +25📚') }) },
      { label: '🚶 Відмовити', desc: 'Нічого не відбувається',
        apply: s => ({ log: addLog(s, '📜 Мудрець пішов далі...') }) },
    ],
  },
  {
    id: 'meteor_shower',
    icon: '☄️', title: 'Метеоритний Дощ',
    desc: 'У нічному небі яскраво спалахують метеорити, наповнюючи душі натхненням.',
    good: true,
    choices: [
      { label: '🔬 Досліджувати явище', desc: '+15📚 +5💡',
        apply: s => ({ knowledge: s.knowledge + 15, inspiration: s.inspiration + 5, log: addLog(s, '☄️ Дослідження метеора: +15📚 +5💡') }) },
      { label: '🎉 Влаштувати свято', desc: 'Всі юніти +8HP',
        apply: s => ({ units: s.units.map(u => u.owner === 'player' ? { ...u, hp: Math.min(u.maxHp, u.hp + 8) } : u), log: addLog(s, '☄️ Свято метеора: всі +8HP') }) },
    ],
  },
  {
    id: 'merchant_caravan',
    icon: '🐪', title: 'Торговельний Караван',
    desc: 'Багатий купець пропонує обмін рідкісними товарами.',
    good: true,
    choices: [
      { label: '💰 Купити знання', desc: 'Витратити 15🪙 — отримати +20📚',
        apply: s => s.coins >= 15
          ? ({ coins: s.coins - 15, knowledge: s.knowledge + 20, log: addLog(s, '🐪 Куплено знання: +20📚') })
          : ({ log: addLog(s, '🐪 Не вистачає монет...') }) },
      { label: '⚡ Купити провізію', desc: 'Витратити 10🪙 — отримати +15⚡',
        apply: s => s.coins >= 10
          ? ({ coins: s.coins - 10, energy: s.energy + 15, log: addLog(s, '🐪 Куплено провізію: +15⚡') })
          : ({ log: addLog(s, '🐪 Не вистачає монет...') }) },
    ],
  },
  {
    id: 'found_ruins',
    icon: '🏚️', title: 'Знайдені Руїни',
    desc: 'Ваші юніти натрапили на давні руїни. Всередині щось блищить...',
    good: true,
    choices: [
      { label: '⛏️ Дослідити руїни', desc: '+20📚 +10🪙 але 20% шанс пастки (-5HP одному юніту)',
        apply: s => {
          const trap = Math.random() < 0.2;
          const units = trap ? s.units.map((u, i) => i === 0 ? { ...u, hp: Math.max(1, u.hp - 5) } : u) : s.units;
          return { knowledge: s.knowledge + 20, coins: s.coins + 10, units, log: addLog(s, trap ? '🏚️ Пастка! +20📚 +10🪙 але -5HP' : '🏚️ Руїни: +20📚 +10🪙') };
        } },
      { label: '🚫 Обійти стороною', desc: 'Безпечно, нічого не відбувається',
        apply: s => ({ log: addLog(s, '🏚️ Руїни залишені позаду') }) },
    ],
  },
  {
    id: 'great_teacher',
    icon: '👨‍🏫', title: 'Великий Учитель',
    desc: 'Легендарний вчитель готовий поділитися своєю мудрістю — за невелику плату.',
    good: true,
    choices: [
      { label: '🎓 Навчатися', desc: 'Витратити 20⚡ — всі юніти +1 до атаки назавжди',
        apply: s => ({ energy: s.energy - 20, units: s.units.map(u => u.owner === 'player' ? u : u), log: addLog(s, '👨‍🏫 Великий Учитель: +1 атака всіх юнітів') }) },
      { label: '💡 Попросити лекцію', desc: '+12📚 +6💡',
        apply: s => ({ knowledge: s.knowledge + 12, inspiration: s.inspiration + 6, log: addLog(s, '👨‍🏫 Лекція: +12📚 +6💡') }) },
    ],
  },
  // ── Negative ───────────────────────────────────────────────────────────────
  {
    id: 'student_strike',
    icon: '😤', title: 'Страйк Студентів',
    desc: 'Студенти незадоволені та оголошують страйк! Потрібна термінова відповідь.',
    good: false,
    choices: [
      { label: '💸 Поступитися їхнім вимогам', desc: 'Витратити 15📚 — відновити мир',
        apply: s => ({ knowledge: Math.max(0, s.knowledge - 15), log: addLog(s, '😤 Страйк вирішено: -15📚') }) },
      { label: '🚫 Ігнорувати', desc: '-10⚡ — на нас чекатиме зниження продуктивності',
        apply: s => ({ energy: Math.max(0, s.energy - 10), log: addLog(s, '😤 Страйк продовжується: -10⚡') }) },
    ],
  },
  {
    id: 'library_fire',
    icon: '🔥', title: 'Пожежа в Бібліотеці',
    desc: 'У бібліотеці спалахнула пожежа! Потрібно терміново діяти!',
    good: false,
    choices: [
      { label: '🚒 Гасити пожежу', desc: 'Витратити 15⚡ — врятувати частину книг (-5📚 замість -20📚)',
        apply: s => ({ energy: Math.max(0, s.energy - 15), knowledge: Math.max(0, s.knowledge - 5), log: addLog(s, '🔥 Пожежа погашена: -15⚡ -5📚') }) },
      { label: '📸 Врятувати лише найцінніше', desc: '-20📚 але всі юніти +3HP (адреналін)',
        apply: s => ({ knowledge: Math.max(0, s.knowledge - 20), units: s.units.map(u => u.owner === 'player' ? { ...u, hp: Math.min(u.maxHp, u.hp + 3) } : u), log: addLog(s, '🔥 Пожежа! -20📚 але +3HP юнітам') }) },
    ],
  },
  {
    id: 'plague',
    icon: '🦠', title: 'Епідемія',
    desc: 'Хвороба поширюється серед населення. Це загрожує боєздатності.',
    good: false,
    choices: [
      { label: '💊 Виділити ресурси на лікування', desc: '-20⚡ — юніти не отримають пошкоджень',
        apply: s => ({ energy: Math.max(0, s.energy - 20), log: addLog(s, '🦠 Епідемія локалізована: -20⚡') }) },
      { label: '⚠️ Прийняти втрати', desc: 'Всі юніти -5HP',
        apply: s => ({ units: s.units.map(u => u.owner === 'player' ? { ...u, hp: Math.max(1, u.hp - 5) } : u), log: addLog(s, '🦠 Епідемія! Всі юніти -5HP') }) },
    ],
  },
  {
    id: 'barbarian_demand',
    icon: '💢', title: 'Ультиматум Варварів',
    desc: 'Ватажок варварів вимагає данину. Відмова може спровокувати набіг.',
    good: false,
    choices: [
      { label: '💰 Заплатити данину', desc: '-25🪙 — варвари відступають на 5 ходів',
        apply: s => ({ coins: Math.max(0, s.coins - 25), log: addLog(s, '💢 Данина сплачена: -25🪙') }) },
      { label: '⚔️ Відмовити', desc: 'Варвари атакуватимуть наступного ходу з подвоєною силою',
        apply: s => ({ log: addLog(s, '💢 Ультиматум відкинуто! Варвари лютують!') }) },
    ],
  },
  {
    id: 'spy_caught',
    icon: '🕵️', title: 'Схоплений Шпигун',
    desc: 'У стінах академії спіймано ворожого шпигуна з секретними документами.',
    good: false,
    choices: [
      { label: '🗣️ Провести допит', desc: '+10📚 (дізнатися секрети) -5⚡',
        apply: s => ({ knowledge: s.knowledge + 10, energy: Math.max(0, s.energy - 5), log: addLog(s, '🕵️ Допит: +10📚 -5⚡') }) },
      { label: '🚪 Відпустити як знак доброї волі', desc: '+8💡 (дипломатичний жест)',
        apply: s => ({ inspiration: s.inspiration + 8, log: addLog(s, '🕵️ Дипломатичний жест: +8💡') }) },
    ],
  },
];

export function pickEvent(_turn: number, eventsMore: boolean): GameEvent | null {
  const chance = eventsMore ? 0.55 : 0.3;
  if (Math.random() > chance) return null;
  const idx = rng(0, EVENTS.length - 1);
  return EVENTS[idx];
}
