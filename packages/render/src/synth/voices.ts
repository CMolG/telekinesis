import { SOUND_PROFILES, type SoundProfile } from "@telekinesis/schema";
import {
  Biquad,
  applyFades,
  attackDecayEnvelope,
  bellEnvelope,
  createRng,
  expDecayEnvelope,
  glideSine,
  hashSeed,
  jitter,
  msToSamples,
  normalizePeak,
  renderVoice,
  sweptBandpass,
  tanhSaturate,
  whiteNoise,
  type Layer,
} from "./dsp";
import { SAMPLE_RATE } from "./wav";

export interface SynthOptions {
  sampleRate?: number;
  /** Overrides the profile's default (stable, name-derived) seed. */
  seed?: number;
}

/**
 * The "tick": a band-pass-filtered noise burst with near-instant exponential
 * decay. Per the spec this is ~80% of the perceived physical click — every
 * voice below starts with one.
 */
function transientLayer(
  rng: () => number,
  sampleRate: number,
  freqHz: number,
  q: number,
  durationMs: number,
  decayMs: number,
): Float32Array {
  const n = msToSamples(durationMs, sampleRate);
  const noise = whiteNoise(n, rng);
  const filtered = new Biquad("bandpass", freqHz, q, sampleRate).processBuffer(noise);
  const env = expDecayEnvelope(n, sampleRate, decayMs);
  for (let i = 0; i < n; i++) filtered[i] *= env[i];
  applyFades(filtered, sampleRate, 0.25, 0); // 0.25ms fade-in only: kill the digital step, keep the attack
  return filtered;
}

/** A resonant body partial: one oscillator with a pitch-drop (or -rise) and an exponential decay. */
function bodyLayer(
  sampleRate: number,
  startHz: number,
  endHz: number,
  glideMs: number,
  decayMs: number,
  durationMs: number,
): Float32Array {
  const n = msToSamples(durationMs, sampleRate);
  const osc = glideSine(n, sampleRate, startHz, endHz, glideMs);
  const env = expDecayEnvelope(n, sampleRate, decayMs);
  for (let i = 0; i < n; i++) osc[i] *= env[i];
  applyFades(osc, sampleRate, 0.25, 0);
  return osc;
}

/**
 * Two phases: a bright ~2.2kHz press tick at t=0, then — after the switch's
 * travel time — a ~180Hz bottom-out thock (fundamental + an inharmonic
 * partial at ~2.6x, so it clacks rather than rings like a bell).
 */
function synthMechanicalKeyboard(rng: () => number, sampleRate: number): Float32Array {
  const total = msToSamples(90, sampleRate);
  const delaySamples = msToSamples(18 * jitter(rng, 0.15), sampleRate);

  const tick = transientLayer(rng, sampleRate, 2200 * jitter(rng, 0.06), 1.8, 6, 2.5);
  const bottomOut = transientLayer(rng, sampleRate, 700 * jitter(rng, 0.08), 1.3, 5, 3);
  const fundamental = bodyLayer(
    sampleRate,
    210 * jitter(rng, 0.04),
    165 * jitter(rng, 0.04),
    6,
    14,
    60,
  );
  const overtone = bodyLayer(sampleRate, 546 * jitter(rng, 0.05), 429 * jitter(rng, 0.05), 5, 9, 45);

  const layers: Layer[] = [
    { data: tick, gain: 0.55 },
    { data: bottomOut, gain: 0.5 * jitter(rng, 0.1), offsetSamples: delaySamples },
    { data: fundamental, gain: 0.6 * jitter(rng, 0.08), offsetSamples: delaySamples },
    { data: overtone, gain: 0.22 * jitter(rng, 0.1), offsetSamples: delaySamples },
  ];
  const sat = tanhSaturate(renderVoice(total, layers), 2.2);
  applyFades(sat, sampleRate, 0, 6);
  return sat;
}

/** Short transient + a damped 150-200Hz body (fundamental + a soft inharmonic partial), ~9ms tau. */
function synthMacbookTrackpad(rng: () => number, sampleRate: number): Float32Array {
  const total = msToSamples(60, sampleRate);
  const transient = transientLayer(rng, sampleRate, 1400 * jitter(rng, 0.05), 1.2, 4, 1.8);
  const fundamental = bodyLayer(sampleRate, 195 * jitter(rng, 0.02), 155 * jitter(rng, 0.02), 8, 9, 50);
  const overtone = bodyLayer(sampleRate, 458 * jitter(rng, 0.02), 364 * jitter(rng, 0.02), 6, 6, 40);

  const layers: Layer[] = [
    { data: transient, gain: 0.35 },
    { data: fundamental, gain: 0.62 },
    { data: overtone, gain: 0.2 },
  ];
  const sat = tanhSaturate(renderVoice(total, layers), 2.6);
  applyFades(sat, sampleRate, 0, 8);
  return sat;
}

