/**
 * Procedural audio synthesis for the sound pack: layered, PCM-accurate voices
 * written directly to WAV — no ffmpeg, no recorded samples. See
 * `docs/mejoras-cinematograficas-2026-07.md` §1 for the design brief.
 */
export { synthesizeProfile, type SynthOptions } from "./voices";
export { encodeWavPcm16, SAMPLE_RATE } from "./wav";
