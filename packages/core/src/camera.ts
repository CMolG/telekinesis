import type { Point } from "./geometry";
import { animate, animateSprings, Spring, type SpringParams } from "./timing";

export interface CameraState {
  scale: number;
  /** Translation, in `document.body`'s own (untransformed) coordinate space. */
  tx: number;
  ty: number;
}

const IDENTITY: CameraState = { scale: 1, tx: 0, ty: 0 };

export type CameraMotion =
  | { kind: "eased"; duration: number; ease: (t: number) => number }
  | { kind: "spring"; params?: Partial<SpringParams> };

export interface CameraOptions {
  /** Idle Ken-Burns drift while zoomed in (scale > 1). Default true. */
  idleDrift?: boolean;
}

const DRIFT_AMPLITUDE_PX = 5;
const DRIFT_PERIOD_MS = 5200;

/**
 * Owns `document.body`'s camera transform: a single
 * `matrix(scale, 0, 0, scale, tx, ty)`, driven every frame by rAF (or by
 * `Spring`s — see `zoomTo`), instead of a CSS transition on `transform` with
 * a `transform-origin` that gets reassigned between calls.
 *
 * ## Why matrix + fixed origin, not `transform-origin`
 *
 * The old `overlay.zoom()` pinned a focus point by setting
 * `transform-origin` to that point (in page coordinates) and transitioning
 * `transform: scale(s)`. That's correct for a *single* zoom from rest, but
 * breaks down the moment two zooms chain: the second call snaps
 * `transform-origin` to the new focus *instantly*, while the CSS transition
 * from the first call may still be mid-flight — for one frame (and for the
 * rest of that transition) the content is being scaled around a different
 * point than an instant ago, which reads as a jump/warp (the "blurs text"
 * complaint in the spec is this: a discontinuous origin change combined with
 * a live scale transition). It also can't express a pan (translate) at all,
 * so "zoom + drift" was never possible.
 *
 * The fix: fix `transform-origin` at `0 0` forever and bake the anchor math
 * into an explicit `tx, ty` instead. With origin pinned at the body's own
 * top-left, the transform simplifies to the textbook "scale then translate"
 * form (no cross terms with a moving origin):
 *
 *   rendered_page = scale · local + (tx, ty)
 *
 * To keep a page-space anchor point `p` visually fixed at its current
 * on-screen (page-space) position while animating to a new `scale`, solve
 * for the translate that keeps `p` invariant:
 *
 *   tx_new = p.x − scale_new · local.x         (and the same for y)
 *
 * where `local = (p − tx_current) / scale_current` is `p` expressed in
 * body's own untransformed coordinates (the inverse of the same formula).
 * Because `tx, ty` are now *explicit* numbers instead of a derived
 * side-effect of `transform-origin`, they can be linearly interpolated (or
 * spring-integrated) frame by frame with zero discontinuity, which is what
 * makes combined zoom+pan and the idle Ken-Burns drift possible at all.
 *
 * ## Cursor/target alignment under this transform
 *
 * This class only ever transforms `document.body` — nothing else changes
 * about the coordinate architecture `registry.ts`/`geometry.ts` already
 * relied on. `getFrameRect()` (registry.ts) calls the target element's
 * `getBoundingClientRect()`, which is *always* post-transform, post-scroll,
 * viewport-space — the browser recomputes it from current computed style,
 * so it's correct on every frame of a camera animation, `matrix()` or not.
 * The ghost cursor and spotlight overlay live in `#telekinesis-layer`
 * (`layer.ts`), mounted as a *sibling* of `<body>` (`position: fixed`) so
 * body's transform never touches them — they stay in true, untransformed
 * viewport space. Since `getFrameRect()` output is already viewport-space
 * and the layer is already viewport-space, no extra coordinate conversion
 * is needed anywhere else in the engine: a cursor placed at
 * `rectCenter(getFrameRect(id))` lands exactly on the visually zoomed/panned
 * element, at any point during a camera animation, unchanged from before.
 * (`Point` above is imported purely for that type — this module doesn't
 * otherwise touch viewport coordinates directly.)
 */
export class Camera {
  private state: CameraState = { ...IDENTITY };
  private anchorPage: Point = { x: 0, y: 0 };
  private anchorLocal: Point = { x: 0, y: 0 };
  private initialized = false;
  private generation = 0;
  private driftRaf = 0;

  constructor(private readonly opts: CameraOptions = {}) {}

  get scale(): number {
    return this.state.scale;
  }

