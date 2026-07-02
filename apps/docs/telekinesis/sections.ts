import type { TimesheetInput } from "@telekinesis/schema";

/**
 * One recorded tutorial per documentation section. Each `timesheet` targets the
 * `<Frame id=...>` markers on its `path`. These drive two things from a single
 * source of truth:
 *   1. `<DemoGif section>` — plays the timesheet live in the page.
 *   2. `scripts/record-sections.ts` — records each into `public/motion/<id>.gif`.
 */
export interface DemoSection {
  /** Route to record (frames must be mounted here). */
  path: string;
  title: string;
  timesheet: TimesheetInput;
}

const resolution = { width: 1280, height: 720 };

export const sections: Record<string, DemoSection> = {
  hero: {
    path: "/",
    title: "The pitch, performed",
    timesheet: {
      meta: { title: "Docs hero tour", author: "telekinesis" },
      resolution,
      timeline: [
        { action: "wait", duration: 400 },
        { action: "highlight", frameId: "hero", duration: 1200, delayAfter: 200 },
        { action: "zoom-in", frameId: "hero-cta", scale: 1.18, duration: 1000, easing: "ease-out" },
        { action: "cursor-move", destFrameId: "hero-cta", duration: 650 },
        { action: "zoom-out", duration: 800, delayAfter: 200 },
        { action: "scroll-down", distance: "viewport", duration: 700, delayAfter: 250 },
        { action: "highlight", frameId: "pillars", duration: 1100, delayAfter: 150 },
        { action: "zoom-in", frameId: "pillar-motion", scale: 1.14, duration: 900, easing: "ease-out" },
        { action: "highlight", frameId: "pillar-motion", duration: 1000, delayAfter: 200 },
        { action: "zoom-out", duration: 800 },
        { action: "wait", duration: 1200 },
      ],
    },
  },

  effects: {
    path: "/effects",
    title: "Every effect, in motion",
    timesheet: {
      meta: { title: "Effects showcase", author: "telekinesis" },
      resolution,
      timeline: [
        { action: "wait", duration: 400 },
        { action: "highlight", frameId: "fx-grid", duration: 1000, delayAfter: 150 },
        { action: "zoom-in", frameId: "fx-zoom", scale: 1.2, duration: 900, easing: "ease-out", delayAfter: 150 },
        { action: "zoom-out", duration: 700 },
        { action: "highlight", frameId: "fx-highlight", duration: 1100, delayAfter: 150 },
        { action: "cursor-move", destFrameId: "fx-cursor", duration: 700, curve: "bezier" },
        { action: "shake", frameId: "fx-cursor", intensity: "low", duration: 320, delayAfter: 150 },
        { action: "cursor-move", destFrameId: "fx-type", duration: 600 },
        { action: "click", frameId: "fx-type", delayAfter: 150 },
        {
          action: "type-down",
          frameId: "fx-type",
          text: "motion is the message",
          typingSpeed: 55,
          soundProfile: "mechanical-keyboard",
          delayAfter: 300,
        },
        { action: "wait", duration: 1000 },
      ],
    },
  },

  timesheet: {
    path: "/timesheet",
    title: "The score it performs",
    timesheet: {
      meta: { title: "Timesheet anatomy", author: "telekinesis" },
      resolution,
      timeline: [
        { action: "wait", duration: 400 },
        { action: "highlight", frameId: "ts-json", duration: 1300, delayAfter: 200 },
        { action: "zoom-in", frameId: "ts-json", scale: 1.15, duration: 1000, easing: "ease-out", delayAfter: 300 },
        { action: "zoom-out", duration: 800 },
        { action: "wait", duration: 900 },
      ],
    },
  },

  "gif-export": {
    path: "/gif-export",
    title: "Ship it as a GIF",
    timesheet: {
      meta: { title: "GIF export", author: "telekinesis" },
      resolution,
      timeline: [
        { action: "wait", duration: 400 },
        { action: "highlight", frameId: "gif-demo", duration: 1200, delayAfter: 200 },
        { action: "zoom-in", frameId: "gif-demo", scale: 1.16, duration: 900, easing: "ease-out", delayAfter: 300 },
        { action: "zoom-out", duration: 800 },
        { action: "wait", duration: 900 },
      ],
    },
  },

  studio: {
    path: "/studio",
    title: "Edit it like video",
    timesheet: {
      meta: { title: "Studio tour", author: "telekinesis" },
      resolution,
      timeline: [
        { action: "wait", duration: 400 },
        { action: "highlight", frameId: "studio-shot", duration: 1300, delayAfter: 200 },
        { action: "zoom-in", frameId: "studio-shot", scale: 1.12, duration: 1000, easing: "ease-out", delayAfter: 300 },
        { action: "zoom-out", duration: 800 },
        { action: "wait", duration: 900 },
      ],
    },
  },
};

/** Convenience map used by `<DemoGif>` (timesheet only). */
export const sectionTimesheets: Record<string, TimesheetInput> = Object.fromEntries(
  Object.entries(sections).map(([id, s]) => [id, s.timesheet]),
);
