import { Container, Graphics, FillGradient } from "pixi.js";
import { PIXELS_PER_METER as P, COLORS } from "../config.ts";
import { hullVertices } from "../physics/hull.ts";
import { generateRocks } from "../entities/rocks.ts";
import { LIGHTHOUSE_RADIUS } from "../entities/bodies.ts";
import type { Level, WallDef, BoatDef, GoalDef, RockFieldDef, LighthouseDef } from "../level/types.ts";

// Minimalist-but-polished vector views. Hull outlines reuse the exact physics geometry, and
// every solid object gets a soft drop shadow for depth.

const SH_X = 2; // shadow offset (local px)
const SH_Y = 6;

const flat = (verts: { x: number; y: number }[]): number[] =>
  verts.flatMap((v) => [v.x, v.y]);

export function buildWater(level: Level): Graphics {
  const W = level.bounds.w * P;
  const H = level.bounds.h * P;
  const g = new Graphics();
  const grad = new FillGradient({
    type: "linear",
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    colorStops: [
      { offset: 0, color: COLORS.waterTop },
      { offset: 1, color: COLORS.waterBottom },
    ],
    textureSpace: "local",
  });
  g.rect(0, 0, W, H).fill(grad);

  // Soft grid for motion readability.
  const step = 10 * P;
  for (let x = step; x < W; x += step) g.moveTo(x, 0).lineTo(x, H);
  for (let y = step; y < H; y += step) g.moveTo(0, y).lineTo(W, y);
  g.stroke({ width: 1, color: COLORS.waterGrid, alpha: 0.35 });
  return g;
}

export interface GoalView {
  container: Container;
  update: (t: number) => void;
}

export function buildGoal(def: GoalDef): GoalView {
  const c = new Container();
  c.position.set(def.x * P, def.y * P);
  const w = def.w * P;
  const h = def.h * P;

  const fill = new Graphics();
  const ring = new Graphics();
  c.addChild(fill, ring);

  const draw = (pulse: number) => {
    fill.clear();
    fill
      .roundRect(-w / 2, -h / 2, w, h, 14)
      .fill({ color: COLORS.goalSoft, alpha: 0.22 + 0.12 * pulse });
    ring.clear();
    ring
      .roundRect(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12, 12)
      .stroke({ width: 3, color: COLORS.goal, alpha: 0.6 + 0.4 * pulse });
    // Centre berth marker.
    const r = 14 + pulse * 6;
    ring.circle(0, 0, r).stroke({ width: 3, color: COLORS.goal, alpha: 0.5 });
    ring.circle(0, 0, 4).fill(COLORS.goal);
  };
  draw(0);

  return {
    container: c,
    update: (t: number) => draw((Math.sin(t * 2.5) + 1) / 2),
  };
}

// Red (port) and green (starboard) marks at the harbour mouth — the pocket opens to the left.
export function buildBuoys(goal: GoalDef): Container {
  const c = new Container();
  const mouthX = (goal.x - goal.w / 2) * P;
  const top = (goal.y - goal.h / 2) * P;
  const bot = (goal.y + goal.h / 2) * P;
  c.addChild(buoy(mouthX, top, COLORS.buoyPort));
  c.addChild(buoy(mouthX, bot, COLORS.buoyStbd));
  return c;
}

function buoy(x: number, y: number, color: number): Graphics {
  const g = new Graphics();
  g.ellipse(SH_X, SH_Y + 2, 9, 5).fill({ color: COLORS.shadow, alpha: 0.18 });
  g.circle(0, 0, 8).fill(color).stroke({ width: 2, color: COLORS.line });
  g.rect(-2, -16, 4, 8).fill(COLORS.line); // top mark
  g.position.set(x, y);
  return g;
}

export function buildRockField(def: RockFieldDef): Container {
  const c = new Container();
  for (const r of generateRocks(def)) {
    const g = new Graphics();
    const pts = r.verts.flatMap((v) => [v.x * P, v.y * P]);
    const shadow = r.verts.flatMap((v) => [v.x * P + SH_X, v.y * P + SH_Y]);
    g.poly(shadow).fill({ color: COLORS.shadow, alpha: 0.18 });
    g.poly(pts).fill(COLORS.rock).stroke({ width: 1.5, color: COLORS.line });
    // highlight cap
    g.poly(r.verts.flatMap((v) => [v.x * P * 0.55, v.y * P * 0.55 - r.r * P * 0.15])).fill({
      color: COLORS.rockTop,
      alpha: 0.7,
    });
    g.position.set(r.x * P, r.y * P);
    c.addChild(g);
  }
  return c;
}

