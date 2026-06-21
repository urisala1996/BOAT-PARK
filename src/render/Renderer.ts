import { Application, Container } from "pixi.js";
import { COLORS } from "../config.ts";

// Owns the PixiJS application and two layers: a camera-transformed `world` (pans to follow
// the boat, clamped to the level) and a fixed `hud` overlay.
export class Renderer {
  readonly app: Application;
  readonly world = new Container();
  readonly hud = new Container();
  zoom = 1;

  constructor(app: Application) {
    this.app = app;
    app.stage.addChild(this.world);
    app.stage.addChild(this.hud);
  }

  static async create(mount: HTMLElement): Promise<Renderer> {
    const app = new Application();
    await app.init({
      resizeTo: mount,
      background: COLORS.water,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });
    mount.appendChild(app.canvas);
    return new Renderer(app);
  }

  // Logical (CSS) pixel size of the viewport, independent of device pixel ratio.
  get width(): number {
    return this.app.screen.width;
  }
  get height(): number {
    return this.app.screen.height;
  }

  // Centre the camera on a world point, clamped so we never pan past the level bounds.
  follow(x: number, y: number, boundsW: number, boundsH: number) {
    const z = this.zoom;
    this.world.scale.set(z);
    this.world.position.set(
      clampCam(this.width, boundsW * z, this.width / 2 - x * z),
      clampCam(this.height, boundsH * z, this.height / 2 - y * z),
    );
  }
}

// If the world is larger than the viewport, clamp so its edges stay flush; otherwise centre it.
function clampCam(view: number, world: number, pos: number): number {
  if (world <= view) return (view - world) / 2;
  return Math.min(0, Math.max(view - world, pos));
}
