import {
  parseTimesheet,
  type Timesheet,
  type TimesheetInput,
} from "@telekinesis/schema";
import { getCursor } from "./cursor";
import { runEffect, type RunContext } from "./effects";
import { getOverlay } from "./overlay";
import { SoundEngine, type SoundMark } from "./sound";
import { sleep } from "./timing";

export interface PlayOptions {
  /** `self` drives the real app; `external` is visuals-only (Playwright). */
  mode?: "self" | "external";
  /** Play audio in the browser. Defaults to true in self mode. */
  sound?: boolean;
  soundBase?: string;
  /** Called for every sound event (used to build the audio map). */
  onMark?: (mark: SoundMark) => void;
  onStep?: (index: number, total: number) => void;
  signal?: AbortSignal;
}

/**
 * Perform a whole timesheet, resolving with the ordered list of sound marks
 * (offsets in ms from playback start).
 */
export async function play(
  timesheet: Timesheet | TimesheetInput,
  opts: PlayOptions = {},
): Promise<SoundMark[]> {
  const sheet = parseTimesheet(timesheet);
  const mode = opts.mode ?? "self";
  const cursor = getCursor();
  const overlay = getOverlay();
  const audio = new SoundEngine({
    base: opts.soundBase,
    enabled: opts.sound ?? mode === "self",
  });

  const marks: SoundMark[] = [];
  const start = performance.now();

  const ctx: RunContext = {
    mode,
    cursor,
    overlay,
    signal: opts.signal,
    mark: (profile) => {
      const mark: SoundMark = { profile, t: performance.now() - start };
      marks.push(mark);
      opts.onMark?.(mark);
      audio.play(profile);
    },
  };

  cursor.show();
  const { timeline } = sheet;
  for (let i = 0; i < timeline.length; i++) {
    if (opts.signal?.aborted) break;
    const eff = timeline[i];
    opts.onStep?.(i, timeline.length);
    if (eff.delayBefore) await sleep(eff.delayBefore, opts.signal);
    await runEffect(eff, ctx);
    if (eff.delayAfter) await sleep(eff.delayAfter, opts.signal);
  }
  return marks;
}
