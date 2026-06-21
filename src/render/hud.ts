import { Container, Graphics, Text, FillGradient } from "pixi.js";
import { COLORS } from "../config.ts";
import { hudLayout } from "./hudLayout.ts";
import type { GameState } from "../state/GameState.ts";
import type { Boat } from "../physics/Boat.ts";

export interface HudFrame {
  state: GameState;
  boat: Boat;
  w: number;
  h: number;
  t: number; // seconds, for subtle animation
  goal: { x: number; y: number; onScreen: boolean }; // goal centre in screen coords
}

// Fixed overlay: vignette, hull panel, speedometer, objective + off-screen arrow, the
// throttle/helm gauges (which double as touch controls), and the start / win / lose cards.
export class HUD {
  readonly container = new Container();
  private readonly vignette = new Graphics();
  private readonly g = new Graphics();
  private vW = 0;
  private vH = 0;

  // gameplay texts
  private readonly hullLabel = mk(13, "700", COLORS.hudMuted);
  private readonly speedNum = mk(30, "800", COLORS.hud);
  private readonly speedUnit = mk(13, "700", COLORS.hudMuted);
  private readonly objective = mk(15, "700", COLORS.hud);
  private readonly timer = mk(16, "800", COLORS.hud);
  // overlay texts
  private readonly title = mk(56, "800", COLORS.hud, 0.5);
  private readonly subtitle = mk(18, "600", COLORS.hudMuted, 0.5);
  private readonly stat = mk(20, "700", COLORS.hud, 0.5);
  private readonly btn = mk(20, "800", 0xffffff, 0.5);
  private readonly hint = mk(15, "600", COLORS.hudMuted, 0.5);

  constructor() {
    this.container.addChild(this.vignette, this.g);
    this.container.addChild(
      this.hullLabel,
      this.speedNum,
      this.speedUnit,
      this.objective,
      this.timer,
      this.title,
      this.subtitle,
      this.stat,
      this.btn,
      this.hint,
    );
  }

  update(f: HudFrame) {
    const { state, boat, w, h } = f;
    if (w !== this.vW || h !== this.vH) this.drawVignette(w, h);

    const playing = state.status === "playing";
    const g = this.g;
    g.clear();

    this.layoutGameplay(f, playing);
    if (playing) {
      this.drawGauges(boat, w, h);
      this.drawArrow(f);
    }

    this.layoutOverlay(state, w, h);
  }

  // ---- gameplay HUD ----
  private layoutGameplay(f: HudFrame, playing: boolean) {
    const { state, boat, w } = f;
    const g = this.g;
    const show = playing;
    for (const tx of [this.hullLabel, this.speedNum, this.speedUnit, this.objective, this.timer])
      tx.visible = show;
    if (!show) return;

    // Hull panel
    const px = 18,
      py = 18,
      pw = 232,
      ph = 64;
    panel(g, px, py, pw, ph);
    boatIcon(g, px + 24, py + 32);
    this.hullLabel.position.set(px + 46, py + 12);
    const barX = px + 46,
      barY = py + 32,
      barW = pw - 64,
      barH = 14;
    g.roundRect(barX, barY, barW, barH, 7).fill({ color: 0x000000, alpha: 0.1 });
    const frac = state.lifeFraction;
    const col = frac > 0.5 ? COLORS.lifeGood : frac > 0.25 ? COLORS.lifeWarn : COLORS.lifeBad;
    if (frac > 0) {
      g.roundRect(barX, barY, barW * frac, barH, 7).fill(col);
      g.roundRect(barX + 2, barY + 2, Math.max(0, barW * frac - 4), 4, 2).fill({
        color: 0xffffff,
        alpha: 0.35,
      }); // gloss
    }
    this.hullLabel.text = "HULL";
    this.timer.visible = true;

    // Speed pill (below hull panel)
    const sx = 18,
      sy = py + ph + 10;
    panel(g, sx, sy, 132, 50);
    this.speedNum.text = boat.speedKnots.toFixed(1);
    this.speedNum.position.set(sx + 14, sy + 8);
    this.speedUnit.text = "kn";
    this.speedUnit.position.set(sx + 14 + this.speedNum.width + 6, sy + 26);

    // Objective banner (top centre)
    this.objective.text = "Reach the seaport";
    const ow = this.objective.width + 52;
    const ox = (w - ow) / 2;
    panel(g, ox, 18, ow, 38);
    anchorIcon(g, ox + 22, 37);
    this.objective.position.set(ox + 38, 28);

    // Timer pill (top right)
    const tw = 86;
    panel(g, w - 18 - tw, 18, tw, 38);
    this.timer.text = fmtTime(state.elapsedSeconds);
    this.timer.position.set(w - 18 - tw + (tw - this.timer.width) / 2, 28);
  }

