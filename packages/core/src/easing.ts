import type { EasingPattern } from "@telekinesis/schema";

/** EasingPattern → CSS `transition-timing-function`. */
export const cssEasing: Record<EasingPattern, string> = {
  linear: "linear",
  "ease-in": "cubic-bezier(0.42, 0, 1, 1)",
  "ease-out": "cubic-bezier(0, 0, 0.58, 1)",
  "ease-in-out": "cubic-bezier(0.42, 0, 0.58, 1)",
  spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
};

/** EasingPattern → JS easing function for requestAnimationFrame loops. */
export const jsEasing: Record<EasingPattern, (t: number) => number> = {
  linear: (t) => t,
  "ease-in": (t) => t * t,
  "ease-out": (t) => 1 - (1 - t) * (1 - t),
  "ease-in-out": (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  spring: (t) => {
    const c = 1.70158 * 1.525;
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c + 1) * 2 * t - c)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c + 1) * (2 * t - 2) + c) + 2) / 2;
  },
};
