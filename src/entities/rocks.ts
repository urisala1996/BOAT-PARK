import type { RockFieldDef } from "../level/types.ts";

export interface Rock {
  x: number; // centre, metres (world)
  y: number;
  r: number; // collision radius, metres
  verts: { x: number; y: number }[]; // render blob, local metres
}

// Deterministic PRNG so a rock field looks/collides identically every build (editor == game).
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Scatter rocks across the (rotated) field. Count scales with area, capped for performance.
export function generateRocks(f: RockFieldDef): Rock[] {
  const rng = mulberry32(Math.round(f.x * 73856093) ^ Math.round(f.y * 19349663) ^ Math.round(f.w * 83492791));
  const area = f.w * f.h;
  const count = Math.max(3, Math.min(40, Math.round(area / 6)));
  const cos = Math.cos(f.angle ?? 0);
  const sin = Math.sin(f.angle ?? 0);
  const rocks: Rock[] = [];
  for (let i = 0; i < count; i++) {
    const lx = (rng() - 0.5) * f.w;
    const ly = (rng() - 0.5) * f.h;
    const x = f.x + lx * cos - ly * sin;
    const y = f.y + lx * sin + ly * cos;
    const r = 0.6 + rng() * 1.3;
    rocks.push({ x, y, r, verts: blob(r, rng) });
  }
  return rocks;
}

// A small convex-ish irregular polygon around the origin.
function blob(r: number, rng: () => number): { x: number; y: number }[] {
  const n = 6 + Math.floor(rng() * 3);
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rad = r * (0.78 + rng() * 0.32);
    pts.push({ x: Math.cos(a) * rad, y: Math.sin(a) * rad });
  }
  return pts;
}
