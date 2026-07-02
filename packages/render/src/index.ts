/**
 * @telekinesis/render — the ffmpeg layer.
 *
 * Everything that turns a silent Playwright recording into a shareable artifact:
 * mixing timed audio onto an MP4, and exporting high-quality GIFs (ffmpeg
 * palette or gifski). Depends only on ffmpeg (and optionally gifski) — no
 * browser, so the CLI and the Studio sidecar can both import it.
 */
export { ensureFfmpeg, hasGifski, fileExists } from "./ffmpeg";
export { mixAudio, type AudioMap, type AudioMark, type MixOptions } from "./mixer";
export { toGif, type GifOptions, type GifResult, type GifDither } from "./gif";
export { synthSounds } from "./sounds";
