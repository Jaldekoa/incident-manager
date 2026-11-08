import { describe, expect, it } from 'vitest';
import { createWindower, rms, SILENCE_RMS, TARGET_RATE, toBase64, wavFromPcm } from '../src/offscreen/audio';

const ascii = (bytes: Uint8Array, start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length));

describe('wavFromPcm', () => {
  it('genera un WAV PCM16 mono a 16 kHz con la longitud remuestreada', () => {
    const wav = wavFromPcm(new Float32Array(48000).fill(0.5), 48000); // 1 s a 48 kHz
    const view = new DataView(wav.buffer);
    expect(ascii(wav, 0, 4)).toBe('RIFF');
    expect(ascii(wav, 8, 4)).toBe('WAVE');
    expect(ascii(wav, 36, 4)).toBe('data');
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(TARGET_RATE);
    expect(view.getUint32(40, true)).toBe(TARGET_RATE * 2); // 16000 muestras × 2 bytes
    expect(wav.length).toBe(44 + TARGET_RATE * 2);
    expect(view.getInt16(44, true)).toBe(Math.trunc(0.5 * 32767));
  });

  it('recorta las muestras fuera de [-1, 1]', () => {
    const view = new DataView(wavFromPcm(new Float32Array([2, -2]), TARGET_RATE).buffer);
    expect(view.getInt16(44, true)).toBe(32767);
    expect(view.getInt16(46, true)).toBe(-32768);
  });
});

describe('toBase64', () => {
  it('codifica de forma reversible en más de un bloque', () => {
    const bytes = new Uint8Array(70000).map((_, i) => i % 256); // más de un bloque de 0x8000
    expect(Uint8Array.from(atob(toBase64(bytes)), (char) => char.charCodeAt(0))).toEqual(bytes);
  });
});

describe('rms', () => {
  it('distingue silencio de voz con el umbral', () => {
    expect(rms(new Float32Array(1000))).toBeLessThan(SILENCE_RMS);
    expect(rms(new Float32Array(1000).fill(0.1))).toBeCloseTo(0.1);
  });
});

describe('createWindower', () => {
  it('emite ventanas de 4 s en orden cronológico, la primera al llenarse y después cada 3 s', () => {
    const sampleRate = 1000; // ventana de 4000 muestras, salto de 3000
    const windows: Float32Array[] = [];
    const push = createWindower(sampleRate, (samples) => windows.push(samples));
    let counter = 0;
    for (let chunk = 0; chunk < 20; chunk++) push(new Float32Array(500).map(() => counter++)); // 10 s de audio
    expect(windows.map((w) => w.length)).toEqual([4000, 4000, 4000]);
    // 1 s de solape entre ventanas consecutivas.
    expect(windows.map((w) => [w[0], w[3999]])).toEqual([[0, 3999], [3000, 6999], [6000, 9999]]);
  });

  it('mantiene el ritmo con bloques que no encajan con el salto (como los 2048 del worklet)', () => {
    const windows: Float32Array[] = [];
    const push = createWindower(1000, (samples) => windows.push(samples));
    let counter = 0;
    for (let chunk = 0; chunk < 10; chunk++) push(new Float32Array(1300).map(() => counter++)); // 13 s de audio
    // Ventanas en el primer bloque que alcanza 4, 7, 10 y 13 s; cada una termina en la última muestra recibida.
    expect(windows.map((w) => w[3999])).toEqual([5199, 7799, 10399, 12999]);
  });
});
