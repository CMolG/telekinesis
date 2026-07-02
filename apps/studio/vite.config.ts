import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * Shared Vite config. The SPA consumes the workspace packages straight from
 * TypeScript source (no build step), matching the playground. The sidecar
 * (`server/index.ts`) reuses these `resolve.alias` entries in middleware mode.
 */
export const alias = {
  "@telekinesis/core": fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url)),
  "@telekinesis/schema": fileURLToPath(new URL("../../packages/schema/src/index.ts", import.meta.url)),
};

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
});
