import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { EFFECT_ACTIONS, parseTimesheet } from "@telekinesis/schema";

// Plan 5, Task 7 — docs/superpowers/plans/2026-07-06-05-qa-suite-gif-gallery-readme.md.
//
// The triple link this file guards, per action: (1) a gallery timesheet in
// examples/gallery/ that still parses, (2) a committed, budgeted GIF rendered from it
// (`pnpm gallery:record`), and (3) a `#### `<action>`` section in the README that embeds
// that same GIF. Break any one of the three — rename an effect, forget to regenerate a
// GIF, edit the README without regenerating — and a test below fails, in red, pointing at
// exactly what's missing. This is also the designed growth mechanism: when Plans 1-2 add
// effects to EFFECT_ACTIONS, this file fails for the new action until the gallery and
// README catch up (see the plan's "Dependencias con otros planes").
//
// No browser needed — this is plain Node fs assertions, run through `playwright test`
// only so it's gated alongside (and reported with) the rest of the e2e suite instead of
// living behind a separate runner.

// Plan rule 2's per-GIF budget — asserted strictly (< 900_000 bytes, toBeLessThan below).
const GALLERY_GIF_BUDGET_BYTES = 900_000;

// fileURLToPath (not raw `.pathname`) so this survives a repo path with spaces or other
// characters a file:// URL would percent-encode, and path.join (not template-literal
// concatenation) to attach subpaths — both match examples.spec.ts's convention. The
// template-literal version used to bite here: "../.." resolves to a directory, so
// fileURLToPath's result keeps its trailing slash, and `${repoRoot}/examples/gallery`
// silently doubled it up (".../telekinesis//examples/gallery") — harmless on POSIX, but
// not what examples.spec.ts does with its own path.join(examplesDir, file).
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const galleryTimesheetsDir = path.join(repoRoot, "examples/gallery");
const galleryGifsDir = path.join(repoRoot, "public/gallery");
const readme = readFileSync(path.join(repoRoot, "README.md"), "utf8");

for (const action of EFFECT_ACTIONS) {
  test(`"${action}" has a gallery timesheet, a committed GIF, and a README section`, () => {
    // Every assertion below is independent (expect.soft) and every file check is
    // existsSync-guarded ahead of any statSync/readFileSync that would otherwise throw a
    // raw, test-halting ENOENT — so a brand-new action with nothing wired up yet (no
    // sheet, no GIF, no README section) reports all of its gaps in one run instead of
    // stopping at the first missing file.
    const sheetPath = path.join(galleryTimesheetsDir, `${action}.timesheet.json`);
    const sheetExists = existsSync(sheetPath);
    expect.soft(sheetExists, `${action}: missing ${sheetPath}`).toBe(true);
    if (sheetExists) {
      expect.soft(statSync(sheetPath).size, `${action}: empty ${sheetPath}`).toBeGreaterThan(0);

      // examples.spec.ts's readdirSync(examplesDir) is non-recursive, so it never descends
      // into examples/gallery/ — these sheets are otherwise never parsed as a contract
      // anywhere in the suite. Parsing here closes that gap: a schema change that breaks a
      // gallery sheet (e.g. drops a field one of them relies on) fails loudly in CI instead
      // of only at the next `pnpm gallery:record`.
      const sheet = parseTimesheet(JSON.parse(readFileSync(sheetPath, "utf8")));
      expect
        .soft(sheet.timeline.length, `${action}: gallery timesheet has an empty timeline`)
        .toBeGreaterThan(0);
    }

    const gifPath = path.join(galleryGifsDir, `${action}.gif`);
    const gifExists = existsSync(gifPath);
    expect.soft(gifExists, `${action}: missing ${gifPath}`).toBe(true);
    if (gifExists) {
      expect
        .soft(
          statSync(gifPath).size,
          `${action}: gallery GIF exceeds the ${GALLERY_GIF_BUDGET_BYTES}-byte budget (plan rule 2)`,
        )
        .toBeLessThan(GALLERY_GIF_BUDGET_BYTES);
    }

    expect.soft(readme, `${action}: README never references public/gallery/${action}.gif`).toContain(
      `public/gallery/${action}.gif`,
    );
    // Anchored to a whole line ("m" makes ^/$ apply per-line): "#### `action`" and nothing
    // else on it. The backticks around `action` still make same-prefix actions exact-match
    // by construction (e.g. "zoom-in"'s pattern can't accidentally match a "zoom-in-drift"
    // heading, since a literal backtick has to follow immediately) — but without ^/$ this
    // was also able to match inside a deeper heading ("##### `zoom-in`", since "####" is a
    // prefix of "#####") or a backticked mention of the action sitting mid-sentence in a
    // description — neither of which is the actual section heading.
    expect.soft(readme, `${action}: README has no "#### \`${action}\`" heading`).toMatch(
      new RegExp("^####\\s+`" + action + "`\\s*$", "m"),
    );
  });
}

