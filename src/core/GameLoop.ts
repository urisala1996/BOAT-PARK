import { FIXED_STEP_MS } from "../config.ts";

// Fixed-timestep accumulator: physics advances in constant FIXED_STEP_MS chunks regardless
// of frame rate, so the simulation stays deterministic and stable. Rendering happens once
// per animation frame.
export class GameLoop {
  private acc = 0;

  constructor(
    private readonly update: (dtSeconds: number, dtMs: number) => void,
    private readonly render: () => void,
  ) {}

  frame(frameMs: number) {
    // Clamp to avoid a spiral of death after a tab stall.
    this.acc += Math.min(frameMs, 250);
    while (this.acc >= FIXED_STEP_MS) {
      this.update(FIXED_STEP_MS / 1000, FIXED_STEP_MS);
      this.acc -= FIXED_STEP_MS;
    }
    this.render();
  }
}
