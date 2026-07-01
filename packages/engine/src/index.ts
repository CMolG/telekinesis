/**
 * @telekinesis/engine — the Playwright recorder.
 *
 * Produces a silent video plus `audio-map.json` (sound events with millisecond
 * timestamps). The CLI mixes real audio afterwards with ffmpeg.
 */
export {
  record,
  type AudioMap,
  type AudioMark,
  type RecordOptions,
  type RecordResult,
} from "./record";

export {
  extractFrames,
  type ExtractedFrame,
  type ExtractedRect,
  type ExtractOptions,
} from "./extract";
