/**
 * Record every effect in the gallery — plus the landing hero tour — against
 * the playground's `vite preview` server, and export each as a budgeted GIF
 * into `public/gallery/<name>.gif`. Telekinesis filming Telekinesis: every
 * clip in the repo's own showcase is produced by this pipeline, never hand-
 * captured or hand-edited.
 *
 * Pattern lifted from `apps/docs/scripts/record-sections.ts` and
 * generalized: this lives in `e2e/` (not `playground/`) because that
 * workspace already depends on `@telekinesis/engine`/`render`/`schema`.
 *
 * Usage:
 *   pnpm gallery:record                            # builds the playground, then records all 12
 *   pnpm --filter @telekinesis/e2e gallery:record   # skips the build — dist/ must already exist
 *
 * Env:
 *   TK_GALLERY_FPS    output GIF frame rate for every job, overriding
 *                     JOB_OVERRIDES too (default 12, the docs precedent —
 *                     see JOB_OVERRIDES below for per-job floors)
 *   TK_GALLERY_WIDTH  output GIF width in px for every job, height keeps
 *                     aspect, overriding JOB_OVERRIDES too — same
 *                     precedence as TK_GALLERY_FPS (default 480, see
 *                     JOB_OVERRIDES below for per-job floors)
 *   TK_GALLERY_ONLY   record a single job by name (an action, or "hero") — cheap iteration
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rename, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { record } from "@telekinesis/engine";
import { toGif } from "@telekinesis/render";

// e2e/scripts/record-gallery.ts -> repo root. Same depth as e2e/tests/*.ts,
// so this resolves identically to gallery-coverage.spec.ts's
// `new URL("../..", import.meta.url)`.
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const galleryDir = path.join(repoRoot, "examples", "gallery");
const outDir = path.join(repoRoot, "public", "gallery");
// Every job's GIF is encoded here first, budget-checked, and only *then*
// renamed into outDir — see the per-job loop in main() below. Nested inside
// outDir (not the OS tmpdir) so the final rename is same-filesystem, never
// a cross-device EXDEV; excluded from the total-budget scan below because
// readdir(outDir) is non-recursive and never descends into it.
const tmpOutDir = path.join(outDir, ".tmp");

const PORT = 4173;
const BASE = `http://localhost:${PORT}`;

const DEFAULT_FPS = 12;
// The docs precedent (apps/docs/scripts/record-sections.ts) uses width 560,
// which is fine for clips where most of the frame holds still (cursor moves,
// clicks, highlights). 480 gives every other gallery clip comfortable budget
// margin at the global fps/width defaults. zoom-in/zoom-out don't reliably
// fit even at 480 — see their own JOB_OVERRIDES entry below for the measured
// numbers and why they get a narrower, slower override instead of lowering
// the default for every other clip.
const DEFAULT_WIDTH = 480;
const ONLY = process.env.TK_GALLERY_ONLY;

/**
 * Per-job fps/width floors for jobs that don't fit the global defaults.
 * Resolved by `resolveFps`/`resolveWidth` below, applied where fps/width
 * flow into `toGif`.
 *
 * - `hero` (the landing tour — longer and busier than a single-effect
 *   gallery clip) measured ~905-908KB at the global fps 12 default, just
 *   over the 900KB per-GIF budget, vs. ~810KB at fps 10 — so it gets its own
 *   fps floor instead of lowering fps for every other clip.
 * - `zoom-in`/`zoom-out` rescale the *entire* viewport every frame — GIF's
 *   LZW/palette compression has nothing static to exploit. At the global
 *   fps12/width480 defaults they regenerate at 1017-1061KB, over the 900KB
 *   budget (encode is non-deterministic run to run — the previously-
 *   committed bytes for these two, 816KB/766KB, happened to land under
 *   budget at those same settings, within the ~±25-30% run-to-run variance
 *   this encoder shows, not because fps12/width480 reliably fits them).
 *   fps10+width440 measured 602KB — a 33% margin, comfortably absorbing
 *   that variance instead of gambling on it every re-record.
 */
const JOB_OVERRIDES: Record<string, { fps?: number; width?: number }> = {
  hero: { fps: 10 },
  "zoom-in": { fps: 10, width: 440 },
  "zoom-out": { fps: 10, width: 440 },
};

