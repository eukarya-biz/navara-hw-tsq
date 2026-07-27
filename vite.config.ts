import { defineConfig } from "vite";

// Relative base so the build works both at a domain root and under a GitHub Pages
// project subpath (e.g. https://<org>.github.io/navara-hw/) without reconfiguration.
export default defineConfig({
  base: "./",
});
