/**
 * Sample-accurate DSP primitives for procedural sound synthesis. Zero
 * dependencies — every function operates on plain `Float32Array` buffers of
 * samples in [-1, 1]. `voices.ts` composes these into the five sound
 * profiles; `@telekinesis/core`'s `sound.ts` shapes the same layers with
 * native Web Audio nodes so the rendered assets and the live preview match.
 */

export function msToSamples(ms: number, sampleRate: number): number {
  return Math.max(0, Math.round((ms / 1000) * sampleRate));
}

/** Deterministic PRNG (mulberry32): the same seed always yields the same stream. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a string hash — turns a profile id into a stable default seed. */
export function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** `1 + jitter`, e.g. `jitter(rng, 0.05)` returns a factor in [0.95, 1.05]. */
export function jitter(rng: () => number, amount: number): number {
  return 1 + (rng() * 2 - 1) * amount;
}

/** White noise in [-1, 1], driven by `rng` so bursts are reproducible per seed. */
export function whiteNoise(n: number, rng: () => number): Float32Array {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = rng() * 2 - 1;
  return out;
}

export type FilterType = "lowpass" | "highpass" | "bandpass";

/**
 * One RBJ "Audio EQ Cookbook" biquad section — the same formulas behind the
 * Web Audio `BiquadFilterNode`, so the offline synth shapes frequency content
 * the same way the live preview's native filter does.
 */
export class Biquad {
  private b0 = 1;
  private b1 = 0;
  private b2 = 0;
  private a1 = 0;
  private a2 = 0;
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;

  constructor(type: FilterType, freqHz: number, q: number, sampleRate: number) {
    this.set(type, freqHz, q, sampleRate);
  }

  set(type: FilterType, freqHz: number, q: number, sampleRate: number): void {
    const nyquist = sampleRate / 2;
    const f = Math.min(Math.max(freqHz, 10), nyquist * 0.9);
    const w0 = (2 * Math.PI * f) / sampleRate;
    const cosW0 = Math.cos(w0);
    const sinW0 = Math.sin(w0);
    const alpha = sinW0 / (2 * Math.max(q, 0.0001));
    let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number;
    switch (type) {
      case "lowpass":
        b0 = (1 - cosW0) / 2;
        b1 = 1 - cosW0;
        b2 = (1 - cosW0) / 2;
        a0 = 1 + alpha;
        a1 = -2 * cosW0;
        a2 = 1 - alpha;
        break;
      case "highpass":
        b0 = (1 + cosW0) / 2;
        b1 = -(1 + cosW0);
        b2 = (1 + cosW0) / 2;
        a0 = 1 + alpha;
        a1 = -2 * cosW0;
        a2 = 1 - alpha;
        break;
      case "bandpass":
      default:
        b0 = alpha;
        b1 = 0;
        b2 = -alpha;
        a0 = 1 + alpha;
        a1 = -2 * cosW0;
        a2 = 1 - alpha;
        break;
    }
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = a1 / a0;
    this.a2 = a2 / a0;
  }

  process(x: number): number {
    const y =
      this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }

  processBuffer(input: Float32Array): Float32Array {
    const out = new Float32Array(input.length);
    for (let i = 0; i < input.length; i++) out[i] = this.process(input[i]);
    return out;
  }
}

/**
 * Bandpass a buffer whose center frequency moves over time (a "sweep").
 * Coefficients are recomputed every `recalcEvery` samples — cheap, and far
 * more often than the ear can resolve a filter update.
 */
export function sweptBandpass(
  input: Float32Array,
  sampleRate: number,
  centerHzAt: (t: number) => number,
  q: number,
  recalcEvery = 32,
): Float32Array {
  const out = new Float32Array(input.length);
  const filter = new Biquad("bandpass", centerHzAt(0), q, sampleRate);
  for (let i = 0; i < input.length; i++) {
    if (i % recalcEvery === 0) {
      filter.set("bandpass", centerHzAt(i / sampleRate), q, sampleRate);
    }
    out[i] = filter.process(input[i]);
  }
  return out;
}

