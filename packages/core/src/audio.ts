// Audio placeholder generation.
//
// Produces a 16-bit PCM mono WAV file containing a sine wave at the
// configured frequency. v1 keeps this simple — no envelopes, no
// filters, no multi-channel. The point is to give the user a
// drop-in placeholder tone at the right duration and frequency
// for whatever they're scaffolding.

import type { AudioAsset } from '@placeholderer/schemas';

/** Encode a 16-bit PCM mono WAV. */
export function encodeWav(samples: Int16Array, sampleRate: number): Uint8Array {
  const dataLen = samples.length * 2; // 16-bit
  const headerLen = 44;
  const totalLen = headerLen + dataLen;
  const buffer = new ArrayBuffer(totalLen);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalLen - 8, true);
  writeString(view, 8, 'WAVE');

  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);     // fmt chunk size
  view.setUint16(20, 1, true);      // PCM
  view.setUint16(22, 1, true);      // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true);      // block align
  view.setUint16(34, 16, true);     // bits per sample

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataLen, true);

  // PCM samples
  for (let i = 0; i < samples.length; i++) {
    view.setInt16(headerLen + i * 2, samples[i], true);
  }

  return new Uint8Array(buffer);
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/** Build a sine-wave sample buffer. */
export function synthesizeTone(frequency: number, duration: number, sampleRate: number, amplitude: number): Int16Array {
  const total = Math.max(1, Math.floor(duration * sampleRate));
  const samples = new Int16Array(total);
  const twoPiFOverSR = (2 * Math.PI * frequency) / sampleRate;
  // Soft attack/release to avoid clicks.
  const env = Math.max(1, Math.floor(sampleRate * 0.01));
  for (let i = 0; i < total; i++) {
    const t = i;
    const envMul =
      t < env ? t / env :
      t > total - env ? (total - t) / env :
      1;
    const s = Math.sin(twoPiFOverSR * t) * amplitude * envMul;
    samples[i] = Math.max(-1, Math.min(1, s)) * 0x7fff;
  }
  return samples;
}

export function generateAudio(asset: AudioAsset): Uint8Array {
  const sampleRate = asset.sample_rate ?? 44100;
  const amplitude = asset.amplitude ?? 0.5;
  const samples = synthesizeTone(asset.frequency, asset.duration, sampleRate, amplitude);
  return encodeWav(samples, sampleRate);
}
