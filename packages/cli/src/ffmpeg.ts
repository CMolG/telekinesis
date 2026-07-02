import { fileURLToPath } from "node:url";

/**
 * The ffmpeg layer now lives in `@telekinesis/render` so the CLI and the Studio
 * sidecar can share it. This module keeps the CLI-only bit — the location of
 * the bundled sound pack — and re-exports the renderer for the commands.
 */

/** The sound pack bundled with the CLI (populated by `telekinesis sounds`). */
export function defaultSoundsDir(): string {
  return fileURLToPath(new URL("../assets/sounds", import.meta.url));
}

export {
  ensureFfmpeg,
  hasGifski,
  mixAudio,
  synthSounds,
  toGif,
  type AudioMap,
  type GifOptions,
  type GifResult,
} from "@telekinesis/render";
