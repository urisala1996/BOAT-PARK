import Matter from "matter-js";
import { PIXELS_PER_METER as P } from "../config.ts";
import { hullVertices } from "../physics/hull.ts";
import { generateRocks } from "./rocks.ts";
import type { WallDef, BoatDef, GoalDef, RockFieldDef, LighthouseDef } from "../level/types.ts";

export const LIGHTHOUSE_RADIUS = 2.5; // default base radius, metres

// Factories that turn level data (metres) into static Matter bodies (pixels).

export function makeWall(def: WallDef): Matter.Body {
  return Matter.Bodies.rectangle(def.x * P, def.y * P, def.w * P, def.h * P, {
    isStatic: true,
    angle: def.angle ?? 0,
    label: "wall",
    friction: 0.4,
    restitution: 0.2,
  });
}

// Parked obstacle boats: static so they cost the player life on contact but never drift.
export function makeObstacleBoat(def: BoatDef): Matter.Body {
  const verts = hullVertices(def.length * P, def.beam * P);
  return Matter.Bodies.fromVertices(def.x * P, def.y * P, [verts], {
    isStatic: true,
    angle: def.angle,
    label: "obstacle",
    friction: 0.3,
    restitution: 0.3,
  });
}

// The seaport target: a sensor (no physical response) that fires a collision event on entry.
export function makeGoal(def: GoalDef): Matter.Body {
  return Matter.Bodies.rectangle(def.x * P, def.y * P, def.w * P, def.h * P, {
    isStatic: true,
    isSensor: true,
    label: "goal",
  });
}

// A rock field becomes a set of small static circle obstacles.
export function makeRockBodies(def: RockFieldDef): Matter.Body[] {
  return generateRocks(def).map((r) =>
    Matter.Bodies.circle(r.x * P, r.y * P, r.r * P, {
      isStatic: true,
      label: "obstacle",
      friction: 0.6,
      restitution: 0.25,
    }),
  );
}

export function makeLighthouse(def: LighthouseDef): Matter.Body {
  return Matter.Bodies.circle(def.x * P, def.y * P, (def.radius ?? LIGHTHOUSE_RADIUS) * P, {
    isStatic: true,
    label: "obstacle",
    friction: 0.5,
    restitution: 0.2,
  });
}