  /**
   * Animate to `scale`, optionally re-pinning `focus` (viewport coords).
   * `focus: null` keeps whatever anchor was last set (matches the previous
   * `zoom()` contract of "leave transform-origin alone"). `scale === 1`
   * always targets the true identity transform, regardless of anchor —
   * "reset" means back to natural layout, not "panned but unzoomed".
   */
  zoomTo(
    focus: Point | null,
    scale: number,
    motion: CameraMotion,
    signal?: AbortSignal,
  ): Promise<void> {
    this.ensureInit();
    this.stopDrift();
    const target = scale === 1 ? { ...IDENTITY } : this.solveTarget(focus, scale);
    const done =
      motion.kind === "spring"
        ? this.animateToSpring(target, motion.params, signal)
        : this.animateToEased(target, motion.duration, motion.ease, signal);
    return done.then(() => {
      if (this.state.scale > 1) this.startDrift();
    });
  }

  private solveTarget(focus: Point | null, scale: number): CameraState {
    if (focus) {
      const page = { x: focus.x + window.scrollX, y: focus.y + window.scrollY };
      this.anchorPage = page;
      this.anchorLocal = {
        x: (page.x - this.state.tx) / this.state.scale,
        y: (page.y - this.state.ty) / this.state.scale,
      };
    }
    return {
      scale,
      tx: this.anchorPage.x - scale * this.anchorLocal.x,
      ty: this.anchorPage.y - scale * this.anchorLocal.y,
    };
  }

  private animateToEased(
    target: CameraState,
    duration: number,
    ease: (t: number) => number,
    signal?: AbortSignal,
  ): Promise<void> {
    const from = { ...this.state };
    const myGen = ++this.generation;
    return animate(
      duration,
      ease,
      (t) => {
        if (myGen !== this.generation) return; // superseded by a newer call
        this.state = {
          scale: from.scale + (target.scale - from.scale) * t,
          tx: from.tx + (target.tx - from.tx) * t,
          ty: from.ty + (target.ty - from.ty) * t,
        };
        this.apply();
      },
      signal,
    ).then(() => {
      if (myGen !== this.generation) return;
      this.state = target;
      this.apply();
    });
  }

  private animateToSpring(
    target: CameraState,
    params: Partial<SpringParams> | undefined,
    signal?: AbortSignal,
  ): Promise<void> {
    const myGen = ++this.generation;
    const sScale = new Spring(params);
    const sTx = new Spring(params);
    const sTy = new Spring(params);
    sScale.reset(this.state.scale, target.scale);
    sTx.reset(this.state.tx, target.tx);
    sTy.reset(this.state.ty, target.ty);
    return animateSprings(
      [sScale, sTx, sTy],
      () => {
        if (myGen !== this.generation) return;
        this.state = { scale: sScale.position, tx: sTx.position, ty: sTy.position };
        this.apply();
      },
      { signal },
    ).then(() => {
      if (myGen !== this.generation) return;
      this.state = target;
      this.apply();
    });
  }

  /** A slow, small-amplitude pan while holding a zoomed-in shot — "holds breathe". */
  private startDrift(): void {
    if (this.opts.idleDrift === false) return;
    const myGen = this.generation;
    const base = { ...this.state };
    const start = performance.now();
    const tick = (now: number): void => {
      if (myGen !== this.generation) return; // superseded — a real zoom/reset took over
      const phase = ((now - start) / DRIFT_PERIOD_MS) * Math.PI * 2;
      const dx = Math.sin(phase) * DRIFT_AMPLITUDE_PX;
      const dy = Math.sin(phase * 0.63 + 1.1) * DRIFT_AMPLITUDE_PX * 0.6;
      // Deliberately bypasses `this.state`: drift is a purely visual wobble
      // layered on top of the settled state, so the *next* real animation's
      // `from` is still the stable, non-jittery value.
      this.writeTransform(base.scale, base.tx + dx, base.ty + dy);
      this.driftRaf = requestAnimationFrame(tick);
    };
    this.driftRaf = requestAnimationFrame(tick);
  }

  private stopDrift(): void {
    cancelAnimationFrame(this.driftRaf);
  }

  private ensureInit(): void {
    if (this.initialized) return;
    this.initialized = true;
    document.body.style.transformOrigin = "0 0";
    document.body.style.willChange = "transform";
  }

  private apply(): void {
    const { scale, tx, ty } = this.state;
    this.writeTransform(scale, tx, ty);
  }

  private writeTransform(scale: number, tx: number, ty: number): void {
    document.body.style.transform =
      scale === 1 && tx === 0 && ty === 0 ? "" : `matrix(${scale}, 0, 0, ${scale}, ${tx}, ${ty})`;
  }
}
