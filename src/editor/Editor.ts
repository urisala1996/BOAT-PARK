import {
  Container,
  Graphics,
  Sprite,
  Texture,
  type FederatedPointerEvent,
} from "pixi.js";
import { PIXELS_PER_METER as P, COLORS } from "../config.ts";
import { Renderer } from "../render/Renderer.ts";
import type { Level, WallDef, BoatDef } from "../level/types.ts";
import {
  buildWater,
  buildGoal,
  buildBuoys,
  buildWall,
  buildObstacleBoat,
  buildRockField,
  buildLighthouse,
  buildPlayer,
} from "../render/views.ts";
import { LIGHTHOUSE_RADIUS } from "../entities/bodies.ts";
import { saveLevel, saveCurrent, loadLevel, listLevelNames } from "../level/storage.ts";

type Tool =
  | "select"
  | "dock"
  | "land"
  | "boat"
  | "spawn"
  | "goal"
  | "rocks"
  | "lighthouse"
  | "erase"
  | "image";
type Sel =
  | { kind: "wall"; i: number }
  | { kind: "boat"; i: number }
  | { kind: "rocks"; i: number }
  | { kind: "lighthouse"; i: number }
  | { kind: "goal" }
  | { kind: "spawn" }
  | { kind: "image" }
  | null;

const HANDLE_PX = 11; // on-screen handle size
const HIT_PX = 16; // handle hit tolerance
const ROT_OFF_PX = 26; // rotate handle distance above the box

interface ImageMeta {
  dataUrl: string;
  xM: number;
  yM: number;
  widthM: number;
  heightM: number;
  opacity: number;
}

export interface EditorOptions {
  onPlay: (level: Level) => void;
  onMenu: () => void;
}

const IMG_KEY = "boatpark.image.v1";

// In-canvas level editor: trace a map image, drag out docks/walls, drop boats, set the start
// slip and seaport goal, then play/export. Renders into the shared renderer.world with its own
// pan/zoom camera; all editing UI is plain DOM overlaid on the canvas.
export class Editor {
  private readonly scene = new Container();
  private readonly level: Level;
  private image: (ImageMeta & { sprite: Sprite }) | null = null;

  private tool: Tool = "select";
  private sel: Sel = null;
  private snap = 1; // metres; 0 = off
  private cam = { x: 0, y: 0, zoom: 1 };

  // drag state
  private action: "none" | "pan" | "move" | "draw" | "moveImage" | "resize" | "rotate" | "radius" =
    "none";
  private startScreen = { x: 0, y: 0 };
  private moveOffset = { x: 0, y: 0 };
  private draftRect: { x: number; y: number; w: number; h: number } | null = null;
  private activeHandle: { type: "corner" | "rotate" | "radius"; sx: number; sy: number } | null = null;
  private resizeFixed = { x: 0, y: 0 };
  private resizeAng = 0;

  // DOM
  private readonly root = document.createElement("div");
  private readonly panel = document.createElement("div");
  private readonly toolButtons = new Map<Tool, HTMLButtonElement>();

  constructor(
    private readonly renderer: Renderer,
    level: Level,
    private readonly opts: EditorOptions,
  ) {
    this.level = structuredClone(level);
    this.level.rocks ??= [];
    this.level.lighthouses ??= [];
    renderer.world.addChild(this.scene);
    renderer.app.stage.eventMode = "static";

    this.buildDom();
    this.loadImageMeta();
    this.fitCamera();
    this.render();

    // Dev-only hook for automated verification; stripped from production builds.
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__ed = {
        level: () => this.level,
        selKind: () => this.sel?.kind ?? null,
        toScreen: (xM: number, yM: number) => ({
          x: this.cam.x + xM * P * this.cam.zoom,
          y: this.cam.y + yM * P * this.cam.zoom,
        }),
        handleScreens: () =>
          this.sel
            ? this.handles(this.sel).map((h) => ({
                type: h.type,
                x: this.cam.x + h.x * P * this.cam.zoom,
                y: this.cam.y + h.y * P * this.cam.zoom,
              }))
            : [],
      };
    }

