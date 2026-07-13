import { expect, test, type Page } from "@playwright/test";
import { layoutTimesheet, parseTimesheet, type Effect, type TimesheetInput } from "@telekinesis/schema";
import { waitForRuntime } from "../helpers";

// One test per row of the effects invariants table (Plan 5, Task 3 —
// docs/superpowers/plans/2026-07-06-05-qa-suite-gif-gallery-readme.md). Each
// spec asserts something observably true of the DOM/runtime state after (or,
// for highlight/shake, *during*) exactly one effect — not a screenshot, not a
// pixel diff, just the contract `@telekinesis/core` (`effects.ts`, `player.ts`,
// `overlay.ts`, `cursor.ts`, `camera.ts`) actually promises for that action.
// Every test is self-contained: fresh page, `waitForRuntime`, act, assert.

/** A timeline entry as authored, before Zod fills in defaults. */
type RawEffect = TimesheetInput["timeline"][number];

/**
 * Apply the schema's defaults to a single effect, Node-side, so specs never
 * hand-copy a default from `packages/schema/src/effects.ts` (they'd silently
 * rot the moment the schema changes). Deliberately routed through
 * `parseTimesheet` rather than the schema's standalone `Effect.parse` (which
 * would apply the same defaults): only `Timesheet` runs the cross-field
 * refinement — e.g. a `cursor-move` with no destination passes bare `Effect`
 * parsing but correctly throws here — so a typo'd fixture fails loudly in the
 * spec instead of silently becoming a no-op effect in the browser.
 */
function defaultEffect(raw: RawEffect): Effect {
  return parseTimesheet({ timeline: [raw] }).timeline[0];
}

/**
 * Default `raw`, hand it to the real `window.__telekinesis.runEffect` (mode
 * "external" — visuals only, the same call a Playwright recording makes; see
 * `packages/core/src/runtime.ts` and `packages/engine/src/record.ts`'s
 * `runVisual`), and resolve with how long it took in milliseconds. Timed with
 * `performance.now()` *inside* the page rather than around the
 * `page.evaluate` call, so the number reflects the effect's own animation,
 * not the Node↔browser CDP round trip.
 */
async function runEffect(page: Page, raw: RawEffect): Promise<number> {
  const effect = defaultEffect(raw);
  return page.evaluate(async (eff) => {
    const start = performance.now();
    await window.__telekinesis.runEffect(eff);
    return performance.now() - start;
  }, effect);
}

/** Parse the ghost cursor's `translate(Xpx, Ypx)` inline transform — see
 * `GhostCursor.place` in `packages/core/src/cursor.ts`. */
async function cursorPosition(page: Page): Promise<{ x: number; y: number }> {
  return page.evaluate(() => {
    const el = document.querySelector<HTMLElement>(".telekinesis-cursor");
    const match = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(el?.style.transform ?? "");
    if (!match) throw new Error("ghost cursor has no translate() transform");
    return { x: parseFloat(match[1]), y: parseFloat(match[2]) };
  });
}

/** Center of a registered frame's rect, read through the real `getRect` API
 * (not a hand-rolled `getBoundingClientRect` in the spec) so this stays the
 * same "center" the runtime itself targets — see `rectCenter` in
 * `packages/core/src/geometry.ts`. */
