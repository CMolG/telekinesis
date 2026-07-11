import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { record } from "@telekinesis/engine";
import type { TimesheetInput } from "@telekinesis/schema";
import { waitForRuntime } from "../helpers";

// Deterministic regression coverage for `type-down`'s `mistakes: true` path
// in *both* consumers of `planTyping` (packages/schema/src/typing.ts): the
// self-mode DOM writer (`typeInto` in packages/core/src/effects.ts) and the
// external-mode real keystrokes (`packages/engine/src/record.ts`). Until
// this file, only the gallery's `type-down.timesheet.json` ever exercised
// `mistakes: true`, and nothing asserted the typo actually gets corrected.
//
// Both tests type "keyboard" (8 chars) into a field that starts empty, with
// `Math.random` pinned so `planTyping` plants exactly one typo, at the
// second character (index 1). Derived from `planTyping`'s loop:
//   - char 0 is exempt from typos while the target is still empty
//     (`hasContent` starts `false`, so `mistakes && hasContent && …`
//     short-circuits *before* `rng()` is ever called for char 0 — see
//     typing.ts and its "never plans a typo on the very first character of
//     an empty target" test);
//   - every later character consumes exactly one `rng()` call to decide
//     hit (`rng() < TYPO_RATE`) vs miss; a hit consumes one further `rng()`
//     call for `randomTypoLetter`'s letter draw.
// So forcing the hit at char 1 costs: [hit, letter-draw, miss, miss, miss,
// miss, miss, miss] — 8 calls for 8 characters (char 0 contributes none,
// chars 2-7 contribute one miss call each, char 1 contributes two).
const TEXT = "keyboard";
const TYPO_FORCING_SEQUENCE = [0, 0, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99];

// Every plain step fires one sound mark (the correct keystroke); the one
// typo'd step fires two (the wrong keystroke, then the correction) instead
// of one — see typeInto (effects.ts) and the type-down case in record.ts.
// So total marks = chars + (number of typos) = TEXT.length + 1 here.
const EXPECTED_MARKS = TEXT.length + 1;

/**
 * Both consumers resolve `rng` as `opts.rng ?? Math.random` (typing.ts), so a
 * fixed-position queue installed on the global `Math.random` only lands on
 * `planTyping`'s own calls if *nothing else* consumes from it first. In
 * practice something always does:
 *   - self mode: a one-time, page-session-scoped cost of exactly 2 calls
 *     fires the first time `play()` ever touches the runtime (observed via
 *     instrumented stack traces during development; the exact source didn't
 *     matter once isolated — see the priming call below).
 *   - external mode: `record()`'s setup (`chromium.launch`/`newContext`/
 *     `page.goto`/`waitForFunction`) burns *thousands* of calls via
 *     playwright-core's own `randomIntInRange` internals before the
 *     timeline loop even starts. (Filtering by inspecting `new
 *     Error().stack` looks tempting but is a trap: this repo's Playwright
 *     Test run installs a source-mapping `Error.prepareStackTrace` that
 *     itself calls `Math.random()` — via a randomized quicksort — every
 *     time `.stack` is *read*, so the inspection contaminates the very
 *     sequence it's trying to protect.)
 * Both tests below sidestep this the same way: let the unrelated consumer
 * run first against an unpatched (or don't-care) `Math.random`, *then*
 * install the real forcing queue right before the real type-down runs.
 */
