import { describe, expect, it } from "vitest";
import type { EasingPattern } from "@telekinesis/schema";
import { cssEasing, jsEasing } from "../src/easing";

const ALL_EASINGS = Object.keys(jsEasing) as EasingPattern[];
const EXPECTED_EASINGS = [
  "linear",
  "ease-in",
  "ease-out",
  "ease-in-out",
  "spring",
  "ease-in-out-expo",
  "ease-out-quint",
  "ease-out-circ",
  "ease-out-back",
];

describe("jsEasing", () => {
  it("covers every EasingPattern value, including the 4 curves added 2026-07", () => {
    expect(ALL_EASINGS.sort()).toEqual([...EXPECTED_EASINGS].sort());
  });

  it.each(ALL_EASINGS)("%s is exact at t=0 (→0) and t=1 (→1)", (name) => {
    const f = jsEasing[name];
    expect(f(0)).toBeCloseTo(0, 9);
    expect(f(1)).toBeCloseTo(1, 9);
  });

  it("ease-in-out-expo is continuous across the t=0.5 piecewise seam", () => {
    const f = jsEasing["ease-in-out-expo"];
    const left = f(0.5 - 1e-6);
    const right = f(0.5 + 1e-6);
    expect(Math.abs(left - right)).toBeLessThan(1e-3);
    expect(f(0.5)).toBeCloseTo(0.5, 6);
  });

  // Curves with no overshoot: monotonic non-decreasing across the whole
  // domain is a meaningful, non-trivial property for these (unlike the
  // back-eases below, which overshoot by design).
  const MONOTONIC: EasingPattern[] = [
    "linear",
    "ease-in",
    "ease-out",
    "ease-in-out",
    "ease-in-out-expo",
    "ease-out-quint",
    "ease-out-circ",
  ];
  it.each(MONOTONIC)("%s is monotonically non-decreasing on [0,1]", (name) => {
    const f = jsEasing[name];
    let prev = f(0);
    for (let i = 1; i <= 200; i++) {
      const v = f(i / 200);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = v;
    }
  });

  // `spring` (the fixed-duration CSS fallback approximation) and
  // `ease-out-back` are deliberately *not* monotonic — overshooting past 1
  // before landing exactly on it is the entire visual point of a back-ease.
  const OVERSHOOTING: EasingPattern[] = ["spring", "ease-out-back"];
  it.each(OVERSHOOTING)("%s overshoots past 1 before landing exactly on 1", (name) => {
    const f = jsEasing[name];
    const samples = Array.from({ length: 99 }, (_, i) => f((i + 1) / 100));
    expect(Math.max(...samples)).toBeGreaterThan(1);
    expect(f(1)).toBeCloseTo(1, 9);
  });
});

describe("cssEasing", () => {
  it("has a matching bezier fallback entry for every EasingPattern jsEasing defines", () => {
    expect(Object.keys(cssEasing).sort()).toEqual([...EXPECTED_EASINGS].sort());
  });

  it.each(EXPECTED_EASINGS)("%s is a non-empty CSS timing-function string", (name) => {
    expect(cssEasing[name as EasingPattern].length).toBeGreaterThan(0);
  });
});
