import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { record } from "@telekinesis/engine";
import { Command } from "commander";
import pc from "picocolors";
import { ensureFfmpeg, mixAudio } from "../ffmpeg";
import { loadTimesheet } from "../io";

interface RecordOpts {
  url?: string;
  output: string;
  sounds?: string;
  headed?: boolean;
  keepTemp?: boolean;
}

export function recordCommand(): Command {
  return new Command("record")
    .description("Record a demo video from a timesheet")
    .argument("<timesheet>", "path to a timesheet .json")
    .option("-u, --url <url>", "URL to record (overrides timesheet.url)")
    .option("-o, --output <file>", "output video file", "telekinesis-demo.mp4")
    .option("-s, --sounds <dir>", "sound asset pack directory")
    .option("--headed", "run the browser headed", false)
    .option("--keep-temp", "keep intermediate artifacts", false)
    .action(async (timesheetPath: string, opts: RecordOpts) => {
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

        console.log(pc.cyan("●"), `mixing ${pc.bold(String(result.audioMap.marks.length))} sound cues`);
        const { mixed } = await mixAudio({
          videoPath: result.videoPath,
          audioMap: result.audioMap,
          soundsDir: opts.sounds,
          output: opts.output,
        });

        console.log(
          pc.green("✔"),
          `wrote ${pc.bold(opts.output)} ` +
            pc.dim(`(${(result.durationMs / 1000).toFixed(1)}s, ${mixed} sounds mixed)`),
        );
      } finally {
        if (opts.keepTemp) console.log(pc.dim(`  kept artifacts in ${work}`));
        else await rm(work, { recursive: true, force: true });
      }
    });
}
