import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  parseTimesheet,
  SOUND_PROFILES,
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
      for (const ch of [...eff.text]) {
        mark(eff.soundProfile);
        await field.pressSequentially(ch, { delay: 0 });
        await page.waitForTimeout(eff.typingSpeed);
      }
      return;
    }

    case "drag-and-drop": {
      await runVisual(page, eff); // cursor travels the path
      const source = frameLocator(page, eff.frameId);
      if (eff.destFrameId) {
        await source.dragTo(frameLocator(page, eff.destFrameId), { force: true });
      } else if (typeof eff.destX === "number" && typeof eff.destY === "number") {
        const box = await source.boundingBox();
        if (box) {
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.down();
          await page.mouse.move(eff.destX, eff.destY, { steps: 12 });
          await page.mouse.up();
        }
      }
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
