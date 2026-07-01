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
}

/** Catalog mapping each profile to its metadata and default asset. */
export const SOUND_PROFILES: Record<SoundProfile, SoundProfileMeta> = {
  "mechanical-keyboard": {
    id: "mechanical-keyboard",
    label: "Mechanical keyboard",
    description: "Tactile key clack, emitted once per character while typing.",
    asset: "mechanical-keyboard.wav",
    cadence: "per-keystroke",
  },
  "macbook-trackpad": {
    id: "macbook-trackpad",
    label: "MacBook trackpad",
    description: "Soft, deep trackpad click for primary actions.",
    asset: "macbook-trackpad.wav",
    cadence: "once",
  },
  "mouse-click": {
    id: "mouse-click",
    label: "Mouse click",
    description: "Crisp mechanical mouse click.",
    asset: "mouse-click.wav",
    cadence: "once",
  },
  whoosh: {
    id: "whoosh",
    label: "Whoosh",
    description: "Airy swipe for fast cursor moves, scrolls and zooms.",
    asset: "whoosh.wav",
    cadence: "once",
  },
  pop: {
    id: "pop",
    label: "Pop",
    description: "Light UI pop for highlights and appearances.",
    asset: "pop.wav",
    cadence: "once",
  },
};

export const SOUND_PROFILE_IDS = Object.keys(SOUND_PROFILES) as SoundProfile[];
