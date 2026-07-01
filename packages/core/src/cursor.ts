import type { CursorCurve, EasingPattern } from "@telekinesis/schema";
import { jsEasing } from "./easing";
import { arcControlPoint, quadBezier, type Point } from "./geometry";
import { getLayer } from "./layer";
import { animate, sleep } from "./timing";

const CURSOR_SVG = `
<svg width="26" height="26" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M5 3 L5 23 L10.2 17.8 L13.6 25 L16.8 23.4 L13.4 16.4 L21 16.4 Z"
        fill="#111827" stroke="#ffffff" stroke-width="1.6" stroke-linejoin="round"/>
</svg>`;

export interface MoveOptions {
  duration: number;
  curve?: CursorCurve;
  easing?: EasingPattern;
  signal?: AbortSignal;
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
    const ease = jsEasing[opts.easing ?? "ease-in-out"];
    const control =
      curve === "linear"
        ? null
        : arcControlPoint(from, target, curve === "arc" ? 0.28 : 0.16);

    await animate(
      opts.duration,
      ease,
      (t) => {
        const p = control
          ? quadBezier(from, control, target, t)
          : { x: from.x + (target.x - from.x) * t, y: from.y + (target.y - from.y) * t };
        this.place(p);
      },
      opts.signal,
    );
    this.place(target);
  }

  /** A brief press animation at the current position. */
  async pressPulse(signal?: AbortSignal): Promise<void> {
    const { x, y } = this.pos;
    this.el.animate(
      [
        { transform: `translate(${x}px, ${y}px) scale(1)` },
        { transform: `translate(${x}px, ${y}px) scale(0.76)` },
        { transform: `translate(${x}px, ${y}px) scale(1)` },
      ],
      { duration: 220, easing: "ease-out" },
    );
    await sleep(220, signal);
  }
}

let cursor: GhostCursor | null = null;

export function getCursor(): GhostCursor {
  if (!cursor || !cursor.el.isConnected) cursor = new GhostCursor();
  return cursor;
}
