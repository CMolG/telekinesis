import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  parseTimesheet,
  planTyping,
  SOUND_PROFILES,
  type DragAndDropEffect,
  type Effect,
  type SoundProfile,
} from "@telekinesis/schema";
import { chromium, type Locator, type Page } from "playwright";

/** One sound event, located at `t` ms from the start of the recording. */
export interface AudioMark {
  profile: SoundProfile;
  asset: string;
  t: number;
}

export interface AudioMap {
  resolution: { width: number; height: number };
  durationMs: number;
  marks: AudioMark[];
}

export interface RecordOptions {
  /** URL to record. Falls back to `timesheet.url`. */
  url?: string;
  /** Working directory for the silent video + audio-map.json. */
  outDir: string;
  headless?: boolean;
  /** Capture video. Set false for a live preview (no file produced). */
  recordVideo?: boolean;
  /** How long to wait for `window.__telekinesis` to be ready (ms). */
  runtimeTimeout?: number;
  onStep?: (index: number, total: number, effect: Effect) => void;
  /**
   * Invoked with the live `Page` once the timeline has finished driving it,
   * after `durationMs` is captured but before the recording context (and
   * therefore the page) closes. Purely for post-run inspection/assertions —
   * e.g. reading a field's real DOM value — never for further recorded
   * interaction: by the time this runs, every mark in the returned
   * `audioMap` has already been collected and the video is already fully
   * choreographed, so nothing the hook does can retroactively change what
   * was recorded (it can, if capturing video, add a few extra static frames
   * to the tail while it runs). Additive/optional — existing callers are
   * unaffected. Used by the e2e suite to catch "the video looks fine but the
   * underlying state is wrong" regressions Playwright's own recording can't
   * otherwise see (e.g. a typo'd character that was never actually
   * corrected).
   */
  afterTimeline?: (page: Page) => void | Promise<void>;
}

export interface RecordResult {
  videoPath: string;
  audioMapPath: string;
  audioMap: AudioMap;
  resolution: { width: number; height: number };
  durationMs: number;
}

/**
 * Drive a page through a timesheet with Playwright, recording a **silent**
 * video and a timestamped audio map. Visuals (cursor/zoom/highlight) are run by
 * the in-page runtime; real interactions (click/type/drag) are performed by
 * Playwright. The CLI mixes the real audio afterwards with ffmpeg.
 */
export async function record(
  timesheetInput: unknown,
  opts: RecordOptions,
): Promise<RecordResult> {
  const sheet = parseTimesheet(timesheetInput);
  const url = opts.url ?? sheet.url;
  if (!url) {
    throw new Error("Telekinesis: no URL to record (pass `url` or set `timesheet.url`).");
  }

  await mkdir(opts.outDir, { recursive: true });

  const captureVideo = opts.recordVideo ?? true;
  const browser = await chromium.launch({ headless: opts.headless ?? true });
  try {
    const context = await browser.newContext({
      viewport: { width: sheet.resolution.width, height: sheet.resolution.height },
      deviceScaleFactor: 1,
      ...(captureVideo
        ? { recordVideo: { dir: opts.outDir, size: sheet.resolution } }
        : {}),
    });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "load" });

    // Wait for <TelekinesisStage> to install the runtime, then let layout settle.
    await page.waitForFunction(
      () => (window as unknown as { __telekinesis?: { ready?: boolean } }).__telekinesis?.ready === true,
      undefined,
      { timeout: opts.runtimeTimeout ?? 15_000 },
    );
    await page.evaluate(() =>
      (window as unknown as { __telekinesis: { showCursor(): void } }).__telekinesis.showCursor(),
    );
    await page.waitForTimeout(500);

    const marks: AudioMark[] = [];
    const start = Date.now();
    const mark = (profile?: SoundProfile) => {
      if (!profile) return;
      marks.push({ profile, asset: SOUND_PROFILES[profile].asset, t: Date.now() - start });
    };

    for (let i = 0; i < sheet.timeline.length; i++) {
      const eff = sheet.timeline[i];
      opts.onStep?.(i, sheet.timeline.length, eff);
      if (eff.delayBefore) await page.waitForTimeout(eff.delayBefore);
      await runEffectOnPage(page, eff, mark);
      if (eff.delayAfter) await page.waitForTimeout(eff.delayAfter);
    }

    const durationMs = Date.now() - start;

    // The timeline is done and every mark above is already collected, but
    // the page/context are still alive — give the caller a chance to inspect
    // final in-page state before everything is torn down. See the doc
    // comment on `RecordOptions.afterTimeline`.
    await opts.afterTimeline?.(page);

    const video = captureVideo ? page.video() : null;
    await context.close(); // flushes the video file
    const videoPath = video ? await video.path() : "";

    const audioMap: AudioMap = { resolution: sheet.resolution, durationMs, marks };
    const audioMapPath = path.join(opts.outDir, "audio-map.json");
    await writeFile(audioMapPath, JSON.stringify(audioMap, null, 2), "utf8");

    return { videoPath, audioMapPath, audioMap, resolution: sheet.resolution, durationMs };
  } finally {
    await browser.close();
  }
}

