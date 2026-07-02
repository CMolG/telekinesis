import { mkdir } from "node:fs/promises";
import path from "node:path";
import { execa } from "execa";

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