/** Bright, brief transient + a short 400Hz body — the crispest, shortest voice of the pack. */
function synthMouseClick(rng: () => number, sampleRate: number): Float32Array {
  const total = msToSamples(40, sampleRate);
  const transient = transientLayer(rng, sampleRate, 3600 * jitter(rng, 0.06), 1.6, 3, 1.2);
  const fundamental = bodyLayer(sampleRate, 430 * jitter(rng, 0.04), 385 * jitter(rng, 0.04), 3, 7, 30);
  const overtone = bodyLayer(sampleRate, 946 * jitter(rng, 0.04), 847 * jitter(rng, 0.04), 2, 4, 20);

  const layers: Layer[] = [
    { data: transient, gain: 0.62 },
    { data: fundamental, gain: 0.5 },
    { data: overtone, gain: 0.18 },
  ];
  const sat = tanhSaturate(renderVoice(total, layers), 2.0);
  applyFades(sat, sampleRate, 0, 5);
  return sat;
}

/** A small click accent under a sine that pitches up fast (320Hz -> 950Hz) then settles — a UI "pop". */
function synthPop(rng: () => number, sampleRate: number): Float32Array {
  const total = msToSamples(100, sampleRate);
  const click = transientLayer(rng, sampleRate, 1800 * jitter(rng, 0.08), 1.5, 2, 1);

  const n = msToSamples(90, sampleRate);
  const osc = glideSine(n, sampleRate, 320 * jitter(rng, 0.05), 950 * jitter(rng, 0.05), 6);
  const env = attackDecayEnvelope(n, sampleRate, 4, 18);
  for (let i = 0; i < n; i++) osc[i] *= env[i];
  applyFades(osc, sampleRate, 0.25, 0);

  const layers: Layer[] = [
    { data: click, gain: 0.22 },
    { data: osc, gain: 0.75 },
  ];
  const sat = tanhSaturate(renderVoice(total, layers), 1.6);
  applyFades(sat, sampleRate, 0, 10);
  return sat;
}

/**
 * Filtered noise with a band-pass sweep (up then down, peaking mid-buffer)
 * under a raised-cosine "bell" amplitude envelope — no body oscillator, this
 * one is pure moving air.
 */
function synthWhoosh(rng: () => number, sampleRate: number): Float32Array {
  const durationMs = 320;
  const n = msToSamples(durationMs, sampleRate);
  const noise = whiteNoise(n, rng);
  const baseHz = 320 * jitter(rng, 0.1);
  const peakHz = 2200 * jitter(rng, 0.1);
  const durationSec = durationMs / 1000;
  const swept = sweptBandpass(
    noise,
    sampleRate,
    (t) => baseHz + (peakHz - baseHz) * Math.sin((Math.PI * t) / durationSec),
    1.0,
  );
  const env = bellEnvelope(n, 0.3);
  for (let i = 0; i < n; i++) swept[i] *= env[i];
  const sat = tanhSaturate(swept, 1.3);
  applyFades(sat, sampleRate, 1, 15);
  return sat;
}

function synthVoice(profile: SoundProfile, rng: () => number, sampleRate: number): Float32Array {
  switch (profile) {
    case "mechanical-keyboard":
      return synthMechanicalKeyboard(rng, sampleRate);
    case "macbook-trackpad":
      return synthMacbookTrackpad(rng, sampleRate);
    case "mouse-click":
      return synthMouseClick(rng, sampleRate);
    case "pop":
      return synthPop(rng, sampleRate);
    case "whoosh":
      return synthWhoosh(rng, sampleRate);
    default: {
      // Exhaustiveness guard: a new profile without a voice fails the build.
      const _exhaustive: never = profile;
      throw new Error(`No synth voice for sound profile: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Synthesizes one profile's hit as mono float samples in [-1, 1]. Deterministic:
 * the default seed is derived from the profile id, so regenerating the asset
 * pack is reproducible byte-for-byte. Applies the profile's catalog gain
 * (`@telekinesis/schema`'s `SOUND_PROFILES[profile].synth.gain`) last, then a
 * peak safety clamp.
 */
export function synthesizeProfile(profile: SoundProfile, opts: SynthOptions = {}): Float32Array {
  const sampleRate = opts.sampleRate ?? SAMPLE_RATE;
  const rng = createRng(opts.seed ?? hashSeed(profile));
  const voice = synthVoice(profile, rng, sampleRate);
  const { gain } = SOUND_PROFILES[profile].synth;
  for (let i = 0; i < voice.length; i++) voice[i] *= gain;
  normalizePeak(voice, 0.97);
  return voice;
}
