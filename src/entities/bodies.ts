import Matter from "matter-js";
import { PIXELS_PER_METER as P } from "../config.ts";
import { hullVertices } from "../physics/hull.ts";
import type { WallDef, BoatDef, GoalDef } from "../level/types.ts";

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
