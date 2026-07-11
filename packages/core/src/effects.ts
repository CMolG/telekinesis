import { planTyping, type DragAndDropEffect, type Effect, type SoundProfile } from "@telekinesis/schema";
import type { GhostCursor } from "./cursor";
import { cssEasing, jsEasing } from "./easing";
import { rectCenter, viewportAnchor, type Point } from "./geometry";
import type { Overlay } from "./overlay";
import { getFrameElement, getFrameRect } from "./registry";
import { animate, sleep } from "./timing";

export interface RunContext {
  /**
   * `self`  — also drive the real interaction (click/type) so a live in-browser
   *           preview actually changes the app.
   * `external` — visuals only; Playwright performs the real I/O during a recording.
   */
  mode: "self" | "external";
  cursor: GhostCursor;
  overlay: Overlay;
  /** Record a sound event (and, in self mode, play it). */
  mark: (profile: SoundProfile) => void;
  signal?: AbortSignal;
}

/** Run a single, already-defaulted effect. */
export async function runEffect(effect: Effect, ctx: RunContext): Promise<void> {
  const { cursor, overlay, signal } = ctx;

  switch (effect.action) {
    case "wait": {
      await sleep(effect.duration, signal);
      return;
    }

    case "cursor-move": {
      const target = destPoint(effect);
      if (!target) return;
      await cursor.moveTo(target, {
        duration: effect.duration,
        curve: effect.curve,
        easing: effect.easing,
        signal,
      });
      if (effect.soundProfile) ctx.mark(effect.soundProfile);
      return;
    }

    case "click": {
      const el = getFrameElement(effect.frameId);
      const rect = el?.getBoundingClientRect();
      const point = rect ? rectCenter(rect) : cursor.pos;
      await cursor.moveTo(point, { duration: 180, easing: "ease-out", signal });
      await cursor.pressPulse(signal);
      if (effect.showRipple) await overlay.ripple(point, signal);
      if (effect.soundProfile) ctx.mark(effect.soundProfile);
      if (ctx.mode === "self" && el) clickTargetWithin(el).click();
      return;
    }

    case "type-down": {
      // In a recording, Playwright types for real; the engine times the sound.
      if (ctx.mode === "external") return;
      const field = resolveEditable(effect.frameId);
      if (!field) return;
      field.focus();
      await typeInto(field, effect.text, effect.typingSpeed, effect.mistakes, () => {
        if (effect.soundProfile) ctx.mark(effect.soundProfile);
      }, signal);
      return;
    }

    case "drag-and-drop": {
      const from = await dragApproach(effect, ctx);
      await dragGlide(effect, from, ctx);
      return;
    }

    case "zoom-in": {
      const rect = effect.frameId ? getFrameRect(effect.frameId) : null;
      const focus = rect ? rectCenter(rect) : viewportAnchor(effect.transformOrigin);
      await overlay.zoom(focus, effect.scale, effect.duration, effect.easing, signal);
      if (effect.soundProfile) ctx.mark(effect.soundProfile);
      return;
    }

    case "zoom-out": {
      await overlay.resetZoom(effect.duration, effect.easing, signal);
      if (effect.soundProfile) ctx.mark(effect.soundProfile);
      return;
    }

    case "scroll-up":
    case "scroll-down": {
      const dir = effect.action === "scroll-up" ? -1 : 1;
      const amount =
        effect.distance === "viewport" ? window.innerHeight * 0.9 : effect.distance;
      await smoothScroll(dir * amount, effect.duration, effect.easing, signal);
      if (effect.soundProfile) ctx.mark(effect.soundProfile);
      return;
    }

    case "shake": {
      const el = getFrameElement(effect.frameId);
      if (el) await overlay.shake(el, effect.intensity, effect.duration, signal);
      if (effect.soundProfile) ctx.mark(effect.soundProfile);
      return;
    }

    case "highlight": {
      const rect = getFrameRect(effect.frameId);
      if (rect) {
        await overlay.highlight(rect, {
          dimOpacity: effect.dimOpacity,
          padding: effect.padding,
          duration: effect.duration,
          signal,
        });
      }
      if (effect.soundProfile) ctx.mark(effect.soundProfile);
      return;
    }

    default: {
      // Exhaustiveness guard: a new action without a handler fails the build.
      const _exhaustive: never = effect;
      void _exhaustive;
    }
  }
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/**
 * Resolve a `destFrameId`/`destX`+`destY` pair to a viewport point. Exported
 * (in addition to being used by `runEffect` above) so `seek.ts` can compute
 * the same "where does this effect leave the cursor" answer without
 * duplicating the frame/coordinate fallback logic.
 */
export function destPoint(e: {
  destFrameId?: string;
  destX?: number;
  destY?: number;
}): Point | null {
  if (e.destFrameId) {
    const r = getFrameRect(e.destFrameId);
    if (r) return rectCenter(r);
  }
  if (typeof e.destX === "number" && typeof e.destY === "number") {
    return { x: e.destX, y: e.destY };
  }
  return null;
}

/**
 * Where a `drag-and-drop`'s ghost cursor starts: the source frame's live
 * center, or the cursor's current position if the frame can't be found (same
 * graceful-miss fallback every other effect uses).
 */
function dragSourcePoint(effect: DragAndDropEffect, cursor: GhostCursor): Point {
  const fromEl = getFrameElement(effect.frameId);
  const fromRect = fromEl?.getBoundingClientRect();
  return fromRect ? rectCenter(fromRect) : cursor.pos;
}

/**
 * `drag-and-drop`'s visual, phase 1 ("pick up"): the ghost cursor travels to
 * the source and does a brief press-pulse. Resolves with the source point so
 * a caller that needs it (phase 2, `dragGlide`, below) doesn't have to
 * re-measure a possibly-stale rect.
 *
 * Split out from phase 2 so a recording (`packages/engine/src/record.ts`)
 * can await this short leg alone, then start the real pointer drag *and*
 * fire phase 2 at the same time — instead of the previous choreography,
 * which awaited the *whole* two-leg visual (source approach + destination
 * glide) before ever touching the real pointer, leaving the dragged element
 * to snap into place well after the ghost cursor had already finished
 * traveling. `runEffect`'s own "drag-and-drop" case below still runs both
 * legs back-to-back for every other caller (self-mode live preview, Studio
 * playback, or a bare external `runEffect` call like `effects.spec.ts`
 * makes) — this split doesn't change their behavior at all.
 */
export async function dragApproach(effect: DragAndDropEffect, ctx: RunContext): Promise<Point> {
  const from = dragSourcePoint(effect, ctx.cursor);
  await ctx.cursor.moveTo(from, { duration: 200, easing: "ease-out", signal: ctx.signal });
  await ctx.cursor.pressPulse(ctx.signal);
  return from;
}

/**
 * `drag-and-drop`'s visual, phase 2 ("carry"): the ghost cursor glides from
 * `from` (phase 1's resolved source point) to the destination over
 * `effect.duration`. In self mode this is also what moves the dragged
 * element itself — a CSS transform, since nothing else is driving real
 * input; in external mode the caller is expected to be performing the real
 * drag concurrently with this call (see `dragApproach`'s doc comment above),
 * so only the cursor is driven here.
 */
export async function dragGlide(
  effect: DragAndDropEffect,
  from: Point,
  ctx: RunContext,
): Promise<void> {
  const { cursor, signal } = ctx;
  const to = destPoint(effect) ?? from;
  if (ctx.mode === "self") {
    const fromEl = getFrameElement(effect.frameId);
    if (fromEl) {
      fromEl.style.transition = `transform ${effect.duration}ms ${cssEasing[effect.easing]}`;
      fromEl.style.transform = `translate(${to.x - from.x}px, ${to.y - from.y}px)`;
    }
  }
  await cursor.moveTo(to, { duration: effect.duration, easing: effect.easing, signal });
  if (effect.soundProfile) ctx.mark(effect.soundProfile);
}

/**
 * A `<TelekineticFrame>` renders a wrapper around the real control, so a
 * self-mode click must reach the interactive element inside it. `.click()`
 * dispatches a bubbling click that React's onClick handlers receive.
 */
function clickTargetWithin(el: HTMLElement): HTMLElement {
  if (el.matches("button, a, input, select, textarea, [role='button']")) return el;
  return (
    el.querySelector<HTMLElement>(
      "button, a, input, select, textarea, [role='button']",
    ) ?? el
  );
}

function resolveEditable(frameId: string): HTMLElement | null {
  const el = getFrameElement(frameId);
  if (!el) return null;
  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el.isContentEditable
  ) {
    return el;
  }
  return el.querySelector<HTMLElement>(
    "input, textarea, [contenteditable='true'], [contenteditable='']",
  );
}

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  // Notify React's synthetic onChange.
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

