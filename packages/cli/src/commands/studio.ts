import { createRequire } from "node:module";
import { Command } from "commander";
import { execa } from "execa";
import pc from "picocolors";

interface StudioOpts {
  port?: string;
  target?: string;
}

/** Resolve the Studio's launcher, if the package is installed. */
function resolveStudioBin(): string | undefined {
  try {
    return createRequire(import.meta.url).resolve("@telekinesis/studio/server/bin.mjs");
  } catch {
    return undefined;
  }
}

/**
 * Launch the Studio — the interactive timesheet editor. It ships as its own
 * package (`@telekinesis/studio`) with a `telekinesis-studio` bin; this command
 * is a thin delegator so `telekinesis studio` works out of the box in the
 * monorepo. We don't statically import it (keeps the CLI light), we spawn it.
 */
export function studioCommand(): Command {
  return new Command("studio")
    .description("Launch the interactive timesheet editor (CapCut-style) in your browser")
    .option("-p, --port <port>", "port for the Studio server", "57174")
    .option("-t, --target <url>", "URL of the app to edit (defaults to the docs site)")
    .action(async (opts: StudioOpts) => {
      const args: string[] = [];
      if (opts.port) args.push("--port", opts.port);
      if (opts.target) args.push("--target", opts.target);

      const bin = resolveStudioBin();
      try {
        if (bin) {
          await execa(process.execPath, [bin, ...args], { stdio: "inherit" });
        } else {
          await execa("telekinesis-studio", args, { stdio: "inherit", preferLocal: true });
        }
      } catch (err) {
        const e = err as NodeJS.ErrnoException & { exitCode?: number };
        if (e.code === "ENOENT") {
          console.error(pc.red("✖"), "the Studio is not installed.");
          console.error(pc.dim("  In the Telekinesis monorepo run:  pnpm studio"));
          console.error(pc.dim("  Otherwise install it:             pnpm add -D @telekinesis/studio"));
          process.exitCode = 1;
          return;
        }
        // A non-zero exit from the Studio itself: pass the code through cleanly.
        if (typeof e.exitCode === "number") {
          process.exitCode = e.exitCode;
          return;
        }
        throw err;
      }
    });
}
