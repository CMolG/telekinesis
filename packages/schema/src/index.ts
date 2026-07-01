/**
 * @telekinesis/schema — the shared contract.
 *
 * Effects, the timesheet, the sound catalog and JSON-Schema exports used by the
 * UI engine (`@telekinesis/core`), the Playwright recorder (`@telekinesis/engine`),
 * the CLI and the MCP server.
 */
export * from "./easing";
export * from "./sound";
export * from "./effects";
export * from "./timesheet";
export * from "./jsonschema";

/** Timesheet schema version this package speaks. */
export const TELEKINESIS_SCHEMA_VERSION = "1.0" as const;
