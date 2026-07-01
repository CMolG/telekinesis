import { writeFile } from "node:fs/promises";
import { Command } from "commander";
import pc from "picocolors";

interface InitOpts {
  output: string;
  url: string;
}

export function initCommand(): Command {
  return new Command("init")
    .description("Create a starter timesheet you can edit")
    .option("-o, --output <file>", "file to write", "telekinesis.timesheet.json")
    .option("-u, --url <url>", "URL of the page to record", "http://localhost:3000?demo")
    .action(async (opts: InitOpts) => {
      const starter = {
        version: "1.0",
        meta: { title: "My Telekinesis demo" },
        url: opts.url,
        resolution: { width: 1280, height: 720 },
        fps: 30,
        timeline: [
          { action: "wait", duration: 500 },
          { action: "zoom-in", frameId: "REPLACE_WITH_FRAME_ID", scale: 1.15, duration: 1100 },
          { action: "highlight", frameId: "REPLACE_WITH_FRAME_ID", duration: 1200 },
          { action: "cursor-move", destFrameId: "REPLACE_WITH_FRAME_ID", duration: 700 },
          { action: "click", frameId: "REPLACE_WITH_FRAME_ID", soundProfile: "macbook-trackpad" },
          { action: "zoom-out", duration: 800 },
        ],
      };
      await writeFile(opts.output, JSON.stringify(starter, null, 2) + "\n", "utf8");
      console.log(pc.green("✔"), `created ${pc.bold(opts.output)}`);
      console.log(
        pc.dim(
          "  Replace the frame ids with your <TelekineticFrame id=...> values, then run:\n" +
            `  telekinesis preview ${opts.output}`,
        ),
      );
    });
}
