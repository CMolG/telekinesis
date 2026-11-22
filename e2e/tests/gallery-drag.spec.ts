import { expect, test } from "@playwright/test";
import { waitForRuntime } from "../helpers";

/**
 * Permanent regression guard for the gallery's one interactive pair,
 * `gal-drag-src` → `gal-drag-dest` (see playground/src/gallery/App.tsx's
 * DragDemo doc comment). Drives the drag exactly the way
 * `packages/engine/src/record.ts` drives a `drag-and-drop` effect that has a
 * `destFrameId` — `Locator.dragTo(dest, { force: true })` — which dispatches
 * real low-level mouse input that Chromium turns into genuine Pointer Events,
 * the mechanism DragDemo depends on (a native HTML5 `draggable` never fires
 * for a Playwright-driven drag; see that same doc comment).
 *
 * This guards a real regression: the settle math in `endDrag` (App.tsx)
 * measures the dropzone's rect *after* the drop, but until fixed, unmounting
 * the "Drop here" label on drop collapsed that very rect's shrink-to-fit box
 * (~90.66×49 → ~24×32), so the chip settled centered on a box that no longer
 * existed by the time the frame painted — a ~33px miss. A screenshot diff
 * wouldn't reliably catch that at gallery scale; measuring both rects does.
 */
test("drag-and-drop: the chip settles centered on the dropzone, which is marked filled", async ({
  page,
}) => {
  await page.goto("/gallery.html?demo");
  await waitForRuntime(page);

  const chipFrame = page.locator('[data-telekinesis-id="gal-drag-src"]');
  const dropFrame = page.locator('[data-telekinesis-id="gal-drag-dest"]');
  const chip = page.locator('[data-telekinesis-id="gal-drag-src"] .gallery-chip');
  const dropzone = page.locator('[data-telekinesis-id="gal-drag-dest"] .gallery-dropzone');

  // Drag by frame id, not by the inner chip/dropzone class — that's the
  // stable contract a real timesheet targets (record.ts's frameLocator),
  // and matches eff.frameId/eff.destFrameId in
  // examples/gallery/drag-and-drop.timesheet.json.
  await chipFrame.dragTo(dropFrame, { force: true });

  await expect(dropzone).toHaveClass(/\bfilled\b/);

  // The settle snap is CSS-transitioned (`.gallery-chip`'s 220ms `transform`
  // transition, styles.css), not an instant style write — give it time to
  // finish before reading boundingBox(), or this measures a mid-transition
  // position instead of the resting one.
  await page.waitForTimeout(400);

  const [chipBox, dropBox] = await Promise.all([chip.boundingBox(), dropzone.boundingBox()]);
  if (!chipBox || !dropBox) {
    throw new Error("expected both the chip and the dropzone to have a layout box after the drop");
  }
  const chipCenter = { x: chipBox.x + chipBox.width / 2, y: chipBox.y + chipBox.height / 2 };
  const dropCenter = { x: dropBox.x + dropBox.width / 2, y: dropBox.y + dropBox.height / 2 };

  // ±3px: endDrag's settle math computes an *exact* delta between the two
  // rects at drop time (getBoundingClientRect, same tick), so real drift
  // should be ~0 — this only covers subpixel rounding across two independent
  // boundingBox() reads, not a real tolerance band. (This was off by ~33px
  // before the dropzone-collapse fix, so 3px comfortably distinguishes
  // "fixed" from "regressed".)
  expect(Math.abs(chipCenter.x - dropCenter.x)).toBeLessThanOrEqual(3);
  expect(Math.abs(chipCenter.y - dropCenter.y)).toBeLessThanOrEqual(3);
});
