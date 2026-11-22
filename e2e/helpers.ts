import type { BrowserContext, Page } from "@playwright/test";
import { ensureFfmpeg } from "@telekinesis/render";
import { execa } from "execa";

/**
 * Wait for `<TelekinesisStage>` to install `window.__telekinesis`. Mirrors the
 * `waitForFunction` in `packages/engine/src/record.ts` so specs see the same
 * "ready" signal the real recorder waits for before driving the page.
 */
export async function waitForRuntime(page: Page, timeout = 15_000): Promise<void> {
  await page.waitForFunction(
    () =>
      (window as unknown as { __telekinesis?: { ready?: boolean } }).__telekinesis?.ready === true,
    undefined,
    { timeout },
  );
}

/**
 * Make the playground's `setForcedDemoMode(true)` inert for every page in
 * `context`. The playground force-enables demo mode at module scope for all
 * visitors (`playground/src/main.tsx`) — a deliberate showcase choice, not a
 * bug — so specs that need `isDemoMode()`'s *real* detection conditions
 * (`navigator.webdriver`, `?demo`) to decide the outcome must first take the
 * force flag out of play. The no-op setter is load-bearing: the app assigns
 * `window.__TELEKINESIS_FORCE__ = true` from strict-mode ESM, where writing
 * to a getter-only property would throw and crash the app on boot.
 */
export async function neutralizeForcedDemoMode(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    Object.defineProperty(window, "__TELEKINESIS_FORCE__", {
      get: () => false,
      set: () => {},
    });
  });
}

let ffmpegProbe: boolean | undefined;

/**
 * Are `ffmpeg` **and** `ffprobe` available on the PATH? Cached after the first
 * probe (same convention as render's `hasGifski`). Specs that mix/render skip
 * themselves when this is false. ffprobe is probed separately because unusual
 * installs ship one binary without the other, and `ffprobeJson` needs it.
 */
export async function hasFfmpeg(): Promise<boolean> {
  if (ffmpegProbe !== undefined) return ffmpegProbe;
  try {
    await ensureFfmpeg();
    await execa("ffprobe", ["-version"]);
    ffmpegProbe = true;
  } catch {
    ffmpegProbe = false;
  }
  return ffmpegProbe;
}

/** The subset of `ffprobe -show_format -show_streams` JSON that specs actually assert on. */
export interface FfprobeStream {
  codec_type: string;
  codec_name?: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
  duration?: string;
  /** Only populated when `ffprobeJson` is called with `["-count_packets"]`. */
  nb_read_packets?: string;
  [key: string]: unknown;
}

export interface FfprobeFormat {
  filename?: string;
  format_name?: string;
  duration?: string;
  size?: string;
  [key: string]: unknown;
}

export interface FfprobeOutput {
  streams: FfprobeStream[];
  format: FfprobeFormat;
}

/**
 * Run `ffprobe` on `file` and parse its JSON output (container format + stream
 * metadata). Bounded by a timeout so a hung probe on a corrupt file can't
 * outlive the Playwright test timeout as an orphaned process.
 *
 * `extraArgs` are inserted before `file`, e.g. `["-count_packets"]` to
 * populate each stream's `nb_read_packets` (ffprobe only counts packets when
 * asked — it's not part of the default `-show_streams` output).
 */
export async function ffprobeJson(file: string, extraArgs: string[] = []): Promise<FfprobeOutput> {
  const { stdout } = await execa(
    "ffprobe",
    ["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", ...extraArgs, file],
    { timeout: 30_000 },
  );
  return JSON.parse(stdout) as FfprobeOutput;
}
