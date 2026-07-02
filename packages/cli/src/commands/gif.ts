import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { record } from "@telekinesis/engine";
import { Command } from "commander";
import pc from "picocolors";
import { ensureFfmpeg, toGif } from "../ffmpeg";
import { loadTimesheet } from "../io";

interface GifOpts {
  url?: string;
  output: string;
  fps: string;
  width: string;
  maxColors?: string;
  lossy?: string;
  /** commander sets this to false when `--no-gifski` is passed. */
  gifski: boolean;
  headed?: boolean;
}

export function gifCommand(): Command {
  return new Command("gif")
    .description("Record a demo from a timesheet and export a lightweight looping GIF")
    .argument("<timesheet>", "path to a timesheet .json")
    .option("-u, --url <url>", "URL to record (overrides timesheet.url)")
    .option("-o, --output <file>", "output .gif file", "telekinesis-demo.gif")
    .option("--fps <n>", "frames per second", "15")
    .option("--width <px>", "width in px (height keeps aspect)", "640")
    .option("--max-colors <n>", "cap the palette (2–256) for a smaller file")
    .option("--lossy <n>", "gifsicle lossy amount (needs gifsicle; smaller file)")
    .option("--no-gifski", "force the ffmpeg backend even if gifski is installed")
    .option("--headed", "run the browser headed", false)
    .action(async (timesheetPath: string, opts: GifOpts) => {
      const output = opts.output.endsWith(".gif") ? opts.output : `${opts.output}.gif`;
      const sheet = await loadTimesheet(timesheetPath);
      await ensureFfmpeg();

      const work = await mkdtemp(path.join(tmpdir(), "telekinesis-gif-"));
      try {
        console.log(pc.cyan("●"), `recording ${pc.bold(String(sheet.timeline.length))} steps`);
        const result = await record(sheet, {
          url: opts.url,
          outDir: work,
          headless: !opts.headed,
          onStep: (i, total, eff) =>
            process.stdout.write(pc.dim(`  ${i + 1}/${total}  ${eff.action}\n`)),
        });

        console.log(pc.cyan("●"), "encoding GIF");
        const gif = await toGif(result.videoPath, {
          output,
          fps: Number(opts.fps),
          width: Number(opts.width),
          maxColors: opts.maxColors ? Number(opts.maxColors) : undefined,
          lossy: opts.lossy ? Number(opts.lossy) : undefined,
          gifski: opts.gifski ? "auto" : "never",
          onLog: (m) => process.stdout.write(pc.dim(`  ${m}\n`)),
        });

        console.log(
          pc.green("✔"),
          `wrote ${pc.bold(output)} ` +
            pc.dim(
              `(${gif.backend}${gif.optimized ? "+gifsicle" : ""}, ${gif.fps}fps, ${gif.width}px, ` +
                `${(result.durationMs / 1000).toFixed(1)}s)`,
            ),
        );
      } finally {
        await rm(work, { recursive: true, force: true });
      }
    });
}
