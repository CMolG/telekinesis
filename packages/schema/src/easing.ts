import { z } from "zod";

/**
 * Animation easing curves understood by the Telekinesis effects engine.
 * These map to CSS timing functions (and JS equivalents) in `@telekinesis/core`.
 *
 * Additive only: existing values are load-bearing string identifiers read by
 * example timesheets and the Studio inspector, so never rename or remove one
 * — only append new curves to the end.
 */
export const EasingPattern = z.enum([
  "linear",
  "ease-in",
  "ease-out",
  "ease-in-out",
  "spring",
  // Added 2026-07: richer cinematic vocabulary (see docs/mejoras-cinematograficas-2026-07.md §2).
  "ease-in-out-expo",
  "ease-out-quint",
  "ease-out-circ",
  "ease-out-back",
  // Added 2026-07-13: plan 1 backlog (docs/superpowers/plans/2026-07-06-01-animation-transition-library.md).
  "ease-in-expo",
  "ease-out-expo",
  "ease-in-out-back",
]);
export type EasingPattern = z.infer<typeof EasingPattern>;

/** Where a zoom anchors. */
export const TransformOrigin = z.enum([
  "center",
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
]);
export type TransformOrigin = z.infer<typeof TransformOrigin>;

/** How a fake cursor travels between two points. */
export const CursorCurve = z.enum(["linear", "arc", "bezier"]);
export type CursorCurve = z.infer<typeof CursorCurve>;

/**
 * EasingPattern → JS easing function for requestAnimationFrame-style loops.
 * Every curve is exact at the endpoints: `f(0) === 0`, `f(1) === 1`
 * (`ease-out-back` overshoots past 1 in between — that's the point of a
 * "back" ease — but still lands exactly on 1). See `test/easing.test.ts` in
 * `@telekinesis/core` (re-exported from `./easing` there — see that file's
 * doc comment for why the table itself lives here instead).
 *
 * Pure math, no DOM — lives in this package (not `@telekinesis/core`, whose
 * `cssEasing` sibling table *is* browser/CSS-specific) so it's reachable by
 * any workspace that already depends on the shared schema without also
 * pulling in core's DOM-heavy runtime. `@telekinesis/engine`'s Node-side
 * recorder is exactly that case — see `curveForEasing` below.
 */
export const jsEasing: Record<EasingPattern, (t: number) => number> = {
  linear: (t) => t,
  "ease-in": (t) => t * t,
  "ease-out": (t) => 1 - (1 - t) * (1 - t),
  "ease-in-out": (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  // Fixed-duration fallback approximation of a spring — see `cssEasing`'s
  // block comment in `@telekinesis/core`'s easing.ts.
  spring: (t) => {
    const c = 1.70158 * 1.525;
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c + 1) * 2 * t - c)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c + 1) * (2 * t - 2) + c) + 2) / 2;
  },
  // Exponential ease-in-out: near-flat start/end, steep middle — a dramatic
  // "hyperspace jump" feel for zoom-in/out.
  "ease-in-out-expo": (t) =>
    t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  // Quintic ease-out: a longer, softer deceleration tail than the built-in
  // ease-out (quadratic) — reads as more "premium"/weighted.
  "ease-out-quint": (t) => 1 - Math.pow(1 - t, 5),
  // Circular ease-out: quarter-circle deceleration, snappier launch and a
  // shorter tail than quint — good for quick camera settles.
  "ease-out-circ": (t) => Math.sqrt(1 - Math.pow(t - 1, 2)),
  // Back ease-out: overshoots past 1 then eases back — a punchy, cartoony
  // "arrival with a little kick" for UI elements (not the ghost cursor,
  // which gets a physically-integrated overshoot instead — see core's
  // cursor.ts).
  "ease-out-back": (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  // Added 2026-07-13: plan 1 backlog. Closed forms from easings.net.
  // Exponential ease-in: near-flat start that snaps into a steep launch —
  // the mirror image of `ease-out-expo` below, for a "wind-up" feel.
  "ease-in-expo": (t) => (t === 0 ? 0 : Math.pow(2, 10 * t - 10)),
  // Exponential ease-out: steep launch, near-flat long tail — a snappier,
  // single-direction cousin of `ease-in-out-expo`'s symmetric hyperspace jump.
  "ease-out-expo": (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  // Back ease-in-out: undershoots below 0 on the way in, then overshoots
  // past 1 on the way out before landing exactly on 1 — `ease-out-back`'s
  // symmetric sibling, a wind-up *and* an arrival kick.
  "ease-in-out-back": (t) => {
    const c = 1.70158 * 1.525;
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c + 1) * 2 * t - c)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c + 1) * (2 * t - 2) + c) + 2) / 2;
  },
};

