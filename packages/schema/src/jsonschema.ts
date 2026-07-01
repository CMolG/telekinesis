import { zodToJsonSchema } from "zod-to-json-schema";
import { Effect } from "./effects";
import { Timesheet } from "./timesheet";

/**
 * JSON Schema for a full timesheet. Handed to LLMs (via the MCP server) so a
 * model can emit a structurally valid timesheet without hallucinating fields.
 * Refs are inlined (`$refStrategy: "none"`) because models follow flat schemas
 * far more reliably than `$ref`-heavy ones.
 */
export const timesheetJsonSchema = zodToJsonSchema(Timesheet, {
  name: "Timesheet",
  $refStrategy: "none",
});

/** JSON Schema for a single effect (handy for editor tooling). */
export const effectJsonSchema = zodToJsonSchema(Effect, {
  name: "Effect",
  $refStrategy: "none",
});