/** Exponential decay envelope: 1 at t=0, falling toward 0 with time constant `tauMs`. */
export function expDecayEnvelope(n: number, sampleRate: number, tauMs: number): Float32Array {
  const out = new Float32Array(n);
  const tau = Math.max(tauMs, 0.001) / 1000;
  for (let i = 0; i < n; i++) {
    out[i] = Math.exp(-(i / sampleRate) / tau);
  }
  return out;
}

/** Linear attack to 1, then an exponential decay — a hit that swells before it falls. */
export function attackDecayEnvelope(
  n: number,
  sampleRate: number,
  attackMs: number,
  decayTauMs: number,
): Float32Array {
  const out = new Float32Array(n);
  const attackN = msToSamples(attackMs, sampleRate);
  const tau = Math.max(decayTauMs, 0.001) / 1000;
  for (let i = 0; i < n; i++) {
    out[i] = i < attackN ? i / Math.max(attackN, 1) : Math.exp(-((i - attackN) / sampleRate) / tau);
  }
  return out;
}

/** A raised-cosine "bell": ramps 0→1 over the first `attackFraction`, then 1→0. Smooth, click-free. */
export function bellEnvelope(n: number, attackFraction: number): Float32Array {
  const out = new Float32Array(n);
  const attackN = Math.max(1, Math.round(n * attackFraction));
  const releaseN = Math.max(1, n - attackN);
  for (let i = 0; i < n; i++) {
    out[i] =
      i < attackN
        ? 0.5 - 0.5 * Math.cos(Math.PI * (i / attackN))
        : 0.5 + 0.5 * Math.cos(Math.PI * ((i - attackN) / releaseN));
  }
  return out;
}

/**
 * A sine oscillator whose frequency glides from `startHz` toward `endHz`
 * (exponential approach, time constant `glideTauMs`) — the pitch-drop a
 * physical hit has as it loses energy, or a quick pitch-up when reversed.
 */
export function glideSine(
  n: number,
  sampleRate: number,
  startHz: number,
  endHz: number,
  glideTauMs: number,
): Float32Array {
  const out = new Float32Array(n);
  const tau = Math.max(glideTauMs, 0.001) / 1000;
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const f = endHz + (startHz - endHz) * Math.exp(-t / tau);
    phase += (2 * Math.PI * f) / sampleRate;
    out[i] = Math.sin(phase);
  }
  return out;
}

/** Soft saturation: normalized tanh. Glues layers together and rounds off peaks without hard-clipping. */
export function tanhSaturate(input: Float32Array, drive: number): Float32Array {
  const norm = Math.tanh(drive) || 1;
  const out = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) out[i] = Math.tanh(input[i] * drive) / norm;
  return out;
}

/** In-place linear fade of the first/last `ms` milliseconds — kills start/end clicks. */
export function applyFades(
  samples: Float32Array,
  sampleRate: number,
  fadeInMs: number,
  fadeOutMs: number,
): void {
  const fadeIn = msToSamples(fadeInMs, sampleRate);
  for (let i = 0; i < fadeIn && i < samples.length; i++) samples[i] *= i / fadeIn;
  const fadeOut = msToSamples(fadeOutMs, sampleRate);
  for (let i = 0; i < fadeOut && i < samples.length; i++) {
    samples[samples.length - 1 - i] *= i / fadeOut;
  }
}

/** One synthesized layer, mixed into the voice buffer at `offsetSamples` and scaled by `gain`. */
export interface Layer {
  data: Float32Array;
  gain: number;
  offsetSamples?: number;
}

/** Sums `gain`-scaled layers into a fresh buffer of `totalSamples`, clipping layers to its bounds. */
export function renderVoice(totalSamples: number, layers: Layer[]): Float32Array {
  const out = new Float32Array(totalSamples);
  for (const layer of layers) {
    const offset = layer.offsetSamples ?? 0;
    for (let i = 0; i < layer.data.length; i++) {
      const j = i + offset;
      if (j < 0 || j >= out.length) continue;
      out[j] += layer.data[i] * layer.gain;
    }
  }
  return out;
}

/** Scales down only if the peak exceeds `ceiling`, so already-quiet layers stay quiet. */
export function normalizePeak(samples: Float32Array, ceiling = 0.97): void {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
  if (peak > ceiling) {
    const scale = ceiling / peak;
    for (let i = 0; i < samples.length; i++) samples[i] *= scale;
  }
}
