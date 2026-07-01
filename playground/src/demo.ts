import type { TimesheetInput } from "@telekinesis/schema";

/**
 * A self-contained tour of the effects library against the playground UI.
 * The frame ids here must match the `<TelekineticFrame id=...>` in App.tsx.
 */
export const demoTimesheet: TimesheetInput = {
  meta: { title: "Telekinesis playground tour", author: "telekinesis" },
  resolution: { width: 1280, height: 720 },
  timeline: [
    { action: "wait", duration: 500 },

    // 1. Zoom onto the pricing table and spotlight the Pro plan.
    { action: "zoom-in", frameId: "pricing", scale: 1.12, duration: 1100, easing: "ease-out" },
    { action: "highlight", frameId: "tier-pro", duration: 1300, delayAfter: 200 },

    // 2. Move the ghost cursor to the Pro CTA and click it.
    { action: "cursor-move", destFrameId: "tier-pro-cta", duration: 750 },
    { action: "click", frameId: "tier-pro-cta", soundProfile: "macbook-trackpad", delayAfter: 400 },
    { action: "zoom-out", duration: 800, delayAfter: 300 },

    // 3. Fill the login form like a human.
    { action: "cursor-move", destFrameId: "email", duration: 700 },
    { action: "click", frameId: "email" },
    {
      action: "type-down",
      frameId: "email",
      text: "ada@telekinesis.dev",
      typingSpeed: 60,
      soundProfile: "mechanical-keyboard",
      delayAfter: 250,
    },
    { action: "cursor-move", destFrameId: "password", duration: 600 },
    { action: "click", frameId: "password" },
    {
      action: "type-down",
      frameId: "password",
      text: "l0vel@ce",
      typingSpeed: 72,
      soundProfile: "mechanical-keyboard",
      delayAfter: 250,
    },

    // 4. Submit, with a tiny anticipation shake, then celebrate.
    { action: "cursor-move", destFrameId: "login", duration: 650 },
    { action: "shake", frameId: "login", intensity: "low", duration: 320 },
    { action: "click", frameId: "login", soundProfile: "macbook-trackpad", delayAfter: 700 },
    { action: "highlight", frameId: "welcome", duration: 1600, padding: 14 },
  ],
};
