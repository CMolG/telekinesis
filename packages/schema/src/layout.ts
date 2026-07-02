import type { Effect, EffectAction } from "./effects";
import type { Timesheet } from "./timesheet";

/**
 * A timesheet is a *sequential* score: each effect runs after the previous one,
 * separated by optional `delayBefore` / `delayAfter` pauses. A timeline UI (and
 * a "planned duration" read-out) needs *absolute* positions instead. These pure
 * helpers derive those positions without changing the authoritative order.
 *
 * Reused by the Studio timeline, the docs "≈Ns" badges and progress reporting.
 */

/** Broad category a clip belongs to — used for lane grouping and colour. */
export type EffectLane = "timing" | "camera" | "navigation" | "cursor" | "interaction";

export const EFFECT_LANES: readonly EffectLane[] = [
  "timing",
  "camera",
  "navigation",
  "cursor",
  "interaction",
];

/** Which lane each action lives in. */
export const LANE_OF: Record<EffectAction, EffectLane> = {
  wait: "timing",
  "zoom-in": "camera",
  "zoom-out": "camera",
  highlight: "camera",
  "scroll-up": "navigation",
  "scroll-down": "navigation",
  "cursor-move": "cursor",
  click: "interaction",
  "type-down": "interaction",
  "drag-and-drop": "interaction",
  shake: "interaction",
};

/**
 * Fallback active durations (ms) for actions when a concrete `duration` is
 * absent (e.g. an in-progress draft before Zod defaults are applied). These
 * mirror the schema defaults in `effects.ts`; `click` is synthetic (cursor
 * settle + press pulse + ripple) since it carries no `duration` field.
 */
export const EFFECT_BASE_DURATIONS: Record<EffectAction, number> = {
  click: 500,
  "type-down": 1000,
  "drag-and-drop": 800,
  shake: 500,
  "zoom-in": 1200,
  "zoom-out": 900,
  "scroll-up": 700,
  "scroll-down": 700,
  "cursor-move": 700,
  highlight: 1500,
  wait: 1000,
};

/**
 * The *active* duration (ms) of a single effect — the width of its timeline
 * clip, excluding the surrounding `delayBefore` / `delayAfter` pauses.
 *
 * `type-down` is proportional to its text; `click` is a fixed synthetic beat;
 * every other action reads its `duration` (falling back to the base default
 * when a draft has not yet been through the schema).
 */
export function estimateEffectDuration(effect: Effect): number {
  switch (effect.action) {
    case "type-down": {
      const speed = effect.typingSpeed ?? 55;
      const chars = [...(effect.text ?? "")].length;
      return Math.max(chars * speed, 200);
    }
    case "click":
      return EFFECT_BASE_DURATIONS.click;
    default: {
      const duration = (effect as { duration?: number }).duration;
      return typeof duration === "number"
        ? duration
        : EFFECT_BASE_DURATIONS[effect.action];
    }
  }
}

/** One effect placed on an absolute time axis. */
export interface LaidOutEffect {
  effect: Effect;
  /** Position in the original `timeline` array (the authoritative order). */
  index: number;
  /** Start offset (ms) from the beginning of playback, after `delayBefore`. */
  start: number;
  /** Active duration (ms) — see {@link estimateEffectDuration}. */
  duration: number;
  /** `start + duration`, before `delayAfter`. */
  end: number;
  lane: EffectLane;
}

export interface TimesheetLayout {
  items: LaidOutEffect[];
  /** Total estimated wall-clock duration (ms), including trailing delays. */
  totalMs: number;
}

/**
 * Walk the timeline once, accumulating a playback cursor, and assign every
 * effect an absolute `start`/`end` and a lane. The array order is never
 * changed — this is a projection, not a mutation.
 */
export function layoutTimesheet(sheet: Pick<Timesheet, "timeline">): TimesheetLayout {
  let cursor = 0;
  const items = sheet.timeline.map((effect, index): LaidOutEffect => {
    const delayBefore = effect.delayBefore ?? 0;
    const delayAfter = effect.delayAfter ?? 0;
    const duration = estimateEffectDuration(effect);
    const start = cursor + delayBefore;
    const end = start + duration;
    cursor = end + delayAfter;
    return { effect, index, start, duration, end, lane: LANE_OF[effect.action] };
  });
  return { items, totalMs: cursor };
}