    const stage = renderer.app.stage;
    stage.on("pointerdown", this.onDown);
    stage.on("globalpointermove", this.onMove);
    stage.on("pointerup", this.onUp);
    stage.on("pointerupoutside", this.onUp);
    renderer.app.canvas.addEventListener("wheel", this.onWheel, { passive: false });
  }

  dispose() {
    const stage = this.renderer.app.stage;
    stage.off("pointerdown", this.onDown);
    stage.off("globalpointermove", this.onMove);
    stage.off("pointerup", this.onUp);
    stage.off("pointerupoutside", this.onUp);
    this.renderer.app.canvas.removeEventListener("wheel", this.onWheel);
    this.renderer.world.removeChild(this.scene);
    this.scene.destroy({ children: true });
    this.root.remove();
  }

  // ---------- camera ----------
  private applyCam() {
    this.renderer.world.position.set(this.cam.x, this.cam.y);
    this.renderer.world.scale.set(this.cam.zoom);
  }
  private fitCamera() {
    const W = this.level.bounds.w * P;
    const H = this.level.bounds.h * P;
    const z = Math.min(this.renderer.width / W, this.renderer.height / H) * 0.92;
    this.cam.zoom = z;
    this.cam.x = (this.renderer.width - W * z) / 2;
    this.cam.y = (this.renderer.height - H * z) / 2;
    this.applyCam();
  }
  private toM(sx: number, sy: number) {
    return { x: (sx - this.cam.x) / this.cam.zoom / P, y: (sy - this.cam.y) / this.cam.zoom / P };
  }
  private snapM(v: number) {
    return this.snap > 0 ? Math.round(v / this.snap) * this.snap : v;
  }

  private readonly onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const before = this.toM(e.offsetX, e.offsetY);
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    this.cam.zoom = Math.max(0.1, Math.min(8, this.cam.zoom * factor));
    // keep the point under the cursor fixed
    this.cam.x = e.offsetX - before.x * P * this.cam.zoom;
    this.cam.y = e.offsetY - before.y * P * this.cam.zoom;
    this.applyCam();
  };

  // ---------- pointer ----------
  private readonly onDown = (e: FederatedPointerEvent) => {
    const s = { x: e.global.x, y: e.global.y };
    const m = this.toM(s.x, s.y);
    this.startScreen = s;

    // Right / middle button always pans.
    if (e.button === 1 || e.button === 2) {
      this.action = "pan";
      return;
    }

    switch (this.tool) {
      case "select":
      case "erase": {
        if (this.tool === "select" && this.sel) {
          const hb = this.hitHandle(m);
          if (hb) {
            this.startHandle(hb);
            return;
          }
        }
        const hit = this.pick(m.x, m.y);
        if (this.tool === "erase") {
          if (hit) this.deleteSel(hit);
          return;
        }
        this.sel = hit;
        this.updatePanel();
        if (hit) {
          this.action = "move";
          const c = this.center(hit);
          this.moveOffset = { x: m.x - c.x, y: m.y - c.y };
        } else {
          this.action = "pan";
        }
        this.render();
        break;
      }
      case "dock":
      case "land":
      case "goal":
      case "rocks":
        this.action = "draw";
        this.draftRect = { x: m.x, y: m.y, w: 0, h: 0 };
        break;
      case "lighthouse": {
        const lh = { x: this.snapM(m.x), y: this.snapM(m.y), radius: LIGHTHOUSE_RADIUS };
        this.level.lighthouses!.push(lh);
        this.sel = { kind: "lighthouse", i: this.level.lighthouses!.length - 1 };
        this.tool = "select";
        this.syncTools();
        this.updatePanel();
        this.autosave();
        this.render();
        break;
      }
      case "boat": {
        const b: BoatDef = { x: this.snapM(m.x), y: this.snapM(m.y), angle: 0, length: 5, beam: 2 };
        this.level.boats.push(b);
        this.sel = { kind: "boat", i: this.level.boats.length - 1 };
        this.tool = "select";
        this.syncTools();
        this.updatePanel();
        this.render();
        break;
      }
      case "spawn":
        this.level.spawn.x = this.snapM(m.x);
        this.level.spawn.y = this.snapM(m.y);
        this.sel = { kind: "spawn" };
        this.updatePanel();
        this.render();
        break;
      case "image":
        if (this.image) {
          this.action = "moveImage";
          this.moveOffset = { x: m.x - this.image.xM, y: m.y - this.image.yM };
        }
        break;
    }
  };

  private readonly onMove = (e: FederatedPointerEvent) => {
    if (this.action === "none") return;
    const s = { x: e.global.x, y: e.global.y };
    const m = this.toM(s.x, s.y);

    if (this.action === "pan") {
      this.cam.x += s.x - this.startScreen.x;
      this.cam.y += s.y - this.startScreen.y;
      this.startScreen = s;
      this.applyCam();
    } else if (this.action === "move" && this.sel) {
      this.setCenter(this.sel, this.snapM(m.x - this.moveOffset.x), this.snapM(m.y - this.moveOffset.y));
      this.render();
    } else if (this.action === "draw" && this.draftRect) {
      this.draftRect.w = m.x - this.draftRect.x;
      this.draftRect.h = m.y - this.draftRect.y;
      this.render();
    } else if (this.action === "moveImage" && this.image) {
      this.image.xM = this.snapM(m.x - this.moveOffset.x);
      this.image.yM = this.snapM(m.y - this.moveOffset.y);
      this.render();
    } else if (this.action === "resize" && this.sel && this.activeHandle) {
      this.doResize(m);
      this.render();
    } else if (this.action === "rotate" && this.sel) {
      this.doRotate(m);
      this.render();
    } else if (this.action === "radius" && this.sel) {
      this.doRadius(m);
      this.render();
    }
  };

  private readonly onUp = () => {
    if (this.action === "draw" && this.draftRect) {
      const r = norm(this.draftRect);
      if (r.w > 1 && r.h > 1) {
        const cx = this.snapM(r.x + r.w / 2);
        const cy = this.snapM(r.y + r.h / 2);
        const w = this.snapM(r.w);
        const h = this.snapM(r.h);
        if (this.tool === "goal") {
          this.level.goal = { x: cx, y: cy, w, h };
          this.sel = { kind: "goal" };
        } else if (this.tool === "rocks") {
          this.level.rocks!.push({ x: cx, y: cy, w, h });
          this.sel = { kind: "rocks", i: this.level.rocks!.length - 1 };
        } else {
          this.level.walls.push({ x: cx, y: cy, w, h, kind: this.tool === "dock" ? "dock" : "land" });
          this.sel = { kind: "wall", i: this.level.walls.length - 1 };
        }
        this.tool = "select";
        this.syncTools();
        this.updatePanel();
      }
      this.draftRect = null;
    }
    if (this.action === "moveImage") this.saveImageMeta();
    this.activeHandle = null;
    this.action = "none";
    this.autosave();
    this.render();
  };

  // ---------- hit testing ----------
  private pick(x: number, y: number): Sel {
    const lhs = this.level.lighthouses ?? [];
    for (let i = lhs.length - 1; i >= 0; i--) {
      const l = lhs[i];
      if (Math.hypot(x - l.x, y - l.y) <= (l.radius ?? LIGHTHOUSE_RADIUS)) return { kind: "lighthouse", i };
    }
    for (let i = this.level.boats.length - 1; i >= 0; i--) {
      const b = this.level.boats[i];
      if (inRect(x, y, b.x, b.y, b.length, b.beam, b.angle)) return { kind: "boat", i };
    }
    const sp = this.level.spawn;
    if (inRect(x, y, sp.x, sp.y, 5, 2, sp.angle)) return { kind: "spawn" };
    const rocks = this.level.rocks ?? [];
    for (let i = rocks.length - 1; i >= 0; i--) {
      const r = rocks[i];
      if (inRect(x, y, r.x, r.y, r.w, r.h, r.angle ?? 0)) return { kind: "rocks", i };
    }
    for (let i = this.level.walls.length - 1; i >= 0; i--) {
      const w = this.level.walls[i];
      if (inRect(x, y, w.x, w.y, w.w, w.h, w.angle ?? 0)) return { kind: "wall", i };
    }
    const g = this.level.goal;
    if (inRect(x, y, g.x, g.y, g.w, g.h, 0)) return { kind: "goal" };
    return null;
  }
  private center(s: NonNullable<Sel>): { x: number; y: number } {
    if (s.kind === "wall") return this.level.walls[s.i];
    if (s.kind === "boat") return this.level.boats[s.i];
    if (s.kind === "rocks") return this.level.rocks![s.i];
    if (s.kind === "lighthouse") return this.level.lighthouses![s.i];
    if (s.kind === "goal") return this.level.goal;
    if (s.kind === "spawn") return this.level.spawn;
    return { x: this.image?.xM ?? 0, y: this.image?.yM ?? 0 };
  }
  private setCenter(s: NonNullable<Sel>, x: number, y: number) {
    const o = this.center(s);
    o.x = x;
    o.y = y;
  }
  private deleteSel(s: NonNullable<Sel>) {
    if (s.kind === "wall") this.level.walls.splice(s.i, 1);
    else if (s.kind === "boat") this.level.boats.splice(s.i, 1);
    else if (s.kind === "rocks") this.level.rocks!.splice(s.i, 1);
    else if (s.kind === "lighthouse") this.level.lighthouses!.splice(s.i, 1);
    else return; // goal/spawn are required, not deletable
    this.sel = null;
    this.updatePanel();
    this.autosave();
    this.render();
  }

  // ---------- rendering ----------
  private render() {
    const sc = this.scene;
    sc.removeChildren();

    sc.addChild(buildWater(this.level));
    if (this.image) {
      this.image.sprite.position.set(this.image.xM * P, this.image.yM * P);
      this.image.sprite.width = this.image.widthM * P;
      this.image.sprite.height = this.image.heightM * P;
      this.image.sprite.alpha = this.image.opacity;
      sc.addChild(this.image.sprite);
    }
    sc.addChild(buildGoal(this.level.goal).container);
    sc.addChild(buildBuoys(this.level.goal));
    for (const w of this.level.walls) sc.addChild(buildWall(w));
    for (const r of this.level.rocks ?? []) sc.addChild(buildRockField(r));
    for (const b of this.level.boats) sc.addChild(buildObstacleBoat(b));
    for (const lh of this.level.lighthouses ?? []) sc.addChild(buildLighthouse(lh));
    const sp = buildPlayer(5 * P, 2 * P);
    sp.container.position.set(this.level.spawn.x * P, this.level.spawn.y * P);
    sp.container.rotation = this.level.spawn.angle;
    sc.addChild(sp.container);

    // bounds frame
    const frame = new Graphics();
    frame
      .rect(0, 0, this.level.bounds.w * P, this.level.bounds.h * P)
      .stroke({ width: 2, color: COLORS.line, alpha: 0.5 });
    sc.addChild(frame);

    if (this.draftRect) {
      const r = norm(this.draftRect);
      const g = new Graphics();
      g.rect(r.x * P, r.y * P, r.w * P, r.h * P).fill({ color: COLORS.playerAccent, alpha: 0.25 }).stroke({
        width: 2,
        color: COLORS.playerAccent,
      });
      sc.addChild(g);
    }

    if (this.sel) sc.addChild(this.selectionOverlay(this.sel));
  }

  // Geometry of a selection in metres (half extents + angle), used for handles + overlay.
  private geom(s: NonNullable<Sel>): { cx: number; cy: number; hw: number; hh: number; ang: number } {
    switch (s.kind) {
      case "wall": { const o = this.level.walls[s.i]; return { cx: o.x, cy: o.y, hw: o.w / 2, hh: o.h / 2, ang: o.angle ?? 0 }; }
      case "boat": { const o = this.level.boats[s.i]; return { cx: o.x, cy: o.y, hw: o.length / 2, hh: o.beam / 2, ang: o.angle }; }
      case "rocks": { const o = this.level.rocks![s.i]; return { cx: o.x, cy: o.y, hw: o.w / 2, hh: o.h / 2, ang: o.angle ?? 0 }; }
      case "goal": { const o = this.level.goal; return { cx: o.x, cy: o.y, hw: o.w / 2, hh: o.h / 2, ang: 0 }; }
      case "spawn": { const o = this.level.spawn; return { cx: o.x, cy: o.y, hw: 2.5, hh: 1, ang: o.angle }; }
      case "lighthouse": { const o = this.level.lighthouses![s.i]; const r = o.radius ?? LIGHTHOUSE_RADIUS; return { cx: o.x, cy: o.y, hw: r, hh: r, ang: 0 }; }
      default: { const im = this.image!; return { cx: im.xM + im.widthM / 2, cy: im.yM + im.heightM / 2, hw: im.widthM / 2, hh: im.heightM / 2, ang: 0 }; }
    }
  }

  private resizable(s: NonNullable<Sel>) {
    return s.kind === "wall" || s.kind === "boat" || s.kind === "goal" || s.kind === "rocks";
  }
  private rotatable(s: NonNullable<Sel>) {
    return s.kind === "wall" || s.kind === "boat" || s.kind === "rocks" || s.kind === "spawn";
  }

  private handles(s: NonNullable<Sel>) {
    const g = this.geom(s);
    const cos = Math.cos(g.ang), sin = Math.sin(g.ang);
    const tw = (lx: number, ly: number) => ({ x: g.cx + lx * cos - ly * sin, y: g.cy + lx * sin + ly * cos });
    const out: { type: "corner" | "rotate" | "radius"; sx: number; sy: number; x: number; y: number }[] = [];
    if (this.resizable(s))
      for (const sx of [-1, 1])
        for (const sy of [-1, 1]) {
          const p = tw(sx * g.hw, sy * g.hh);
          out.push({ type: "corner", sx, sy, x: p.x, y: p.y });
        }
    if (this.rotatable(s)) {
      const off = ROT_OFF_PX / (this.cam.zoom * P);
      const p = tw(0, -(g.hh + off));
      out.push({ type: "rotate", sx: 0, sy: 0, x: p.x, y: p.y });
    }
    if (s.kind === "lighthouse") out.push({ type: "radius", sx: 1, sy: 0, x: g.cx + g.hw, y: g.cy });
    return out;
  }

  private hitHandle(m: { x: number; y: number }) {
    if (!this.sel) return null;
    const tol = HIT_PX / (this.cam.zoom * P);
    for (const h of this.handles(this.sel)) if (Math.hypot(m.x - h.x, m.y - h.y) <= tol) return h;
    return null;
  }

  private startHandle(h: { type: "corner" | "rotate" | "radius"; sx: number; sy: number }) {
    this.activeHandle = h;
    if (h.type === "corner") {
      this.action = "resize";
      const g = this.geom(this.sel!);
      this.resizeAng = g.ang;
      const cos = Math.cos(g.ang), sin = Math.sin(g.ang);
      const flx = -h.sx * g.hw, fly = -h.sy * g.hh; // opposite (fixed) corner, local
      this.resizeFixed = { x: g.cx + flx * cos - fly * sin, y: g.cy + flx * sin + fly * cos };
    } else if (h.type === "rotate") this.action = "rotate";
    else this.action = "radius";
  }

  private doResize(m: { x: number; y: number }) {
    const ang = this.resizeAng;
    const cosN = Math.cos(-ang), sinN = Math.sin(-ang);
    const dx = m.x - this.resizeFixed.x, dy = m.y - this.resizeFixed.y;
    const lx = dx * cosN - dy * sinN, ly = dx * sinN + dy * cosN; // pointer in object-aligned frame
    let fullW = Math.max(0.5, Math.abs(lx)), fullH = Math.max(0.5, Math.abs(ly));
    if (this.snap > 0) { fullW = Math.max(0.5, this.snapM(fullW)); fullH = Math.max(0.5, this.snapM(fullH)); }
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const ddx = (lx < 0 ? -1 : 1) * fullW, ddy = (ly < 0 ? -1 : 1) * fullH;
    const dragX = this.resizeFixed.x + ddx * ca - ddy * sa;
    const dragY = this.resizeFixed.y + ddx * sa + ddy * ca;
    this.setRect(this.sel!, (this.resizeFixed.x + dragX) / 2, (this.resizeFixed.y + dragY) / 2, fullW / 2, fullH / 2);
  }

  private doRotate(m: { x: number; y: number }) {
    const g = this.geom(this.sel!);
    let a = Math.atan2(m.y - g.cy, m.x - g.cx) + Math.PI / 2;
    if (this.snap > 0) { const step = Math.PI / 12; a = Math.round(a / step) * step; } // snap to 15°
    this.setAngle(this.sel!, a);
  }

  private doRadius(m: { x: number; y: number }) {
    if (this.sel!.kind !== "lighthouse") return;
    const g = this.geom(this.sel!);
    let r = Math.hypot(m.x - g.cx, m.y - g.cy);
    r = Math.max(1, this.snap > 0 ? this.snapM(r) : r);
    this.level.lighthouses![this.sel!.i].radius = r;
  }

  private setRect(s: NonNullable<Sel>, cx: number, cy: number, hw: number, hh: number) {
    if (s.kind === "wall") { const o = this.level.walls[s.i]; o.x = cx; o.y = cy; o.w = hw * 2; o.h = hh * 2; }
    else if (s.kind === "boat") { const o = this.level.boats[s.i]; o.x = cx; o.y = cy; o.length = hw * 2; o.beam = hh * 2; }
    else if (s.kind === "rocks") { const o = this.level.rocks![s.i]; o.x = cx; o.y = cy; o.w = hw * 2; o.h = hh * 2; }
    else if (s.kind === "goal") { const o = this.level.goal; o.x = cx; o.y = cy; o.w = hw * 2; o.h = hh * 2; }
  }

  private setAngle(s: NonNullable<Sel>, ang: number) {
    if (s.kind === "wall") this.level.walls[s.i].angle = ang;
    else if (s.kind === "boat") this.level.boats[s.i].angle = ang;
    else if (s.kind === "rocks") this.level.rocks![s.i].angle = ang;
    else if (s.kind === "spawn") this.level.spawn.angle = ang;
  }

  private selectionOverlay(s: NonNullable<Sel>): Graphics {
    const g = new Graphics();
    const gm = this.geom(s);
    const cos = Math.cos(gm.ang), sin = Math.sin(gm.ang);
    const tw = (lx: number, ly: number): [number, number] => [
      (gm.cx + lx * cos - ly * sin) * P,
      (gm.cy + lx * sin + ly * cos) * P,
    ];
    const lw = 2 / this.cam.zoom;
    const corners = [tw(-gm.hw, -gm.hh), tw(gm.hw, -gm.hh), tw(gm.hw, gm.hh), tw(-gm.hw, gm.hh)];
    g.poly(corners.flat()).stroke({ width: lw, color: 0x2ec4b6 });
    const hp = HANDLE_PX / this.cam.zoom;
    for (const h of this.handles(s)) {
      const x = h.x * P, y = h.y * P;
      if (h.type === "corner") g.rect(x - hp / 2, y - hp / 2, hp, hp).fill(0xffffff).stroke({ width: lw, color: 0x2ec4b6 });
      else g.circle(x, y, hp * 0.6).fill(h.type === "rotate" ? 0x2ec4b6 : 0xffffff).stroke({ width: lw, color: 0x2ec4b6 });
    }
    return g;
  }

  // ---------- image ----------
  private setImage(dataUrl: string, widthM = this.level.bounds.w) {
    const img = new Image();
    img.onload = () => {
      const ratio = img.height / img.width;
      const sprite = this.image?.sprite ?? new Sprite();
      sprite.texture = Texture.from(img);
      this.image = {
        sprite,
        dataUrl,
        xM: this.image?.xM ?? 0,
        yM: this.image?.yM ?? 0,
        widthM,
        heightM: widthM * ratio,
        opacity: this.image?.opacity ?? 0.5,
      };
      this.saveImageMeta();
      this.updatePanel();
      this.render();
    };
    img.src = dataUrl;
  }
  private saveImageMeta() {
    if (!this.image) return;
    try {
      const { dataUrl, xM, yM, widthM, heightM, opacity } = this.image;
      localStorage.setItem(IMG_KEY, JSON.stringify({ dataUrl, xM, yM, widthM, heightM, opacity }));
    } catch {
      /* image too big for storage — stays for this session only */
    }
  }
  private loadImageMeta() {
    try {
      const v = localStorage.getItem(IMG_KEY);
      if (!v) return;
      const meta = JSON.parse(v) as ImageMeta;
      const img = new Image();
      img.onload = () => {
        const sprite = new Sprite(Texture.from(img));
        this.image = { ...meta, sprite };
        this.render();
      };
      img.src = meta.dataUrl;
    } catch {
      /* ignore */
    }
  }

  // ---------- persistence / actions ----------
  private autosave() {
    saveCurrent(this.level);
  }
  private exportJson() {
    const blob = new Blob([JSON.stringify(this.level, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${this.level.name.replace(/\s+/g, "-").toLowerCase() || "level"}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  private importJson(file: File) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const lvl = JSON.parse(String(r.result)) as Level;
        if (!lvl.bounds || !lvl.spawn || !lvl.goal || !Array.isArray(lvl.walls) || !Array.isArray(lvl.boats))
          throw new Error("bad");
        Object.assign(this.level, lvl);
        this.level.rocks ??= [];
        this.level.lighthouses ??= [];
        this.sel = null;
        this.fitCamera();
        this.updatePanel();
        this.autosave();
        this.render();
      } catch {
        alert("That doesn't look like a valid level JSON.");
      }
    };
    r.readAsText(file);
  }
  private newLevel() {
    Object.assign(this.level, {
      name: "New Port",
      bounds: { w: 90, h: 60 },
      spawn: { x: 12, y: 30, angle: 0 },
      goal: { x: 78, y: 30, w: 14, h: 16 },
      walls: [],
      boats: [],
      rocks: [],
      lighthouses: [],
    } satisfies Level);
    this.sel = null;
    this.fitCamera();
    this.updatePanel();
    this.autosave();
    this.render();
  }

  // ---------- DOM ----------
  private buildDom() {
    injectStyle();
    this.root.className = "ed-root";

    // top toolbar
    const bar = div("ed-bar");
    const tools: [Tool, string][] = [
      ["select", "↖ Select"],
      ["dock", "▤ Dock"],
      ["land", "▦ Land"],
      ["boat", "⛵ Boat"],
      ["spawn", "⚑ Start"],
      ["goal", "⚓ Goal"],
      ["rocks", "🪨 Rocks"],
      ["lighthouse", "🗼 Lighthouse"],
      ["erase", "✕ Erase"],
      ["image", "🗺 Image"],
    ];
    for (const [t, label] of tools) {
      const b = button(label, () => {
        this.tool = t;
        this.syncTools();
      });
      b.className = "ed-tool";
      this.toolButtons.set(t, b);
      bar.appendChild(b);
    }
    bar.appendChild(sep());

    const snapBtn = button("Snap 1m", () => {
      this.snap = this.snap > 0 ? 0 : 1;
      snapBtn.textContent = this.snap > 0 ? "Snap 1m" : "Snap off";
      snapBtn.classList.toggle("on", this.snap > 0);
    });
    snapBtn.classList.add("on");
    bar.appendChild(snapBtn);

    const imgInput = fileInput("image/*", (f) => readDataUrl(f, (url) => this.setImage(url)));
    bar.appendChild(labelWrap("Load map", imgInput));
    bar.appendChild(sep());

    bar.appendChild(button("New", () => this.newLevel()));
    const jsonInput = fileInput("application/json,.json", (f) => this.importJson(f));
    bar.appendChild(labelWrap("Import", jsonInput));
    bar.appendChild(button("Export", () => this.exportJson()));
    bar.appendChild(button("Save", () => this.saveNamed()));
    bar.appendChild(this.buildLoadSelect());
    bar.appendChild(sep());
    bar.appendChild(button("≡ Menu", () => this.opts.onMenu()));
    const play = button("▶ Play", () => this.opts.onPlay(structuredClone(this.level)));
    play.className = "ed-play";
    bar.appendChild(play);

    this.root.appendChild(bar);

    // properties panel
    this.panel.className = "ed-panel";
    this.root.appendChild(this.panel);

    document.body.appendChild(this.root);
    this.syncTools();
    this.updatePanel();
  }

  private buildLoadSelect(): HTMLElement {
    const sel = document.createElement("select");
    sel.className = "ed-select";
    const refresh = () => {
      sel.innerHTML = "<option value=''>Load…</option>";
      for (const n of listLevelNames()) {
        const o = document.createElement("option");
        o.value = n;
        o.textContent = n;
        sel.appendChild(o);
      }
    };
    refresh();
    sel.onfocus = refresh;
    sel.onchange = () => {
      const lvl = sel.value && loadLevel(sel.value);
      if (lvl) {
        Object.assign(this.level, lvl);
        this.level.rocks ??= [];
        this.level.lighthouses ??= [];
        this.sel = null;
        this.fitCamera();
        this.updatePanel();
        this.autosave();
        this.render();
      }
      sel.value = "";
    };
    return sel;
  }

  private saveNamed() {
    const name = prompt("Save level as:", this.level.name) ?? "";
    if (!name.trim()) return;
    this.level.name = name.trim();
    saveLevel(structuredClone(this.level));
    this.autosave();
    this.updatePanel();
  }

  private syncTools() {
    for (const [t, b] of this.toolButtons) b.classList.toggle("on", t === this.tool);
    this.renderer.app.canvas.style.cursor =
      this.tool === "select" || this.tool === "image" ? "default" : "crosshair";
  }

  private updatePanel() {
    const p = this.panel;
    p.innerHTML = "";
    const num = (label: string, val: number, set: (v: number) => void, step = 1) => {
      const row = div("ed-row");
      row.appendChild(text(label));
      const inp = document.createElement("input");
      inp.type = "number";
      inp.value = String(round2(val));
      inp.step = String(step);
      inp.oninput = () => {
        const v = parseFloat(inp.value);
        if (!Number.isNaN(v)) {
          set(v);
          this.autosave();
          this.render();
        }
      };
      row.appendChild(inp);
      p.appendChild(row);
    };

    const s = this.sel;
    if (!s) {
      p.appendChild(heading("Level"));
      const nameRow = div("ed-row");
      nameRow.appendChild(text("name"));
      const ni = document.createElement("input");
      ni.value = this.level.name;
      ni.oninput = () => {
        this.level.name = ni.value;
        this.autosave();
      };
      nameRow.appendChild(ni);
      p.appendChild(nameRow);
      num("bounds w (m)", this.level.bounds.w, (v) => (this.level.bounds.w = v));
      num("bounds h (m)", this.level.bounds.h, (v) => (this.level.bounds.h = v));
      if (this.image) {
        p.appendChild(heading("Map image"));
        num("width (m)", this.image.widthM, (v) => this.setImage(this.image!.dataUrl, v));
        num("opacity", this.image.opacity, (v) => (this.image!.opacity = clamp01(v)), 0.1);
        p.appendChild(button("Remove image", () => {
          this.image = null;
          try { localStorage.removeItem(IMG_KEY); } catch { /* ignore */ }
          this.updatePanel();
          this.render();
        }));
      }
      p.appendChild(hint("Pick a tool, then drag on the water to draw. Wheel = zoom, drag empty = pan."));
      return;
    }

    if (s.kind === "wall") {
      const w = this.level.walls[s.i];
      p.appendChild(heading(w.kind === "dock" ? "Dock" : "Land"));
      num("x (m)", w.x, (v) => (w.x = v));
      num("y (m)", w.y, (v) => (w.y = v));
      num("width (m)", w.w, (v) => (w.w = v));
      num("height (m)", w.h, (v) => (w.h = v));
      num("angle (°)", deg(w.angle ?? 0), (v) => (w.angle = rad(v)));
      const kindRow = div("ed-row");
      kindRow.appendChild(text("kind"));
      const ks = document.createElement("select");
      for (const k of ["dock", "land"]) {
        const o = document.createElement("option");
        o.value = k;
        o.textContent = k;
        if ((w.kind ?? "land") === k) o.selected = true;
        ks.appendChild(o);
      }
      ks.onchange = () => {
        w.kind = ks.value as WallDef["kind"];
        this.autosave();
        this.render();
      };
      kindRow.appendChild(ks);
      p.appendChild(kindRow);
      p.appendChild(button("Delete", () => this.deleteSel(s)));
    } else if (s.kind === "boat") {
      const b = this.level.boats[s.i];
      p.appendChild(heading("Boat"));
      num("x (m)", b.x, (v) => (b.x = v));
      num("y (m)", b.y, (v) => (b.y = v));
      num("length (m)", b.length, (v) => (b.length = v), 0.5);
      num("beam (m)", b.beam, (v) => (b.beam = v), 0.5);
      num("angle (°)", deg(b.angle), (v) => (b.angle = rad(v)));
      p.appendChild(button("Delete", () => this.deleteSel(s)));
    } else if (s.kind === "rocks") {
      const r = this.level.rocks![s.i];
      p.appendChild(heading("Rocks"));
      num("x (m)", r.x, (v) => (r.x = v));
      num("y (m)", r.y, (v) => (r.y = v));
      num("width (m)", r.w, (v) => (r.w = v));
      num("height (m)", r.h, (v) => (r.h = v));
      num("angle (°)", deg(r.angle ?? 0), (v) => (r.angle = rad(v)));
      p.appendChild(button("Delete", () => this.deleteSel(s)));
    } else if (s.kind === "lighthouse") {
      const l = this.level.lighthouses![s.i];
      p.appendChild(heading("Lighthouse"));
      num("x (m)", l.x, (v) => (l.x = v));
      num("y (m)", l.y, (v) => (l.y = v));
      num("radius (m)", l.radius ?? 2.5, (v) => (l.radius = v), 0.5);
      p.appendChild(button("Delete", () => this.deleteSel(s)));
    } else if (s.kind === "goal") {
      const g = this.level.goal;
      p.appendChild(heading("Seaport goal"));
      num("x (m)", g.x, (v) => (g.x = v));
      num("y (m)", g.y, (v) => (g.y = v));
      num("width (m)", g.w, (v) => (g.w = v));
      num("height (m)", g.h, (v) => (g.h = v));
    } else if (s.kind === "spawn") {
      const sp = this.level.spawn;
      p.appendChild(heading("Start slip"));
      num("x (m)", sp.x, (v) => (sp.x = v));
      num("y (m)", sp.y, (v) => (sp.y = v));
      num("heading (°)", deg(sp.angle), (v) => (sp.angle = rad(v)));
    }
  }
}

