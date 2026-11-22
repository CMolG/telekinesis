import type { DragAndDropEffect, Effect, TimesheetInput } from "@telekinesis/schema";
import { getCursor } from "./cursor";
import { dragApproach, dragGlide, runEffect, type RunContext } from "./effects";
import { rectToJSON, type Point, type RectJSON } from "./geometry";
import { getOverlay } from "./overlay";
import { play } from "./player";
import { getFrameRect, listFrames, type FrameInfo } from "./registry";
import { seekTo } from "./seek";

export const VERSION = "0.1.0";

/**
 * The `window.__telekinesis` API. Installed by `<TelekinesisStage>` in demo
 * mode; the Playwright recorder calls into it via `page.evaluate`.
 */
export interface TelekinesisRuntime {
  version: string;
  ready: boolean;
  /** Autonomously play a whole timesheet (used for live previews). */
  play: typeof play;
  /** Run a single effect's visuals — Playwright drives the real I/O itself. */
  runEffect: (effect: Effect) => Promise<void>;
  /**
   * `drag-and-drop`'s visual, split into its two phases — see
   * `effects.ts`'s `dragApproach`/`dragGlide`. Every other effect only ever
   * needs plain `runEffect`; these two exist so
   * `packages/engine/src/record.ts` can carry out the real pointer drag
   * *during* the destination glide instead of after it (see that file's
   * "drag-and-drop" case for the choreography and why). `runDragApproach`
   * resolves with the source point `runDragGlide` needs.
   */
  runDragApproach: (effect: DragAndDropEffect) => Promise<Point>;
  runDragGlide: (effect: DragAndDropEffect, from: Point) => Promise<void>;
  /** All registered frames with their current viewport rects. */
  listFrames: () => FrameInfo[];
  getRect: (id: string) => RectJSON | null;
  showCursor: () => void;
  /**
   * Studio scrubbing: instantly reconstruct the persistent visual state
   * (cursor position, camera zoom, scroll offset) at absolute time `t` (ms).
   * See `seek.ts` for the fidelity trade-off. Additive — does not affect
   * `play`/`runEffect`.
   */
  seekTo: (sheet: TimesheetInput, t: number) => void;
}

export function installRuntime(_opts: { soundBase?: string } = {}): TelekinesisRuntime {
  const cursor = getCursor();
  const overlay = getOverlay();
  // Shared by every runtime-invoked effect call below: sound is always
  // marked Node-side by the recorder's own `mark` closure (record.ts), never
  // in-page, so this `mark` is deliberately a no-op — same as before this
  // context was hoisted out of each call site.
  const ctx: RunContext = { mode: "external", cursor, overlay, mark: () => {} };

  const rt: TelekinesisRuntime = {
    version: VERSION,
    ready: true,
    play,
    runEffect: (effect) => runEffect(effect, ctx),
    runDragApproach: (effect) => dragApproach(effect, ctx),
    runDragGlide: (effect, from) => dragGlide(effect, from, ctx),
    listFrames,
    getRect: (id) => {
      const r = getFrameRect(id);
      return r ? rectToJSON(r) : null;
    },
    showCursor: () => cursor.show(),
    seekTo: (sheet, t) => seekTo(sheet, t),
  };

  if (typeof window !== "undefined") {
    (window as unknown as Record<string, unknown>).__telekinesis = rt;
  }
  return rt;
}

export function getRuntime(): TelekinesisRuntime | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as Record<string, TelekinesisRuntime>).__telekinesis;
}
