import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AudioMap } from "@telekinesis/engine";
import { execa } from "execa";

/** The sound pack bundled with the CLI (populated by `telekinesis sounds`). */
export function defaultSoundsDir(): string {
  return fileURLToPath(new URL("../assets/sounds", import.meta.url));
}

export async function ensureFfmpeg(): Promise<void> {
  try {
    await execa("ffmpeg", ["-version"]);
  } catch {
    throw new Error(
      "ffmpeg was not found on your PATH. Install it from https://ffmpeg.org/download.html",
    );
  }
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

export interface MixOptions {
  videoPath: string;
  audioMap: AudioMap;
  /** Asset pack directory; defaults to the bundled pack. */
  soundsDir?: string;
  output: string;
}

/**
 * Option B: take the silent video and the audio map, and mix each sound at its
 * exact millisecond offset using ffmpeg `adelay` + `amix`, re-encoding to mp4.
 * Sounds whose asset is missing are skipped, so a partial pack still works.
 */
export async function mixAudio(opts: MixOptions): Promise<{ mixed: number }> {
  const soundsDir = opts.soundsDir ?? defaultSoundsDir();
  const inputs: string[] = ["-i", opts.videoPath];
  const filters: string[] = [];
  const labels: string[] = [];
  let idx = 1;

  for (const mark of opts.audioMap.marks) {
    const asset = path.join(soundsDir, mark.asset);
    if (!(await exists(asset))) continue;
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

/** ffmpeg lavfi recipes for a starter sound pack. Placeholder, replaceable. */
const SOUND_RECIPES: Array<{ name: string; args: string[] }> = [
  {
    name: "mouse-click.wav",
    args: ["-f", "lavfi", "-i", "sine=frequency=1100:duration=0.05", "-af", "afade=t=out:st=0:d=0.05,volume=0.6"],
  },
  {
    name: "macbook-trackpad.wav",
    args: ["-f", "lavfi", "-i", "sine=frequency=320:duration=0.06", "-af", "afade=t=out:st=0:d=0.06,volume=0.7"],
  },
  {
    name: "mechanical-keyboard.wav",
    args: ["-f", "lavfi", "-i", "anoisesrc=d=0.06:color=pink:amplitude=0.5", "-af", "afade=t=out:st=0:d=0.06"],
  },
  {
    name: "whoosh.wav",
    args: [
      "-f", "lavfi", "-i", "anoisesrc=d=0.35:color=brown:amplitude=0.4",
      "-af", "bandpass=f=1200,afade=t=in:st=0:d=0.15,afade=t=out:st=0.2:d=0.15",
    ],
  },
  {
    name: "pop.wav",
    args: ["-f", "lavfi", "-i", "sine=frequency=600:duration=0.09", "-af", "afade=t=out:st=0:d=0.09,volume=0.6"],
  },
];

export async function synthSounds(outDir: string): Promise<string[]> {
  await mkdir(outDir, { recursive: true });
  const written: string[] = [];
  for (const { name, args } of SOUND_RECIPES) {
    const dest = path.join(outDir, name);
    await execa("ffmpeg", ["-y", ...args, dest]);
    written.push(dest);
  }
  return written;
}
