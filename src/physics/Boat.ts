import Matter from "matter-js";
import {
  MAX_THRUST_ACCEL,
  REVERSE_FACTOR,
  MOTOR_ANGLE_LIMIT,
  OUTBOARD_OFFSET_M,
  STEER_RATE,
  STEER_RETURN,
  THROTTLE_RATE,
  PIXELS_PER_METER,
} from "../config.ts";
import { hullVertices } from "./hull.ts";
import { computeHydroDrag } from "./hydro.ts";
import { applyWrench } from "./integrator.ts";
import type { InputState } from "../input/controls.ts";

const MS_TO_KNOTS = 1.94384;

// The player's motorboat: a single rear outboard whose thrust direction is steered like a
// real helm. Throttle is a held lever from full reverse (-1) through neutral (0) to full
// ahead (+1). Steering deflects the motor; because thrust is applied at the stern, the
// offset naturally produces the turning torque (and the response inverts in reverse, just
// like a real boat).
export class Boat {
  readonly body: Matter.Body;
  readonly lengthPx: number;
  readonly thrustOffsetPx: number; // distance aft of centre where the prop thrust acts

  motorAngle = 0; // radians relative to hull, +/- MOTOR_ANGLE_LIMIT
  throttle = 0; // -1..1 lever position

  constructor(xPx: number, yPx: number, angle: number, lengthM: number, beamM: number) {
    this.lengthPx = lengthM * PIXELS_PER_METER;
    this.thrustOffsetPx = this.lengthPx / 2 + OUTBOARD_OFFSET_M * PIXELS_PER_METER;
    const beamPx = beamM * PIXELS_PER_METER;
    const verts = hullVertices(this.lengthPx, beamPx);
    this.body = Matter.Bodies.fromVertices(xPx, yPx, [verts], {
      label: "player",
      frictionAir: 0, // we apply all damping ourselves
      friction: 0.02,
      restitution: 0.25,
    });
    Matter.Body.setAngle(this.body, angle);
  }

  update(dt: number, input: InputState) {
    // --- Helm: touch sets the deflection directly; keyboard nudges and auto-centres ---
    if (input.steerSet != null) {
      this.motorAngle = input.steerSet * MOTOR_ANGLE_LIMIT;
    } else if (input.steer !== 0) {
      // D / right steers the bow to starboard => motor deflects negative (see torque below).
      this.motorAngle -= input.steer * STEER_RATE * dt;
    } else if (this.motorAngle !== 0) {
      const ease = STEER_RETURN * dt;
      this.motorAngle =
        Math.abs(this.motorAngle) <= ease
          ? 0
          : this.motorAngle - Math.sign(this.motorAngle) * ease;
    }
    this.motorAngle = clamp(this.motorAngle, -MOTOR_ANGLE_LIMIT, MOTOR_ANGLE_LIMIT);

    // --- Throttle lever (held position); touch sets it directly ---
    if (input.throttleSet != null) {
      this.throttle = clamp(input.throttleSet, -1, 1);
    } else if (input.neutral) {
      const ease = THROTTLE_RATE * 2 * dt;
      this.throttle = Math.abs(this.throttle) <= ease ? 0 : this.throttle - Math.sign(this.throttle) * ease;
    } else {
      this.throttle = clamp(this.throttle + input.throttle * THROTTLE_RATE * dt, -1, 1);
    }

    // --- Thrust from the stern-mounted, steerable motor ---
    const a = this.body.angle;
    const signal =
      this.throttle >= 0 ? this.throttle : this.throttle * REVERSE_FACTOR;
    const fMag = this.body.mass * MAX_THRUST_ACCEL * signal;
    const dir = a + this.motorAngle;
    const fx = fMag * Math.cos(dir);
    const fy = fMag * Math.sin(dir);

    // Thrust acts behind the transom, offset from the centre of mass => steering torque.
    // The longer this lever arm, the harder the boat pivots when the helm is over.
    const rx = -this.thrustOffsetPx * Math.cos(a);
    const ry = -this.thrustOffsetPx * Math.sin(a);
    const thrustTorque = rx * fy - ry * fx;

    // --- Water resistance ---
    const drag = computeHydroDrag(this.body);

    applyWrench(
      this.body,
      fx + drag.fx,
      fy + drag.fy,
      thrustTorque + drag.torque,
      dt,
    );
  }

  get speedKnots(): number {
    const vx = this.body.velocity.x * 60;
    const vy = this.body.velocity.y * 60;
    const pxPerSec = Math.hypot(vx, vy);
    return (pxPerSec / PIXELS_PER_METER) * MS_TO_KNOTS;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
