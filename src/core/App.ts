import { Renderer } from "../render/Renderer.ts";
import { Game } from "./Game.ts";
import { Editor } from "../editor/Editor.ts";
import { level1 } from "../level/level1.ts";
import { loadCurrent, saveCurrent } from "../level/storage.ts";
import type { Level } from "../level/types.ts";

// Top-level controller: owns the renderer and swaps between Play (Game) and Edit (Editor).
// Boots into the last-played/edited level if one is saved, otherwise the built-in marina.
export class App {
  private game?: Game;
  private editor?: Editor;
  private level: Level;
  private readonly editBtn: HTMLButtonElement;

  constructor(private readonly renderer: Renderer) {
    this.level = loadCurrent() ?? structuredClone(level1);
    this.editBtn = makeEditButton(() => this.openEditor());
    document.body.appendChild(this.editBtn);
    this.play(this.level);
  }

  private play(level: Level) {
    this.editor?.dispose();
    this.editor = undefined;
    this.game?.dispose();
    this.level = level;
    saveCurrent(level);
    this.game = new Game(this.renderer, level);
    this.editBtn.style.display = "";
  }

  private openEditor() {
    this.game?.dispose();
    this.game = undefined;
    this.editBtn.style.display = "none";
    this.editor = new Editor(this.renderer, this.level, {
      onPlay: (lvl) => this.play(lvl),
    });
  }
}

function makeEditButton(onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.textContent = "✎ Editor";
  b.style.cssText =
    "position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:20;" +
    "padding:8px 16px;border:none;border-radius:20px;background:rgba(255,255,255,0.92);" +
    "color:#18242b;font:600 14px system-ui,sans-serif;cursor:pointer;" +
    "box-shadow:0 2px 8px rgba(12,34,48,0.25);";
  b.onclick = onClick;
  return b;
}
