import { Container, Graphics, Text } from "pixi.js";
import { COLORS } from "../config.ts";
import { hudLayout } from "./hudLayout.ts";
import type { GameState } from "../state/GameState.ts";
import type { Boat } from "../physics/Boat.ts";

// Fixed overlay: hull life bar, speed readout, throttle lever + steering-wheel gauges, and
// the win/lose overlay. The gauges double as touch controls (see input/pointer.ts); here we
// only draw them, reflecting the boat's actual throttle / helm so touch and keyboard look the
// same. Dynamic shapes are redrawn each frame into a single Graphics.
export class HUD {
  readonly container = new Container();
  private readonly g = new Graphics();
  private readonly speed: Text;
  private readonly status: Text;
  private readonly hint: Text;

  constructor() {
    this.container.addChild(this.g);

    this.speed = label(16);
    this.status = label(54, true);
    this.hint = label(20, true);
    this.status.visible = false;
    this.hint.visible = false;
    this.container.addChild(this.speed, this.status, this.hint);
  }

  update(state: GameState, boat: Boat, w: number, h: number) {
    const g = this.g;
    const L = hudLayout(w, h);
    g.clear();

    // --- Hull life bar (top-left) ---
    const { x: bx, y: by, w: bw, h: bh } = L.life;
    g.roundRect(bx - 4, by - 4, bw + 8, bh + 8, 6).fill({ color: COLORS.hudBg, alpha: 0.85 });
    g.roundRect(bx, by, bw, bh, 4).fill({ color: 0x000000, alpha: 0.12 });
    const f = state.lifeFraction;
    const col = f > 0.5 ? COLORS.lifeGood : f > 0.25 ? COLORS.lifeWarn : COLORS.lifeBad;
    if (f > 0) g.roundRect(bx, by, bw * f, bh, 4).fill(col);
    this.speed.text = `${boat.speedKnots.toFixed(1)} kn`;
    this.speed.position.set(bx, by + bh + 8);

    // --- Throttle lever (bottom-right) ---
    const t = L.throttle;
    panel(g, t.x - 26, t.top - 26, 52, t.bot - t.top + 52);
    g.moveTo(t.x, t.top).lineTo(t.x, t.bot).stroke({ width: 4, color: COLORS.hud, alpha: 0.25 });
    g.moveTo(t.x - 14, t.mid).lineTo(t.x + 14, t.mid).stroke({ width: 2, color: COLORS.hud, alpha: 0.4 }); // neutral
    const knobY = t.mid - boat.throttle * t.half;
    const knobCol =
      boat.throttle > 0.02 ? COLORS.lifeGood : boat.throttle < -0.02 ? COLORS.playerAccent : COLORS.hud;
    g.roundRect(t.x - 18, knobY - 8, 36, 16, 4).fill(knobCol).stroke({ width: 2, color: COLORS.hud });

    // --- Steering wheel (bottom-left) ---
    const wl = L.wheel;
    panel(g, wl.x - wl.r - 14, wl.y - wl.r - 14, (wl.r + 14) * 2, (wl.r + 14) * 2);
    g.circle(wl.x, wl.y, wl.r).stroke({ width: 5, color: COLORS.hud, alpha: 0.85 });
    g.circle(wl.x, wl.y, 5).fill(COLORS.hud);
    // Spokes rotate with the helm; right steer (motorAngle<0) reads as clockwise.
    const rot = -boat.motorAngle * 2.4;
    for (let i = 0; i < 3; i++) {
      const a = rot + (i * Math.PI * 2) / 3;
      g.moveTo(wl.x, wl.y).lineTo(wl.x + Math.cos(a) * wl.r, wl.y + Math.sin(a) * wl.r);
    }
    g.stroke({ width: 4, color: COLORS.hud, alpha: 0.85 });

    // --- Win / lose overlay ---
    if (state.status === "playing") {
      this.status.visible = false;
      this.hint.visible = false;
    } else {
      g.rect(0, 0, w, h).fill({ color: 0x0a1a22, alpha: 0.55 });
      const won = state.status === "won";
      this.status.text = won ? "DOCKED!" : "HULL BREACHED";
      this.status.style.fill = won ? COLORS.lifeGood : COLORS.playerAccent;
      this.hint.text = "Tap or press R to restart";
      center(this.status, w, h / 2 - 30);
      center(this.hint, w, h / 2 + 40);
      this.status.visible = true;
      this.hint.visible = true;
    }
  }
}

function panel(g: Graphics, x: number, y: number, w: number, h: number) {
  g.roundRect(x, y, w, h, 10).fill({ color: COLORS.hudBg, alpha: 0.8 });
}

function label(size: number, bold = false): Text {
  return new Text({
    text: "",
    style: {
      fontFamily: "system-ui, sans-serif",
      fontSize: size,
      fontWeight: bold ? "700" : "500",
      fill: COLORS.hud,
    },
  });
}

function center(t: Text, w: number, cy: number) {
  t.position.set((w - t.width) / 2, cy - t.height / 2);
}
