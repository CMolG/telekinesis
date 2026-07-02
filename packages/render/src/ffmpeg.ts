import { access } from "node:fs/promises";
import { execa } from "execa";

/** Throw a friendly error if ffmpeg is not installed. */
export async function ensureFfmpeg(): Promise<void> {
  try {
    await execa("ffmpeg", ["-version"]);
  } catch {
    throw new Error(
      "ffmpeg was not found on your PATH. Install it from https://ffmpeg.org/download.html",
    );
  }
}

let gifskiProbe: boolean | undefined;

/**
 * Is `gifski` available on the PATH? Cached after the first probe. gifski
 * produces best-in-class GIFs (cross-frame palette + temporal dithering); when
 * present we prefer it, otherwise we fall back to ffmpeg's palettegen path.
 */
export async function hasGifski(): Promise<boolean> {
  if (gifskiProbe !== undefined) return gifskiProbe;
  try {
    await execa("gifski", ["--version"]);
    gifskiProbe = true;
  } catch {
    gifskiProbe = false;
  }
  return gifskiProbe;
}

let gifsicleProbe: boolean | undefined;

/**
 * Is `gifsicle` available on the PATH? Cached after the first probe. gifsicle's
 * `-O3` performs transparency-based interframe optimisation (only changed pixels
 * are stored) and optional `--lossy` quantisation — the single biggest size win
 * for UI GIFs, which are full of static holds. Optional: we auto-use it.
 */
export async function hasGifsicle(): Promise<boolean> {
  if (gifsicleProbe !== undefined) return gifsicleProbe;
  try {
    await execa("gifsicle", ["--version"]);
    gifsicleProbe = true;
  } catch {
    gifsicleProbe = false;
  }
  return gifsicleProbe;
}

export async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}
