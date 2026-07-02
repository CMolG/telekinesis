import { describe, expect, it } from "vitest";
import { DEFAULT_SPRING_PARAMS, Spring } from "../src/timing";

const FRAME_MS = 1000 / 60;

/** Step a spring until settled or `maxSteps` elapses; returns the step count. */
function runToSettle(spring: Spring, maxSteps: number, dtMs = FRAME_MS): number {
  let steps = 0;
  while (!spring.settled && steps < maxSteps) {
    spring.step(dtMs);
    steps++;
  }
  return steps;
}

describe("Spring", () => {
  it("settles within a bounded number of 60fps frames and lands on the target", () => {
    const spring = new Spring();
    spring.reset(0, 100);
    const steps = runToSettle(spring, 600); // 10s of frames — generous upper bound
    expect(spring.settled).toBe(true);
    expect(steps).toBeLessThan(600);
    expect(spring.position).toBeCloseTo(100, 0);
    expect(Math.abs(spring.velocity)).toBeLessThan(5);
  });

  it("a looser settleThreshold never settles later than a stricter one on the same trajectory (partial params merge onto DEFAULT_SPRING_PARAMS)", () => {
    // Both springs follow the *identical* position/velocity trajectory (the
    // threshold doesn't feed back into the physics) — so the looser bound is
    // guaranteed to be crossed no later than the stricter one. This is a
    // property of the comparison, not a tuning-dependent empirical guess
    // (unlike e.g. "a stiffer spring settles faster", which is actually
    // false in general: raising stiffness while holding damping fixed lowers
    // the damping *ratio*, and can make it ring longer, not less).
    const loose = new Spring({ settleThreshold: DEFAULT_SPRING_PARAMS.settleThreshold * 20 });
    const strict = new Spring({ settleThreshold: DEFAULT_SPRING_PARAMS.settleThreshold });
    loose.reset(0, 100);
    strict.reset(0, 100);
    const looseSteps = runToSettle(loose, 600);
    const strictSteps = runToSettle(strict, 600);
    expect(looseSteps).toBeLessThanOrEqual(strictSteps);
  });

  it("a critically damped spring does not meaningfully overshoot its target", () => {
    const stiffness = 300;
    const mass = 1;
    const criticalDamping = Math.sqrt(4 * stiffness * mass);
    const spring = new Spring({ stiffness, damping: criticalDamping, mass });
    spring.reset(0, 50);
    let maxPos = 0;
    let steps = 0;
    while (!spring.settled && steps < 600) {
      spring.step(FRAME_MS);
      maxPos = Math.max(maxPos, spring.position);
      steps++;
    }
    expect(spring.settled).toBe(true);
    expect(maxPos).toBeLessThan(50 * 1.05);
  });

  it("clamps dt so a stalled/backgrounded frame cannot fling the spring off to infinity", () => {
    const spring = new Spring();
    spring.reset(0, 100);
    spring.step(5000); // a huge dt (e.g. a backgrounded tab waking up)
    expect(Number.isFinite(spring.position)).toBe(true);
    expect(Number.isFinite(spring.velocity)).toBe(true);
    expect(Math.abs(spring.position)).toBeLessThan(1000);
  });

  it("settle threshold: a spring already at rest at its target is immediately settled", () => {
    const spring = new Spring();
    spring.reset(10, 10, 0);
    expect(spring.energy).toBe(0);
    expect(spring.settled).toBe(true);
  });

  it("energy trends toward zero over time for a damped run (compares early vs. late windows, not sample-to-sample, since instantaneous energy can tick up slightly near a velocity zero-crossing)", () => {
    const spring = new Spring();
    spring.reset(0, 100);
    const energies: number[] = [spring.energy];
    for (let i = 0; i < 300 && !spring.settled; i++) {
      spring.step(FRAME_MS);
      energies.push(spring.energy);
    }
    const early = average(energies.slice(0, 5));
    const late = average(energies.slice(-5));
    expect(late).toBeLessThan(early);
  });

  it("reset() reinitializes position/target/velocity for instance reuse", () => {
    const spring = new Spring();
    spring.reset(0, 10);
    spring.step(16);
    spring.reset(5, 5, 0);
    expect(spring.position).toBe(5);
    expect(spring.target).toBe(5);
    expect(spring.velocity).toBe(0);
  });
});

function average(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
