import { Command } from "commander";
import pc from "picocolors";
import { ensureFfmpeg, synthSounds } from "../ffmpeg";

interface SoundsOpts {
  output: string;
}

export function soundsCommand(): Command {
  return new Command("sounds")
    .description("Synthesize a starter sound pack (wav) with ffmpeg")
    .option("-o, --output <dir>", "directory to write the pack into", "telekinesis-sounds")
    .action(async (opts: SoundsOpts) => {
      await ensureFfmpeg();
      const written = await synthSounds(opts.output);
      console.log(pc.green("✔"), `wrote ${written.length} sounds to ${pc.bold(opts.output)}`);
      console.log(pc.dim("  These are placeholders — drop in your own .wav files to upgrade."));
    });
}