// ---------- geometry helpers ----------
function inRect(px: number, py: number, cx: number, cy: number, w: number, h: number, ang: number): boolean {
  const dx = px - cx;
  const dy = py - cy;
  const c = Math.cos(-ang);
  const s = Math.sin(-ang);
  const lx = dx * c - dy * s;
  const ly = dx * s + dy * c;
  return Math.abs(lx) <= w / 2 && Math.abs(ly) <= h / 2;
}
function norm(r: { x: number; y: number; w: number; h: number }) {
  return {
    x: Math.min(r.x, r.x + r.w),
    y: Math.min(r.y, r.y + r.h),
    w: Math.abs(r.w),
    h: Math.abs(r.h),
  };
}
const deg = (r: number) => (r * 180) / Math.PI;
const rad = (d: number) => (d * Math.PI) / 180;
const round2 = (v: number) => Math.round(v * 100) / 100;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// ---------- DOM helpers ----------
function div(cls: string) {
  const d = document.createElement("div");
  d.className = cls;
  return d;
}
function text(t: string) {
  const s = document.createElement("span");
  s.textContent = t;
  return s;
}
function heading(t: string) {
  const h = document.createElement("h3");
  h.textContent = t;
  h.className = "ed-h";
  return h;
}
function hint(t: string) {
  const d = div("ed-hint");
  d.textContent = t;
  return d;
}
function button(label: string, onClick: () => void) {
  const b = document.createElement("button");
  b.textContent = label;
  b.className = "ed-btn";
  b.onclick = onClick;
  return b;
}
function sep() {
  return div("ed-sep");
}
function fileInput(accept: string, onFile: (f: File) => void) {
  const i = document.createElement("input");
  i.type = "file";
  i.accept = accept;
  i.style.display = "none";
  i.onchange = () => {
    if (i.files && i.files[0]) onFile(i.files[0]);
    i.value = "";
  };
  return i;
}
function labelWrap(label: string, input: HTMLInputElement) {
  const b = button(label, () => input.click());
  b.appendChild(input);
  return b;
}
function readDataUrl(file: File, cb: (url: string) => void) {
  const r = new FileReader();
  r.onload = () => cb(String(r.result));
  r.readAsDataURL(file);
}

