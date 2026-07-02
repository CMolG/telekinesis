import { mkdtemp, readdir, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execa } from "execa";
import { ensureFfmpeg, hasGifsicle, hasGifski } from "./ffmpeg";

export type GifDither = "sierra2_4a" | "bayer" | "floyd_steinberg" | "none";

export interface GifOptions {
  /** Destination `.gif` path. */
  output: string;
  /** Frames per second. Lower = smaller file. Default 15. */
  fps?: number;
  /** Output width in px; height keeps aspect (`-1`). Default 640. */
  width?: number;
  /** Cap the palette size (2–256). Fewer colours = smaller file. Default 256. */
  maxColors?: number;
  /** ffmpeg `paletteuse` dithering. Default `bayer`. */
  dither?: GifDither;
  /** Loop count (0 = infinite, ffmpeg backend only). Default 0. */
  loop?: number;
  /**
   * `auto` (default) uses gifski when it is on the PATH, else ffmpeg.
   * `never` forces the ffmpeg palette path. `always` requires gifski.
   */
  gifski?: "auto" | "never" | "always";
  /** gifski quality 1–100. Default 90. */
  quality?: number;
  /** `auto` (default) runs a gifsicle `-O3` pass when available; `never` skips it. */
  optimize?: "auto" | "never";
  /** gifsicle lossy quantisation (0–200-ish). Smaller file, some quality loss. */
  lossy?: number;
  onLog?: (msg: string) => void;
}

export interface GifResult {
  output: string;
  backend: "gifski" | "ffmpeg";
  /** Whether a gifsicle optimisation pass ran. */
  optimized: boolean;
  fps: number;
  width: number;
}

/**
 * Convert a (silent) recording into a looping GIF. GIFs carry no audio, so this
 * plugs in right after the recorder's `.webm` — no mixing step.
 *
 * Encoders, best-first:
 *  - **gifski** (auto-detected): cross-frame palette + temporal dithering — the
 *    quality ceiling, but larger files.
 *  - **ffmpeg** (always available): two-pass palettegen → paletteuse with a
 *    lanczos downscale and a capped palette — small and good.
 * Then, if **gifsicle** is present, an `-O3` (+ optional `--lossy`) pass strips
 * unchanged pixels between frames — the biggest win for UI motion.
 */
export async function toGif(videoPath: string, opts: GifOptions): Promise<GifResult> {
  await ensureFfmpeg();

  const fps = opts.fps ?? 15;
  const width = opts.width ?? 640;
  const loop = opts.loop ?? 0;
  const mode = opts.gifski ?? "auto";

  const gifskiAvailable = await hasGifski();
  if (mode === "always" && !gifskiAvailable) {
    throw new Error("gifski was requested but not found on PATH. Install it from https://gif.ski/");
  }
  const useGifski = mode === "always" || (mode === "auto" && gifskiAvailable);

  const resolved: Resolved = { ...opts, fps, width, loop };
  const result = useGifski
    ? await encodeWithGifski(videoPath, resolved)
    : await encodeWithFfmpeg(videoPath, resolved);

  const optimized = await maybeOptimize(resolved);
  return { ...result, optimized };
}

type Resolved = GifOptions & { fps: number; width: number; loop: number };

const scaleChain = (o: Resolved) => `fps=${o.fps},scale=${o.width}:-1:flags=lanczos`;

async function encodeWithFfmpeg(videoPath: string, o: Resolved): Promise<GifResult> {
  const dither = o.dither ?? "bayer";
  const ditherArg = dither === "bayer" ? "bayer:bayer_scale=3" : dither;
  const filters = scaleChain(o);
  const paletteFilter = o.maxColors
    ? `palettegen=max_colors=${o.maxColors}:stats_mode=diff`
    : "palettegen=stats_mode=diff";
  const work = await mkdtemp(path.join(tmpdir(), "tk-gif-"));
  const palette = path.join(work, "palette.png");
  try {
    o.onLog?.("generating palette (ffmpeg)");
    await execa("ffmpeg", ["-y", "-i", videoPath, "-vf", `${filters},${paletteFilter}`, palette]);
    o.onLog?.("encoding gif (ffmpeg palette)");
    await execa("ffmpeg", [
      "-y", "-i", videoPath, "-i", palette,
      "-lavfi", `${filters} [x];[x][1:v] paletteuse=dither=${ditherArg}:diff_mode=rectangle`,
      "-loop", String(o.loop),
      o.output,
    ]);
    return { output: o.output, backend: "ffmpeg", optimized: false, fps: o.fps, width: o.width };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

async function encodeWithGifski(videoPath: string, o: Resolved): Promise<GifResult> {
  const work = await mkdtemp(path.join(tmpdir(), "tk-gif-"));
  try {
    o.onLog?.("extracting frames (ffmpeg)");
    await execa("ffmpeg", ["-y", "-i", videoPath, "-vf", scaleChain(o), path.join(work, "frame-%05d.png")]);
    const frames = (await readdir(work)).filter((f) => f.endsWith(".png")).sort().map((f) => path.join(work, f));
    if (frames.length === 0) {
      throw new Error("gifski backend: ffmpeg produced no frames from the recording.");
    }
    o.onLog?.(`encoding gif (gifski, ${frames.length} frames)`);
    await execa("gifski", ["--fps", String(o.fps), "--quality", String(o.quality ?? 90), "-o", o.output, ...frames]);
    return { output: o.output, backend: "gifski", optimized: false, fps: o.fps, width: o.width };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

/** Optionally shrink the finished GIF further with gifsicle. */
async function maybeOptimize(o: Resolved): Promise<boolean> {
  if ((o.optimize ?? "auto") === "never") return false;
  if (!(await hasGifsicle())) return false;
  o.onLog?.(`optimizing (gifsicle -O3${o.lossy ? ` --lossy=${o.lossy}` : ""})`);
  const tmp = `${o.output}.opt.gif`;
  const args = ["-O3", ...(o.lossy ? [`--lossy=${o.lossy}`] : []), "-o", tmp, o.output];
  await execa("gifsicle", args);
  await rename(tmp, o.output);
  return true;
}