/**
 * fps for one job, precedence high to low: env `TK_GALLERY_FPS` (if set,
 * wins outright for every job, `JOB_OVERRIDES` included) > that job's entry
 * in `JOB_OVERRIDES` > `DEFAULT_FPS`.
 */
function resolveFps(jobName: string): number {
  if (process.env.TK_GALLERY_FPS) return Number(process.env.TK_GALLERY_FPS);
  return JOB_OVERRIDES[jobName]?.fps ?? DEFAULT_FPS;
}

/** width for one job — same precedence as `resolveFps` above (env > override > default). */
function resolveWidth(jobName: string): number {
  if (process.env.TK_GALLERY_WIDTH) return Number(process.env.TK_GALLERY_WIDTH);
  return JOB_OVERRIDES[jobName]?.width ?? DEFAULT_WIDTH;
}

// Hard budget (plan's "Reglas duras" #2): the script fails loudly rather
// than silently shipping an oversized gallery. 900_000 / 10_000_000 are
// decimal (matching how the plan writes "900 KB"/"10 MB"), not binary.
const PER_GIF_BUDGET_BYTES = 900_000;
const TOTAL_BUDGET_BYTES = 10_000_000;

interface Job {
  /** action name for a gallery sheet, or "hero" for the landing tour. */
  name: string;
  timesheetPath: string;
  url: string;
}

interface Row {
  name: string;
  bytes: number;
  backend: string;
  ms: number;
}

async function reachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

async function waitForServer(url: string, timeoutMs = 60_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await reachable(url)) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`playground preview server never became reachable at ${url}`);
}

/**
 * The 12 sheets in `examples/gallery/*.timesheet.json` — 11 named for the
 * action they demo (per the frame-id contract in
 * `playground/src/gallery/App.tsx`) plus `hero.timesheet.json`, the landing
 * page's condensed tour (frame ids per `playground/src/landing/App.tsx`).
 * Discovery is uniform: every file in the directory becomes a job the same
 * way, `hero` included — it's just another `examples/gallery/*.timesheet.json`
 * now, not a special case sourced from elsewhere. Only the target page
 * differs, so that's the one thing this derives from the name: every job's
 * URL is built here from `BASE` (rather than trusting each JSON file's own
 * `url` field) so the script stays self-contained against whichever preview
 * server it just started, regardless of what host/port a sheet happens to
 * have baked in.
 */
async function buildJobs(): Promise<Job[]> {
  const files = (await readdir(galleryDir)).filter((f) => f.endsWith(".timesheet.json")).sort();
  return files.map((f) => {
    const name = f.replace(/\.timesheet\.json$/, "");
    return {
      name,
      timesheetPath: path.join(galleryDir, f),
      url: `${BASE}/${name === "hero" ? "landing" : "gallery"}.html?demo`,
    };
  });
}

