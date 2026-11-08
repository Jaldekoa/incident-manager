import { ollama, DEFAULT_ASR_MODEL, KEEP_ALIVE } from './ollama.js';
import { DEFAULT_ASR_PROMPT, SPEAKERS } from './settings.js';

const TARGET_RATE = 16000;
const WINDOW_SECONDS = 4;
const STRIDE_SECONDS = 3; // 1 s de solape entre ventanas
const SILENCE_RMS = 0.005; // por debajo, la ventana se considera silencio y no se envía al ASR
const ASR_TAG = '<asr_text>';
const MIC_CONSTRAINTS = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };

let session; // { context, streams, ports } de la captura activa
let activeRequest;
let captureGeneration = 0;
let captureControl = Promise.resolve();
let transcriptQueue = Promise.resolve();

const report = (message) => chrome.runtime.sendMessage({ target: 'background', ...message });
const isCurrent = (generation) => generation === captureGeneration;

/** Serializa start/stop para que nunca se solapen. */
function enqueueCaptureOperation(operation) {
  const result = captureControl.then(operation, operation);
  captureControl = result.catch(() => {});
  return result;
}

async function getAsrSettings() {
  const { model = DEFAULT_ASR_MODEL, asrPrompt = DEFAULT_ASR_PROMPT } = (await report({ type: 'GET_SETTINGS' })) || {};
  return { model, asrPrompt };
}

const preloadModel = (model) => ollama('/api/generate', { body: { model, prompt: '', keep_alive: KEEP_ALIVE, stream: false } });

// ---- Audio → WAV ----

/** Remuestrea a 16 kHz mono y devuelve los bytes de un WAV PCM16. */
function wavFromPcm(input, sourceRate) {
  const length = Math.floor(input.length * TARGET_RATE / sourceRate);
  const buffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(buffer);
  const put = (offset, text) => [...text].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
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

function toBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function rms(samples) {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length);
}

// ---- Transcripción ----

async function transcribe(wav, speaker, generation) {
  const { model, asrPrompt } = await getAsrSettings();
  if (!isCurrent(generation)) return;
  const controller = new AbortController();
  activeRequest = controller;
  let raw;
  try {
    const { message } = await ollama('/api/chat', {
      signal: controller.signal,
      body: { model, stream: false, keep_alive: KEEP_ALIVE, messages: [{ role: 'user', content: asrPrompt, images: [toBase64(wav)] }] }
    });
    raw = message?.content || '';
  } finally {
    if (activeRequest === controller) activeRequest = undefined;
  }
  const tagIndex = raw.indexOf(ASR_TAG);
  const text = (tagIndex >= 0 ? raw.slice(tagIndex + ASR_TAG.length) : raw).replace(/<\|[^|]+\|>/g, '').trim();
  if (text && isCurrent(generation)) await report({ type: 'APPEND_TRANSCRIPT', speaker, text });
}

/** Encola una ventana de audio; ambas fuentes comparten cola para mantener el orden cronológico. */
function queueWindow(samples, sampleRate, speaker, generation) {
  if (rms(samples) < SILENCE_RMS) return;
  const wav = wavFromPcm(samples, sampleRate);
  transcriptQueue = transcriptQueue
    .then(() => isCurrent(generation) && transcribe(wav, speaker, generation))
    .catch((error) => {
      if (isCurrent(generation)) report({ type: 'CAPTURE_STATE', capturing: true, error: error.message });
    });
}

/** Acumula audio en un buffer circular y llama a `onWindow` con una ventana de 4 s cada 3 s. */
function createWindower(sampleRate, onWindow) {
  const windowSamples = Math.ceil(sampleRate * WINDOW_SECONDS);
  const strideSamples = Math.ceil(sampleRate * STRIDE_SECONDS);
  const ring = new Float32Array(windowSamples);
  let writeIndex = 0;
  let buffered = 0;
  let sinceWindow = 0;
  return (input) => {
    for (let i = 0; i < input.length; i++) {
      ring[writeIndex] = input[i];
      writeIndex = (writeIndex + 1) % windowSamples;
    }
    buffered = Math.min(windowSamples, buffered + input.length);
    sinceWindow += input.length;
    if (buffered < windowSamples || sinceWindow < strideSamples) return;
    sinceWindow %= strideSamples;
    const chronological = new Float32Array(windowSamples);
    chronological.set(ring.subarray(writeIndex), 0);
    chronological.set(ring.subarray(0, writeIndex), windowSamples - writeIndex);
    onWindow(chronological);
  };
}

