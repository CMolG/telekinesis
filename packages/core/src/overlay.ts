import type { EasingPattern } from "@telekinesis/schema";
import { Camera, type CameraMotion } from "./camera";
import { jsEasing } from "./easing";
import { getLayer } from "./layer";
import type { Point } from "./geometry";
import { animate, sleep } from "./timing";

export interface HighlightOptions {
  dimOpacity: number;
  padding: number;
  duration: number;
  signal?: AbortSignal;
}

interface HighlightBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface RippleRing {
  size: number;
  maxScale: number;
  startOpacity: number;
  duration: number;
  delay: number;
  color: string;
}

const RIPPLE_RINGS: readonly RippleRing[] = [
  { size: 14, maxScale: 3.2, startOpacity: 0.9, duration: 620, delay: 0, color: "96,150,255" },
  { size: 14, maxScale: 4.6, startOpacity: 0.45, duration: 680, delay: 90, color: "150,190,255" },
];

/** How long a still-visible spotlight is kept around, in case the very next effect is another highlight() that should slide rather than flicker. */
const HIGHLIGHT_GRACE_MS = 2200;
const HIGHLIGHT_SLIDE_MS = 320;
const HIGHLIGHT_POP_MS = 260;
const HIGHLIGHT_FADE_MS = 300;
const HIGHLIGHT_BREATH_PERIOD_MS = 1400;
const HIGHLIGHT_BREATH_AMPLITUDE = 0.012;

/**
 * Camera & spotlight effects. `zoom` delegates to `Camera` (see camera.ts for
 * the coordinate math and how cursor/target alignment is preserved); ripple
 * / highlight live in the overlay layer (outside body) so they stay put
 * regardless of the camera transform.
 */
export class Overlay {
  private readonly camera = new Camera();
  private highlightEl: HTMLElement | null = null;
  private highlightBox: HighlightBox | null = null;
  private highlightFadeTimer: ReturnType<typeof setTimeout> | undefined;

  /**
   * Animate the camera to `scale`, keeping `focus` (viewport coords) pinned
   * to the same on-screen spot. `focus = null` keeps the current anchor.
   * `easing: "spring"` runs the real physically-integrated spring
   * (`timing.ts`); every other easing runs the matching `jsEasing` curve
   * over `duration` ms — see `Camera.zoomTo`.
   *
   * `duration <= 0` always snaps instantly, even for `"spring"`: a spring's
   * settle time emerges from its physics, not from `duration`, so a caller
   * asking for zero duration (Studio's `seekTo` scrubbing, notably) means
   * "no animation, jump there now" — matching `animate()`'s own existing
   * `duration <= 0` fast path for the other easings.
   */
  zoom(
    focus: Point | null,
    scale: number,
    duration: number,
    easing: EasingPattern,
    signal?: AbortSignal,
  ): Promise<void> {
    const motion: CameraMotion =
      easing === "spring" && duration > 0
        ? { kind: "spring" }
        : { kind: "eased", duration, ease: jsEasing[easing] };
    return this.camera.zoomTo(focus, scale, motion, signal);
  }

  resetZoom(duration: number, easing: EasingPattern, signal?: AbortSignal): Promise<void> {
    return this.zoom(null, 1, duration, easing, signal);
  }

  get currentScale(): number {
    return this.camera.scale;
  }

  /** A double ring, the second phase-offset behind the first — a fuller "impact" than one flat ring. */
  async ripple(p: Point, signal?: AbortSignal): Promise<void> {
    const dots = RIPPLE_RINGS.map((ring) => this.spawnRing(p, ring));
    const totalMs = Math.max(...RIPPLE_RINGS.map((r) => r.delay + r.duration));
    try {
      await sleep(totalMs, signal);
    } catch (e) {
      for (const dot of dots) dot.remove();
      throw e;
    }
    for (const dot of dots) dot.remove();
  }

  private spawnRing(p: Point, ring: RippleRing): HTMLElement {
    const dot = document.createElement("div");
    Object.assign(dot.style, {
      position: "absolute",
      left: `${p.x}px`,
      top: `${p.y}px`,
      width: `${ring.size}px`,
      height: `${ring.size}px`,
      marginLeft: `${-ring.size / 2}px`,
      marginTop: `${-ring.size / 2}px`,
      borderRadius: "50%",
      background: `rgba(${ring.color},0.35)`,
      border: `2px solid rgba(${ring.color},0.95)`,
      pointerEvents: "none",
    });
    getLayer().appendChild(dot);
    dot.animate(
      [
        { transform: "scale(0.3)", opacity: ring.startOpacity },
        { transform: `scale(${ring.maxScale})`, opacity: 0 },
      ],
      { duration: ring.duration, delay: ring.delay, easing: "ease-out", fill: "backwards" },
    );
    return dot;
  }