async function frameCenter(page: Page, frameId: string): Promise<{ x: number; y: number }> {
  return page.evaluate((id) => {
    const r = window.__telekinesis.getRect(id);
    if (!r) throw new Error(`no registered frame: ${id}`);
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, frameId);
}

/**
 * `GhostCursor.moveTo` (cursor.ts) always finishes with an exact
 * `place(target)` snap — with or without the micro-overshoot settle phase,
 * the final write sets the transform to the literal target coordinates. So
 * real drift here should be ~0px; this tolerance (as specified by the plan)
 * is a generous safety margin against `getBoundingClientRect` subpixel
 * rounding, not a measured error band.
 */
const CURSOR_SETTLE_TOLERANCE_PX = 8;

function expectNear(
  actual: { x: number; y: number },
  expected: { x: number; y: number },
  tolerancePx: number,
): void {
  expect(Math.abs(actual.x - expected.x)).toBeLessThanOrEqual(tolerancePx);
  expect(Math.abs(actual.y - expected.y)).toBeLessThanOrEqual(tolerancePx);
}

test("cursor-move: the ghost cursor settles on the destination frame's center", async ({ page }) => {
  await page.goto("/?demo");
  await waitForRuntime(page);

  // tier-pro-cta sits far enough from the cursor's initial position (viewport
  // center-ish — see GhostCursor's constructor) to clear
  // MIN_OVERSHOOT_TRAVEL_PX, so this also exercises the overshoot+settle
  // spring path ("tras settle" in the plan), not just a direct tween.
  await runEffect(page, { action: "cursor-move", destFrameId: "tier-pro-cta", duration: 300 });

  const [pos, center] = await Promise.all([cursorPosition(page), frameCenter(page, "tier-pro-cta")]);
  expectNear(pos, center, CURSOR_SETTLE_TOLERANCE_PX);
});

test("click: the ghost cursor ends up over the target frame", async ({ page }) => {
  await page.goto("/?demo");
  await waitForRuntime(page);

  // showRipple defaults to true and its ring animation runs ~770ms after the
  // click lands (see overlay.ts's RIPPLE_RINGS) — irrelevant to *this*
  // invariant (cursor position only), so it's turned off to keep the test
  // fast. The playground has no click counter/state exposed to the DOM, so
  // per the plan's own fallback ("si no, basta el cursor") the cursor
  // position is the whole invariant.
  await runEffect(page, { action: "click", frameId: "login", showRipple: false });

  const [pos, center] = await Promise.all([cursorPosition(page), frameCenter(page, "login")]);
  expectNear(pos, center, CURSOR_SETTLE_TOLERANCE_PX);
});

test("zoom-in: body transform reflects the requested scale", async ({ page }) => {
  await page.goto("/?demo");
  await waitForRuntime(page);

  await runEffect(page, { action: "zoom-in", scale: 1.4, duration: 150, easing: "ease-out" });

  const transform = await page.evaluate(() => document.body.style.transform);
  const match = /matrix\(([-\d.]+),/.exec(transform);
  expect(match).not.toBeNull();
  // Camera.animateToEased (camera.ts) snaps `this.state = target` exactly
  // once the eased animation resolves, so drift should be ~0; ±0.01 only
  // guards against float-to-string formatting, not a real tolerance band.
  expect(Math.abs(parseFloat(match![1]) - 1.4)).toBeLessThanOrEqual(0.01);
});

test("zoom-out: body transform returns to identity after a prior zoom-in", async ({ page }) => {
  await page.goto("/?demo");
  await waitForRuntime(page);

  await runEffect(page, { action: "zoom-in", scale: 1.3, duration: 120 });
  await runEffect(page, { action: "zoom-out", duration: 120 });

  // Camera.writeTransform special-cases scale===1 && tx===0 && ty===0 to the
  // empty string rather than "matrix(1,0,0,1,0,0)" — assert the exact value,
  // not just "no scale left over".
  expect(await page.evaluate(() => document.body.style.transform)).toBe("");
});

test("scroll-down / scroll-up: window.scrollY moves by the requested distance", async ({ page }) => {
  await page.goto("/?demo");
  await waitForRuntime(page);

  // Guarantee scroll headroom regardless of the playground's actual content
  // height (which can change independently of this spec) so a 400px scroll
  // is never silently clamped by the bottom of the document.
  await page.evaluate(() => {
    document.body.style.paddingBottom = "1200px";
  });

  const top = await page.evaluate(() => window.scrollY);
  await runEffect(page, { action: "scroll-down", distance: 400, duration: 150 });
  const afterDown = await page.evaluate(() => window.scrollY);
  // ±20px: smoothScroll (effects.ts) drives window.scrollTo from a rAF loop
  // whose easing is exact at t=1 (see jsEasing doc comment), so the target is
  // reached essentially exactly — this is generous slack for subpixel/device
  // rounding, not a hidden miscalculation.
  expect(Math.abs(afterDown - top - 400)).toBeLessThanOrEqual(20);

  await runEffect(page, { action: "scroll-up", distance: 400, duration: 150 });
  const afterUp = await page.evaluate(() => window.scrollY);
  expect(Math.abs(afterUp - afterDown + 400)).toBeLessThanOrEqual(20);
});

test("highlight: a spotlight node with a box-shadow exists while the effect runs", async ({ page }) => {
  await page.goto("/?demo");
  await waitForRuntime(page);

  const duration = 800; // per the plan's table row for this effect.
  const effect = defaultEffect({ action: "highlight", frameId: "tier-pro", duration });

  // Probe mid-flight instead of after resolution: `runEffect` for highlight
  // resolves once the pop-in + "breathe" hold finishes, but the spotlight
  // then lingers for a further HIGHLIGHT_GRACE_MS (2.2s, overlay.ts) before
  // it even starts fading. Asserting *presence* only holds during the active
  // phase; asserting the eventual removal would cost this test ~2.5s for no
  // extra coverage of the invariant under test — closing the page at the end
  // of the test discards the still-running timers, same as a user closing a
  // tab mid-clip.
  const visibleMidway = await page.evaluate(
    async ({ eff, probeDelayMs }) => {
      const done = window.__telekinesis.runEffect(eff);
      await Promise.race([done, new Promise((resolve) => setTimeout(resolve, probeDelayMs))]);
      const layer = document.getElementById("telekinesis-layer");
      // Deliberately not awaiting `done` here — see the comment above.
      return layer
        ? [...layer.children].some((n) => (n as HTMLElement).style.boxShadow !== "")
        : false;
    },
    { eff: effect, probeDelayMs: duration / 2 },
  );

  expect(visibleMidway).toBe(true);
});

test("shake: the frame's transform mutates during the effect and restores exactly after", async ({
  page,
}) => {
  await page.goto("/?demo");
  await waitForRuntime(page);

  const frameSelector = '[data-telekinesis-id="password"]';
  const duration = 400;
  const effect = defaultEffect({ action: "shake", frameId: "password", intensity: "high", duration });

  const before = await page.evaluate(
    (sel) => document.querySelector<HTMLElement>(sel)?.style.transform ?? "",
    frameSelector,
  );

  // Same mid-flight race as the highlight test above, but here `done` *is*
  // awaited before returning: unlike highlight, this invariant also needs
  // the post-completion (restored) state, which Overlay.shake only writes in
  // a `finally` once the whole animation resolves (overlay.ts).
  const during = await page.evaluate(
    async ({ eff, sel, probeDelayMs }) => {
      const done = window.__telekinesis.runEffect(eff);
      await Promise.race([done, new Promise((resolve) => setTimeout(resolve, probeDelayMs))]);
      const mid = document.querySelector<HTMLElement>(sel)?.style.transform ?? "";
      await done;
      return mid;
    },
    { eff: effect, sel: frameSelector, probeDelayMs: duration / 2 },
  );

  const after = await page.evaluate(
    (sel) => document.querySelector<HTMLElement>(sel)?.style.transform ?? "",
    frameSelector,
  );

  expect(during).toContain("translateX");
  expect(after).toBe(before);
});

test("type-down: self-mode play sets the field's value and marks one sound per character", async ({
  page,
}) => {
  await page.goto("/?demo");
  await waitForRuntime(page);

  const text = "ada@example.dev";
  // `runEffect` always drives in "external" mode (runtime.ts) — a type-down
  // there is a deliberate no-op ("Playwright types for real; the engine
  // times the sound", effects.ts) — so this row needs `play`, whose default
  // mode is "self", to actually drive the input.
  const marks = await page.evaluate(
    (typedText) =>
      window.__telekinesis.play(
        {
          timeline: [
            {
              action: "type-down",
              frameId: "email",
              text: typedText,
              typingSpeed: 20,
              soundProfile: "mechanical-keyboard",
            },
          ],
        },
        { mode: "self", sound: false },
      ),
    text,
  );

  const value = await page.evaluate(
    () => document.querySelector<HTMLInputElement>('[data-telekinesis-id="email"] input')?.value,
  );
  expect(value).toBe(text);
  // mistakes defaults to false, so `typeInto` (effects.ts) fires `onChar`
  // (and therefore one `ctx.mark`) exactly once per character, no extras.
  expect(marks).toHaveLength([...text].length);
});

test("drag-and-drop: the ghost cursor ends at the destination frame", async ({ page }) => {
  await page.goto("/?demo");
  await waitForRuntime(page);

  // No dedicated drag-source/target pair exists in the playground yet (that
  // lands with the gallery page in a later task); any two frames work here
  // since only the cursor's resting position is under test.
  await runEffect(page, {
    action: "drag-and-drop",
    frameId: "tier-pro",
    destFrameId: "pricing",
    duration: 250,
  });

  const [pos, center] = await Promise.all([cursorPosition(page), frameCenter(page, "pricing")]);
  expectNear(pos, center, CURSOR_SETTLE_TOLERANCE_PX);
});

/**
 * Regression guard for the `approximateSpring` wiring (`MoveOptions`,
 * `packages/core/src/cursor.ts`) that closes the spring-drag lockstep gap
 * documented on `curveForEasing` in `@telekinesis/schema`'s easing.ts:
 * `dragGlide` (core's effects.ts) now always passes `approximateSpring: true`
 * to `GhostCursor.moveTo`, so a `spring`-eased drag's carry resolves through
 * the fixed-duration `curveForEasing` approximation instead of branching to
 * `flySpring`. This only re-asserts the same settle invariant as the test
 * above (this doesn't/can't observe Playwright's real pointer here — that
 * lockstep is exercised by the recorder, not a bare `runEffect` call) —
 * enough to catch the `approximateSpring` flag being dropped, miswired, or
 * throwing, which would otherwise sit dormant until someone authored a
 * `spring`-eased drag timesheet.
 */
test("drag-and-drop: a spring-eased carry still settles on the destination frame", async ({
  page,
}) => {
  await page.goto("/?demo");
  await waitForRuntime(page);

  await runEffect(page, {
    action: "drag-and-drop",
    frameId: "tier-pro",
    destFrameId: "pricing",
    duration: 250,
    easing: "spring",
  });

  const [pos, center] = await Promise.all([cursorPosition(page), frameCenter(page, "pricing")]);
  expectNear(pos, center, CURSOR_SETTLE_TOLERANCE_PX);
});

test("wait: runEffect takes at least the requested duration, without excessive overrun", async ({
  page,
}) => {
  await page.goto("/?demo");
  await waitForRuntime(page);

  const elapsed = await runEffect(page, { action: "wait", duration: 600 });

  expect(elapsed).toBeGreaterThanOrEqual(600);
  // Wide upper bound on purpose: this only needs to catch a *broken* wait
  // (e.g. a no-op or an early resolve), not measure timer precision — a
  // shared CI/dev machine can stall a setTimeout callback under load. 900ms
  // leaves 300ms (50%) of slack above the nominal duration.
  expect(elapsed).toBeLessThan(900);
});

test("durations: total wall-clock time tracks layoutTimesheet's estimate across effects with delays", async ({
  page,
}) => {
  await page.goto("/?demo");
  await waitForRuntime(page);

  // wait/zoom-in/zoom-out all resolve their real animation in exactly their
  // `duration` — no cursor-style overshoot/settle phase to inflate them
  // (contrast cursor.ts's moveTo) — so estimate and actual should track
  // closely. click/type-down/drag-and-drop are deliberately excluded here:
  // their *actual* execution time includes fixed overhead
  // `estimateEffectDuration` (layout.ts) doesn't model (click's ripple
  // ~770ms; drag's two extra moveTo/pressPulse legs), which would make this
  // assertion about `layoutTimesheet`'s fidelity rather than about `play`'s
  // timing.
  const timeline: RawEffect[] = [
    { action: "wait", duration: 250 },
    { action: "zoom-in", scale: 1.15, duration: 350, easing: "ease-out", delayBefore: 100 },
    { action: "zoom-out", duration: 300, easing: "ease-in-out", delayAfter: 150 },
  ];
  const sheet = parseTimesheet({ timeline });
  const expectedMs = layoutTimesheet(sheet).totalMs;

  // sound: false — none of the three effects above ever call `ctx.mark`
  // (none set `soundProfile`), so this only avoids spinning up an
  // AudioContext for no reason; it doesn't change the timing being measured.
  const elapsed = await page.evaluate(async (s) => {
    const start = performance.now();
    await window.__telekinesis.play(s, { mode: "self", sound: false });
    return performance.now() - start;
  }, sheet);

  // ±15% (as specified by the plan): comfortably covers rAF frame
  // quantization and CI scheduling jitter on top of the near-exact tracking
  // described above, without being loose enough to hide a real regression
  // (e.g. an accidentally-doubled delay).
  expect(Math.abs(elapsed - expectedMs)).toBeLessThanOrEqual(expectedMs * 0.15);
});
