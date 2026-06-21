import { MAX_LIFE } from "../config.ts";

export type Status = "ready" | "playing" | "won" | "lost";

export class GameState {
  life = MAX_LIFE;
  status: Status = "ready";
  elapsedMs = 0; // time spent actually playing this run

  reset() {
    this.life = MAX_LIFE;
    this.status = "ready";
    this.elapsedMs = 0;
  }

  start() {
    if (this.status === "ready") this.status = "playing";
  }

  tick(dtMs: number) {
    if (this.status === "playing") this.elapsedMs += dtMs;
  }

  damage(amount: number) {
    if (this.status !== "playing" || amount <= 0) return;
    this.life = Math.max(0, this.life - amount);
    if (this.life === 0) this.status = "lost";
  }

  win() {
    if (this.status === "playing") this.status = "won";
  }

  get lifeFraction(): number {
    return this.life / MAX_LIFE;
  }

  get elapsedSeconds(): number {
    return this.elapsedMs / 1000;
  }
}
