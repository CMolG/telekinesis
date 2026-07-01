import { SOUND_PROFILES, type SoundProfile } from "@telekinesis/schema";

/** A sound event with its offset (ms) from the start of playback. */
export interface SoundMark {
  profile: SoundProfile;
  /** Milliseconds since playback started. */
  t: number;
}

export interface SoundEngineOptions {
  /** Base URL where the asset pack lives, e.g. `/telekinesis-sounds/`. */
  base?: string;
  /** Whether to actually play audio (off in recorder/external mode). */
  enabled?: boolean;
  volume?: number;
}

/**
 * Best-effort in-browser audio playback for live previews. In the recorder
 * flow audio is *not* played here — the engine records timestamps and the CLI
 * mixes real sound with ffmpeg (Option B). Missing assets fail silently.
 */
export class SoundEngine {
  private base: string;
  private volume: number;
  enabled: boolean;

  constructor(opts: SoundEngineOptions = {}) {
    const winBase =
      typeof window !== "undefined"
        ? (window as unknown as Record<string, string>).__TELEKINESIS_SOUND_BASE__
        : undefined;
    this.base = (opts.base ?? winBase ?? "/telekinesis-sounds/").replace(/\/$/, "");
    this.enabled = opts.enabled ?? true;
    this.volume = opts.volume ?? 0.5;
  }

  play(profile: SoundProfile): void {
    if (!this.enabled || typeof Audio === "undefined") return;
    try {
      const meta = SOUND_PROFILES[profile];
      const audio = new Audio(`${this.base}/${meta.asset}`);
      audio.volume = this.volume;
      void audio.play().catch(() => {
        /* autoplay blocked or asset missing — ignore */
      });
    } catch {
      /* ignore */
    }
  }
}