/* ------------------------------------------------------------------ *
 * Per-effect execution
 * ------------------------------------------------------------------ */

async function runEffectOnPage(
  page: Page,
  eff: Effect,
  mark: (p?: SoundProfile) => void,
): Promise<void> {
  switch (eff.action) {
    case "click": {
      await runVisual(page, eff); // ghost cursor + ripple
      const target = await clickable(frameLocator(page, eff.frameId));
      // The camera layer animates the page transform by design (zoom holds carry
      // a subtle idle drift), so a target is essentially never "stable" under
      // Playwright's actionability check. Force the click: the element is real,
      // visible and hit-testable — only its transform is in motion.
      await target.click({ force: true });
      mark(eff.soundProfile);
      return;
    }

    case "type-down": {
      const field = await editable(frameLocator(page, eff.frameId));
      await field.click({ force: true });
      // `planTyping` is the same pure decision function self-mode `typeInto`
      // (core/effects.ts) uses, so a recorded typo has identical shape/odds
      // to a live-preview one — including `startNonEmpty`: effects.ts derives
      // it from its own buffer (`current.length > 0`), so this reads the
      // field's *live* value the same way instead of always assuming a fresh
      // field (a recording onto a pre-filled field must get the same typo
      // eligibility a live preview would). Mirrors effects.ts's `read`:
      // `inputValue()` for input/textarea/select, falling back to
      // `textContent()` for a contenteditable (where `inputValue()` throws).
      // With `mistakes` false (the default) this returns one plain step per
      // character and the loop below reduces to exactly the previous
      // behavior.
      const currentText = (await field.inputValue().catch(() => field.textContent())) ?? "";
      const steps = planTyping(eff.text, eff.mistakes, {
        startNonEmpty: currentText.length > 0,
      });
      for (const step of steps) {
        if (step.typo) {
          // Real wrong keystroke, a beat, a real Backspace, another beat —
          // mirrors typeInto's typo+correction rhythm (write, pause,
          // backspace, pause) with actual Playwright input instead of a
          // synthetic DOM write. The backspace itself stays unmarked, same
          // as self mode: only the wrong keystroke and the eventual correct
          // one make a sound.
          await pressAndWait(page, field, step.typo, eff.typingSpeed, {
            mark: () => mark(eff.soundProfile),
          });
          await pressAndWait(page, field, "Backspace", eff.typingSpeed, { named: true });
        }
        await pressAndWait(page, field, step.char, eff.typingSpeed, {
          mark: () => mark(eff.soundProfile),
        });
      }
      return;
    }

    case "drag-and-drop": {
      // Synchronized carry, in two phases — see `dragApproach`/`dragGlide`
      // in `@telekinesis/core`'s effects.ts and the two runtime methods they
      // back. Phase 1 (the ghost cursor's short approach to the source,
      // ~200ms) is awaited on its own so the cursor visibly arrives before
      // anything else happens. Phase 2 (the longer src→dest glide) is then
      // *fired* — not awaited — and raced against a real, stepped Playwright
      // drag paced to the same `eff.duration`. The gallery's DragDemo chip
      // is a Pointer Events target with `setPointerCapture`
      // (playground/src/gallery/App.tsx), so it rides along with whatever
      // real pointer is down on it — on film, the chip travels *with* the
      // ghost cursor instead of teleporting into place after it.
      //
      // The previous choreography awaited the *whole* two-leg visual first
      // and only then performed the real drag as a single near-instant
      // `dragTo` snap: cursor glides, a beat of dead air, the dragged
      // element teleports. This keeps the two in lockstep the entire trip.
      const from = await awaitGhostApproach(page, eff);
      const to = await resolveDragDest(page, eff);
      if (!to) {
        // The schema's cross-field refinement (timesheet.ts's superRefine)
        // guarantees a destination at parse time, so this is unreachable for
        // any timesheet that made it through `parseTimesheet` — kept only so
        // a malformed effect fails soft instead of throwing mid-recording.
        mark(eff.soundProfile);
        return;
      }

      const glideDone = fireGhostGlide(page, eff, from); // not awaited yet

      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      const stepDelay = eff.duration / DRAG_STEPS;
      for (let i = 1; i <= DRAG_STEPS; i++) {
        const t = easeOutQuad(i / DRAG_STEPS);
        await page.mouse.move(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
        await page.waitForTimeout(stepDelay);
      }
      await page.mouse.up();

      // The ghost cursor's own overshoot+settle spring (GhostCursor.moveTo)
      // can run a little past `eff.duration` — wait for it so the next
      // effect never starts while phase 2's visual is still resolving.
      await glideDone;
      mark(eff.soundProfile);
      return;
    }

    default: {
      // Pure-visual effects (cursor-move, zoom, scroll, shake, highlight, wait).
      // Sound (if any) leads the motion.
      if ("soundProfile" in eff) mark(eff.soundProfile);
      await runVisual(page, eff);
      return;
    }
  }
}

/** Run an effect's visuals via the in-page runtime and await its animation. */
function runVisual(page: Page, eff: Effect): Promise<void> {
  return page.evaluate(
    (e) =>
      (window as unknown as { __telekinesis: { runEffect(x: unknown): Promise<void> } })
        .__telekinesis.runEffect(e),
    eff,
  );
}

/* ------------------------------------------------------------------ *
 * drag-and-drop's synchronized carry — see the case above.
 * ------------------------------------------------------------------ */

/** Real-pointer samples across the destination carry. Within the ~20-25
 * range a stepped drag needs to read as continuous motion once paced out
 * over `eff.duration` (rather than a handful of choppy jumps), without
 * spending a CDP round trip per GIF frame. */
const DRAG_STEPS = 22;

/**
 * Ease-out quad — fast start, gentle arrival into the drop target. Roughly
 * matches the ghost cursor's own default deceleration-into-target feel
 * (`fittsEase` in `@telekinesis/core`'s cursor.ts) without pulling that
 * browser-only math into this Node-side recorder for the sake of one curve.
 */
function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

/** Await phase 1 of a drag-and-drop's visual (the ghost cursor's approach to
 * the source) via the runtime, and hand back the exact source point it
 * resolved — see `@telekinesis/core`'s `dragApproach`. */
function awaitGhostApproach(
  page: Page,
  eff: DragAndDropEffect,
): Promise<{ x: number; y: number }> {
  return page.evaluate(
    (e) =>
      (
        window as unknown as {
          __telekinesis: { runDragApproach(effect: unknown): Promise<{ x: number; y: number }> };
        }
      ).__telekinesis.runDragApproach(e),
    eff,
  );
}

/** Fire phase 2 of a drag-and-drop's visual (the ghost cursor's src→dest
 * glide) via the runtime — see `@telekinesis/core`'s `dragGlide`.
 * Deliberately returns the in-flight promise rather than awaiting it: the
 * "drag-and-drop" case above races this against a real, stepped drag so the
 * dragged element rides along with the ghost cursor instead of teleporting
 * once the visual is already done. */
function fireGhostGlide(
  page: Page,
  eff: DragAndDropEffect,
  from: { x: number; y: number },
): Promise<void> {
  return page.evaluate(
    ({ effect, from: f }) =>
      (
        window as unknown as {
          __telekinesis: {
            runDragGlide(effect: unknown, from: { x: number; y: number }): Promise<void>;
          };
        }
      ).__telekinesis.runDragGlide(effect, f),
    { effect: eff, from },
  );
}

/**
 * A drag-and-drop's landing point in Playwright's (viewport CSS px) mouse
 * coordinates — mirrors `destPoint` in `@telekinesis/core`'s effects.ts,
 * Node-side, since this file drives the real pointer independently of the
 * in-page runtime. `null` only for a malformed effect the schema should
 * already have rejected at parse time (see the case above).
 */
async function resolveDragDest(
  page: Page,
  eff: DragAndDropEffect,
): Promise<{ x: number; y: number } | null> {
  if (eff.destFrameId) {
    const box = await frameLocator(page, eff.destFrameId).boundingBox();
    return box ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : null;
  }
  if (typeof eff.destX === "number" && typeof eff.destY === "number") {
    return { x: eff.destX, y: eff.destY };
  }
  return null;
}

/**
 * One keystroke of the type-down loop above: optionally record a sound mark,
 * send the key, then hold for the typing cadence. `opts.named` sends a named
 * key (e.g. `"Backspace"`) through `press`; otherwise `key` is typed through
 * `pressSequentially`, same as an ordinary character. Extracted because this
 * press/mark/wait idiom otherwise repeats three times per typo'd step (wrong
 * char, backspace, correct char) and once per plain step.
 */
async function pressAndWait(
  page: Page,
  field: Locator,
  key: string,
  waitMs: number,
  opts: { named?: boolean; mark?: () => void } = {},
): Promise<void> {
  opts.mark?.();
  if (opts.named) {
    await field.press(key);
  } else {
    await field.pressSequentially(key, { delay: 0 });
  }
  await page.waitForTimeout(waitMs);
}

/* ------------------------------------------------------------------ *
 * Locator helpers
 * ------------------------------------------------------------------ */

function frameLocator(page: Page, id: string): Locator {
  const escaped = id.replace(/["\\]/g, "\\$&");
  return page.locator(`[data-telekinesis-id="${escaped}"]`);
}

async function clickable(frame: Locator): Promise<Locator> {
  const inner = frame.locator("button, a, input, select, textarea, [role='button']").first();
  return (await inner.count()) > 0 ? inner : frame;
}

async function editable(frame: Locator): Promise<Locator> {
  const inner = frame.locator("input, textarea, [contenteditable]").first();
  return (await inner.count()) > 0 ? inner : frame;
}