  private drawGauges(boat: Boat, w: number, h: number) {
    const g = this.g;
    const L = hudLayout(w, h);

    // Throttle lever
    const tk = L.throttle;
    panel(g, tk.x - 28, tk.top - 30, 56, tk.bot - tk.top + 60);
    g.roundRect(tk.x - 4, tk.top, 8, tk.bot - tk.top, 4).fill({ color: 0x000000, alpha: 0.1 });
    // coloured fill from neutral to knob
    const knobY = tk.mid - boat.throttle * tk.half;
    const fwd = boat.throttle >= 0;
    const fillCol = Math.abs(boat.throttle) < 0.02 ? COLORS.hudMuted : fwd ? COLORS.lifeGood : COLORS.playerAccent;
    g.roundRect(tk.x - 4, Math.min(tk.mid, knobY), 8, Math.abs(knobY - tk.mid), 4).fill(fillCol);
    for (const yy of [tk.top, tk.mid, tk.bot])
      g.moveTo(tk.x - 12, yy).lineTo(tk.x + 12, yy).stroke({ width: 2, color: COLORS.hudMuted, alpha: 0.5 });
    g.roundRect(tk.x - 19, knobY - 9, 38, 18, 5).fill(COLORS.panel).stroke({ width: 2.5, color: fillCol });
    g.moveTo(tk.x - 9, knobY).lineTo(tk.x + 9, knobY).stroke({ width: 2, color: fillCol });

    // Helm wheel
    const wl = L.wheel;
    panel(g, wl.x - wl.r - 16, wl.y - wl.r - 16, (wl.r + 16) * 2, (wl.r + 16) * 2);
    g.circle(wl.x, wl.y, wl.r).stroke({ width: 6, color: COLORS.hud, alpha: 0.9 });
    g.circle(wl.x, wl.y, wl.r - 3).stroke({ width: 1, color: COLORS.hudMuted, alpha: 0.5 });
    const rot = -boat.motorAngle * 2.4;
    for (let i = 0; i < 6; i++) {
      const a = rot + (i * Math.PI) / 3;
      g.moveTo(wl.x, wl.y).lineTo(wl.x + Math.cos(a) * (wl.r - 2), wl.y + Math.sin(a) * (wl.r - 2));
    }
    g.stroke({ width: 3, color: COLORS.hud, alpha: 0.85 });
    // grip handles + hub, hub marks heading
    for (let i = 0; i < 3; i++) {
      const a = rot + (i * Math.PI * 2) / 3;
      g.circle(wl.x + Math.cos(a) * wl.r, wl.y + Math.sin(a) * wl.r, 5).fill(COLORS.hud);
    }
    g.circle(wl.x, wl.y, 9).fill(COLORS.hud);
    g.circle(wl.x + Math.cos(rot - Math.PI / 2) * 9, wl.y + Math.sin(rot - Math.PI / 2) * 9, 3).fill(COLORS.playerAccent);
  }

  private drawArrow(f: HudFrame) {
    if (f.goal.onScreen) return;
    const g = this.g;
    const cx = f.w / 2,
      cy = f.h / 2;
    const ang = Math.atan2(f.goal.y - cy, f.goal.x - cx);
    const m = 64;
    const x = clamp(f.goal.x, m, f.w - m);
    const y = clamp(f.goal.y, m, f.h - 150); // keep clear of the bottom gauges
    g.circle(x, y, 20).fill({ color: COLORS.panel, alpha: 0.9 }).stroke({ width: 2, color: COLORS.goal });
    const tip = 11;
    g.poly([
      x + Math.cos(ang) * tip,
      y + Math.sin(ang) * tip,
      x + Math.cos(ang + 2.5) * tip,
      y + Math.sin(ang + 2.5) * tip,
      x + Math.cos(ang - 2.5) * tip,
      y + Math.sin(ang - 2.5) * tip,
    ]).fill(COLORS.goal);
  }

