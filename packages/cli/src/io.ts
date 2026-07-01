import { readFile } from "node:fs/promises";
import { safeParseTimesheet, type Timesheet } from "@telekinesis/schema";

/** Read and validate a timesheet file, with friendly error reporting. */
export async function loadTimesheet(file: string): Promise<Timesheet> {
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch {
    throw new Error(`Cannot read timesheet: ${file}`);
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error(`Timesheet is not valid JSON: ${file}`);
  }

  const result = safeParseTimesheet(json);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid timesheet ${file}:\n${issues}`);
  }
  return result.data;
}
