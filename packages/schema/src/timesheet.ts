import { z } from "zod";
import { Effect } from "./effects";

/** Output frame size. Defaults to 1080p. */
export const Resolution = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export type Resolution = z.infer<typeof Resolution>;

export const TimesheetMeta = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  author: z.string().optional(),
  /** Tool/agent that produced this timesheet, e.g. "telekinesis-mcp". */
  generatedBy: z.string().optional(),
});
export type TimesheetMeta = z.infer<typeof TimesheetMeta>;

/**
 * The timesheet — the "score" the recorder performs. An ordered timeline of
 * effects plus the recording settings. Cross-field rules (e.g. drag/cursor
 * needing a destination) are enforced here so generators can't emit a
 * structurally valid but unplayable sheet.
 */
export const Timesheet = z
  .object({
    version: z.literal("1.0").default("1.0"),
    meta: TimesheetMeta.optional(),
    /** Page to record. The CLI may override this. */
    url: z.string().url().optional(),
    resolution: Resolution.default({ width: 1920, height: 1080 }),
    fps: z.number().int().positive().max(120).default(30),
    timeline: z.array(Effect).min(1, "A timesheet needs at least one effect."),
  })
  .superRefine((sheet, ctx) => {
    sheet.timeline.forEach((eff, i) => {
      if (eff.action === "drag-and-drop" || eff.action === "cursor-move") {
        const hasDest =
          eff.destFrameId != null ||
          (eff.destX != null && eff.destY != null);
        if (!hasDest) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["timeline", i],
            message: `${eff.action} needs a destination: destFrameId (preferred) or both destX and destY.`,
          });
        }
      }
    });
  });

/** Fully-resolved timesheet (defaults applied). */
export type Timesheet = z.infer<typeof Timesheet>;
/** Loose timesheet as authored (defaults optional). */
export type TimesheetInput = z.input<typeof Timesheet>;

/** Parse & validate, throwing a ZodError on failure. */
export function parseTimesheet(input: unknown): Timesheet {
  return Timesheet.parse(input);
}

/** Parse & validate without throwing. */
export function safeParseTimesheet(input: unknown) {
  return Timesheet.safeParse(input);
}
