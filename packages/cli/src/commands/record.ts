import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { record } from "@telekinesis/engine";
import { Command } from "commander";
import pc from "picocolors";
import { defaultSoundsDir, ensureFfmpeg, mixAudio, toGif } from "../ffmpeg";
import { loadTimesheet } from "../io";

type Format = "mp4" | "gif" | "both";

interface RecordOpts {
  url?: string;
  output: string;
  format: Format;
  sounds?: string;
  headed?: boolean;
  keepTemp?: boolean;
  gifFps: string;
  gifWidth: string;
  /** commander sets this to false when `--no-gifski` is passed. */
  gifski: boolean;
}

export function recordCommand(): Command {
  return new Command("record")
    .description("Record a demo from a timesheet — as MP4, GIF, or both")
    .argument("<timesheet>", "path to a timesheet .json")
    .option("-u, --url <url>", "URL to record (overrides timesheet.url)")
    .option("-o, --output <file>", "output file (extension derives per format)", "telekinesis-demo.mp4")
    .option("-f, --format <format>", "mp4 | gif | both", "mp4")
    .option("-s, --sounds <dir>", "sound asset pack directory")
    .option("--gif-fps <n>", "GIF frames per second", "15")
    .option("--gif-width <px>", "GIF width in px (height keeps aspect)", "640")
    .option("--no-gifski", "force the ffmpeg GIF backend even if gifski is installed")
    .option("--headed", "run the browser headed", false)
    .option("--keep-temp", "keep intermediate artifacts", false)
    .action(async (timesheetPath: string, opts: RecordOpts) => {
      const format = opts.format;
      if (format !== "mp4" && format !== "gif" && format !== "both") {
        throw new Error(`--format must be one of mp4 | gif | both (got "${format}")`);
      }
      const wantMp4 = format === "mp4" || format === "both";
      const wantGif = format === "gif" || format === "both";

      const base = opts.output.replace(/\.(mp4|gif)$/i, "");
      const mp4Out = `${base}.mp4`;
      const gifOut = `${base}.gif`;

      const sheet = await loadTimesheet(timesheetPath);
      await ensureFfmpeg();

      const work = await mkdtemp(path.join(tmpdir(), "telekinesis-"));
      try {
        console.log(pc.cyan("●"), `recording ${pc.bold(String(sheet.timeline.length))} steps`);
        const result = await record(sheet, {
          url: opts.url,
          outDir: work,
          headless: !opts.headed,
          onStep: (i, total, eff) =>
            process.stdout.write(pc.dim(`  ${i + 1}/${total}  ${eff.action}\n`)),
        });

        if (wantMp4) {
          console.log(pc.cyan("●"), `mixing ${pc.bold(String(result.audioMap.marks.length))} sound cues`);
          const { mixed } = await mixAudio({
            videoPath: result.videoPath,
            audioMap: result.audioMap,
            soundsDir: opts.sounds ?? defaultSoundsDir(),
            output: mp4Out,
          });
          console.log(
            pc.green("✔"),
            `wrote ${pc.bold(mp4Out)} ` +
              pc.dim(`(${(result.durationMs / 1000).toFixed(1)}s, ${mixed} sounds mixed)`),
          );
        }

        if (wantGif) {
          console.log(pc.cyan("●"), "encoding GIF");
          const gif = await toGif(result.videoPath, {
            output: gifOut,
            fps: Number(opts.gifFps),
            width: Number(opts.gifWidth),
            gifski: opts.gifski ? "auto" : "never",
            onLog: (m) => process.stdout.write(pc.dim(`  ${m}\n`)),
          });
          console.log(
            pc.green("✔"),
            `wrote ${pc.bold(gifOut)} ` +
              pc.dim(`(${gif.backend}, ${gif.fps}fps, ${gif.width}px)`),
          );
        }
      } finally {
        if (opts.keepTemp) console.log(pc.dim(`  kept artifacts in ${work}`));
        else await rm(work, { recursive: true, force: true });
      }
    });
}
