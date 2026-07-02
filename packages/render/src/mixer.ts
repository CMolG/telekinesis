import path from "node:path";
import type { SoundProfile } from "@telekinesis/schema";
import { execa } from "execa";
import { fileExists } from "./ffmpeg";

/** One sound event, located at `t` ms from the start of the recording. */
export interface AudioMark {
  profile: SoundProfile;
  asset: string;
  t: number;
}

/**
 * The timestamped sound map emitted by the recorder. Structurally identical to
 * `@telekinesis/engine`'s `AudioMap`, redeclared here so the renderer stays
 * free of a Playwright dependency; the CLI passes the engine's result straight
 * through.
 */
export interface AudioMap {
  resolution: { width: number; height: number };
  durationMs: number;
  marks: AudioMark[];
}

export interface MixOptions {
  videoPath: string;
  audioMap: AudioMap;
  /** Asset pack directory. The CLI resolves this (its bundled pack by default). */
  soundsDir: string;
  output: string;
}

/**
 * Option B: take the silent video and the audio map, and mix each sound at its
 * exact millisecond offset using ffmpeg `adelay` + `amix`, re-encoding to mp4.
 * Sounds whose asset is missing are skipped, so a partial pack still works.
 */
export async function mixAudio(opts: MixOptions): Promise<{ mixed: number }> {
  const inputs: string[] = ["-i", opts.videoPath];
  const filters: string[] = [];
  const labels: string[] = [];
  let idx = 1;

  for (const mark of opts.audioMap.marks) {
    const asset = path.join(opts.soundsDir, mark.asset);
    if (!(await fileExists(asset))) continue;
    inputs.push("-i", asset);
    filters.push(`[${idx}:a]adelay=${Math.round(mark.t)}:all=1[a${idx}]`);
    labels.push(`[a${idx}]`);
    idx++;
  }

  const video = ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart"];

  let args: string[];
  if (labels.length === 0) {
    args = ["-y", ...inputs, "-map", "0:v?", ...video, opts.output];
  } else {
    const filterComplex = [
      ...filters,
      `${labels.join("")}amix=inputs=${labels.length}:normalize=0[aout]`,
    ].join(";");
    args = [
      "-y",
      ...inputs,
      "-filter_complex",
      filterComplex,
      "-map",
      "0:v?",
      "-map",
      "[aout]",
      ...video,
      "-c:a",
      "aac",
      // The silent video is the canvas; sounds are overlaid at their offsets.
      // The mixed audio ends at the last cue, so `-shortest` would truncate the
      // video to it — dropping any trailing visual-only beat (a closing
      // highlight, a hold, a fade). Let the (longer) video define the duration.
      opts.output,
    ];
  }

  await execa("ffmpeg", args);
  return { mixed: labels.length };
}
