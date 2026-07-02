import { SOUND_PROFILES, type SoundProfile } from "@telekinesis/schema";

/** A sound event with its offset (ms) from the start of playback. */
export interface SoundMark {
  profile: SoundProfile;
  /** Milliseconds since playback started. */
  t: number;
}

export interface SoundEngineOptions {
  /**
   * Kept for interface/back-compat with older builds. Sound is now
   * synthesized locally (Web Audio), so no asset base URL is fetched.
   */
  base?: string;
  /** Whether to actually play audio (off in recorder/external mode). */
  enabled?: boolean;
  volume?: number;
}

/* ------------------------------------------------------------------ *
 * Web Audio plumbing
 *
 * Mirrors `@telekinesis/render`'s `synth/` layer model — a filtered-noise
 * transient ("tick") plus a resonant, pitch-gliding oscillator body — but
 * built from native nodes (BiquadFilter, Oscillator, Gain, WaveShaper)
 * instead of hand-written PCM, so the live preview matches the rendered
 * asset pack without fetching it. See
 * `docs/mejoras-cinematograficas-2026-07.md` §1 for the design brief.
 * ------------------------------------------------------------------ */

type AudioContextCtor = new () => AudioContext;

function getAudioContextCtor(): AudioContextCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return w.AudioContext ?? w.webkitAudioContext;
}

/** `1 + jitter`, only when `allow` — deterministic profiles (variation: false) always return 1. */
function jitterIf(allow: boolean, amount: number): number {
  return allow ? 1 + (Math.random() * 2 - 1) * amount : 1;
}

function createNoiseBuffer(ctx: AudioContext, durationMs: number): AudioBuffer {
  const length = Math.max(1, Math.round((durationMs / 1000) * ctx.sampleRate));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/** Normalized tanh wave-shaping curve — the same soft saturation the offline synth applies. */
function makeSaturationCurve(drive: number, samples = 1024): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(samples);
  const norm = Math.tanh(drive) || 1;
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * drive) / norm;
  }
  return curve;
}

const curveCache = new Map<number, Float32Array<ArrayBuffer>>();
function saturationCurve(drive: number): Float32Array<ArrayBuffer> {
  let curve = curveCache.get(drive);
  if (!curve) {
    curve = makeSaturationCurve(drive);
    curveCache.set(drive, curve);
  }
  return curve;
}

/** A band-pass-filtered noise burst with a fast exponential decay — the percussive "tick". */
function scheduleTransient(
  ctx: AudioContext,
  dest: AudioNode,
  opts: { freqHz: number; q: number; durationMs: number; decayMs: number; startTime: number; gain: number },
): void {
  const source = ctx.createBufferSource();
  source.buffer = createNoiseBuffer(ctx, opts.durationMs);

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = opts.freqHz;
  filter.Q.value = opts.q;

  const env = ctx.createGain();
  const tau = Math.max(opts.decayMs, 0.001) / 1000;
  env.gain.setValueAtTime(opts.gain, opts.startTime);
  env.gain.setTargetAtTime(0, opts.startTime, tau);

  source.connect(filter);
  filter.connect(env);
  env.connect(dest);

  const stopAt = opts.startTime + Math.max(opts.durationMs / 1000, tau * 5);
  source.start(opts.startTime);
  source.stop(stopAt);
  source.onended = () => {
    source.disconnect();
    filter.disconnect();
    env.disconnect();
  };
}

/** A resonant oscillator with a pitch glide (drop or rise) and an exponential (optionally attack-first) envelope. */
function scheduleBody(
  ctx: AudioContext,
  dest: AudioNode,
  opts: {
    startHz: number;
    endHz: number;
    glideMs: number;
    decayMs: number;
    durationMs: number;
    startTime: number;
    gain: number;
    attackMs?: number;
  },
): void {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(opts.startHz, opts.startTime);
  osc.frequency.setTargetAtTime(opts.endHz, opts.startTime, Math.max(opts.glideMs, 0.001) / 1000);

  const env = ctx.createGain();
  const tau = Math.max(opts.decayMs, 0.001) / 1000;
  if (opts.attackMs && opts.attackMs > 0) {
    const attackEnd = opts.startTime + opts.attackMs / 1000;
    env.gain.setValueAtTime(0, opts.startTime);
    env.gain.linearRampToValueAtTime(opts.gain, attackEnd);
    env.gain.setTargetAtTime(0, attackEnd, tau);
  } else {
    env.gain.setValueAtTime(opts.gain, opts.startTime);
    env.gain.setTargetAtTime(0, opts.startTime, tau);
  }

  osc.connect(env);
  env.connect(dest);

  const stopAt = opts.startTime + Math.max(opts.durationMs / 1000, tau * 5);
  osc.start(opts.startTime);
  osc.stop(stopAt);
  osc.onended = () => {
    osc.disconnect();
    env.disconnect();
  };
}

