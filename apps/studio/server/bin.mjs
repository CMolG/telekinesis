#!/usr/bin/env node
// Launcher for `telekinesis-studio`. Runs the TypeScript sidecar in-process via
// tsx's programmatic API so no build step is required.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tsImport } from "tsx/esm/api";

const here = path.dirname(fileURLToPath(import.meta.url));
await tsImport(path.join(here, "index.ts"), import.meta.url);
