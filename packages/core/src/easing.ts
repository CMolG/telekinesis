import type { EasingPattern } from "@telekinesis/schema";

/**
 * The JS (rAF-loop) easing table, `fittsEase` and `curveForEasing` all moved
 * to `@telekinesis/schema`'s easing.ts — pure math that both this package's
 * `cursor.ts` (the browser-side ghost cursor) and `@telekinesis/engine`'s
 * `record.ts` (the Node-side real-pointer recorder) need, so it lives
 * somewhere reachable without engine having to depend on core's DOM-heavy
 * runtime for the sake of one shared curve. Re-exported here unchanged so
 * every existing `import { jsEasing } from "@telekinesis/core"` (or from
 * `"./easing"`, as `test/easing.test.ts` does) keeps working.
 */
export { jsEasing } from "@telekinesis/schema";

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
 * The four 2026-07 additions and the three 2026-07-13 additions (plan 1
 * backlog — see their own inline comments below) are all standard
 * easings.net cubic-bezier approximations — close enough for a CSS
 * fallback; `jsEasing` (now `@telekinesis/schema`'s) has the exact
 * closed-form functions for rAF-driven playback. Stays in this file (not
 * moved to schema alongside `jsEasing`) because nothing outside the browser
 * runtime needs a CSS timing-function string.
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
  // Added 2026-07-13: plan 1 backlog. Standard easings.net cubic-bezier
  // approximations for the closed forms `jsEasing` (schema) defines.
  "ease-in-expo": "cubic-bezier(0.7, 0, 0.84, 0)",
  "ease-out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
  "ease-in-out-back": "cubic-bezier(0.68, -0.6, 0.32, 1.6)",
};
