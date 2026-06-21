import { MAX_LIFE } from "../config.ts";

export type Status = "playing" | "won" | "lost";

export class GameState {
  life = MAX_LIFE;
  status: Status = "playing";

  reset() {
    this.life = MAX_LIFE;
    this.status = "playing";
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
}