let styleInjected = false;
function injectStyle() {
  if (styleInjected) return;
  styleInjected = true;
  const css = `
.ed-root{position:fixed;inset:0;z-index:30;pointer-events:none;font:500 13px system-ui,sans-serif;color:#18242b}
.ed-bar{position:absolute;top:0;left:0;right:0;display:flex;flex-wrap:wrap;gap:6px;align-items:center;
  padding:8px;background:rgba(255,255,255,0.94);box-shadow:0 2px 10px rgba(12,34,48,0.18);pointer-events:auto}
.ed-btn,.ed-tool,.ed-select{border:1px solid #c8d4da;background:#fff;border-radius:8px;padding:6px 10px;
  font:600 13px system-ui,sans-serif;color:#18242b;cursor:pointer}
.ed-btn:hover,.ed-tool:hover{background:#eef3f5}
.ed-tool.on{background:#2ec4b6;border-color:#2ec4b6;color:#fff}
.ed-btn.on{background:#2ec4b6;border-color:#2ec4b6;color:#fff}
.ed-play{background:#e4572e;border-color:#e4572e;color:#fff}
.ed-sep{width:1px;align-self:stretch;background:#d4dde2;margin:0 2px}
.ed-panel{position:absolute;top:64px;right:10px;width:200px;background:rgba(255,255,255,0.96);
  border-radius:12px;padding:12px;box-shadow:0 2px 10px rgba(12,34,48,0.18);pointer-events:auto}
.ed-h{margin:0 0 8px;font-size:14px}
.ed-row{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:6px 0}
.ed-row span{color:#6b8290}
.ed-row input,.ed-row select{width:96px;border:1px solid #c8d4da;border-radius:6px;padding:4px 6px;font:500 13px system-ui}
.ed-panel .ed-btn{width:100%;margin-top:10px;text-align:center}
.ed-hint{margin-top:10px;color:#6b8290;font-size:12px;line-height:1.4}
`;
  const el = document.createElement("style");
  el.textContent = css;
  document.head.appendChild(el);
}
