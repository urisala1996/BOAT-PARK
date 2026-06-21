import Matter from "matter-js";

// Thin wrapper around a Matter engine configured for a top-down world (no gravity).
// All damping/drag is applied by us each step, so the engine itself only integrates
// motion and resolves collisions.

export class PhysicsWorld {
  readonly engine: Matter.Engine;
  readonly world: Matter.World;

  constructor() {
    this.engine = Matter.Engine.create();
    this.engine.gravity.x = 0;
    this.engine.gravity.y = 0;
    this.world = this.engine.world;
  }

  add(body: Matter.Body | Matter.Body[]) {
    Matter.Composite.add(this.world, body);
  }

  clear() {
    Matter.Composite.clear(this.world, false, true);
  }

  step(deltaMs: number) {
    Matter.Engine.update(this.engine, deltaMs);
  }
}
