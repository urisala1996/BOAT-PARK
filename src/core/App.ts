import { Renderer } from "../render/Renderer.ts";
import { Game } from "./Game.ts";
import { Editor } from "../editor/Editor.ts";
import { MainMenu } from "./MainMenu.ts";
import { saveCurrent } from "../level/storage.ts";
import type { Level } from "../level/types.ts";

// Top-level controller. Three modes — Menu, Play (Game), Edit (Editor) — sharing one renderer;
// each mode owns its DOM/Pixi and is disposed on switch. Boots into the main menu.
export class App {
  private game?: Game;
  private editor?: Editor;
  private menu?: MainMenu;
  private current?: Level; // last played level (target for the in-play Edit button)

  private readonly menuBtn = navButton("≡ Menu", "left", () => this.showMenu());
  private readonly editBtn = navButton("✎ Editor", "right", () =>
    this.openEditor(this.current ?? undefined),
  );

  constructor(private readonly renderer: Renderer) {
    document.body.append(this.menuBtn, this.editBtn);
    this.showMenu();
  }

  private clear() {
    this.menu?.dispose();
    this.menu = undefined;
    this.game?.dispose();
    this.game = undefined;
    this.editor?.dispose();
    this.editor = undefined;
  }

  private setNavVisible(v: boolean) {
    this.menuBtn.style.display = v ? "" : "none";
    this.editBtn.style.display = v ? "" : "none";
  }

  private showMenu() {
    this.clear();
    this.setNavVisible(false);
    this.menu = new MainMenu({
      onPlay: (lvl) => this.play(lvl),
      onEdit: (lvl) => this.openEditor(lvl),
    });
  }

  private play(level: Level) {
    this.clear();
    this.current = level;
    saveCurrent(level);
    this.game = new Game(this.renderer, level);
    this.setNavVisible(true);
  }

  private openEditor(level?: Level) {
    this.clear();
    this.setNavVisible(false);
    this.editor = new Editor(this.renderer, level ?? this.current ?? blank(), {
      onPlay: (lvl) => this.play(lvl),
      onMenu: () => this.showMenu(),
    });
  }
}

function blank(): Level {
  return {
    name: "New Port",
    bounds: { w: 90, h: 60 },
    spawn: { x: 12, y: 30, angle: 0 },
    goal: { x: 78, y: 30, w: 14, h: 16 },
    walls: [],
    boats: [],
  };
}

function navButton(label: string, side: "left" | "right", onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.textContent = label;
  const x = side === "left" ? "left:12px" : "right:12px";
  b.style.cssText =
    `position:fixed;${x};bottom:12px;z-index:20;display:none;` +
    "padding:8px 14px;border:none;border-radius:20px;background:rgba(255,255,255,0.92);" +
    "color:#18242b;font:600 14px system-ui,sans-serif;cursor:pointer;" +
    "box-shadow:0 2px 8px rgba(12,34,48,0.25);";
  b.onclick = onClick;
  return b;
}
