import { readdirSync, readFileSync, statSync } from "node:fs";
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
// characters a file:// URL would percent-encode — matches examples.spec.ts's convention.
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const galleryTimesheetsDir = `${repoRoot}/examples/gallery`;
const galleryGifsDir = `${repoRoot}/public/gallery`;
const readme = readFileSync(`${repoRoot}/README.md`, "utf8");

for (const action of EFFECT_ACTIONS) {
  test(`"${action}" has a gallery timesheet, a committed GIF, and a README section`, () => {
    const sheetPath = `${galleryTimesheetsDir}/${action}.timesheet.json`;
    expect(statSync(sheetPath).size, `${action}: missing or empty ${sheetPath}`).toBeGreaterThan(0);

    // examples.spec.ts's readdirSync(examplesDir) is non-recursive, so it never descends
    // into examples/gallery/ — these sheets are otherwise never parsed as a contract
    // anywhere in the suite. Parsing here closes that gap: a schema change that breaks a
    // gallery sheet (e.g. drops a field one of them relies on) fails loudly in CI instead
    // of only at the next `pnpm gallery:record`.
    const sheet = parseTimesheet(JSON.parse(readFileSync(sheetPath, "utf8")));
    expect(sheet.timeline.length, `${action}: gallery timesheet has an empty timeline`).toBeGreaterThan(
      0,
    );

    const gifPath = `${galleryGifsDir}/${action}.gif`;
    expect(
      statSync(gifPath).size,
      `${action}: gallery GIF exceeds the ${GALLERY_GIF_BUDGET_BYTES}-byte budget (plan rule 2)`,
    ).toBeLessThan(GALLERY_GIF_BUDGET_BYTES);

    expect(readme, `${action}: README never references public/gallery/${action}.gif`).toContain(
      `public/gallery/${action}.gif`,
    );
    // Exact heading shape the README section (Task 8) is required to use: "#### `action`".
    // The surrounding backticks make this exact-match by construction — e.g. "zoom-in"'s
    // pattern can't accidentally match a "zoom-in-drift" heading, since a literal
    // backtick has to follow immediately.
    expect(readme, `${action}: README has no "#### \`${action}\`" heading`).toMatch(
      new RegExp(`####\\s+\`${action}\``),
    );
  });
}

// hero isn't one of the 11 EFFECT_ACTIONS — examples/gallery/hero.timesheet.json records
// the whole playground landing page (via landing.html?demo), not one effect in isolation —
// but the plan's Definition of Done still counts it as a committed, budgeted asset ("12
// GIFs (11 effects + hero)"), and the README opens with it (Task 8's hero <img> under the
// header block). So it gets the same guards as the per-action GIFs above: the budget, and
// the README embed — without the latter, stripping the hero <img> from the README would
// slip through as the one unguarded GIF of the twelve.
test("hero.gif is committed, within the gallery GIF budget, and embedded in the README", () => {
  expect(
    statSync(`${galleryGifsDir}/hero.gif`).size,
    `hero.gif exceeds the ${GALLERY_GIF_BUDGET_BYTES}-byte budget (plan rule 2)`,
  ).toBeLessThan(GALLERY_GIF_BUDGET_BYTES);
  expect(readme, "README never references public/gallery/hero.gif").toContain(
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
