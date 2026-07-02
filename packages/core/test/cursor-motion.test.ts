import { describe, expect, it } from "vitest";
import { fittsEase } from "../src/cursor";
import { arcControlPoint, dist, quadBezier, type Point } from "../src/geometry";

describe("fittsEase", () => {
  it("is exact at the endpoints", () => {
    expect(fittsEase(0)).toBe(0);
    expect(fittsEase(1)).toBe(1);
  });

  it("is monotonically non-decreasing on [0,1] for the default exaggeration", () => {
    let prev = fittsEase(0);
    for (let i = 1; i <= 200; i++) {
      const v = fittsEase(i / 200);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it("front-loads velocity — fast launch, long tail: more than half the distance covered in the first third of the time", () => {
    expect(fittsEase(1 / 3)).toBeGreaterThan(0.5);
  });

  it("stays monotonic and endpoint-exact across a range of exaggeration values", () => {
    for (const k of [1, 2, 3.2, 5, 8]) {
      let prev = fittsEase(0, k);
      for (let i = 1; i <= 50; i++) {
        const v = fittsEase(i / 50, k);
        expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
        prev = v;
      }
      expect(fittsEase(1, k)).toBeCloseTo(1, 10);
    }
  });

  it("clamps out-of-range t instead of extrapolating", () => {
    expect(fittsEase(-1)).toBe(0);
    expect(fittsEase(2)).toBe(1);
  });
});

describe("cursor travel path (fittsEase progress along GhostCursor's own quadBezier)", () => {
  // GhostCursor.moveTo bends the A→B path with arcControlPoint at bend=0.16
  // ("bezier", the default curve) or 0.28 ("arc") — reuse the exact same
  // construction so this test exercises what moveTo actually draws.
  const geometries: Array<[Point, Point]> = [
    [{ x: 40, y: 500 }, { x: 860, y: 120 }],
    [{ x: 900, y: 80 }, { x: 120, y: 640 }],
    [{ x: 100, y: 100 }, { x: 110, y: 900 }], // near-vertical
    [{ x: 0, y: 0 }, { x: 1000, y: 0 }], // horizontal
    [{ x: 1200, y: 50 }, { x: 1210, y: 60 }], // short hop
  ];

  it.each([0.16, 0.28])("never moves backward from the target (bend=%s): distance-to-target is monotonically non-increasing", (bend) => {
    for (const [from, to] of geometries) {
      const control = arcControlPoint(from, to, bend);
      let prevDist = dist(from, to);
      for (let i = 1; i <= 200; i++) {
        const p = quadBezier(from, control, to, fittsEase(i / 200));
        const d = dist(p, to);
        expect(d).toBeLessThanOrEqual(prevDist + 1e-6);
        prevDist = d;
      }
      expect(prevDist).toBeCloseTo(0, 6); // lands exactly on target at t=1
    }
  });

  it("linear curve (no control point) also progresses monotonically toward the target", () => {
    for (const [from, to] of geometries) {
      let prevDist = dist(from, to);
      for (let i = 1; i <= 200; i++) {
        const t = fittsEase(i / 200);
        const p = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
        const d = dist(p, to);
        expect(d).toBeLessThanOrEqual(prevDist + 1e-6);
        prevDist = d;
      }
    }
  });
});