/** Filtered noise with a band-pass sweep under a raised-cosine "bell" envelope — pure moving air, no body. */
function scheduleWhoosh(ctx: AudioContext, dest: AudioNode, startTime: number): void {
  const durationMs = 320;
  const durationSec = durationMs / 1000;

  const source = ctx.createBufferSource();
  source.buffer = createNoiseBuffer(ctx, durationMs);

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 1.0;
  const baseHz = 320;
  const peakHz = 2200;
  const freqSteps = 64;
  const freqCurve = new Float32Array(freqSteps);
  for (let i = 0; i < freqSteps; i++) {
    const t = (i / (freqSteps - 1)) * durationSec;
    freqCurve[i] = baseHz + (peakHz - baseHz) * Math.sin((Math.PI * t) / durationSec);
  }
  filter.frequency.setValueCurveAtTime(freqCurve, startTime, durationSec);

  const env = ctx.createGain();
  const envSteps = 128;
  const attackN = Math.max(1, Math.round(envSteps * 0.3));
  const envCurve = new Float32Array(envSteps);
  for (let i = 0; i < envSteps; i++) {
    envCurve[i] =
      i < attackN
        ? 0.5 - 0.5 * Math.cos(Math.PI * (i / attackN))
        : 0.5 + 0.5 * Math.cos(Math.PI * ((i - attackN) / Math.max(envSteps - attackN, 1)));
  }
  env.gain.setValueCurveAtTime(envCurve, startTime, durationSec);

  source.connect(filter);
  filter.connect(env);
  env.connect(dest);

  source.start(startTime);
  source.stop(startTime + durationSec);
  source.onended = () => {
    source.disconnect();
    filter.disconnect();
    env.disconnect();
  };
}

/** Two phases: a bright ~2.2kHz press tick, then — after the switch's travel time — a ~180Hz bottom-out thock. */
function scheduleMechanicalKeyboard(ctx: AudioContext, dest: AudioNode, now: number, v: boolean): void {
  const delaySec = (18 / 1000) * jitterIf(v, 0.15);
  scheduleTransient(ctx, dest, {
    freqHz: 2200 * jitterIf(v, 0.06),
    q: 1.8,
    durationMs: 6,
    decayMs: 2.5,
    startTime: now,
    gain: 0.55,
  });
  scheduleTransient(ctx, dest, {
    freqHz: 700 * jitterIf(v, 0.08),
    q: 1.3,
    durationMs: 5,
    decayMs: 3,
    startTime: now + delaySec,
    gain: 0.5 * jitterIf(v, 0.1),
  });
  scheduleBody(ctx, dest, {
    startHz: 210 * jitterIf(v, 0.04),
    endHz: 165 * jitterIf(v, 0.04),
    glideMs: 6,
    decayMs: 14,
    durationMs: 60,
    startTime: now + delaySec,
    gain: 0.6 * jitterIf(v, 0.08),
  });
  scheduleBody(ctx, dest, {
    startHz: 546 * jitterIf(v, 0.05),
    endHz: 429 * jitterIf(v, 0.05),
    glideMs: 5,
    decayMs: 9,
    durationMs: 45,
    startTime: now + delaySec,
    gain: 0.22 * jitterIf(v, 0.1),
  });
}

/** Short transient + a damped 150-200Hz body (fundamental + a soft inharmonic partial). */
function scheduleMacbookTrackpad(ctx: AudioContext, dest: AudioNode, now: number, v: boolean): void {
  scheduleTransient(ctx, dest, {
    freqHz: 1400 * jitterIf(v, 0.05),
    q: 1.2,
    durationMs: 4,
    decayMs: 1.8,
    startTime: now,
    gain: 0.35,
  });
  scheduleBody(ctx, dest, {
    startHz: 195 * jitterIf(v, 0.02),
    endHz: 155 * jitterIf(v, 0.02),
    glideMs: 8,
    decayMs: 9,
    durationMs: 50,
    startTime: now,
    gain: 0.62,
  });
  scheduleBody(ctx, dest, {
    startHz: 458 * jitterIf(v, 0.02),
    endHz: 364 * jitterIf(v, 0.02),
    glideMs: 6,
    decayMs: 6,
    durationMs: 40,
    startTime: now,
    gain: 0.2,
  });
}

