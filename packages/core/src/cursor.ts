import type { CursorCurve, EasingPattern } from "@telekinesis/schema";
import { jsEasing } from "./easing";
import { arcControlPoint, dist, pointAlong, quadBezier, type Point } from "./geometry";
import { getLayer } from "./layer";
import { animate, animateSprings, Spring, sleep, type SpringParams } from "./timing";

const CURSOR_SVG = `
<svg width="26" height="26" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M5 3 L5 23 L10.2 17.8 L13.6 25 L16.8 23.4 L13.4 16.4 L21 16.4 Z"
        fill="#111827" stroke="#ffffff" stroke-width="1.6" stroke-linejoin="round"/>
</svg>`;

/** Travel past the real target before springing back — 0 disables the settle phase. */
const DEFAULT_OVERSHOOT_PX = 6;
/** Below this travel distance, overshoot reads as jitter rather than a hand — skip it. */
const MIN_OVERSHOOT_TRAVEL_PX = 24;
/** Snappy, small-amplitude — a hand landing on a target and correcting. */
const SETTLE_SPRING_PARAMS: Partial<SpringParams> = {
  stiffness: 420,
  damping: 16,
  mass: 1,
  settleThreshold: 0.02,
};
/** Softer/more damped than the settle spring — this covers the whole travel distance. */
const TRAVEL_SPRING_PARAMS: Partial<SpringParams> = {
  stiffness: 170,
  damping: 22,
  mass: 1,
  settleThreshold: 0.05,
};
const SETTLE_MAX_DURATION_MS = 420;
const TRAVEL_MAX_DURATION_MS = 2200;
const TRAIL_GHOSTS = 3;
const TRAIL_STRIDE = 3;

/**
 * Fitts-law-inspired velocity profile: a fast launch (steep initial slope)
 * and a long deceleration into the target, the way a real hand approaches a
 * small on-screen target — vs. the symmetric, mechanical feel of a plain
 * ease-in-out. This is `GhostCursor`'s own default progress curve, used
 * whenever the caller doesn't ask for a specific named easing (in practice:
 * whenever an effect leaves `easing` at its schema default of
 * `"ease-in-out"`, since "make it look human" was always the intent of that
 * default). Callers that explicitly want `linear`, `ease-in`, one of the
 * named curves, etc. still get exactly that curve, unchanged.
 *
 * Monotonic and exact at the endpoints for any `exaggeration >= 1`:
 * `f(0) = 0`, `f(1) = 1`, `f'(t) = exaggeration·(1-t)^(exaggeration-1) ≥ 0`.
 * See `test/cursor-motion.test.ts`.
 */
export function fittsEase(t: number, exaggeration = 3.2): number {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return 1 - Math.pow(1 - c, exaggeration);
}

function curveForEasing(easing: EasingPattern | undefined): (t: number) => number {
  if (easing === undefined || easing === "ease-in-out") return fittsEase;
  return jsEasing[easing];
}

/**
 * A short-lived set of pre-allocated "afterimage" elements trailing the
 * cursor while it moves fast. Ghosts are created once per `moveTo` call and
 * mutated in place every sample (transform/opacity only — GPU-cheap, no
 * layout) rather than spawning a DOM node per frame.
 */
class MotionTrail {
  private readonly ghosts: HTMLElement[];
  private readonly history: Point[];
  private head = 0;
  private filled = 0;

  constructor(sourceEl: HTMLElement, count: number, private readonly stride: number) {
    this.history = Array.from({ length: count * stride + 1 }, () => ({ x: 0, y: 0 }));
    this.ghosts = Array.from({ length: count }, () => {
      const g = sourceEl.cloneNode(true) as HTMLElement;
      g.removeAttribute("id");
      Object.assign(g.style, {
        position: "absolute",
        top: "0",
        left: "0",
        transformOrigin: "top left",
        pointerEvents: "none",
        willChange: "transform, opacity",
        opacity: "0",
        // Drop-shadow is a real (non-free) filter pass; the real cursor keeps
        // it, the trail doesn't need it and shouldn't pay for it N times.
        filter: "none",
        transition: "none",
      });
      sourceEl.parentElement?.insertBefore(g, sourceEl);
      return g;
    });
  }

  sample(p: Point): void {
    const slot = this.history[this.head % this.history.length];
    slot.x = p.x;
    slot.y = p.y;
    this.head++;
    this.filled = Math.min(this.filled + 1, this.history.length);
    for (let i = 0; i < this.ghosts.length; i++) {
      const back = (i + 1) * this.stride;
      const ghost = this.ghosts[i];
      if (back >= this.filled) {
        ghost.style.opacity = "0";
        continue;
      }
      const idx = (this.head - 1 - back + this.history.length * 2) % this.history.length;
      const hp = this.history[idx];
      const fade = 1 - (i + 1) / (this.ghosts.length + 1);
      ghost.style.opacity = String(fade * 0.32);
      ghost.style.transform = `translate(${hp.x}px, ${hp.y}px) scale(${(0.9 - i * 0.08).toFixed(2)})`;
    }
  }

  dispose(): void {
    for (const g of this.ghosts) g.remove();
  }
}

