import { ASR_SAMPLE_RATE as TARGET_RATE, STRIDE_SECONDS, WINDOW_SECONDS } from '../config';

/** Remuestrea a ASR_SAMPLE_RATE mono y devuelve los bytes de un WAV PCM16. */
export function wavFromPcm(input: Float32Array, sourceRate: number): Uint8Array {
  const length = Math.floor(input.length * TARGET_RATE / sourceRate);
  const buffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(buffer);
  const put = (offset: number, text: string) => [...text].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
  put(0, 'RIFF'); view.setUint32(4, 36 + length * 2, true); put(8, 'WAVE'); put(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, TARGET_RATE, true); view.setUint32(28, TARGET_RATE * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); put(36, 'data');
  view.setUint32(40, length * 2, true);
  const pcm = new Int16Array(buffer, 44);
  for (let i = 0; i < length; i++) {
    const sample = input[Math.floor(i * sourceRate / TARGET_RATE)] || 0;
    pcm[i] = Math.max(-1, Math.min(1, sample)) * (sample < 0 ? 32768 : 32767);
  }
  return new Uint8Array(buffer);
}

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export function rms(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length);
}

/** Acumula audio en un buffer circular y llama a `onWindow` con una ventana de WINDOW_SECONDS cada STRIDE_SECONDS. */
export function createWindower(sampleRate: number, onWindow: (samples: Float32Array) => void): (input: Float32Array) => void {
  const windowSamples = Math.ceil(sampleRate * WINDOW_SECONDS);
  const strideSamples = Math.ceil(sampleRate * STRIDE_SECONDS);
  const ring = new Float32Array(windowSamples);
  let writeIndex = 0;
  // Empieza en negativo para que la primera ventana salga justo al llenarse y las siguientes cada STRIDE_SECONDS.
  let sinceWindow = strideSamples - windowSamples;
  return (input) => {
    for (let i = 0; i < input.length; i++) {
      ring[writeIndex] = input[i];
      writeIndex = (writeIndex + 1) % windowSamples;
    }
    sinceWindow += input.length;
    if (sinceWindow < strideSamples) return;
    sinceWindow -= strideSamples;
    const chronological = new Float32Array(windowSamples);
    chronological.set(ring.subarray(writeIndex), 0);
    chronological.set(ring.subarray(0, writeIndex), windowSamples - writeIndex);
    onWindow(chronological);
  };
}
