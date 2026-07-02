import { z } from "zod";

/**
 * Named sound profiles. Effects reference a profile (not a file path) so the
 * timesheet stays portable; the CLI's asset pack resolves the actual audio.
 */
export const SoundProfile = z.enum([
  "mechanical-keyboard",
  "macbook-trackpad",
  "mouse-click",
  "whoosh",
  "pop",
]);
export type SoundProfile = z.infer<typeof SoundProfile>;

/**
 * Mixing metadata shared by the Node synth (`@telekinesis/render`, which
 * writes the committed `.wav` pack) and the Web Audio preview
 * (`@telekinesis/core`, which synthesizes live) so both stay loudness- and
 * feel-matched from one source of truth instead of drifting apart.
 */
export interface SoundSynthParams {
  /** Master gain multiplier applied after synthesis; balances loudness across profiles. */
  gain: number;
  /**
   * Whether repeated hits should get deterministic micro-variation
   * (pitch/timing jitter) so they don't sound machine-gunned. Meaningful for
   * profiles that can fire many times in quick succession (notably the
   * `per-keystroke` cadence); profiles meant to feel identical and deliberate
   * every time (e.g. a primary-action click) leave this off.
   */
  variation: boolean;
}

export interface SoundProfileMeta {
  id: SoundProfile;
  label: string;
  description: string;
  /** Default asset filename, resolved against the active asset pack root. */
  asset: string;
  /**
   * `once` plays a single hit on the action.
   * `per-keystroke` plays once per emitted character (e.g. typing).
   */
  cadence: "once" | "per-keystroke";
  /** Procedural synthesis mixing metadata (gain, variation). */
  synth: SoundSynthParams;
}

/** Catalog mapping each profile to its metadata and default asset. */
export const SOUND_PROFILES: Record<SoundProfile, SoundProfileMeta> = {
  "mechanical-keyboard": {
    id: "mechanical-keyboard",
    label: "Mechanical keyboard",
    description: "Tactile key clack, emitted once per character while typing.",
    asset: "mechanical-keyboard.wav",
    cadence: "per-keystroke",
    synth: { gain: 0.5, variation: true },
  },
  "macbook-trackpad": {
    id: "macbook-trackpad",
    label: "MacBook trackpad",
    description: "Soft, deep trackpad click for primary actions.",
    asset: "macbook-trackpad.wav",
    cadence: "once",
    synth: { gain: 0.85, variation: false },
  },
  "mouse-click": {
    id: "mouse-click",
    label: "Mouse click",
    description: "Crisp mechanical mouse click.",
    asset: "mouse-click.wav",
    cadence: "once",
    synth: { gain: 0.75, variation: true },
  },
  whoosh: {
    id: "whoosh",
    label: "Whoosh",
    description: "Airy swipe for fast cursor moves, scrolls and zooms.",
    asset: "whoosh.wav",
    cadence: "once",
    synth: { gain: 0.55, variation: false },
  },
  pop: {
    id: "pop",
    label: "Pop",
    description: "Light UI pop for highlights and appearances.",
    asset: "pop.wav",
    cadence: "once",
    synth: { gain: 0.7, variation: true },
  },
};

export const SOUND_PROFILE_IDS = Object.keys(SOUND_PROFILES) as SoundProfile[];
