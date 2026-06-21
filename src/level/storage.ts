import type { Level } from "./types.ts";

// Persistence for player-made levels. Named levels live under one key; the "current" working
// level (last played/edited) is stored separately so the game boots straight into it.

const LEVELS_KEY = "boatpark.levels.v1";
const CURRENT_KEY = "boatpark.current.v1";

type Store = Record<string, Level>;

function readStore(): Store {
  try {
    return JSON.parse(localStorage.getItem(LEVELS_KEY) || "{}") as Store;
  } catch {
    return {};
  }
}

function writeStore(s: Store) {
  try {
    localStorage.setItem(LEVELS_KEY, JSON.stringify(s));
  } catch {
    /* quota or privacy mode — ignore */
  }
}

export function listLevelNames(): string[] {
  return Object.keys(readStore()).sort((a, b) => a.localeCompare(b));
}

export function loadLevel(name: string): Level | null {
  return readStore()[name] ?? null;
}

export function saveLevel(level: Level) {
  const s = readStore();
  s[level.name] = level;
  writeStore(s);
}

export function deleteLevel(name: string) {
  const s = readStore();
  delete s[name];
  writeStore(s);
}

export function saveCurrent(level: Level) {
  try {
    localStorage.setItem(CURRENT_KEY, JSON.stringify(level));
  } catch {
    /* ignore */
  }
}

export function loadCurrent(): Level | null {
  try {
    const v = localStorage.getItem(CURRENT_KEY);
    return v ? (JSON.parse(v) as Level) : null;
  } catch {
    return null;
  }
}
