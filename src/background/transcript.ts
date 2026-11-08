import type { LocalState } from '../shared/storage';
import type { Speaker } from '../shared/settings';

export type TranscriptState = Pick<LocalState, 'transcript' | 'lastSegments' | 'lastSpeaker'>;

const splitWords = (text: string) => text.trim().split(/\s+/).filter(Boolean);
const normalize = (word: string) => word.toLocaleLowerCase('es').replace(/[^\p{L}\p{N}]/gu, '');

/** Devuelve `text` sin las 2–10 primeras palabras que repiten el final de `lastSegment` (solape entre ventanas). */
export function removeOverlap(lastSegment: string, text: string): string {
  const previous = splitWords(lastSegment).map(normalize);
  const incoming = splitWords(text);
  const incomingNorm = incoming.map(normalize);
  for (let count = Math.min(10, previous.length, incoming.length); count >= 2; count--) {
    if (previous.slice(-count).every((word, i) => word && word === incomingNorm[i])) return incoming.slice(count).join(' ');
  }
  return incoming.join(' ');
}

/**
 * Añade un segmento de `speaker` a la transcripción. Si sigue hablando la misma persona se continúa su línea;
 * si no, se abre una línea nueva con la etiqueta `[AGENTE]` o `[USUARIO]`.
 */
export function appendSegment(
  { transcript = '', lastSegments = {}, lastSpeaker = '' }: Partial<TranscriptState>,
  speaker: Speaker,
  text: string
): TranscriptState {
  const addition = removeOverlap(lastSegments[speaker] ?? '', text);
  const nextSegments = { ...lastSegments, [speaker]: text.trim() };
  if (!addition) return { transcript, lastSegments: nextSegments, lastSpeaker };
  const continues = transcript && speaker === lastSpeaker;
  const next = continues
    ? `${transcript}${/\s$/.test(transcript) ? '' : ' '}${addition}`
    : `${transcript}${transcript ? '\n' : ''}[${speaker}] ${addition}`;
  return { transcript: next, lastSegments: nextSegments, lastSpeaker: speaker };
}
