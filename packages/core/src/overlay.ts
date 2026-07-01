import type { EasingPattern } from "@telekinesis/schema";
import { cssEasing } from "./easing";
import { getLayer } from "./layer";
import type { Point } from "./geometry";
import { animate, sleep } from "./timing";

export interface HighlightOptions {
  dimOpacity: number;
  padding: number;
  duration: number;
  signal?: AbortSignal;
}

/**
 * Camera & spotlight effects. Zoom transforms `<body>` around a focus point;
 * ripple / highlight live in the overlay layer (outside body) so they stay put.
 */
export class Overlay {
  private scale = 1;

  /**
   * Scale `<body>` to `scale`, keeping `focus` (viewport coords) pinned to the
   * same on-screen spot. `focus = null` keeps the current origin.
   */
  zoom(
    focus: Point | null,
    scale: number,
    duration: number,
    easing: EasingPattern,
    signal?: AbortSignal,
  ): Promise<void> {
    const body = document.body;
    body.style.willChange = "transform";
    body.style.transition = `transform ${duration}ms ${cssEasing[easing]}`;
    if (focus) {
      // body's box origin is the page origin, so convert viewport → page.
      const bx = focus.x + window.scrollX;
      const by = focus.y + window.scrollY;
      body.style.transformOrigin = `${bx}px ${by}px`;
    }
    body.style.transform = scale === 1 ? "" : `scale(${scale})`;
    this.scale = scale;
    return sleep(duration, signal);
  }

  resetZoom(duration: number, easing: EasingPattern, signal?: AbortSignal): Promise<void> {
    return this.zoom(null, 1, duration, easing, signal);
  }

  get currentScale(): number {
    return this.scale;
  }

  async ripple(p: Point, signal?: AbortSignal): Promise<void> {
    const dot = document.createElement("div");
    Object.assign(dot.style, {
      position: "absolute",
      left: `${p.x}px`,
      top: `${p.y}px`,
      width: "14px",
      height: "14px",
      marginLeft: "-7px",
      marginTop: "-7px",
      borderRadius: "50%",
      background: "rgba(96,150,255,0.40)",
      border: "2px solid rgba(96,150,255,0.95)",
      pointerEvents: "none",
    });
    getLayer().appendChild(dot);
    dot.animate(
      [
        { transform: "scale(0.3)", opacity: 0.9 },
        { transform: "scale(3.4)", opacity: 0 },
      ],
      { duration: 620, easing: "ease-out" },
    );
    await sleep(620, signal).catch((e) => {
      dot.remove();
      throw e;
    });
    dot.remove();
  }

  /** Spotlight: dim everything except a rounded cutout around `rect`. */
  async highlight(rect: DOMRect, opts: HighlightOptions): Promise<void> {
    const hole = document.createElement("div");
    const pad = opts.padding;
    Object.assign(hole.style, {
      position: "absolute",
      left: `${rect.left - pad}px`,
      top: `${rect.top - pad}px`,
      width: `${rect.width + pad * 2}px`,
      height: `${rect.height + pad * 2}px`,
      borderRadius: "12px",
      boxShadow: `0 0 0 9999px rgba(0,0,0,${opts.dimOpacity})`,
      outline: "2px solid rgba(255,255,255,0.85)",
      transition: "opacity 300ms ease",
      opacity: "0",
      pointerEvents: "none",
    });
    getLayer().appendChild(hole);
    requestAnimationFrame(() => {
      hole.style.opacity = "1";
    });
    try {
      await sleep(Math.max(0, opts.duration), opts.signal);
    } catch (e) {
      hole.remove();
      throw e;
    }
    hole.style.opacity = "0";
    await sleep(300).catch(() => {});
    hole.remove();
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
