import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { record } from "@telekinesis/engine";
import { Command } from "commander";
import pc from "picocolors";
import { loadTimesheet } from "../io";

interface PreviewOpts {
  url?: string;
}

export function previewCommand(): Command {
  return new Command("preview")
    .description("Open a headed browser and perform the timesheet without recording")
    .argument("<timesheet>", "path to a timesheet .json")
    .option("-u, --url <url>", "URL to open (overrides timesheet.url)")
    .action(async (timesheetPath: string, opts: PreviewOpts) => {
      const sheet = await loadTimesheet(timesheetPath);
      const work = await mkdtemp(path.join(tmpdir(), "telekinesis-preview-"));
      try {
        console.log(pc.cyan("●"), "previewing (headed, no recording) — close the window when done");
        await record(sheet, {
          url: opts.url,
          outDir: work,
          headless: false,
          recordVideo: false,
        });
      } finally {
        await rm(work, { recursive: true, force: true });
      }
    });
}
