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
});
