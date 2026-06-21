import type { Level } from "../level/types.ts";
import { allMaps, randomMap, type MapEntry } from "../level/maps.ts";

export interface MenuOptions {
  onPlay: (level: Level) => void;
  onEdit: (level: Level) => void;
}

// Main menu: pick a map to play (built-in, bundled from /maps, or your saved ones), play a
// random one, or open any of them in the editor. Plain DOM overlay over the canvas.
export class MainMenu {
  private readonly root = document.createElement("div");

  constructor(private readonly opts: MenuOptions) {
    injectStyle();
    this.root.className = "mm-root";
    this.root.innerHTML = `
      <div class="mm-card">
        <div class="mm-bar"></div>
        <h1 class="mm-title">PARKING BOAT</h1>
        <p class="mm-sub">Choose a port to dock in</p>
        <div class="mm-list"></div>
        <div class="mm-actions">
          <button class="mm-btn mm-random">🎲 Random port</button>
          <button class="mm-btn mm-new">✎ New map</button>
        </div>
      </div>`;
    document.body.appendChild(this.root);

    this.fillList();
    this.q(".mm-random").onclick = () => this.opts.onPlay(randomMap().level());
    this.q(".mm-new").onclick = () => this.opts.onEdit(blankLevel());
  }

  dispose() {
    this.root.remove();
  }

  private fillList() {
    const list = this.q(".mm-list");
    for (const m of allMaps()) list.appendChild(this.row(m));
  }

  private row(m: MapEntry): HTMLElement {
    const row = document.createElement("div");
    row.className = "mm-row";
    const tag =
      m.source === "default" ? "default" : m.source === "bundled" ? "built-in" : "yours";
    row.innerHTML = `<span class="mm-name">${escapeHtml(m.title)}</span><span class="mm-tag mm-tag-${m.source}">${tag}</span>`;
    const edit = document.createElement("button");
    edit.className = "mm-edit";
    edit.title = "Edit in the level editor";
    edit.textContent = "✎";
    edit.onclick = (e) => {
      e.stopPropagation();
      this.opts.onEdit(m.level());
    };
    row.appendChild(edit);
    row.onclick = () => this.opts.onPlay(m.level());
    return row;
  }

  private q(sel: string): HTMLElement {
    return this.root.querySelector(sel) as HTMLElement;
  }
}

function blankLevel(): Level {
  return {
    name: "New Port",
    bounds: { w: 90, h: 60 },
    spawn: { x: 12, y: 30, angle: 0 },
    goal: { x: 78, y: 30, w: 14, h: 16 },
    walls: [],
    boats: [],
  };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

let styleInjected = false;
function injectStyle() {
  if (styleInjected) return;
  styleInjected = true;
  const css = `
.mm-root{position:fixed;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;
  background:rgba(7,23,31,0.55);font-family:system-ui,Segoe UI,sans-serif;padding:16px}
.mm-card{position:relative;width:min(92vw,440px);max-height:88vh;display:flex;flex-direction:column;
  background:#fff;border-radius:22px;padding:22px 22px 18px;box-shadow:0 12px 40px rgba(7,23,31,0.35);overflow:hidden}
.mm-bar{position:absolute;top:0;left:0;right:0;height:8px;background:#2ec4b6}
.mm-title{margin:8px 0 2px;font-size:34px;font-weight:800;color:#18242b;letter-spacing:.5px}
.mm-sub{margin:0 0 14px;color:#6b8290;font-weight:600;font-size:14px}
.mm-list{overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding-right:2px}
.mm-row{display:flex;align-items:center;gap:10px;padding:12px 12px;border:1px solid #e2e9ec;border-radius:12px;
  cursor:pointer;background:#fff;transition:background .12s,border-color .12s}
.mm-row:hover{background:#f1f8f7;border-color:#2ec4b6}
.mm-name{flex:1;font-weight:700;color:#18242b;font-size:15px}
.mm-tag{font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;color:#fff}
.mm-tag-default{background:#6b8290}.mm-tag-bundled{background:#2ec4b6}.mm-tag-saved{background:#f3a712}
.mm-edit{border:1px solid #d4dde2;background:#fff;border-radius:8px;width:32px;height:32px;cursor:pointer;
  font-size:15px;color:#18242b}
.mm-edit:hover{background:#eef3f5}
.mm-actions{display:flex;gap:10px;margin-top:14px}
.mm-btn{flex:1;border:none;border-radius:12px;padding:13px;font-weight:800;font-size:15px;cursor:pointer}
.mm-random{background:#e4572e;color:#fff}
.mm-new{background:#eef3f5;color:#18242b}
`;
  const el = document.createElement("style");
  el.textContent = css;
  document.head.appendChild(el);
}
