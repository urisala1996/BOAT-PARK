import { defineConfig } from "vite";

// base must match the GitHub repo name so asset URLs resolve on GitHub Pages
// (served from https://<user>.github.io/BOAT-PARK/).
export default defineConfig({
  base: "/BOAT-PARK/",
});
