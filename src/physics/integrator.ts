import Matter from "matter-js";

// Inject our own forces by integrating them into the body's velocity, then let
// Matter.Engine.update integrate position and resolve collisions. This sidesteps Matter's
// hard-to-tune internal force units and gives us a clean "force in mass*px/s^2" model.
//
// Matter velocity/angularVelocity are per-step; we work in per-second and convert.
export function applyWrench(
  body: Matter.Body,
  fx: number,
  fy: number,
  torque: number,
  dt: number, // seconds
) {
  const ax = fx / body.mass;
  const ay = fy / body.mass;
  const angAccel = torque / body.inertia;

  const vx = body.velocity.x * 60 + ax * dt;
  const vy = body.velocity.y * 60 + ay * dt;
  Matter.Body.setVelocity(body, { x: vx / 60, y: vy / 60 });

  const w = body.angularVelocity * 60 + angAccel * dt;
  Matter.Body.setAngularVelocity(body, w / 60);
}
