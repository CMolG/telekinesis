import { Command } from "commander";
import pc from "picocolors";
import { gifCommand } from "./commands/gif";
import { initCommand } from "./commands/init";
import { previewCommand } from "./commands/preview";
import { recordCommand } from "./commands/record";
import { soundsCommand } from "./commands/sounds";
import { studioCommand } from "./commands/studio";

const program = new Command();

program
  .name("telekinesis")
  .description("Cinematic, AI-orchestrated product demo videos — your app records itself.")
  .version("0.1.0");

program.addCommand(recordCommand());
program.addCommand(gifCommand());
program.addCommand(previewCommand());
program.addCommand(studioCommand());
program.addCommand(initCommand());
program.addCommand(soundsCommand());

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(pc.red("✖"), err instanceof Error ? err.message : String(err));
  process.exit(1);
});
