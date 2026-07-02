import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { SOUND_PROFILE_IDS, SOUND_PROFILES } from "@telekinesis/schema";
import { encodeWavPcm16, SAMPLE_RATE, synthesizeProfile } from "./synth/index";

/**
 * Synthesizes the full sound pack — one layered, procedurally generated WAV
 * per catalog profile (`@telekinesis/schema`'s `SOUND_PROFILES`) — and writes
 * it to `outDir` under its catalog asset filename. Pure Node/TS: no ffmpeg,
 * no recorded samples, deterministic output.
 */
export async function synthSounds(outDir: string): Promise<string[]> {
  await mkdir(outDir, { recursive: true });
  const written: string[] = [];
  for (const id of SOUND_PROFILE_IDS) {
    const samples = synthesizeProfile(id);
    const wav = encodeWavPcm16(samples, SAMPLE_RATE);
    const dest = path.join(outDir, SOUND_PROFILES[id].asset);
    await writeFile(dest, wav);
    written.push(dest);
  }
  return written;
}
