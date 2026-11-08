import {
  ASR_TEXT_TAG, DEFAULT_ASR_MODEL, DEFAULT_LANGUAGE, KEEP_ALIVE, MIC_CONSTRAINTS, SILENCE_RMS, SPEAKERS, asrPrompt
} from '../config';
import { ollama, type ChatResponse } from '../shared/ollama';
import type { Speaker } from '../shared/settings';
import { sendToBackground, type AsrSettings } from '../shared/messages';
import { errorMessage } from '../shared/errors';
import { createWindower, rms, toBase64, wavFromPcm } from './audio';

interface CaptureSession {
  context: AudioContext;
  generation: number;
  streams: MediaStream[];
  ports: MessagePort[];
}

let session: CaptureSession | undefined;
let activeRequest: AbortController | undefined;
let captureGeneration = 0;
let captureControl: Promise<unknown> = Promise.resolve();
let transcriptQueue: Promise<unknown> = Promise.resolve();

const isCurrent = (generation: number) => generation === captureGeneration;

/** Serializa start/stop para que nunca se solapen. */
export function enqueueCaptureOperation<T>(operation: () => Promise<T>): Promise<T> {
  const result = captureControl.then(operation, operation);
  captureControl = result.catch(() => {});
  return result;
}

async function getAsrSettings(): Promise<AsrSettings> {
  const response = await sendToBackground({ type: 'GET_SETTINGS' });
  const settings = response && 'model' in response ? response : undefined;
  return { model: settings?.model || DEFAULT_ASR_MODEL, asrPrompt: settings?.asrPrompt || asrPrompt(DEFAULT_LANGUAGE) };
}

export const preloadModel = (model: string) =>
  ollama('/api/generate', { body: { model, prompt: '', keep_alive: KEEP_ALIVE, stream: false } });

// ---- Transcripción ----

async function transcribe(wav: Uint8Array, speaker: Speaker, generation: number): Promise<void> {
  const { model, asrPrompt } = await getAsrSettings();
  if (!isCurrent(generation)) return;
  const controller = new AbortController();
  activeRequest = controller;
  let raw: string;
  try {
    const { message } = await ollama<ChatResponse>('/api/chat', {
      signal: controller.signal,
      body: { model, stream: false, keep_alive: KEEP_ALIVE, messages: [{ role: 'user', content: asrPrompt, images: [toBase64(wav)] }] }
    });
    raw = message?.content || '';
  } finally {
    if (activeRequest === controller) activeRequest = undefined;
  }
  const tagIndex = raw.indexOf(ASR_TEXT_TAG);
  const text = (tagIndex >= 0 ? raw.slice(tagIndex + ASR_TEXT_TAG.length) : raw).replace(/<\|[^|]+\|>/g, '').trim();
  if (text && isCurrent(generation)) await sendToBackground({ type: 'APPEND_TRANSCRIPT', speaker, text });
}

/** Encola una ventana de audio; ambas fuentes comparten cola para mantener el orden cronológico. */
function queueWindow(samples: Float32Array, sampleRate: number, speaker: Speaker, generation: number): void {
  if (rms(samples) < SILENCE_RMS) return;
  const wav = wavFromPcm(samples, sampleRate);
  transcriptQueue = transcriptQueue
    .then(async () => {
      if (isCurrent(generation)) await transcribe(wav, speaker, generation);
    })
    .catch((error) => {
      if (isCurrent(generation)) sendToBackground({ type: 'CAPTURE_STATE', capturing: true, error: errorMessage(error) });
    });
}

/** Conecta un stream al worklet de captura y etiqueta sus ventanas con `speaker`. */
function attachSource(current: CaptureSession, stream: MediaStream, speaker: Speaker, output: AudioNode): void {
  const { context, generation } = current;
  const processor = new AudioWorkletNode(context, 'tab-audio-capture', {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [2]
  });
  const collect = createWindower(context.sampleRate, (samples) => queueWindow(samples, context.sampleRate, speaker, generation));
  processor.port.onmessage = ({ data }: MessageEvent<Float32Array>) => { if (isCurrent(generation)) collect(data); };
  context.createMediaStreamSource(stream).connect(processor);
  processor.connect(output);
  current.ports.push(processor.port);
}

/** Añade el micrófono del agente. Devuelve un mensaje de error si no está disponible (la captura sigue sin él). */
async function attachMicrophone(current: CaptureSession): Promise<string | undefined> {
  try {
    const micStream = await navigator.mediaDevices.getUserMedia({ audio: MIC_CONSTRAINTS, video: false });
    current.streams.push(micStream);
    const muted = current.context.createGain(); // el micro se procesa pero no se reproduce (evita realimentación)
    muted.gain.value = 0;
    muted.connect(current.context.destination);
    attachSource(current, micStream, SPEAKERS.agent, muted);
    return undefined;
  } catch (error) {
    return `Sin audio del agente: no se pudo acceder al micrófono (${errorMessage(error)}). Concede el permiso pulsando el icono del micrófono.`;
  }
}

// ---- Ciclo de vida de la captura ----

export async function startCapture(streamId: string): Promise<void> {
  await stopCapture(false);
  const generation = ++captureGeneration;
  const { model } = await getAsrSettings();
  preloadModel(model).catch(() => {}); // precalienta el ASR mientras se llena la primera ventana
  try {
    const current: CaptureSession = { context: new AudioContext(), generation, streams: [], ports: [] };
    session = current;
    // `chromeMediaSource` es una restricción propia de Chrome que no está en los tipos estándar.
    const tabStream = await navigator.mediaDevices.getUserMedia({
      audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } } as MediaTrackConstraints,
      video: false
    });
    current.streams.push(tabStream);
    await current.context.resume();
    await current.context.audioWorklet.addModule(chrome.runtime.getURL('capture-worklet.js'));
    attachSource(current, tabStream, SPEAKERS.user, current.context.destination); // el audio de la pestaña sigue sonando
    const micError = await attachMicrophone(current);
    tabStream.getTracks().forEach((track) => track.addEventListener('ended', () => {
      if (isCurrent(generation)) enqueueCaptureOperation(() => stopCapture());
    }, { once: true }));
    await sendToBackground({ type: 'CAPTURE_STATE', capturing: true, error: micError });
  } catch (error) {
    await stopCapture(false);
    throw error;
  }
}

export async function stopCapture(updateState = true): Promise<void> {
  captureGeneration++;
  activeRequest?.abort();
  activeRequest = undefined;
  const current = session;
  session = undefined;
  if (current) {
    current.ports.forEach((port) => { port.onmessage = null; port.close(); });
    current.streams.forEach((stream) => stream.getTracks().forEach((track) => track.stop()));
    await current.context.close().catch(() => {});
  }
  if (updateState) await sendToBackground({ type: 'CAPTURE_STATE', capturing: false });
}