export function buildLighthouse(def: LighthouseDef): Container {
  const c = new Container();
  c.position.set(def.x * P, def.y * P);
  const r = (def.radius ?? LIGHTHOUSE_RADIUS) * P;
  const g = new Graphics();
  // rocky base
  g.ellipse(SH_X, SH_Y, r, r * 0.9).fill({ color: COLORS.shadow, alpha: 0.18 });
  g.circle(0, 0, r).fill(COLORS.lightBase).stroke({ width: 2, color: COLORS.line });
  // soft light glow
  g.circle(0, -r * 1.6, r * 1.4).fill({ color: COLORS.lightGlow, alpha: 0.28 });
  // tower (tapered) pointing up
  const tw = r * 0.7;
  const th = r * 2.4;
  g.poly([-tw / 2, 0, tw / 2, 0, tw * 0.34, -th, -tw * 0.34, -th])
    .fill(COLORS.lightTower)
    .stroke({ width: 2, color: COLORS.line });
  // red bands
  for (let i = 0; i < 2; i++) {
    const y0 = -th * (0.28 + i * 0.34);
    const y1 = y0 - th * 0.16;
    const wTop = tw * (0.5 - (-y1 / th) * 0.16);
    const wBot = tw * (0.5 - (-y0 / th) * 0.16);
    g.poly([-wBot, y0, wBot, y0, wTop, y1, -wTop, y1]).fill(COLORS.lightBand);
  }
  // lantern room + cap
  g.rect(-tw * 0.32, -th - r * 0.5, tw * 0.64, r * 0.5).fill(COLORS.lightGlow).stroke({ width: 2, color: COLORS.line });
  g.poly([-tw * 0.4, -th - r * 0.5, tw * 0.4, -th - r * 0.5, 0, -th - r * 1.0]).fill(COLORS.lightBand);
  c.addChild(g);
  return c;
}

export function buildWall(def: WallDef): Container {
  const c = new Container();
  c.position.set(def.x * P, def.y * P);
  c.rotation = def.angle ?? 0;
  const w = def.w * P;
  const h = def.h * P;
  const fill = def.kind === "dock" ? COLORS.dock : COLORS.land;

  const shadow = new Graphics();
  shadow.roundRect(-w / 2 + SH_X, -h / 2 + SH_Y, w, h, 3).fill({ color: COLORS.shadow, alpha: 0.16 });

  const body = new Graphics();
  body.roundRect(-w / 2, -h / 2, w, h, 3).fill(fill).stroke({ width: 2, color: COLORS.landLine });

  // Plank lines along the long axis of docks for a little texture.
  if (def.kind === "dock") {
    if (w >= h) {
      for (let x = -w / 2 + 12; x < w / 2; x += 12)
        body.moveTo(x, -h / 2 + 2).lineTo(x, h / 2 - 2);
    } else {
      for (let y = -h / 2 + 12; y < h / 2; y += 12)
        body.moveTo(-w / 2 + 2, y).lineTo(w / 2 - 2, y);
    }
    body.stroke({ width: 1, color: COLORS.landLine, alpha: 0.25 });
  }

  c.addChild(shadow, body);
  return c;
}

export function buildObstacleBoat(def: BoatDef): Container {
  const c = new Container();
  c.position.set(def.x * P, def.y * P);
  c.rotation = def.angle;
  const verts = hullVertices(def.length * P, def.beam * P);

  const shadow = new Graphics();
  shadow.poly(flat(verts.map((v) => ({ x: v.x + SH_X, y: v.y + SH_Y })))).fill({
    color: COLORS.shadow,
    alpha: 0.16,
  });
  c.addChild(shadow, drawHull(def.length * P, def.beam * P, COLORS.obstacleHull, COLORS.obstacleLine));
  return c;
}

export interface PlayerView {
  container: Container;
  motor: Graphics;
}

export function buildPlayer(lengthPx: number, beamPx: number): PlayerView {
  const container = new Container();
  const verts = hullVertices(lengthPx, beamPx);

  const shadow = new Graphics();
  shadow.poly(flat(verts.map((v) => ({ x: v.x + SH_X, y: v.y + SH_Y })))).fill({
    color: COLORS.shadow,
    alpha: 0.2,
  });

  // Motor at the transom; pivots to show the helm.
  const motor = new Graphics();
  const len = lengthPx * 0.16;
  motor.roundRect(-len, -3, len, 6, 2).fill(COLORS.line);
  motor.position.set(-lengthPx / 2, 0);

  const hull = drawHull(lengthPx, beamPx, COLORS.playerHull, COLORS.line, COLORS.playerAccent);
  container.addChild(shadow, motor, hull);
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
  g.moveTo(lengthPx / 2, 0).lineTo(-lengthPx / 2, 0).stroke({ width: 1.5, color: line, alpha: 0.4 });
  if (accent !== undefined) {
    // Bow wedge + a stripe so the player boat pops and reads its heading clearly.
    g.poly([lengthPx / 2, 0, lengthPx * 0.16, beamPx * 0.34, lengthPx * 0.16, -beamPx * 0.34]).fill({
      color: accent,
      alpha: 0.95,
    });
    g.rect(-lengthPx * 0.34, -beamPx * 0.5, lengthPx * 0.08, beamPx).fill({
      color: accent,
      alpha: 0.8,
    });
  }
  return g;
}
