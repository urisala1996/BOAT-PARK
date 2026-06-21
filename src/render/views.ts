import { Container, Graphics } from "pixi.js";
import { PIXELS_PER_METER as P, COLORS } from "../config.ts";
import { hullVertices } from "../physics/hull.ts";
import type { Level, WallDef, BoatDef, GoalDef } from "../level/types.ts";

// Minimalist vector views built from PixiJS Graphics. Hull outlines reuse the exact same
// geometry as the physics bodies so what you see is what you collide with.

const flat = (verts: { x: number; y: number }[]): number[] =>
  verts.flatMap((v) => [v.x, v.y]);

export function buildWater(level: Level): Graphics {
  const W = level.bounds.w * P;
  const H = level.bounds.h * P;
  const g = new Graphics();
  g.rect(0, 0, W, H).fill(COLORS.water);

  // Faint grid so motion across open water is readable.
  const step = 10 * P;
  for (let x = step; x < W; x += step) g.moveTo(x, 0).lineTo(x, H);
  for (let y = step; y < H; y += step) g.moveTo(0, y).lineTo(W, y);
  g.stroke({ width: 1, color: COLORS.waterGrid, alpha: 0.6 });
  return g;
}

export function buildGoal(def: GoalDef): Container {
  const c = new Container();
  c.position.set(def.x * P, def.y * P);
  const w = def.w * P;
  const h = def.h * P;
  const g = new Graphics();
  g.rect(-w / 2, -h / 2, w, h)
    .fill({ color: COLORS.goal, alpha: 0.45 })
    .stroke({ width: 2, color: COLORS.goal, alpha: 0.9 });
  c.addChild(g);
  return c;
}

export function buildWall(def: WallDef): Graphics {
  const w = def.w * P;
  const h = def.h * P;
  const fill = def.kind === "dock" ? COLORS.dock : COLORS.land;
  const g = new Graphics();
  g.rect(-w / 2, -h / 2, w, h)
    .fill(fill)
    .stroke({ width: 2, color: COLORS.landLine });
  g.position.set(def.x * P, def.y * P);
  g.rotation = def.angle ?? 0;
  return g;
}

export function buildObstacleBoat(def: BoatDef): Graphics {
  const lengthPx = def.length * P;
  const beamPx = def.beam * P;
  const g = drawHull(lengthPx, beamPx, COLORS.obstacleHull, COLORS.obstacleLine);
  g.position.set(def.x * P, def.y * P);
  g.rotation = def.angle;
  return g;
}

// Player view: hull plus a separate motor mark at the stern that rotates with the helm.
export interface PlayerView {
  container: Container;
  motor: Graphics;
}

export function buildPlayer(lengthPx: number, beamPx: number): PlayerView {
  const container = new Container();
  const hull = drawHull(lengthPx, beamPx, COLORS.playerHull, COLORS.line, COLORS.playerAccent);
  container.addChild(hull);

  // Motor mounted at the transom; pivots to show steering direction.
  const motor = new Graphics();
  const len = lengthPx * 0.14;
  motor.rect(-len, -2.5, len, 5).fill(COLORS.line);
  motor.position.set(-lengthPx / 2, 0);
  container.addChild(motor);

  return { container, motor };
}

function drawHull(
  lengthPx: number,
  beamPx: number,
  fill: number,
  line: number,
  accent?: number,
): Graphics {
  const verts = hullVertices(lengthPx, beamPx);
  const g = new Graphics();
  g.poly(flat(verts)).fill(fill).stroke({ width: 2, color: line });
  // Centre line bow->stern.
  g.moveTo(lengthPx / 2, 0).lineTo(-lengthPx / 2, 0).stroke({ width: 1.5, color: line, alpha: 0.5 });
  if (accent !== undefined) {
    // A bow wedge accent so the player boat reads clearly and shows heading.
    g.poly([lengthPx / 2, 0, lengthPx * 0.18, beamPx * 0.32, lengthPx * 0.18, -beamPx * 0.32])
      .fill({ color: accent, alpha: 0.95 });
  }
  return g;
}