/** Conecta un stream al worklet de captura y etiqueta sus ventanas con `speaker`. */
function attachSource(stream, speaker, output) {
  const { context, generation } = session;
  const processor = new AudioWorkletNode(context, 'tab-audio-capture', {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [2]
  });
  const collect = createWindower(context.sampleRate, (samples) => queueWindow(samples, context.sampleRate, speaker, generation));
  processor.port.onmessage = ({ data }) => { if (isCurrent(generation)) collect(data); };
  context.createMediaStreamSource(stream).connect(processor);
  processor.connect(output);
  session.ports.push(processor.port);
}

/** Añade el micrófono del agente. Devuelve un mensaje de error si no está disponible (la captura sigue sin él). */
async function attachMicrophone() {
  try {
    const micStream = await navigator.mediaDevices.getUserMedia({ audio: MIC_CONSTRAINTS, video: false });
    session.streams.push(micStream);
    const muted = session.context.createGain(); // el micro se procesa pero no se reproduce (evita realimentación)
    muted.gain.value = 0;
    muted.connect(session.context.destination);
    attachSource(micStream, SPEAKERS.agent, muted);
    return undefined;
  } catch (error) {
    return `Sin audio del agente: no se pudo acceder al micrófono (${error.message}). Concede el permiso en Configuración.`;
  }
}

// ---- Ciclo de vida de la captura ----

async function startCapture(streamId) {
  await stopCapture(false);
  const generation = ++captureGeneration;
  const { model } = await getAsrSettings();
  preloadModel(model).catch(() => {}); // precalienta el ASR mientras se llena la primera ventana
  try {
    const context = new AudioContext();
    session = { context, generation, streams: [], ports: [] };
    const tabStream = await navigator.mediaDevices.getUserMedia({
      audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } }, video: false
    });
    session.streams.push(tabStream);
    await context.resume();
    await context.audioWorklet.addModule(chrome.runtime.getURL('capture-worklet.js'));
    attachSource(tabStream, SPEAKERS.user, context.destination); // el audio de la pestaña sigue sonando
    const micError = await attachMicrophone();
    tabStream.getTracks().forEach((track) => track.addEventListener('ended', () => {
      if (isCurrent(generation)) enqueueCaptureOperation(() => stopCapture());
    }, { once: true }));
    await report({ type: 'CAPTURE_STATE', capturing: true, error: micError });
  } catch (error) {
    await stopCapture(false);
    throw error;
  }
}

async function stopCapture(updateState = true) {
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
  if (updateState) await report({ type: 'CAPTURE_STATE', capturing: false });
}

// ---- Mensajería ----

function respond(promise, sendResponse) {
  promise.then(() => sendResponse({ ok: true }), (error) => sendResponse({ ok: false, error: error.message }));
  return true;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.target !== 'offscreen') return false;
  switch (message.type) {
    case 'PING':
      sendResponse({ ok: true });
      return false;
    case 'START_CAPTURE':
      return respond(enqueueCaptureOperation(() => startCapture(message.streamId)).catch(async (error) => {
        await report({ type: 'CAPTURE_STATE', capturing: false, error: error.message });
        throw error;
      }), sendResponse);
    case 'STOP_CAPTURE':
      return respond(enqueueCaptureOperation(() => stopCapture()), sendResponse);
    case 'PRELOAD_MODEL':
      preloadModel(message.model)
        .then(() => chrome.runtime.sendMessage({ type: 'PRELOAD_DONE' }))
        .catch((error) => chrome.runtime.sendMessage({ type: 'PRELOAD_FAILED', error: error.message }));
      return false;
  }
  return false;
});
