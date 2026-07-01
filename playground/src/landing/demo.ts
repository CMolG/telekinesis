import type { TimesheetInput } from "@telekinesis/schema";

/**
 * A cinematic tour of the landing page: hero → AI feature → waitlist sign-up.
 * The frame ids here must match the `<TelekineticFrame id=...>` markers on
 * the landing page (nav-cta, hero, hero-cta, hero-visual, features,
 * feature-cinematic, feature-ai, feature-ci, waitlist, waitlist-email,
 * waitlist-submit, waitlist-success).
 */
export const landingTimesheet: TimesheetInput = {
  meta: {
    title: "Landing → waitlist tour",
    description: "Sweep the hero, spotlight the AI feature, then join the waitlist.",
    author: "telekinesis",
  },
  resolution: { width: 1280, height: 720 },
  timeline: [
    { action: "wait", duration: 500 },

    // 1. Spotlight the hero, then punch in on the primary CTA and click it.
    { action: "highlight", frameId: "hero", duration: 1300, delayAfter: 200 },
    { action: "zoom-in", frameId: "hero-cta", scale: 1.15, duration: 1100, easing: "ease-out" },
    { action: "cursor-move", destFrameId: "hero-cta", duration: 700 },
    { action: "click", frameId: "hero-cta", soundProfile: "macbook-trackpad", delayAfter: 400 },
    { action: "zoom-out", duration: 800, delayAfter: 300 },

    // 2. Scroll to the features and call out the AI feature.
    { action: "scroll-down", distance: "viewport", duration: 700, delayAfter: 300 },
    { action: "highlight", frameId: "features", duration: 1200, delayAfter: 200 },
    { action: "zoom-in", frameId: "feature-ai", scale: 1.12, duration: 1000, easing: "ease-out" },
    { action: "highlight", frameId: "feature-ai", duration: 1200, delayAfter: 200 },
    { action: "zoom-out", duration: 800, delayAfter: 300 },

    // 3. Scroll to the waitlist and fill it in like a human.
    { action: "scroll-down", distance: "viewport", duration: 700, delayAfter: 300 },
    { action: "cursor-move", destFrameId: "waitlist-email", duration: 700 },
    { action: "click", frameId: "waitlist-email", delayAfter: 200 },
    {
      action: "type-down",
      frameId: "waitlist-email",
      text: "ada@telekinesis.dev",
      typingSpeed: 60,
      soundProfile: "mechanical-keyboard",
      delayAfter: 250,
    },

    // 4. Submit, with a tiny anticipation shake, then celebrate.
    { action: "cursor-move", destFrameId: "waitlist-submit", duration: 650 },
    { action: "shake", frameId: "waitlist-submit", intensity: "low", duration: 320 },
    { action: "click", frameId: "waitlist-submit", soundProfile: "macbook-trackpad", delayAfter: 700 },
    { action: "highlight", frameId: "waitlist-success", duration: 1600, padding: 14 },

    // 5. Hold on the celebration so the recorder captures the final beat.
    { action: "wait", duration: 3000 },
  ],
};