export interface MoveOptions {
  duration: number;
  curve?: CursorCurve;
  easing?: EasingPattern;
  signal?: AbortSignal;
  /**
   * Micro-overshoot past the target before an elastic settle, in px along
   * the travel direction. `0` disables the settle phase entirely. Ignored
   * for hops shorter than ~24px (reads as jitter, not a hand). Default 6.
   */
  overshoot?: number;
  /**
   * Spawn a decaying motion trail while moving. Off by default — it's an
   * extra few DOM nodes and paints per move, worth paying for on a dramatic
   * sweep, not on every click's tiny approach.
   */
  trail?: boolean;
}

/** A fake mouse pointer that travels along human-looking curves. */
export class GhostCursor {
  readonly el: HTMLElement;
  pos: Point;

  constructor() {
    this.el = document.createElement("div");
    this.el.className = "telekinesis-cursor";
    this.el.innerHTML = CURSOR_SVG;
    Object.assign(this.el.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: "26px",
      height: "26px",
      transformOrigin: "top left",
      transition: "opacity 200ms ease",
      opacity: "0",
      filter: "drop-shadow(0 2px 5px rgba(0,0,0,0.4))",
      willChange: "transform",
    });
    getLayer().appendChild(this.el);
    this.pos = { x: window.innerWidth / 2, y: window.innerHeight * 0.7 };
    this.place(this.pos);
  }

  place(p: Point): void {
    this.pos = p;
    this.el.style.transform = `translate(${p.x}px, ${p.y}px)`;
  }

  show(): void {
    this.el.style.opacity = "1";
  }

  hide(): void {
    this.el.style.opacity = "0";
  }

  async moveTo(target: Point, opts: MoveOptions): Promise<void> {
    const from = { ...this.pos };
    const curve = opts.curve ?? "bezier";
    const control =
      curve === "linear" ? null : arcControlPoint(from, target, curve === "arc" ? 0.28 : 0.16);

    const overshootPx = opts.overshoot ?? DEFAULT_OVERSHOOT_PX;
    const applyOvershoot = overshootPx > 0 && dist(from, target) > MIN_OVERSHOOT_TRAVEL_PX;
    const flightTarget = applyOvershoot ? pointAlong(from, target, overshootPx) : target;

    const trail = opts.trail ? new MotionTrail(this.el, TRAIL_GHOSTS, TRAIL_STRIDE) : null;
    const place = (p: Point): void => {
      this.place(p);
      trail?.sample(p);
    };

    try {
      if (opts.easing === "spring") {
        await this.flySpring(from, flightTarget, place, opts.signal);
      } else {
        const ease = curveForEasing(opts.easing);
        await animate(
          opts.duration,
          ease,
          (t) => {
            const p = control
              ? quadBezier(from, control, flightTarget, t)
              : {
                  x: from.x + (flightTarget.x - from.x) * t,
                  y: from.y + (flightTarget.y - from.y) * t,
                };
            place(p);
          },
          opts.signal,
        );
      }

      if (applyOvershoot) {
        await this.settle(target, place, opts.signal);
      } else {
        place(target);
      }
    } finally {
      trail?.dispose();
    }
  }

  /** Spring-integrated travel for `easing: "spring"` — two independent 1D springs (x, y). */
  private async flySpring(
    from: Point,
    to: Point,
    place: (p: Point) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const sx = new Spring(TRAVEL_SPRING_PARAMS);
    const sy = new Spring(TRAVEL_SPRING_PARAMS);
    sx.reset(from.x, to.x);
    sy.reset(from.y, to.y);
    await animateSprings(
      [sx, sy],
      () => place({ x: sx.position, y: sy.position }),
      { signal, maxDuration: TRAVEL_MAX_DURATION_MS },
    );
  }

  /** Elastic settle from the (overshot) current position to the exact `target`. */
  private async settle(
    target: Point,
    place: (p: Point) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const sx = new Spring(SETTLE_SPRING_PARAMS);
    const sy = new Spring(SETTLE_SPRING_PARAMS);
    sx.reset(this.pos.x, target.x);
    sy.reset(this.pos.y, target.y);
    await animateSprings(
      [sx, sy],
      () => place({ x: sx.position, y: sy.position }),
      { signal, maxDuration: SETTLE_MAX_DURATION_MS },
    );
    place(target); // snap exact — springs asymptote but never quite hit 0 residual.
  }

  /**
   * A brief press animation at the current position: anticipation (a slight
   * stretch, like winding up), a non-uniform squash (real material
   * compresses more on the axis it's pressed along than a uniform
   * `scale(0.76)` collapse), and a small rebound overshoot before settling.
   * Still one `.animate()` call — transform-only, GPU-composited.
   */
  async pressPulse(signal?: AbortSignal): Promise<void> {
    const { x, y } = this.pos;
    const at = (sx: number, sy: number): string => `translate(${x}px, ${y}px) scale(${sx}, ${sy})`;
    const duration = 260;
    this.el.animate(
      [
        { transform: at(1, 1), offset: 0 },
        { transform: at(0.92, 1.1), offset: 0.15 }, // anticipation: wind up
        { transform: at(1.18, 0.68), offset: 0.42 }, // press: squash wide + flat
        { transform: at(0.92, 1.12), offset: 0.72 }, // rebound overshoot
        { transform: at(1, 1), offset: 1 },
      ],
      { duration, easing: "ease-out" },
    );
    await sleep(duration, signal);
  }
}

let cursor: GhostCursor | null = null;

export function getCursor(): GhostCursor {
  if (!cursor || !cursor.el.isConnected) cursor = new GhostCursor();
  return cursor;
}
