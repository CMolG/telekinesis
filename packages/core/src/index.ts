/**
 * @telekinesis/core — the browser runtime.
 *
 * The React surface (`<TelekineticFrame>`, `<TelekinesisStage>`) plus the
 * framework-agnostic engine (registry, cursor, overlay, effects, player) and
 * the `window.__telekinesis` bridge the recorder talks to.
 */
export { isDemoMode, isStudioMode, setForcedDemoMode, type DetectOptions } from "./detect";

export {
  installStudioBridge,
  createStudioClient,
  type StudioClient,
  type StudioClientOptions,
  type StudioPlayOptions,
} from "./studio-bridge";

export { play, type PlayOptions } from "./player";
export { seekTo } from "./seek";
export { runEffect, destPoint, type RunContext } from "./effects";
export {
  installRuntime,
  getRuntime,
  VERSION,
  type TelekinesisRuntime,
} from "./runtime";

export {
  registryStore,
  getFrame,
  getFrameElement,
  getFrameRect,
  listFrames,
  type FrameRecord,
  type FrameInfo,
} from "./registry";

export { getCursor, GhostCursor, fittsEase, type MoveOptions } from "./cursor";
export { getOverlay, Overlay, type HighlightOptions } from "./overlay";
export { Camera, type CameraState, type CameraMotion, type CameraOptions } from "./camera";
export { getLayer, destroyLayer } from "./layer";
export { SoundEngine, type SoundMark, type SoundEngineOptions } from "./sound";
export { cssEasing, jsEasing } from "./easing";
export {
  Spring,
  animateSpring,
  animateSprings,
  DEFAULT_SPRING_PARAMS,
  type SpringParams,
} from "./timing";
export type { Point, RectJSON } from "./geometry";

// React surface (peer dependency)
export {
  TelekineticFrame,
  type TelekineticFrameProps,
} from "./react/TelekineticFrame";
export {
  TelekinesisStage,
  type TelekinesisStageProps,
} from "./react/TelekinesisStage";