test("type-down mistakes:true, self mode: a forced typo still lands the intended text", async ({
  page,
}) => {
  await page.goto("/gallery.html?demo");
  await waitForRuntime(page);

  // Prime: absorb the one-time lazy-init Math.random cost with a throwaway
  // effect that never touches gal-input, using the page's native
  // (unpatched) Math.random — its values don't matter.
  await page.evaluate(() =>
    window.__telekinesis.play(
      { timeline: [{ action: "cursor-move", destX: 50, destY: 50, duration: 10 }] },
      { mode: "self", sound: false },
    ),
  );

  // Now install the real forcing queue, immediately before the real run.
  await page.evaluate((seq) => {
    let i = 0;
    Math.random = () => (i < seq.length ? seq[i++] : 0.99);
  }, TYPO_FORCING_SEQUENCE);

  const marks = await page.evaluate(
    (typedText) =>
      window.__telekinesis.play(
        {
          timeline: [
            {
              action: "type-down",
              frameId: "gal-input",
              text: typedText,
              typingSpeed: 5,
              mistakes: true,
              soundProfile: "mechanical-keyboard",
            },
          ],
        },
        { mode: "self", sound: false },
      ),
    TEXT,
  );

  const value = await page.evaluate(
    () => document.querySelector<HTMLInputElement>('[data-telekinesis-id="gal-input"] input')?.value,
  );
  expect(value).toBe(TEXT);
  expect(
    marks,
    "unexpected mark count — a mismatch here usually means Math.random's forcing queue got " +
      "contaminated by some other consumer running before the queue install above (see the " +
      "file-level comment on priming self mode's one-time lazy-init cost), not a real regression " +
      "in typo planning itself",
  ).toHaveLength(EXPECTED_MARKS);
});

test("type-down mistakes:true, external mode: record() plants and corrects the same forced typo", async () => {
  const outDir = await mkdtemp(path.join(tmpdir(), "tk-typing-mistakes-"));
  const originalRandom = Math.random;
  try {
    const sheet: TimesheetInput = {
      url: "http://localhost:4173/gallery.html?demo",
      resolution: { width: 960, height: 540 },
      timeline: [
        {
          action: "type-down",
          frameId: "gal-input",
          text: TEXT,
          typingSpeed: 5,
          mistakes: true,
          soundProfile: "mechanical-keyboard",
        },
      ],
    };

    // The audio map's marks can't see this: the wrong keystroke and its
    // correction each fire a mark, but the Backspace between them is
    // deliberately unmarked (same as self mode — see record.ts's type-down
    // case), so the mark *count* is identical whether or not the typo is
    // ever actually corrected. Only reading the field's real, post-timeline
    // DOM value (via `afterTimeline`, while the page is still alive) can
    // catch a correction that silently stopped happening.
    let typedValue: string | null = null;

    // recordVideo: false — this spec only needs the audio map, and skipping
    // capture keeps it fast; no ffmpeg involved either way (record() alone
    // never shells out to it, unlike mixAudio/toGif).
    const res = await record(sheet, {
      outDir,
      recordVideo: false,
      headless: true,
      // onStep fires right before each timeline effect — with a single-step
      // sheet, that's right before the type-down runs, i.e. *after*
      // record()'s launch/goto/waitForFunction setup (the actual source of
      // the contamination described above) has already finished with it.
      onStep: () => {
        let i = 0;
        Math.random = () => (i < TYPO_FORCING_SEQUENCE.length ? TYPO_FORCING_SEQUENCE[i++] : 0.99);
      },
      afterTimeline: async (page) => {
        typedValue = await page.locator('[data-telekinesis-id="gal-input"] input').inputValue();
      },
    });

    expect(
      res.audioMap.marks,
      "unexpected mark count — a mismatch here usually means Math.random's forcing queue got " +
        "contaminated by some other consumer running before onStep installs it (see the " +
        "file-level comment above on record()'s setup burning thousands of calls), not a real " +
        "regression in typo planning itself",
    ).toHaveLength(EXPECTED_MARKS);
    expect(res.audioMap.marks.every((m) => m.profile === "mechanical-keyboard")).toBe(true);
    // The real regression this guards: marks alone can't tell a corrected
    // typo apart from an uncorrected one (see the comment on `typedValue`
    // above) — only the field's actual value can.
    expect(typedValue).toBe(TEXT);
  } finally {
    Math.random = originalRandom;
    await rm(outDir, { recursive: true, force: true }).catch(() => {});
  }
});
