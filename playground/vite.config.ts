import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * The playground consumes the workspace packages straight from TypeScript
 * source (no build step needed) by aliasing them to their `src` entrypoints.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@telekinesis/core": fileURLToPath(
        new URL("../packages/core/src/index.ts", import.meta.url),
      ),
      "@telekinesis/schema": fileURLToPath(
        new URL("../packages/schema/src/index.ts", import.meta.url),
      ),
    },
  },
  server: { port: 5173 },
  build: {
    // Vite only builds the root index.html unless every multi-page entry is
    // listed explicitly here — without this, `landing.html` and
    // `gallery.html` silently vanish from `dist/` (they still work fine
    // under `vite dev`, which serves any .html by path, so the gap only
    // shows up post-build under `vite preview`, e.g. the e2e/gallery-record
    // webServer).
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        landing: fileURLToPath(new URL("./landing.html", import.meta.url)),
        gallery: fileURLToPath(new URL("./gallery.html", import.meta.url)),
      },
    },
  },
});
