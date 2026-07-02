import {
  itemsStartedBy,
  layoutTimesheet,
  parseTimesheet,
  type Effect,
  type Timesheet,
  type TimesheetInput,
} from "@telekinesis/schema";
import { destPoint } from "./effects";
import { rectCenter, viewportAnchor } from "./geometry";
import { getFrameElement, getFrameRect } from "./registry";
import { getCursor, type GhostCursor } from "./cursor";
import { getOverlay, type Overlay } from "./overlay";

/**
 * `Overlay.zoom`'s `"spring"` easing drives a real physically-integrated
 * spring (`Camera.zoomTo` → `animateToSpring`) that settles over real rAF
 * frames and, by design, ignores `duration` entirely — there is no
 * "duration 0" fast path for a spring the way `animate()` has one for every
 * other curve. Seeking must always be instant regardless of an effect's
 * authored easing, so camera moves below deliberately request this fixed
 * curve (with `duration: 0`) instead of forwarding `effect.easing` — only
 * the *destination* state matters here, never the path taken to it.
 */
const INSTANT_EASING = "linear";

/**
 * Studio scrubbing — "jump to time `t` without rendering".
 *
 * `runEffect` (effects.ts) plays one effect's full animation, and `play`
 * (player.ts) performs a whole timesheet in real time. Neither can jump *into*
 * the middle of a timeline: a playhead drag needs the visual state at an
 * arbitrary `t` to appear instantly, not after replaying every prior effect's
 * real-time animation (a handful of `highlight`/`ripple` clips alone would
 * cost seconds per scrub step).
 *
 * Fidelity trade-off (chosen deliberately, not a shortcut we forgot to fix):
 * `seekTo` reconstructs only the *persistent* visual state — ghost-cursor
 * position, camera zoom/pan, scroll offset — by instantly (zero-duration)
 * re-applying every effect whose clip has started by `t`, per
 * `layoutTimesheet`'s offsets (`itemsStartedBy`). Momentary flourishes
 * (spotlight dim/fade, ripple, shake, press-pulse) are skipped entirely —
 * they animate-then-vanish, so replaying them contributes nothing to "what
 * does the screen look like right now" and would only make scrubbing feel
 * laggy (`highlight`'s fade-out alone blocks ~300ms). `type-down` and a
 * `click`'s *real* activation are skipped too: both only mutate the target's
 * real DOM in `self` mode during live playback, and re-running them on every
 * scrub tick would risk double-submitting forms or re-typing text. This is a
 * scrub preview, not a frame-accurate video seek — two timesheets that reach
 * "cursor at X, zoomed 1.4x" by different paths render identically here even
 * if their journeys differed. Good enough to review a cut without paying for
 * a render; not a substitute for one.
 */
export function seekTo(sheet: Timesheet | TimesheetInput, t: number): void {
  const parsed = parseTimesheet(sheet);
  const cursor = getCursor();
  const overlay = getOverlay();

  // Baseline: every seek replays from a fresh page state (top of scroll, no
  // zoom) — the same assumption `play()` makes at t=0. A real prior scroll
  // position on the target (from manual navigation) is intentionally not
  // preserved; see the fidelity note above.
  void overlay.resetZoom(0, INSTANT_EASING);
  window.scrollTo(0, 0);
  cursor.show();

  for (const { effect } of itemsStartedBy(layoutTimesheet(parsed), t)) {
    applyPersistent(effect, cursor, overlay);
  }
}

/** Instantly apply the *lasting* visual contribution of one effect, if any. */
function applyPersistent(effect: Effect, cursor: GhostCursor, overlay: Overlay): void {
  switch (effect.action) {
    case "cursor-move": {
      const target = destPoint(effect);
      if (target) cursor.place(target);
      return;
    }
    case "click": {
      const el = getFrameElement(effect.frameId);
      const rect = el?.getBoundingClientRect();
      if (rect) cursor.place(rectCenter(rect));
      return;
    }
    case "drag-and-drop": {
      const target = destPoint(effect);
      if (target) cursor.place(target);
      return;
    }
    case "zoom-in": {
      const rect = effect.frameId ? getFrameRect(effect.frameId) : null;
      const focus = rect ? rectCenter(rect) : viewportAnchor(effect.transformOrigin);
      void overlay.zoom(focus, effect.scale, 0, INSTANT_EASING);
      return;
    }
    case "zoom-out":
      void overlay.resetZoom(0, INSTANT_EASING);
      return;
    case "scroll-up":
    case "scroll-down": {
      const dir = effect.action === "scroll-up" ? -1 : 1;
      const amount = effect.distance === "viewport" ? window.innerHeight * 0.9 : effect.distance;
      window.scrollBy(0, dir * amount);
      return;
    }
    // `wait`, `type-down`, `highlight`, `shake` — no lasting visual state to
    // reconstruct (see the fidelity note on `seekTo`).
    default:
      return;
  }
}
