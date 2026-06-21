import { Container, Graphics } from "pixi.js";
import { COLORS, PIXELS_PER_METER } from "../config.ts";
import type { Boat } from "../physics/Boat.ts";

interface WakePoint {
  x: number;
  y: number;
  nx: number; // unit normal to travel direction
  ny: number;
  baseHalf: number; // half-width seeded from speed at spawn
  age: number;
}

const MAX_AGE = 1.1; // seconds a wake point lives
const MIN_SPEED = 14; // px/s before a wake forms
const MIN_GAP = 5; // px travelled before dropping a new point

// A fading foam ribbon trailing the boat's stern — narrow at the transom, widening and
// dissolving behind. Lives in the world layer, beneath the boats.
export class Wake {
  readonly container = new Container();
  private readonly g = new Graphics();
  private readonly points: WakePoint[] = [];
  private lastX = 0;
  private lastY = 0;

  constructor() {
    this.container.addChild(this.g);
  }

  reset() {
    this.points.length = 0;
  }

  update(boat: Boat, dt: number) {
    const b = boat.body;
    const vx = b.velocity.x * 60;
    const vy = b.velocity.y * 60;
    const speed = Math.hypot(vx, vy);

    // Drop a new foam point at the stern when moving fast enough.
    const sx = b.position.x - Math.cos(b.angle) * boat.thrustOffsetPx * 0.9;
    const sy = b.position.y - Math.sin(b.angle) * boat.thrustOffsetPx * 0.9;
    if (speed > MIN_SPEED && Math.hypot(sx - this.lastX, sy - this.lastY) > MIN_GAP) {
      const inv = 1 / (speed || 1);
      this.points.push({
        x: sx,
        y: sy,
        nx: -vy * inv,
        ny: vx * inv,
        baseHalf: 3 + Math.min(speed / PIXELS_PER_METER, 9) * 1.6,
        age: 0,
      });
      this.lastX = sx;
      this.lastY = sy;
    }

    for (const p of this.points) p.age += dt;
    while (this.points.length && this.points[0].age > MAX_AGE) this.points.shift();

    this.draw();
  }

  private draw() {
    const g = this.g;
    g.clear();
    const pts = this.points;
    if (pts.length < 2) return;

    const half = (p: WakePoint) => p.baseHalf * (0.25 + 0.75 * (p.age / MAX_AGE));
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const ha = half(a);
      const hb = half(b);
      const life = 1 - b.age / MAX_AGE;
      g.poly([
        a.x + a.nx * ha,
        a.y + a.ny * ha,
        b.x + b.nx * hb,
        b.y + b.ny * hb,
        b.x - b.nx * hb,
        b.y - b.ny * hb,
        a.x - a.nx * ha,
        a.y - a.ny * ha,
      ]).fill({ color: COLORS.foam, alpha: 0.5 * life * life });
    }
  }
}
