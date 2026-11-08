import { ollama, DEFAULT_ASR_MODEL, KEEP_ALIVE } from './ollama.js';

const TARGET_RATE = 16000;
const WINDOW_SECONDS = 4;
const STRIDE_SECONDS = 3; // 1 s de solape entre ventanas
const ASR_TAG = '<asr_text>';

let tabStream;
let audioContext;
let sourceNode;
let processorNode;
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

async function transcribe(wav, generation) {
  const { model = DEFAULT_ASR_MODEL } = (await report({ type: 'GET_SETTINGS' })) || {};
  if (!isCurrent(generation)) return;
  const controller = new AbortController();
  activeRequest = controller;
  let raw;
  try {
    const { message } = await ollama('/api/chat', {
      signal: controller.signal,
      body: { model, stream: false, keep_alive: KEEP_ALIVE, messages: [{ role: 'user', content: `language Spanish${ASR_TAG}`, images: [toBase64(wav)] }] }
    });
    raw = message?.content || '';
  } finally {
    if (activeRequest === controller) activeRequest = undefined;
  }
  const tagIndex = raw.indexOf(ASR_TAG);
  const text = (tagIndex >= 0 ? raw.slice(tagIndex + ASR_TAG.length) : raw).replace(/<\|[^|]+\|>/g, '').trim();
  if (text && isCurrent(generation)) await report({ type: 'APPEND_TRANSCRIPT', text });
}

function queueWindow(samples, sampleRate, generation) {
  const wav = wavFromPcm(samples, sampleRate);
  transcriptQueue = transcriptQueue
    .then(() => isCurrent(generation) && transcribe(wav, generation))
    .catch((error) => {
      if (isCurrent(generation)) report({ type: 'CAPTURE_STATE', capturing: true, error: error.message });
    });
}

/** Acumula audio en un buffer circular y emite una ventana de 4 s cada 3 s. */
function beginContinuousAudioCapture() {
  const { sampleRate } = audioContext;
  const generation = captureGeneration;
  const windowSamples = Math.ceil(sampleRate * WINDOW_SECONDS);
  const strideSamples = Math.ceil(sampleRate * STRIDE_SECONDS);
  const ring = new Float32Array(windowSamples);
  let writeIndex = 0;
  let buffered = 0;
  let sinceWindow = 0;

  processorNode = new AudioWorkletNode(audioContext, 'tab-audio-capture', {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [2]
  });
  processorNode.port.onmessage = ({ data: input }) => {
    if (!isCurrent(generation)) return;
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
    queueWindow(chronological, sampleRate, generation);
  };
  sourceNode = audioContext.createMediaStreamSource(tabStream);
  sourceNode.connect(processorNode);
  processorNode.connect(audioContext.destination); // mantiene el audio de la pestaña audible
}

async function startCapture(streamId) {
  await stopCapture(false);
  const generation = ++captureGeneration;
  tabStream = await navigator.mediaDevices.getUserMedia({
    audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } }, video: false
  });
  audioContext = new AudioContext();
  await audioContext.resume();
  await audioContext.audioWorklet.addModule(chrome.runtime.getURL('capture-worklet.js'));
  beginContinuousAudioCapture();
  tabStream.getTracks().forEach((track) => track.addEventListener('ended', () => {
    if (tabStream && isCurrent(generation)) stopCapture();
  }, { once: true }));
  await report({ type: 'CAPTURE_STATE', capturing: true });
}

async function stopCapture(updateState = true) {
  captureGeneration++;
  activeRequest?.abort();
  activeRequest = undefined;
  if (processorNode) {
    processorNode.port.onmessage = null;
    processorNode.port.close();
    processorNode.disconnect();
  }
  sourceNode?.disconnect();
  tabStream?.getTracks().forEach((track) => track.stop());
  const context = audioContext;
  processorNode = sourceNode = tabStream = audioContext = undefined;
  await context?.close().catch(() => {});
  if (updateState) await report({ type: 'CAPTURE_STATE', capturing: false });
}

function preloadModel(model) {
  ollama('/api/generate', { body: { model, prompt: '', keep_alive: KEEP_ALIVE, stream: false } })
    .then(() => chrome.runtime.sendMessage({ type: 'PRELOAD_DONE' }))
    .catch((error) => chrome.runtime.sendMessage({ type: 'PRELOAD_FAILED', error: error.message }));
}

function respond(promise, sendResponse) {
  promise.then(() => sendResponse({ ok: true }), (error) => sendResponse({ ok: false, error: error.message }));
  return true;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.target !== 'offscreen') return false;
  switch (message.type) {
    case 'START_CAPTURE':
      return respond(enqueueCaptureOperation(() => startCapture(message.streamId)).catch(async (error) => {
        await report({ type: 'CAPTURE_STATE', capturing: false, error: error.message });
        throw error;
      }), sendResponse);
    case 'STOP_CAPTURE':
      return respond(enqueueCaptureOperation(() => stopCapture()), sendResponse);
    case 'PRELOAD_MODEL':
      preloadModel(message.model);
      return false;
  }
  return false;
});