/**
 * Fitts-law-inspired velocity profile: a fast launch (steep initial slope)
 * and a long deceleration into the target, the way a real hand approaches a
 * small on-screen target — vs. the symmetric, mechanical feel of a plain
 * ease-in-out. This is `GhostCursor`'s own default progress curve
 * (`@telekinesis/core`'s cursor.ts), used whenever the caller doesn't ask
 * for a specific named easing (in practice: whenever an effect leaves
 * `easing` at its schema default of `"ease-in-out"`, since "make it look
 * human" was always the intent of that default). Callers that explicitly
 * want `linear`, `ease-in`, one of the named curves, etc. still get exactly
 * that curve, unchanged.
 *
 * Monotonic and exact at the endpoints for any `exaggeration >= 1`:
 * `f(0) = 0`, `f(1) = 1`, `f'(t) = exaggeration·(1-t)^(exaggeration-1) ≥ 0`.
 * See `test/cursor-motion.test.ts` in `@telekinesis/core` (re-exported from
 * `./cursor` there).
 */
export function fittsEase(t: number, exaggeration = 3.2): number {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return 1 - Math.pow(1 - c, exaggeration);
}

/**
 * Resolve an `EasingPattern` to its progress-curve function. This is the
 * single source of truth both sides of a recorded drag-and-drop resolve
 * their motion curve through:
 *  - `@telekinesis/core`'s `GhostCursor.moveTo` (cursor.ts) — the visual
 *    ghost cursor and, for a `drag-and-drop` effect, the dragged element's
 *    self-mode CSS transform.
 *  - `@telekinesis/engine`'s `record.ts` — the real, stepped Playwright
 *    mouse drag that carries the dragged element during an external
 *    recording.
 * Resolving both through this one function is what keeps a recorded drag's
 * real pointer and its ghost-cursor visual in lockstep for *any* easing, not
 * just the default.
 *
 * `undefined`/`"ease-in-out"` (the schema default) substitutes `fittsEase` —
 * the ghost cursor's own default feel — over the plain, symmetric
 * `jsEasing["ease-in-out"]`; every other named easing (an explicit author
 * choice) is honored as-is via `jsEasing`.
 *
 * Not meaningful for `"spring"` *outside of a drag's carry glide*:
 * `GhostCursor.moveTo` branches to a physically-integrated spring
 * (`flySpring`, timing.ts's `Spring`) *before* ever calling this, since a
 * spring isn't a fixed-duration progress curve — so for a bare `cursor-move`
 * effect (the only other caller that ever forwards a user-authored `easing:
 * "spring"` into `GhostCursor.moveTo`), `"spring"` always means that true,
 * variable-duration spring. `jsEasing.spring` (a cubic-bezier-shaped
 * fixed-duration approximation) exists as that same effect's CSS transition
 * fallback, and as `GhostCursor.moveTo`'s own opt-in escape hatch:
 * `MoveOptions.approximateSpring` (cursor.ts) skips the `flySpring` branch
 * and resolves through this function instead, returning the approximation.
 *
 * `dragGlide` (`@telekinesis/core`'s effects.ts) is the one caller that sets
 * it, unconditionally, for exactly the reason this function's own doc
 * comment above states: a drag's carry must resolve its motion curve
 * through the *same* fixed-duration function on every leg that moves in
 * lockstep — the self-mode dragged element's CSS transition (`cssEasing`,
 * already a fixed-duration approximation for `spring`) and, in external
 * mode, the engine recorder's real, stepped Playwright pointer (`record.ts`,
 * which resolves `eff.easing` through this very function). Before
 * `approximateSpring` existed, `GhostCursor.moveTo` had no way to opt out of
 * `flySpring`, so a drag authored with `easing: "spring"` ran the
 * approximation on the real pointer (external mode) while the ghost's glide
 * ran true, variable-duration spring physics — a dormant desync (no shipped
 * timesheet used it) tracked for the easing work in Plan 1 and closed by it:
 * all three legs of a `spring`-eased drag now share this one curve and one
 * fixed duration. A `cursor-move` effect and a drag's own brief pick-up
 * approach (hardcoded to `"ease-out"`, never `"spring"`) are unaffected and
 * keep their existing behavior exactly.
 */
export function curveForEasing(easing: EasingPattern | undefined): (t: number) => number {
  if (easing === undefined || easing === "ease-in-out") return fittsEase;
  return jsEasing[easing];
}
