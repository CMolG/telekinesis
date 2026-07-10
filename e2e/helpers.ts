import type { Page } from "@playwright/test";
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
 */
export async function ffprobeJson(file: string): Promise<FfprobeOutput> {
  const { stdout } = await execa(
    "ffprobe",
    ["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", file],
    { timeout: 30_000 },
  );
  return JSON.parse(stdout) as FfprobeOutput;
}
