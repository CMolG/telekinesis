/** Mono PCM sample rate used across the synthesized asset pack. */
export const SAMPLE_RATE = 44100;

const BITS_PER_SAMPLE = 16;
const NUM_CHANNELS = 1;

function floatToInt16(x: number): number {
  const c = Math.max(-1, Math.min(1, x));
  return Math.round(c < 0 ? c * 32768 : c * 32767);
}

/**
 * Encodes mono float samples ([-1, 1]) into a standard 16-bit PCM WAV buffer
 * (RIFF/fmt /data), written by hand — no ffmpeg, no encoder dependency.
 */
export function encodeWavPcm16(samples: Float32Array, sampleRate: number): Buffer {
  const byteRate = sampleRate * NUM_CHANNELS * (BITS_PER_SAMPLE / 8);
  const blockAlign = NUM_CHANNELS * (BITS_PER_SAMPLE / 8);
  const dataSize = samples.length * (BITS_PER_SAMPLE / 8);
  const buf = Buffer.alloc(44 + dataSize);

  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8, "ascii");

  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16); // fmt chunk size
  buf.writeUInt16LE(1, 20); // audio format: 1 = PCM
  buf.writeUInt16LE(NUM_CHANNELS, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(BITS_PER_SAMPLE, 34);

  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) {
    buf.writeInt16LE(floatToInt16(samples[i]), 44 + i * 2);
  }

  return buf;
}
