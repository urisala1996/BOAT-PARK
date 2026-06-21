// Keyboard input mapped to a small intent struct the boat consumes each step.
//   A / Left  & D / Right : steer the helm (held; eases back to centre when released)
//   W / Up    & S / Down  : push / pull the throttle lever (held position)
//   Space                 : ease throttle back to neutral (kill)
//   R                     : restart the level

export interface InputState {
  steer: number; // -1 (port) .. +1 (starboard), rate (keyboard)
  throttle: number; // -1 (pull back) .. +1 (push forward), rate (keyboard)
  neutral: boolean;
  restart: boolean;
  // Absolute positions from touch/mouse; when non-null they override the keyboard.
  steerSet: number | null; // -1..1 maps directly to helm deflection
  throttleSet: number | null; // -1..1 lever position
}

export class Controls {
  private keys = new Set<string>();

  constructor(target: Window = window) {
    target.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      if (HANDLED.has(k)) e.preventDefault();
      this.keys.add(k);
    });
    target.addEventListener("keyup", (e) => this.keys.delete(e.key.toLowerCase()));
    target.addEventListener("blur", () => this.keys.clear());
  }

  read(): InputState {
    const left = this.has("a", "arrowleft");
    const right = this.has("d", "arrowright");
    const up = this.has("w", "arrowup");
    const down = this.has("s", "arrowdown");
    return {
      steer: (right ? 1 : 0) - (left ? 1 : 0),
      throttle: (up ? 1 : 0) - (down ? 1 : 0),
      neutral: this.keys.has(" "),
      restart: this.keys.has("r"),
      steerSet: null,
      throttleSet: null,
    };
  }

  private has(...ks: string[]): boolean {
    return ks.some((k) => this.keys.has(k));
  }
}

const HANDLED = new Set([
  "a",
  "d",
  "w",
  "s",
  "arrowleft",
  "arrowright",
  "arrowup",
  "arrowdown",
  " ",
]);
