import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { parseTimesheet } from "@telekinesis/schema";

// examples/ also holds landing-demo.mp4 (a committed recording, not a
// fixture) — filter to *.timesheet.json only, matching the plan's glob.
const examplesDir = fileURLToPath(new URL("../../examples", import.meta.url));
const timesheetFiles = readdirSync(examplesDir).filter((f) => f.endsWith(".timesheet.json"));

// Guards the generated tests below: an empty match (e.g. a moved/renamed
// examples/ directory) would otherwise register zero tests and this file
// would pass vacuously instead of catching the regression.
test("examples/ has at least one *.timesheet.json fixture", () => {
  expect(timesheetFiles.length).toBeGreaterThan(0);
});

// The shipped examples double as documentation and as a contract: every
// *.timesheet.json here must stay parseable by the current schema, or CI
// catches the drift instead of a user hitting it first. (Plan 2's
// expandTimesheet/SEQUENCE_IDS hasn't landed — no `SEQUENCE_IDS` export
// exists in @telekinesis/schema yet — so plain parseTimesheet is the whole
// story for now.)
for (const file of timesheetFiles) {
  test(`examples/${file} parses as a valid timesheet`, () => {
    const raw = readFileSync(path.join(examplesDir, file), "utf8");
    const sheet = parseTimesheet(JSON.parse(raw));
    expect(sheet.timeline.length).toBeGreaterThan(0);
  });
}
