export {};

/**
 * `window.__telekinesis` is the runtime API installed by `<TelekinesisStage>`
 * in demo mode (see `packages/core/src/runtime.ts`'s `TelekinesisRuntime`).
 * Specs only need a handful of loosely-typed calls (`listFrames`, `getRect`,
 * `ready`), so a lax `any` here is intentional rather than importing the full
 * type from `@telekinesis/core` (not a dependency of this workspace).
 */
declare global {
  interface Window {
    __telekinesis?: any;
  }
}
