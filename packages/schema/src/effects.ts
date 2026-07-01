import { z } from "zod";
import { CursorCurve, EasingPattern, TransformOrigin } from "./easing";
import { SoundProfile } from "./sound";

/**
 * Fields shared by every effect. `frameId` targets a registered
 * `<TelekineticFrame>`; effects that act on the page as a whole leave it unset.
 */
const BaseEffect = z.object({
  /** Target frame id. Required by most effects, overridden per-effect. */
  frameId: z.string().optional(),
  /** Dramatic pause (ms) before the effect runs. */
  delayBefore: z.number().min(0).optional(),
  /** Pause (ms) after the effect resolves, before the next one starts. */
  delayAfter: z.number().min(0).optional(),
  /** Free-form note surfaced in the timeline editor; ignored at runtime. */
  note: z.string().optional(),
});

/* ------------------------------------------------------------------ *
 * Basic interactions
 * ------------------------------------------------------------------ */

export const ClickEffect = BaseEffect.extend({
  action: z.literal("click"),
  frameId: z.string(),
  /** Show an expanding ripple at the click point. */
  showRipple: z.boolean().default(true),
  soundProfile: SoundProfile.optional(),
});
export type ClickEffect = z.infer<typeof ClickEffect>;

export const TypeDownEffect = BaseEffect.extend({
  action: z.literal("type-down"),
  frameId: z.string(),
  text: z.string(),
  /** Milliseconds per character. Lower = faster. */
  typingSpeed: z.number().min(0).default(55),
  /** Simulate a human typo + correction for realism. */
  mistakes: z.boolean().default(false),
  soundProfile: SoundProfile.optional(),
});
export type TypeDownEffect = z.infer<typeof TypeDownEffect>;

/* ------------------------------------------------------------------ *
 * Complex interactions
 * ------------------------------------------------------------------ */

export const DragAndDropEffect = BaseEffect.extend({
  action: z.literal("drag-and-drop"),
  frameId: z.string(),
  /** Preferred: drop onto another frame (resolution-independent). */
  destFrameId: z.string().optional(),
  /** Fallback: absolute drop coordinates. */
  destX: z.number().optional(),
  destY: z.number().optional(),
  duration: z.number().min(0).default(800),
  easing: EasingPattern.default("ease-in-out"),
  soundProfile: SoundProfile.optional(),
});
export type DragAndDropEffect = z.infer<typeof DragAndDropEffect>;

export const ShakeEffect = BaseEffect.extend({
  action: z.literal("shake"),
  frameId: z.string(),
  /** Displacement magnitude. */
  intensity: z.enum(["low", "medium", "high"]).default("medium"),
  duration: z.number().min(0).default(500),
  soundProfile: SoundProfile.optional(),
});
export type ShakeEffect = z.infer<typeof ShakeEffect>;

/* ------------------------------------------------------------------ *
 * Camera & navigation (cinematography)
 * ------------------------------------------------------------------ */

export const ZoomInEffect = BaseEffect.extend({
  action: z.literal("zoom-in"),
  /** Optional anchor frame; when set the zoom centers on it. */
  scale: z.number().positive().default(1.4),
  duration: z.number().min(0).default(1200),
  easing: EasingPattern.default("ease-out"),
  transformOrigin: TransformOrigin.default("center"),
  soundProfile: SoundProfile.optional(),
});
export type ZoomInEffect = z.infer<typeof ZoomInEffect>;

export const ZoomOutEffect = BaseEffect.extend({
  action: z.literal("zoom-out"),
  duration: z.number().min(0).default(900),
  easing: EasingPattern.default("ease-in-out"),
  soundProfile: SoundProfile.optional(),
});
export type ZoomOutEffect = z.infer<typeof ZoomOutEffect>;

const scrollFields = {
  /** Pixels to travel, or `"viewport"` for one full screen. */
  distance: z.union([z.number(), z.literal("viewport")]).default("viewport"),
  duration: z.number().min(0).default(700),
  easing: EasingPattern.default("ease-in-out"),
  soundProfile: SoundProfile.optional(),
};

export const ScrollUpEffect = BaseEffect.extend({
  action: z.literal("scroll-up"),
  ...scrollFields,
});
export type ScrollUpEffect = z.infer<typeof ScrollUpEffect>;

export const ScrollDownEffect = BaseEffect.extend({
  action: z.literal("scroll-down"),
  ...scrollFields,
});
export type ScrollDownEffect = z.infer<typeof ScrollDownEffect>;

export const CursorMoveEffect = BaseEffect.extend({
  action: z.literal("cursor-move"),
  /** Preferred: move toward a frame (resolution-independent). */
  destFrameId: z.string().optional(),
  destX: z.number().optional(),
  destY: z.number().optional(),
  duration: z.number().min(0).default(700),
  /** Path shape — `bezier`/`arc` look human, `linear` looks robotic. */
  curve: CursorCurve.default("bezier"),
  easing: EasingPattern.default("ease-in-out"),
  soundProfile: SoundProfile.optional(),
});
export type CursorMoveEffect = z.infer<typeof CursorMoveEffect>;

export const HighlightEffect = BaseEffect.extend({
  action: z.literal("highlight"),
  frameId: z.string(),
  duration: z.number().min(0).default(1500),
  /** Opacity of the dimming backdrop (0–1). */
  dimOpacity: z.number().min(0).max(1).default(0.6),
  /** Padding (px) of the spotlight cutout around the frame. */
  padding: z.number().min(0).default(8),
  soundProfile: SoundProfile.optional(),
});
export type HighlightEffect = z.infer<typeof HighlightEffect>;

export const WaitEffect = BaseEffect.extend({
  action: z.literal("wait"),
  duration: z.number().min(0).default(1000),
});
export type WaitEffect = z.infer<typeof WaitEffect>;

/* ------------------------------------------------------------------ *
 * The discriminated union
 * ------------------------------------------------------------------ */

export const Effect = z.discriminatedUnion("action", [
  ClickEffect,
  TypeDownEffect,
  DragAndDropEffect,
  ShakeEffect,
  ZoomInEffect,
  ZoomOutEffect,
  ScrollUpEffect,
  ScrollDownEffect,
  CursorMoveEffect,
  HighlightEffect,
  WaitEffect,
]);
export type Effect = z.infer<typeof Effect>;

export const EFFECT_ACTIONS = [
  "click",
  "type-down",
  "drag-and-drop",
  "shake",
  "zoom-in",
  "zoom-out",
  "scroll-up",
  "scroll-down",
  "cursor-move",
  "highlight",
  "wait",
] as const;
export type EffectAction = (typeof EFFECT_ACTIONS)[number];

/** Narrow the union to a single effect by its action literal. */
export type EffectOfAction<A extends EffectAction> = Extract<Effect, { action: A }>;