// hero isn't one of the 11 EFFECT_ACTIONS — examples/gallery/hero.timesheet.json records
// the whole playground landing page (via landing.html?demo), not one effect in isolation —
// but the plan's Definition of Done still counts it as a committed, budgeted asset ("12
// GIFs (11 effects + hero)"), and the README opens with it (Task 8's hero <img> under the
// header block). So it gets the same guards as the per-action block above: the sheet
// (existence, parses, non-empty timeline — the "these sheets are never parsed as a
// contract elsewhere" gap applies to hero's sheet just as much as the 11 per-action ones),
// the budget, and the README embed — without these, e.g. stripping the hero <img> from the
// README would slip through as the one unguarded GIF of the twelve.
test("hero.gif is committed, within the gallery GIF budget, and embedded in the README", () => {
  const sheetPath = path.join(galleryTimesheetsDir, "hero.timesheet.json");
  const sheetExists = existsSync(sheetPath);
  expect.soft(sheetExists, `hero: missing ${sheetPath}`).toBe(true);
  if (sheetExists) {
    const sheet = parseTimesheet(JSON.parse(readFileSync(sheetPath, "utf8")));
    expect
      .soft(sheet.timeline.length, "hero: gallery timesheet has an empty timeline")
      .toBeGreaterThan(0);
  }

  const gifPath = path.join(galleryGifsDir, "hero.gif");
  const gifExists = existsSync(gifPath);
  expect.soft(gifExists, `hero: missing ${gifPath}`).toBe(true);
  if (gifExists) {
    expect
      .soft(
        statSync(gifPath).size,
        `hero.gif exceeds the ${GALLERY_GIF_BUDGET_BYTES}-byte budget (plan rule 2)`,
      )
      .toBeLessThan(GALLERY_GIF_BUDGET_BYTES);
  }

  expect.soft(readme, "README never references public/gallery/hero.gif").toContain(
    "public/gallery/hero.gif",
  );
});

// The mirror image of the orphan-GIF test below: a leftover or renamed
// examples/gallery/*.timesheet.json that doesn't map to a real action (or to hero) would
// otherwise sit uncovered by the per-action loop above (which only ever looks for the
// files it expects) and go unnoticed.
test("every gallery timesheet corresponds to an action or the hero", () => {
  const sheetFiles = readdirSync(galleryTimesheetsDir).filter((f) => f.endsWith(".timesheet.json"));
  for (const f of sheetFiles) {
    const name = f.replace(/\.timesheet\.json$/, "");
    expect([...EFFECT_ACTIONS, "hero"], `orphan gallery timesheet: ${f}`).toContain(name);
  }
});

// The other half of the coverage gate: a stray GIF (a hand-test leftover, or the old file
// from a renamed action) should never sit in public/gallery unaccounted for. Filtered to
// *.gif entries only — e2e/scripts/record-gallery.ts's own scratch directory
// (public/gallery/.tmp, wiped and recreated at the top of each run — see that script's
// tmpOutDir) is not a GIF and not this test's concern, mirroring that same script's own
// `readdir(outDir).filter((f) => f.endsWith(".gif"))` guard.
test("every gallery GIF corresponds to an action or the hero", () => {
  const gifFiles = readdirSync(galleryGifsDir).filter((f) => f.endsWith(".gif"));
  for (const f of gifFiles) {
    const name = f.replace(/\.gif$/, "");
    expect([...EFFECT_ACTIONS, "hero"], `orphan gallery GIF: ${f}`).toContain(name);
  }
});

// The heading-side mirror of the two orphan guards above: a `#### `name`` section left
// behind in the README after an effect is renamed or removed — heading not cleaned up,
// even though it no longer maps to a real action — would otherwise go undetected, since
// the per-action loop's own heading check only ever confirms that each of the 11
// EFFECT_ACTIONS *has* a heading, never that every heading in the README maps back to a
// real action (or hero). Catches a stale section left behind after an effect rename.
test("every README heading corresponds to an action or the hero", () => {
  const headingNames = [...readme.matchAll(/^####\s+`([^`]+)`\s*$/gm)].map((m) => m[1]);
  for (const name of headingNames) {
    expect([...EFFECT_ACTIONS, "hero"], `orphan README heading: "#### \`${name}\`"`).toContain(name);
  }
});
