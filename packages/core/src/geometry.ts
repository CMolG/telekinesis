import type { TransformOrigin } from "@telekinesis/schema";

export interface Point {
  x: number;
  y: number;
}

/** Plain, JSON-serializable rectangle (DOMRect getters don't serialize). */
export interface RectJSON {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export function rectToJSON(r: DOMRect): RectJSON {
  return {
    x: r.x,
    y: r.y,
    width: r.width,
    height: r.height,
    top: r.top,
    right: r.right,
    bottom: r.bottom,
    left: r.left,
  };
}

export function rectCenter(r: DOMRect | RectJSON): Point {
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** Anchor point (viewport coords) for a transform-origin keyword. */
export function viewportAnchor(origin: TransformOrigin): Point {
  const w = window.innerWidth;
  const h = window.innerHeight;
  switch (origin) {
    case "top-left":
      return { x: 0, y: 0 };
    case "top-right":
      return { x: w, y: 0 };
    case "bottom-left":
      return { x: 0, y: h };
    case "bottom-right":
      return { x: w, y: h };
    case "center":
    default:
      return { x: w / 2, y: h / 2 };
  }
}

export function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Quadratic Bézier interpolation. */
export function quadBezier(p0: Point, c: Point, p1: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x,
    y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y,
  };
}

/**
 * A control point that bends a straight A→B path into a human-looking arc:
 * the midpoint, pushed perpendicular to the path by a fraction of its length.
 */
export function arcControlPoint(a: Point, b: Point, bend = 0.18): Point {
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  // perpendicular unit vector
  const nx = -dy / len;
  const ny = dx / len;
  const offset = len * bend;
  return { x: mid.x + nx * offset, y: mid.y + ny * offset };
}
