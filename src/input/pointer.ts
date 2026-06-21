import { Application, Container, Rectangle, type FederatedPointerEvent } from "pixi.js";
import { hudLayout } from "../render/hudLayout.ts";

// Touch / mouse controls layered over the HUD gauges. Produces ABSOLUTE control values that
// override the keyboard when active:
//   - Throttle: drag the lever up/down. It HOLDS its position on release (like a real lever).
//   - Steering: drag across the wheel left/right. It RELEASES to centre when you lift off
//     (returns null so the boat's idle auto-centring takes over).
// Multi-touch aware: throttle and helm track independent pointer ids, so two thumbs work.
export class PointerControls {
  steerSet: number | null = null;
  throttleSet: number | null = null;

  private readonly throttleZone = new Container();
  private readonly steerZone = new Container();
  private throttlePointer: number | null = null;
  private steerPointer: number | null = null;
  private w = 0;
  private h = 0;

  private readonly onMove = (e: FederatedPointerEvent) => {
    if (e.pointerId === this.throttlePointer) this.updateThrottle(e.global.y);
    if (e.pointerId === this.steerPointer) this.updateSteer(e.global.x);
  };
  private readonly onRelease = (e: FederatedPointerEvent) => {
    if (e.pointerId === this.throttlePointer) this.throttlePointer = null;
    if (e.pointerId === this.steerPointer) {
      this.steerPointer = null;
      this.steerSet = null; // let go of the wheel -> auto-centre
    }
  };

  constructor(
    private readonly app: Application,
    private readonly hud: Container,
  ) {
    for (const z of [this.throttleZone, this.steerZone]) {
      z.eventMode = "static";
      hud.addChild(z);
    }

    this.throttleZone.on("pointerdown", (e: FederatedPointerEvent) => {
      this.throttlePointer = e.pointerId;
      this.updateThrottle(e.global.y);
    });
    this.steerZone.on("pointerdown", (e: FederatedPointerEvent) => {
      this.steerPointer = e.pointerId;
      this.updateSteer(e.global.x);
    });

    app.stage.eventMode = "static";
    app.stage.on("globalpointermove", this.onMove);
    app.stage.on("pointerup", this.onRelease);
    app.stage.on("pointerupoutside", this.onRelease);
    app.stage.on("pointercancel", this.onRelease);
  }

  dispose() {
    this.app.stage.off("globalpointermove", this.onMove);
    this.app.stage.off("pointerup", this.onRelease);
    this.app.stage.off("pointerupoutside", this.onRelease);
    this.app.stage.off("pointercancel", this.onRelease);
    this.hud.removeChild(this.throttleZone, this.steerZone);
    this.throttleZone.destroy();
    this.steerZone.destroy();
  }

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.app.stage.hitArea = new Rectangle(0, 0, w, h);
    const L = hudLayout(w, h);
    // Generous finger-sized hit areas around each gauge.
    this.throttleZone.hitArea = new Rectangle(
      L.throttle.x - 48,
      L.throttle.top - 48,
      96,
      L.throttle.bot - L.throttle.top + 96,
    );
    this.steerZone.hitArea = new Rectangle(
      L.wheel.x - L.wheel.r - 34,
      L.wheel.y - L.wheel.r - 34,
      (L.wheel.r + 34) * 2,
      (L.wheel.r + 34) * 2,
    );
  }

  private updateThrottle(globalY: number) {
    const L = hudLayout(this.w, this.h);
    this.throttleSet = clamp((L.throttle.mid - globalY) / L.throttle.half, -1, 1);
  }

  private updateSteer(globalX: number) {
    const L = hudLayout(this.w, this.h);
    this.steerSet = clamp((globalX - L.wheel.x) / L.wheel.r, -1, 1);
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