async function typeInto(
  el: HTMLElement,
  text: string,
  speed: number,
  mistakes: boolean,
  onChar: (ch: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const isField =
    el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
  const read = () => (isField ? (el as HTMLInputElement).value : el.textContent ?? "");
  const write = (v: string) => {
    if (isField) setNativeValue(el as HTMLInputElement, v);
    else el.textContent = v;
  };

  let current = read();
  // `startNonEmpty` preserves the original behavior exactly: a typo could
  // already be planned on the very first character typed here if the field
  // came in non-empty (see planTyping's doc comment).
  const steps = planTyping(text, mistakes, { startNonEmpty: current.length > 0 });
  for (const step of steps) {
    if (signal?.aborted) return;
    if (step.typo) {
      write(current + step.typo);
      onChar("x");
      await sleep(speed, signal);
      write(current); // backspace the typo
      await sleep(speed, signal);
    }
    current += step.char;
    write(current);
    onChar(step.char);
    await sleep(speed, signal);
  }
}

async function smoothScroll(
  delta: number,
  duration: number,
  easing: keyof typeof jsEasing,
  signal?: AbortSignal,
): Promise<void> {
  const startY = window.scrollY;
  const ease = jsEasing[easing];
  await animate(duration, ease, (t) => window.scrollTo(0, startY + delta * t), signal);
}
