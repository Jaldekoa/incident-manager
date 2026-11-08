import { describe, expect, it } from 'vitest';
import { appendSegment, removeOverlap, type TranscriptState } from '../src/background/transcript';
import type { Speaker } from '../src/shared/settings';

describe('removeOverlap', () => {
  it('quita las palabras repetidas del solape, ignorando mayúsculas y puntuación', () => {
    expect(removeOverlap('hola qué tal', 'Qué tal, estás bien')).toBe('estás bien');
  });

  it('no quita nada si solo coincide una palabra', () => {
    expect(removeOverlap('vale gracias', 'gracias por llamar')).toBe('gracias por llamar');
  });

  it('detecta solapes de hasta 10 palabras', () => {
    const ten = 'a b c d e f g h i j';
    expect(removeOverlap(`x ${ten}`, `${ten} fin`)).toBe('fin');
  });

  it('devuelve vacío si el segmento entero es repetido', () => {
    expect(removeOverlap('a b', 'a b')).toBe('');
  });
});

describe('appendSegment', () => {
  const run = (segments: Array<[Speaker, string]>) =>
    segments.reduce<Partial<TranscriptState>>((state, [speaker, text]) => appendSegment(state, speaker, text), {});

  it('etiqueta cada cambio de hablante en una línea nueva y continúa la línea del mismo hablante', () => {
    const { transcript } = run([
      ['USUARIO', 'hola tengo un problema con'],
      ['USUARIO', 'problema con la impresora'],
      ['AGENTE', 'vale, ¿qué error sale?'],
      ['USUARIO', 'sale error 50'],
      ['USUARIO', 'error 50 y no imprime']
    ]);
    expect(transcript).toBe('[USUARIO] hola tengo un problema con la impresora\n[AGENTE] vale, ¿qué error sale?\n[USUARIO] sale error 50 y no imprime');
  });

  it('calcula el solape por hablante aunque el otro hable en medio', () => {
    const { transcript } = run([
      ['USUARIO', 'el equipo no arranca'],
      ['AGENTE', 'de acuerdo'],
      ['USUARIO', 'no arranca desde ayer']
    ]);
    expect(transcript).toBe('[USUARIO] el equipo no arranca\n[AGENTE] de acuerdo\n[USUARIO] desde ayer');
  });

  it('guarda el último segmento de cada hablante y no cambia nada si no hay texto nuevo', () => {
    const state = appendSegment({ transcript: '[AGENTE] a b', lastSegments: { AGENTE: 'a b' }, lastSpeaker: 'AGENTE' }, 'AGENTE', 'a b');
    expect(state).toEqual({ transcript: '[AGENTE] a b', lastSegments: { AGENTE: 'a b' }, lastSpeaker: 'AGENTE' });
  });
});
