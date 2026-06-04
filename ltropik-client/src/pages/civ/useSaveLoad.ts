import type { GameState } from './types';

export interface SaveSlot {
  slot: number;
  label: string;
  turn: number;
  civId: string;
  phase: string;
  savedAt: string;
  stateJson: string;
}

const SAVE_KEY = 'ltropik_civ_saves';

function getSlots(): SaveSlot[] {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function listSaves(): SaveSlot[] {
  return getSlots();
}

export function saveGame(state: GameState, slot: number): void {
  const saves = getSlots().filter(s => s.slot !== slot);
  const entry: SaveSlot = {
    slot,
    label: `Слот ${slot}`,
    turn: state.turn,
    civId: state.civId ?? 'unknown',
    phase: state.phase,
    savedAt: new Date().toLocaleString('uk-UA'),
    stateJson: JSON.stringify(state),
  };
  saves.push(entry);
  localStorage.setItem(SAVE_KEY, JSON.stringify(saves));
}

export function loadGame(slot: number): GameState | null {
  const saves = getSlots();
  const found = saves.find(s => s.slot === slot);
  if (!found) return null;
  try {
    return JSON.parse(found.stateJson) as GameState;
  } catch {
    return null;
  }
}

export function deleteSave(slot: number): void {
  const saves = getSlots().filter(s => s.slot !== slot);
  localStorage.setItem(SAVE_KEY, JSON.stringify(saves));
}

export function autoSave(state: GameState): void {
  if (state.phase === 'playing' && state.turn > 1) {
    saveGame(state, 0); // slot 0 = autosave
  }
}
