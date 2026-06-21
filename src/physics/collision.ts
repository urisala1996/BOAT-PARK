import Matter from "matter-js";
import { DAMAGE_THRESHOLD, DAMAGE_SCALE } from "../config.ts";

// Translate Matter collision events into gameplay: reaching the goal sensor wins; striking a
// wall or boat costs life proportional to the impact speed along the contact normal, so a
// gentle nudge while docking is harmless but ramming the dock hurts.
export function attachCollisions(
  engine: Matter.Engine,
  isPlayer: (b: Matter.Body) => boolean,
  onWin: () => void,
  onDamage: (amount: number) => void,
) {
  Matter.Events.on(engine, "collisionStart", (e) => {
    for (const pair of e.pairs) {
      const { bodyA, bodyB } = pair;
      const a = isPlayer(bodyA);
      const b = isPlayer(bodyB);
      if (!a && !b) continue;

      const player = a ? bodyA : bodyB;
      const other = a ? bodyB : bodyA;

      if (other.label === "goal") {
        onWin();
        continue;
      }

      // Closing speed projected on the contact normal (per-step velocity -> px/s).
      const n = pair.collision.normal;
      const rvx = (player.velocity.x - other.velocity.x) * 60;
      const rvy = (player.velocity.y - other.velocity.y) * 60;
      const impact = Math.abs(rvx * n.x + rvy * n.y);

      const damage = Math.max(0, impact - DAMAGE_THRESHOLD) * DAMAGE_SCALE;
      if (damage > 0) onDamage(damage);
    }
  });
}