  /**
   * Spotlight: dim everything except a rounded cutout around `rect`. If a
   * previous spotlight is still on screen (within the grace window below),
   * it *slides* to the new rect instead of fading out and back in — see
   * `slideHighlight`. Also adds a gentle breathing pulse while it holds.
   */
  async highlight(rect: DOMRect, opts: HighlightOptions): Promise<void> {
    if (this.highlightFadeTimer !== undefined) {
      clearTimeout(this.highlightFadeTimer);
      this.highlightFadeTimer = undefined;
    }

    const pad = opts.padding;
    const box: HighlightBox = {
      x: rect.left - pad,
      y: rect.top - pad,
      w: rect.width + pad * 2,
      h: rect.height + pad * 2,
    };
    const prevBox = this.highlightBox;
    const continuing = this.highlightEl !== null;
    const hole = this.highlightEl ?? this.createHighlightEl();
    this.highlightEl = hole;
    this.highlightBox = box;

    hole.style.boxShadow = `0 0 0 9999px rgba(0,0,0,${opts.dimOpacity})`;
    hole.style.left = `${box.x}px`;
    hole.style.top = `${box.y}px`;
    hole.style.width = `${box.w}px`;
    hole.style.height = `${box.h}px`;

    try {
      if (continuing && prevBox) {
        await this.slideHighlight(hole, prevBox, box, opts.signal);
      } else {
        await this.popInHighlight(hole, opts.signal);
      }
      await this.breatheHighlight(hole, Math.max(0, opts.duration), opts.signal);
    } catch (e) {
      hole.remove();
      this.highlightEl = null;
      this.highlightBox = null;
      throw e;
    }

    // Defer teardown rather than fading out immediately: a highlight() call
    // arriving within the grace window cancels this and slides instead.
    this.highlightFadeTimer = setTimeout(() => this.fadeOutHighlight(), HIGHLIGHT_GRACE_MS);
  }

  private createHighlightEl(): HTMLElement {
    const hole = document.createElement("div");
    Object.assign(hole.style, {
      position: "absolute",
      borderRadius: "12px",
      outline: "2px solid rgba(255,255,255,0.85)",
      opacity: "0",
      pointerEvents: "none",
      willChange: "transform, opacity",
    });
    getLayer().appendChild(hole);
    return hole;
  }

  private async popInHighlight(hole: HTMLElement, signal?: AbortSignal): Promise<void> {
    hole.style.transition = "none";
    hole.style.transform = "scale(0.94)";
    hole.style.opacity = "0";
    void hole.offsetWidth; // flush the writes above before transitioning away from them
    hole.style.transition = `opacity ${HIGHLIGHT_POP_MS}ms ease, transform ${HIGHLIGHT_POP_MS}ms ease`;
    requestAnimationFrame(() => {
      hole.style.opacity = "1";
      hole.style.transform = "scale(1)";
    });
    await sleep(HIGHLIGHT_POP_MS, signal);
    hole.style.transition = "none";
  }

  /**
   * FLIP: `left/top/width/height` were already snapped to the new box above
   * (one layout write, not animated — a single, discrete resize per
   * highlight() call is cheap; the expensive thing is doing it every rAF
   * frame, which this doesn't). Compensate that jump with an
   * equal-and-opposite `translate`, then animate *that* back to zero — the
   * spotlight visibly slides from the old rect to the new one instead of
   * teleporting. Only position is FLIP-animated: a size change lands
   * immediately rather than being scale-compensated, because a non-uniform
   * scale would distort `border-radius`/`outline` when width and height
   * change by different amounts. Transform/opacity only for every animated
   * frame after the one-time layout write.
   */
  private async slideHighlight(
    hole: HTMLElement,
    prevBox: HighlightBox,
    box: HighlightBox,
    signal?: AbortSignal,
  ): Promise<void> {
    const dx = prevBox.x - box.x;
    const dy = prevBox.y - box.y;
    hole.style.transition = "none";
    hole.style.opacity = "1";
    hole.style.transform = `translate(${dx}px, ${dy}px)`;
    void hole.offsetWidth; // commit the jump before animating it away
    await animate(
      HIGHLIGHT_SLIDE_MS,
      jsEasing["ease-out-circ"],
      (t) => {
        const k = 1 - t;
        hole.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
      },
      signal,
    );
    hole.style.transform = "translate(0px, 0px)";
  }

  private async breatheHighlight(hole: HTMLElement, duration: number, signal?: AbortSignal): Promise<void> {
    if (duration <= 0) return;
    await animate(
      duration,
      (t) => t,
      (t) => {
        const phase = ((duration * t) / HIGHLIGHT_BREATH_PERIOD_MS) * Math.PI * 2;
        const s = 1 + Math.sin(phase) * HIGHLIGHT_BREATH_AMPLITUDE;
        hole.style.transform = `scale(${s.toFixed(4)})`;
      },
      signal,
    );
    hole.style.transform = "scale(1)";
  }

  private fadeOutHighlight(): void {
    this.highlightFadeTimer = undefined;
    const hole = this.highlightEl;
    if (!hole) return;
    this.highlightEl = null;
    this.highlightBox = null;
    hole.style.transition = `opacity ${HIGHLIGHT_FADE_MS}ms ease`;
    hole.style.opacity = "0";
    setTimeout(() => hole.remove(), HIGHLIGHT_FADE_MS);
  }

  /** Horizontal shake that decays over `duration`. */
  async shake(
    el: HTMLElement,
    intensity: "low" | "medium" | "high",
    duration: number,
    signal?: AbortSignal,
  ): Promise<void> {
    const amp = intensity === "low" ? 4 : intensity === "high" ? 14 : 8;
    const prev = el.style.transform;
    try {
      await animate(
        duration,
        (t) => t,
        (t) => {
          const decay = 1 - t;
          const dx = Math.sin(t * Math.PI * 10) * amp * decay;
          el.style.transform = `${prev} translateX(${dx}px)`.trim();
        },
        signal,
      );
    } finally {
      el.style.transform = prev;
    }
  }
}

let overlay: Overlay | null = null;

export function getOverlay(): Overlay {
  if (!overlay) overlay = new Overlay();
  return overlay;
}
