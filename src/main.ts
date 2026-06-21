import { Renderer } from "./render/Renderer.ts";
import { App } from "./core/App.ts";

async function main() {
  const mount = document.getElementById("app");
  if (!mount) throw new Error("#app mount not found");

  const renderer = await Renderer.create(mount);
  new App(renderer);
}

main();
