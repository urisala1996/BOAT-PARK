import { Renderer } from "./render/Renderer.ts";
import { Game } from "./core/Game.ts";
import { level1 } from "./level/level1.ts";

async function main() {
  const mount = document.getElementById("app");
  if (!mount) throw new Error("#app mount not found");

  const renderer = await Renderer.create(mount);
  new Game(renderer, level1);
}

main();
