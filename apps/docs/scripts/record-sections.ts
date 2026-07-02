/**
 * Record each documentation section's timesheet against the running docs site
 * and export a looping GIF into `public/motion/<id>.gif`. This is the docs
 * dogfooding the product: the motion examples on every page are produced by
 * Telekinesis recording itself.
 *
 * Usage:
 *   pnpm --filter @telekinesis/docs build      # once, so `next start` can serve
 *   pnpm --filter @telekinesis/docs record:motion
 *
 * Env:
 *   TK_DOCS_URL   base URL of a already-running docs server (skips spawning one)
 *   TK_MOTION_MP4 also emit an .mp4 next to each .gif
 */
import { spawn, type ChildProcess } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { record } from "@telekinesis/engine";
import { mixAudio, toGif } from "@telekinesis/render";
import { sections } from "../telekinesis/sections";

const here = path.dirname(fileURLToPath(import.meta.url));
const docsRoot = path.resolve(here, "..");
const motionDir = path.join(docsRoot, "public", "motion");
const soundsDir = path.join(docsRoot, "..", "..", "packages", "cli", "assets", "sounds");
const PORT = Number(process.env.TK_DOCS_PORT ?? 4311);
const wantMp4 = process.env.TK_MOTION_MP4 === "1";

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
  throw new Error(`docs server never became reachable at ${url}`);
}

async function main(): Promise<void> {
  const base = (process.env.TK_DOCS_URL ?? `http://localhost:${PORT}`).replace(/\/$/, "");
  await mkdir(motionDir, { recursive: true });

  let server: ChildProcess | undefined;
  if (!(await reachable(base))) {
    console.log(`● starting docs server (next start) on :${PORT}`);
    server = spawn("pnpm", ["exec", "next", "start", "--port", String(PORT)], {
      cwd: docsRoot,
      stdio: "ignore",
      env: { ...process.env, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "1" },
    });
    await waitForServer(base);
  }

  try {
    for (const [id, section] of Object.entries(sections)) {
      const url = `${base}${section.path}?demo`;
      console.log(`● recording "${id}"  ${url}`);
      const work = await mkdtemp(path.join(tmpdir(), `tk-motion-${id}-`));
      try {
        const result = await record(section.timesheet, {
          url,
          outDir: work,
          headless: true,
          onStep: (i, total, eff) =>
            process.stdout.write(`  ${i + 1}/${total}  ${eff.action}\n`),
        });
        // The recorded webm is pristine and tiny — the docs play it as a
        // <video>. The GIF is a lightweight, portable fallback.
        const webmOut = path.join(motionDir, `${id}.webm`);
        await copyFile(result.videoPath, webmOut);
        console.log(`  ✔ ${path.relative(docsRoot, webmOut)}`);

        const gifOut = path.join(motionDir, `${id}.gif`);
        const gif = await toGif(result.videoPath, {
          output: gifOut,
          fps: Number(process.env.TK_MOTION_FPS ?? 12),
          width: Number(process.env.TK_MOTION_WIDTH ?? 560),
          maxColors: 96,
          lossy: 80,
          onLog: (m) => process.stdout.write(`    ${m}\n`),
        });
        console.log(
          `  ✔ ${path.relative(docsRoot, gifOut)} (${gif.backend}${gif.optimized ? "+gifsicle" : ""})`,
        );
        if (wantMp4) {
          const mp4Out = path.join(motionDir, `${id}.mp4`);
          await mixAudio({ videoPath: result.videoPath, audioMap: result.audioMap, soundsDir, output: mp4Out });
          console.log(`  ✔ ${path.relative(docsRoot, mp4Out)}`);
        }
      } finally {
        await rm(work, { recursive: true, force: true });
      }
    }
  } finally {
    server?.kill();
  }
  console.log("✔ motion recorded");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
