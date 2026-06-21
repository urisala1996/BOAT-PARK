import type { Level } from "./types.ts";
import { level1 } from "./level1.ts";
import { listLevelNames, loadLevel } from "./storage.ts";

// A selectable map for the main menu. `level()` returns a fresh, mutation-safe copy.
export interface MapEntry {
  id: string;
  title: string;
  source: "default" | "bundled" | "saved";
  level: () => Level;
}

// Bundled maps live in /maps/*.json (kept in the repo, inlined at build time).
const bundledModules = import.meta.glob("/maps/*.json", {
  eager: true,
  import: "default",
}) as Record<string, Level>;

function titleFromPath(path: string): string {
  const file = path.split("/").pop()!.replace(/\.json$/, "");
  return file.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function defaultMap(): MapEntry {
  return {
    id: "default",
    title: "Old Marina",
    source: "default",
    level: () => structuredClone(level1),
  };
}

export function bundledMaps(): MapEntry[] {
  return Object.entries(bundledModules)
    .map(([path, data]) => {
      const title = titleFromPath(path);
      return {
        id: "bundled:" + path,
        title,
        source: "bundled" as const,
        // Use the filename-derived title as the display name.
        level: () => ({ ...structuredClone(data), name: title }),
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function savedMaps(): MapEntry[] {
  return listLevelNames().map((n) => ({
    id: "saved:" + n,
    title: n,
    source: "saved" as const,
    level: () => loadLevel(n) ?? structuredClone(level1),
  }));
}

export function allMaps(): MapEntry[] {
  return [defaultMap(), ...bundledMaps(), ...savedMaps()];
}

export function randomMap(): MapEntry {
  const all = allMaps();
  return all[Math.floor(Math.random() * all.length)];
}