async function main(): Promise<void> {
  await mkdir(outDir, { recursive: true });
  // Wipe and recreate the tmp encode dir up front — clears any stale
  // `.gif` a prior invocation left behind after a hard crash (anything
  // short of that is already cleaned up per-job below), so a leftover temp
  // file can never be mistaken for this run's output.
  await rm(tmpOutDir, { recursive: true, force: true });
  await mkdir(tmpOutDir, { recursive: true });

  const allJobs = await buildJobs();
  const jobs = ONLY ? allJobs.filter((j) => j.name === ONLY) : allJobs;
  if (ONLY && jobs.length === 0) {
    throw new Error(
      `TK_GALLERY_ONLY="${ONLY}" matched no job (expected one of: ${allJobs.map((j) => j.name).join(", ")})`,
    );
  }

  let server: ChildProcess | undefined;
  if (!(await reachable(BASE))) {
    console.log(`● starting playground preview (vite preview) on :${PORT}`);
    server = spawn("pnpm", ["--filter", "@telekinesis/playground", "preview"], {
      cwd: repoRoot,
      stdio: "ignore",
    });
    await waitForServer(BASE);
  }

  const rows: Row[] = [];
  try {
    for (const job of jobs) {
      console.log(`● recording "${job.name}"  ${job.url}`);
      const raw = await readFile(job.timesheetPath, "utf8");
      const sheet = JSON.parse(raw);

      const work = await mkdtemp(path.join(tmpdir(), `tk-gallery-${job.name}-`));
      const jobStart = Date.now();
      try {
        const result = await record(sheet, {
          url: job.url,
          outDir: work,
          headless: true,
          onStep: (i, total, eff) =>
            process.stdout.write(`  ${i + 1}/${total}  ${eff.action}\n`),
        });
        console.log(
          `  ✔ recorded (${result.durationMs}ms wall, ${result.audioMap.marks.length} sound marks)`,
        );

        // Encoded to a tmp path first, budget-checked, and only *then*
        // renamed onto the tracked `public/gallery/<name>.gif` — a run that
        // busts budget below must never leave that tracked path dirty with
        // an oversized GIF (reproduced twice before this fix: the previous
        // order wrote straight to gifOut, so a failed run's oversized bytes
        // just sat there, tracked, until someone noticed).
        const gifOut = path.join(outDir, `${job.name}.gif`);
        const gifTmp = path.join(tmpOutDir, `${job.name}.gif`);
        const gif = await toGif(result.videoPath, {
          output: gifTmp,
          fps: resolveFps(job.name),
          width: resolveWidth(job.name),
          maxColors: 96,
          lossy: 80,
          onLog: (m) => process.stdout.write(`    ${m}\n`),
        });

        const { size } = await stat(gifTmp);
        if (size > PER_GIF_BUDGET_BYTES) {
          // Delete the oversized tmp output — it must never reach gifOut —
          // then throw (not process.exit, so the finally blocks below still
          // run: killing any preview server this invocation started and
          // cleaning up the temp work dir — before main()'s catch exits 1).
          await rm(gifTmp, { force: true });
          throw new Error(
            `${job.name}.gif weighs ${Math.round(size / 1024)}KB — trim the timesheet or lower width/fps`,
          );
        }
        await rename(gifTmp, gifOut);

        const backend = gif.backend + (gif.optimized ? "+gifsicle" : "");
        const ms = Date.now() - jobStart;
        rows.push({ name: job.name, bytes: size, backend, ms });
        console.log(
          `  ✔ ${path.relative(repoRoot, gifOut)} (${Math.round(size / 1024)}KB, ${backend}, ${ms}ms)`,
        );
      } finally {
        await rm(work, { recursive: true, force: true });
      }
    }
  } catch (err) {
    // A mid-batch failure (e.g. one job's GIF busts the per-file budget)
    // would otherwise jump straight to main().catch below, hiding how far
    // the run actually got — print what finished first so a failed
    // `pnpm gallery:record` still reports every completed job's size, not
    // just which one broke.
    if (rows.length > 0) {
      console.log("\n● gallery summary (jobs completed before the failure)");
      console.table(
        rows.map((r) => ({ name: r.name, KB: Math.round(r.bytes / 1024), backend: r.backend, ms: r.ms })),
      );
    }
    throw err;
  } finally {
    server?.kill();
  }

  console.log("\n● gallery summary (this run)");
  console.table(
    rows.map((r) => ({ name: r.name, KB: Math.round(r.bytes / 1024), backend: r.backend, ms: r.ms })),
  );

  // The total-budget guard looks at every *.gif actually sitting in
  // public/gallery, not just the ones this run touched — so a
  // TK_GALLERY_ONLY re-record of a single job still checks the real,
  // whole-gallery total against the 10MB budget (plan's "Reglas duras" #2).
  const allGifFiles = (await readdir(outDir)).filter((f) => f.endsWith(".gif"));
  const allSizes = await Promise.all(
    allGifFiles.map(async (f) => (await stat(path.join(outDir, f))).size),
  );
  const totalBytes = allSizes.reduce((a, b) => a + b, 0);
  console.log(
    `  ${allGifFiles.length} GIF(s) in public/gallery, ${(totalBytes / 1_000_000).toFixed(2)}MB total`,
  );
  if (totalBytes > TOTAL_BUDGET_BYTES) {
    throw new Error(
      `public/gallery totals ${(totalBytes / 1_000_000).toFixed(2)}MB across ${allGifFiles.length} GIFs — ` +
        `over the ${(TOTAL_BUDGET_BYTES / 1_000_000).toFixed(0)}MB budget; trim timesheets or lower width/fps`,
    );
  }

  console.log(
    jobs.length === allJobs.length
      ? `✔ ${rows.length} GIFs recorded, within budget`
      : `✔ ${rows.length}/${allJobs.length} GIF(s) recorded (TK_GALLERY_ONLY=${ONLY}), gallery within budget`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
