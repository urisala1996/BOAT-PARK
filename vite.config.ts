import { defineConfig } from "vite";

// Relative base so asset URLs resolve no matter what the repo is named or which
// sub-path GitHub Pages serves from (https://<user>.github.io/<repo>/). This avoids
// the "blank/blue page, assets 404" problem of hardcoding a repo name.
export default defineConfig({
  base: "./",
});
