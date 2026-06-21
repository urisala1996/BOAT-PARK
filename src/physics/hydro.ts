import Matter from "matter-js";
import {
  DRAG_FWD_LINEAR,
  DRAG_FWD_QUAD,
  DRAG_LAT_LINEAR,
  DRAG_LAT_QUAD,
  DRAG_ANGULAR,
} from "../config.ts";

export interface Wrench {
  fx: number; // force, world x
  fy: number; // force, world y
  torque: number;
}

// Hydrodynamic resistance of a hull in water, returned as a force + torque (in the same
// "mass * px/s^2" units the boat integrator uses).
//
// The key to a boaty feel is ANISOTROPIC drag: resistance perpendicular to the hull is
// far higher than along it, so the boat glides forward, refuses to slide sideways, and
// carves when turning.
export function computeHydroDrag(body: Matter.Body): Wrench {
  const a = body.angle;
  const cos = Math.cos(a);
  const sin = Math.sin(a);

  // Matter stores velocity per-step; convert to per-second so coefficients read naturally.
  const vx = body.velocity.x * 60;
  const vy = body.velocity.y * 60;

  // Decompose world velocity into the boat's local forward / lateral axes.
  const vForward = vx * cos + vy * sin;
  const vLateral = -vx * sin + vy * cos;

  const dragForward = -(
    DRAG_FWD_LINEAR * vForward +
    DRAG_FWD_QUAD * vForward * Math.abs(vForward)
  );
  const dragLateral = -(
    DRAG_LAT_LINEAR * vLateral +
    DRAG_LAT_QUAD * vLateral * Math.abs(vLateral)
  );

  // Recombine into world space, scaled by mass so it acts as an acceleration.
  const fx = (dragForward * cos - dragLateral * sin) * body.mass;
  const fy = (dragForward * sin + dragLateral * cos) * body.mass;

  const angVel = body.angularVelocity * 60;
  const torque = -DRAG_ANGULAR * angVel * body.inertia;

  return { fx, fy, torque };
}