  // ---- overlays ----
  private layoutOverlay(state: GameState, w: number, h: number) {
    const overlay = state.status !== "playing";
    for (const tx of [this.title, this.subtitle, this.stat, this.btn, this.hint]) tx.visible = overlay;
    if (!overlay) return;

    const g = this.g;
    g.rect(0, 0, w, h).fill({ color: 0x07171f, alpha: 0.55 });

    const cw = Math.min(w * 0.88, 460);
    const ch = 300;
    const cx = (w - cw) / 2;
    const cy = (h - ch) / 2;
    g.roundRect(cx + 4, cy + 8, cw, ch, 22).fill({ color: COLORS.shadow, alpha: 0.35 }); // card shadow
    g.roundRect(cx, cy, cw, ch, 22).fill(COLORS.panel);
    g.roundRect(cx, cy, cw, 8, 22).fill(
      state.status === "won" ? COLORS.goal : state.status === "lost" ? COLORS.playerAccent : COLORS.playerAccent2,
    ); // accent top bar

    const midX = w / 2;
    const ready = state.status === "ready";
    const won = state.status === "won";

    this.title.text = ready ? "PARKING BOAT" : won ? "DOCKED!" : "HULL BREACHED";
    this.title.style.fill = ready ? COLORS.hud : won ? COLORS.lifeGood : COLORS.playerAccent;
    this.title.style.fontSize = Math.min(56, cw * 0.13);
    this.title.position.set(midX, cy + 64);

    this.subtitle.visible = ready;
    if (ready) {
      this.subtitle.text = "Ease out of the slip and dock at the seaport";
      this.subtitle.position.set(midX, cy + 104);
    }

    this.stat.visible = !ready;
    if (!ready) {
      this.stat.text = won
        ? `Time ${fmtTime(state.elapsedSeconds)}   ·   Hull ${Math.round(state.lifeFraction * 100)}%`
        : "The hull took too much damage";
      this.stat.position.set(midX, cy + 116);
    }

    // Button
    const bw = 200,
      bh = 52;
    const bx = midX - bw / 2,
      by = cy + ch - 104;
    g.roundRect(bx, by, bw, bh, 14).fill(won || ready ? COLORS.goal : COLORS.playerAccent);
    g.roundRect(bx, by, bw, bh / 2, 14).fill({ color: 0xffffff, alpha: 0.12 });
    this.btn.text = ready ? "START" : "PLAY AGAIN";
    this.btn.position.set(midX, by + bh / 2);

    this.hint.text = ready ? "Touch the gauges, or use W A S D" : "Tap anywhere or press R";
    this.hint.position.set(midX, cy + ch - 30);
  }

  private drawVignette(w: number, h: number) {
    this.vW = w;
    this.vH = h;
    const grad = new FillGradient({
      type: "radial",
      center: { x: 0.5, y: 0.5 },
      innerRadius: 0.32,
      outerCenter: { x: 0.5, y: 0.5 },
      outerRadius: 0.75,
      colorStops: [
        { offset: 0, color: "rgba(6,22,30,0)" },
        { offset: 1, color: "rgba(6,22,30,0.42)" },
      ],
      textureSpace: "local",
    });
    this.vignette.clear();
    this.vignette.rect(0, 0, w, h).fill(grad);
  }
}

// ---- helpers ----
function panel(g: Graphics, x: number, y: number, w: number, h: number) {
  g.roundRect(x + 2, y + 4, w, h, 12).fill({ color: COLORS.shadow, alpha: 0.14 });
  g.roundRect(x, y, w, h, 12).fill({ color: COLORS.panel, alpha: 0.92 });
}

function boatIcon(g: Graphics, cx: number, cy: number) {
  g.poly([cx - 12, cy - 2, cx + 12, cy - 6, cx + 7, cy + 6, cx - 9, cy + 6])
    .fill(COLORS.playerAccent)
    .stroke({ width: 1.5, color: COLORS.line });
}

function anchorIcon(g: Graphics, cx: number, cy: number) {
  g.circle(cx, cy - 8, 3).stroke({ width: 2, color: COLORS.goal });
  g.moveTo(cx, cy - 5).lineTo(cx, cy + 7).stroke({ width: 2, color: COLORS.goal });
  g.moveTo(cx - 6, cy + 1).lineTo(cx + 6, cy + 1).stroke({ width: 2, color: COLORS.goal });
  g.arc(cx, cy + 2, 7, 0.2, Math.PI - 0.2).stroke({ width: 2, color: COLORS.goal });
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function mk(size: number, weight: string, fill: number, anchor = 0): Text {
  const t = new Text({
    text: "",
    style: { fontFamily: "system-ui, Segoe UI, sans-serif", fontSize: size, fontWeight: weight as never, fill },
  });
  t.anchor.set(anchor);
  return t;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