/** Bright, brief transient + a short 400Hz body — the crispest, shortest voice of the pack. */
function scheduleMouseClick(ctx: AudioContext, dest: AudioNode, now: number, v: boolean): void {
  scheduleTransient(ctx, dest, {
    freqHz: 3600 * jitterIf(v, 0.06),
    q: 1.6,
    durationMs: 3,
    decayMs: 1.2,
    startTime: now,
    gain: 0.62,
  });
  scheduleBody(ctx, dest, {
    startHz: 430 * jitterIf(v, 0.04),
    endHz: 385 * jitterIf(v, 0.04),
    glideMs: 3,
    decayMs: 7,
    durationMs: 30,
    startTime: now,
    gain: 0.5,
  });
  scheduleBody(ctx, dest, {
    startHz: 946 * jitterIf(v, 0.04),
    endHz: 847 * jitterIf(v, 0.04),
    glideMs: 2,
    decayMs: 4,
    durationMs: 20,
    startTime: now,
    gain: 0.18,
  });
}

/** A small click accent under a sine that pitches up fast (320Hz -> 950Hz) then settles — a UI "pop". */
function schedulePop(ctx: AudioContext, dest: AudioNode, now: number, v: boolean): void {
  scheduleTransient(ctx, dest, {
    freqHz: 1800 * jitterIf(v, 0.08),
    q: 1.5,
    durationMs: 2,
    decayMs: 1,
    startTime: now,
    gain: 0.22,
  });
  scheduleBody(ctx, dest, {
    startHz: 320 * jitterIf(v, 0.05),
    endHz: 950 * jitterIf(v, 0.05),
    glideMs: 6,
    decayMs: 18,
    durationMs: 90,
    startTime: now,
    gain: 0.75,
    attackMs: 4,
  });
}

/** tanh saturation drive per profile — matches `@telekinesis/render`'s `synth/voices.ts`. */
const SATURATION_DRIVE: Record<SoundProfile, number> = {
  "mechanical-keyboard": 2.2,
  "macbook-trackpad": 2.6,
  "mouse-click": 2.0,
  pop: 1.6,
  whoosh: 1.3,
};

function scheduleVoice(ctx: AudioContext, profile: SoundProfile, dest: AudioNode, now: number, allowVariation: boolean): void {
  switch (profile) {
    case "mechanical-keyboard":
      return scheduleMechanicalKeyboard(ctx, dest, now, allowVariation);
    case "macbook-trackpad":
      return scheduleMacbookTrackpad(ctx, dest, now, allowVariation);
    case "mouse-click":
      return scheduleMouseClick(ctx, dest, now, allowVariation);
    case "pop":
      return schedulePop(ctx, dest, now, allowVariation);
    case "whoosh":
      return scheduleWhoosh(ctx, dest, now);
    default: {
      // Exhaustiveness guard: a new profile without a voice fails the build.
      const _exhaustive: never = profile;
      throw new Error(`No synth voice for sound profile: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Best-effort in-browser audio playback for live previews. Synthesizes each
 * hit live with Web Audio instead of fetching a flat WAV, so the preview
 * matches the rendered asset pack. In the recorder flow audio is *not*
 * played here — the engine records timestamps and the CLI mixes the real
 * rendered sounds with ffmpeg (Option B). Missing/blocked audio (no
 * `AudioContext`, autoplay policy, SSR) fails silently.
 */
export class SoundEngine {
  private volume: number;
  private ctx: AudioContext | undefined;
  private ctxUnavailable = false;
  enabled: boolean;

  constructor(opts: SoundEngineOptions = {}) {
    this.enabled = opts.enabled ?? true;
    this.volume = opts.volume ?? 0.5;
  }

  private ensureContext(): AudioContext | undefined {
    if (this.ctx) return this.ctx;
    if (this.ctxUnavailable) return undefined;
    const Ctor = getAudioContextCtor();
    if (!Ctor) {
      this.ctxUnavailable = true;
      return undefined;
    }
    try {
      this.ctx = new Ctor();
      return this.ctx;
    } catch {
      this.ctxUnavailable = true;
      return undefined;
    }
  }

  play(profile: SoundProfile): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      if (ctx.state === "suspended") void ctx.resume().catch(() => {});

      const meta = SOUND_PROFILES[profile];
      const now = ctx.currentTime;

      const bus = ctx.createGain(); // sums this hit's layers, unity gain
      const shaper = ctx.createWaveShaper();
      shaper.curve = saturationCurve(SATURATION_DRIVE[profile]);
      shaper.oversample = "4x";
      const master = ctx.createGain();
      master.gain.value = meta.synth.gain * this.volume;

      bus.connect(shaper);
      shaper.connect(master);
      master.connect(ctx.destination);

      scheduleVoice(ctx, profile, bus, now, meta.synth.variation);
    } catch {
      /* autoplay blocked, context creation failed, or node graph error — ignore */
    }
  }
}
