import { z } from "zod";

/**
 * Animation easing curves understood by the Telekinesis effects engine.
 * These map to CSS timing functions (and JS equivalents) in `@telekinesis/core`.
 */
export const EasingPattern = z.enum([
  "linear",
  "ease-in",
  "ease-out",
  "ease-in-out",
  "spring",
]);
export type EasingPattern = z.infer<typeof EasingPattern>;

/** Where a zoom anchors. */
export const TransformOrigin = z.enum([
  "center",
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
]);
export type TransformOrigin = z.infer<typeof TransformOrigin>;

/** How a fake cursor travels between two points. */
export const CursorCurve = z.enum(["linear", "arc", "bezier"]);
export type CursorCurve = z.infer<typeof CursorCurve>;
