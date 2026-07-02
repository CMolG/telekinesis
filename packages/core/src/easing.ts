import type { EasingPattern } from "@telekinesis/schema";

/**
 * EasingPattern → CSS `transition-timing-function`.
 *
 * `spring` stays a cubic-bezier back-ease approximation on purpose — it's the
 * fallback for CSS-transition consumers that can't run a variable-duration
 * rAF loop (e.g. `drag-and-drop`'s dragged-element transform in `effects.ts`).
 * The *real*, physically-integrated spring lives in `timing.ts` (`Spring`,
 * `animateSpring`) and is wired into `cursor.ts` and `camera.ts`, which run
 * their own rAF loops instead of a CSS transition.
 *
 * The four 2026-07 additions are standard easings.net cubic-bezier
 * approximations — close enough for a CSS fallback; `jsEasing` below has the
 * exact closed-form functions for rAF-driven playback.
 */
export const cssEasing: Record<EasingPattern, string> = {
  linear: "linear",
  "ease-in": "cubic-bezier(0.42, 0, 1, 1)",
  "ease-out": "cubic-bezier(0, 0, 0.58, 1)",
  "ease-in-out": "cubic-bezier(0.42, 0, 0.58, 1)",
  spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  "ease-in-out-expo": "cubic-bezier(0.87, 0, 0.13, 1)",
  "ease-out-quint": "cubic-bezier(0.22, 1, 0.36, 1)",
  "ease-out-circ": "cubic-bezier(0, 0.55, 0.45, 1)",
  "ease-out-back": "cubic-bezier(0.34, 1.56, 0.64, 1)",
};

/**
 * EasingPattern → JS easing function for requestAnimationFrame loops.
 * Every curve is exact at the endpoints: `f(0) === 0`, `f(1) === 1`
 * (`ease-out-back` overshoots past 1 in between — that's the point of a
 * "back" ease — but still lands exactly on 1). See `test/easing.test.ts`.
 */
export const jsEasing: Record<EasingPattern, (t: number) => number> = {
  linear: (t) => t,
  "ease-in": (t) => t * t,
  "ease-out": (t) => 1 - (1 - t) * (1 - t),
  "ease-in-out": (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  // Fixed-duration fallback approximation of a spring — see block comment above.
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
  // which gets a physically-integrated overshoot instead — see cursor.ts).
  "ease-out-back": (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
};
