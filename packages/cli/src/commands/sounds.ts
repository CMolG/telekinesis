import { Command } from "commander";
import pc from "picocolors";
import { synthSounds } from "../ffmpeg";

interface SoundsOpts {
  output: string;
}

export function soundsCommand(): Command {
  return new Command("sounds")
    .description("Procedurally synthesize the sound pack (wav) — pure Node, no ffmpeg")
    .option("-o, --output <dir>", "directory to write the pack into", "telekinesis-sounds")
    .action(async (opts: SoundsOpts) => {
      const written = await synthSounds(opts.output);
      console.log(pc.green("✔"), `wrote ${written.length} sounds to ${pc.bold(opts.output)}`);
      console.log(pc.dim("  Drop in your own .wav files (same filenames) to override any of them."));
    });
}
