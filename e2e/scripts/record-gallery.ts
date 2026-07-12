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
 *   TK_GALLERY_FPS    output GIF frame rate (default 12, the docs precedent)
 *   TK_GALLERY_WIDTH  output GIF width in px, height keeps aspect (default 480 — see note below)
 *   TK_GALLERY_ONLY   record a single job by name (an action, or "hero") — cheap iteration
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
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

const PORT = 4173;
const BASE = `http://localhost:${PORT}`;

const FPS = Number(process.env.TK_GALLERY_FPS ?? 12);
// The docs precedent (apps/docs/scripts/record-sections.ts) uses width 560,
// which is fine for clips where most of the frame holds still (cursor moves,
// clicks, highlights). zoom-in/zoom-out rescale the *entire* viewport every
// frame — GIF's LZW/palette compression has nothing static to exploit — and
// at width 560 they measured 1036KB/~950KB, over the 900KB per-file budget.
// Dropping fps 12 -> 10 alone wasn't enough (zoom-in still measured 922KB at
// width 560); width 480 was, with real margin (zoom-in 799KB, zoom-out
// 764KB) and without going below the fps10/width480 floor. Applied globally
// for a consistent gallery instead of a one-off per effect.
const WIDTH = Number(process.env.TK_GALLERY_WIDTH ?? 480);
const ONLY = process.env.TK_GALLERY_ONLY;

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

        const gifOut = path.join(outDir, `${job.name}.gif`);
        const gif = await toGif(result.videoPath, {
          output: gifOut,
          fps: FPS,
          width: WIDTH,
          maxColors: 96,
          lossy: 80,
          onLog: (m) => process.stdout.write(`    ${m}\n`),
        });

        const { size } = await stat(gifOut);
        if (size > PER_GIF_BUDGET_BYTES) {
          // Thrown (not process.exit'd) so the finally blocks below still
          // run — killing any preview server this invocation started and
          // cleaning up the temp work dir — before main()'s catch exits 1.
          throw new Error(
            `${job.name}.gif pesa ${Math.round(size / 1024)}KB — recorta el timesheet o baja width/fps`,
          );
        }

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
        `over the ${(TOTAL_BUDGET_BYTES / 1_000_000).toFixed(0)}MB budget; recorta timesheets o baja width/fps`,
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
