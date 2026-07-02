import type { EffectAction, SoundProfile } from "@telekinesis/schema";

/**
 * Pure logic shared by the Studio's timeline UI (`Timeline.tsx`,
 * `ReorderStrip.tsx`, `App.tsx`). Kept free of React/DOM so it's cheap to
 * unit-test in isolation — see `apps/studio/test/timeline-ops.test.ts`.
 */

/* ------------------------------------------------------------------ *
 * Drag-to-reorder
 * ------------------------------------------------------------------ */

const clampIndex = (i: number, length: number): number => Math.min(Math.max(i, 0), length - 1);

/**
 * Move the item at `from` to sit at `to` (both indices into `items`),
 * preserving the relative order of everything else. Out-of-range indices are
 * clamped rather than throwing — a stray drag event shouldn't crash the app.
 * `timeline[]` stays the single source of truth; this just reorders it.
 */
export function reorderTimeline<T>(items: readonly T[], from: number, to: number): T[] {
  const length = items.length;
  if (length === 0) return [];
  const f = clampIndex(from, length);
  const t = clampIndex(to, length);
  const next = [...items];
  if (f === t) return next;
  const [moved] = next.splice(f, 1);
  next.splice(t, 0, moved as T);
  return next;
}

/**
 * After moving the item at `from` to `to`, where does the clip that used to
 * be at `selected` end up? This is what keeps the Inspector pinned to the
 * *same logical clip* across a reorder, instead of silently following
 * whichever clip now happens to sit at the old index.
 */
export function remapSelectionAfterMove(
  selected: number | null,
  from: number,
  to: number,
): number | null {
  if (selected == null || from === to) return selected;
  if (selected === from) return to;
  if (from < to) {
    // Everything strictly between the old and new slot shifts left by one.
    if (selected > from && selected <= to) return selected - 1;
    return selected;
  }
  // from > to: everything from the new slot up to (not including) the old
  // slot shifts right by one.
  if (selected >= to && selected < from) return selected + 1;
  return selected;
}

/**
 * Alt+Up/Down keyboard reorder: nudge `index` by `delta` (±1), clamped to
 * stay inside `[0, length - 1]`. Returns `index` unchanged at the boundary —
 * callers should treat `result === index` as "no-op, nothing to commit".
 */
export function clampMove(index: number, delta: number, length: number): number {
  if (length <= 0) return index;
  return clampIndex(index + delta, length);
}

/** Keep a selection index valid after the timeline's length changes (e.g. an undo/redo or a delete). `null` in, `null` out; an empty timeline selects nothing. */
export function clampSelection(selected: number | null, length: number): number | null {
  if (selected == null) return null;
  if (length <= 0) return null;
  return clampIndex(selected, length);
}

/* ------------------------------------------------------------------ *
 * Duration drag + snapping
 * ------------------------------------------------------------------ */

/** Snap `valueMs` to the nearest of `edgesMs` if one lies within `thresholdMs`; otherwise return it unchanged. */
export function snapToEdges(valueMs: number, edgesMs: readonly number[], thresholdMs: number): number {
  let best = valueMs;
  let bestDist = thresholdMs;
  for (const edge of edgesMs) {
    const d = Math.abs(edge - valueMs);
    if (d <= bestDist) {
      bestDist = d;
      best = edge;
    }
  }
  return best;
}

/**
 * New duration (ms) for a clip whose trailing edge was dragged so its
 * absolute end now sits at `proposedEndMs`. Snaps to a neighboring clip's
 * start/end within `thresholdMs`, and never collapses below `minDurationMs`.
 */
export function resizeDurationMs(
  clipStartMs: number,
  proposedEndMs: number,
  neighborEdgesMs: readonly number[],
  opts: { thresholdMs?: number; minDurationMs?: number } = {},
): number {
  const thresholdMs = opts.thresholdMs ?? 60;
  const minDurationMs = opts.minDurationMs ?? 50;
  const snappedEnd = snapToEdges(proposedEndMs, neighborEdgesMs, thresholdMs);
  return Math.max(minDurationMs, snappedEnd - clipStartMs);
}

/* ------------------------------------------------------------------ *
 * Playhead formatting
 * ------------------------------------------------------------------ */

/** Format milliseconds as `m:ss.t` (tenths), clamped to non-negative — a compact readout for the playhead/time ruler. */
export function formatClock(ms: number): string {
  const totalTenths = Math.round(Math.max(0, ms) / 100);
  const seconds = Math.floor(totalTenths / 10);
  const tenths = totalTenths % 10;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}.${tenths}`;
}

/* ------------------------------------------------------------------ *
 * Sound lane defaults
 * ------------------------------------------------------------------ */

/** A reasonable default profile per action, used when "un-muting" a clip that never had one. Actions without a listed default (and `wait`, which has no `soundProfile` field at all) fall back to `"pop"`. */
const DEFAULT_SOUND_PROFILE: Partial<Record<EffectAction, SoundProfile>> = {
  click: "mouse-click",
  "type-down": "mechanical-keyboard",
  "drag-and-drop": "mouse-click",
  "cursor-move": "whoosh",
  "zoom-in": "whoosh",
  "zoom-out": "whoosh",
  "scroll-up": "whoosh",
  "scroll-down": "whoosh",
  highlight: "pop",
  shake: "pop",
};

export function suggestedSoundProfile(action: EffectAction): SoundProfile {
  return DEFAULT_SOUND_PROFILE[action] ?? "pop";
}
