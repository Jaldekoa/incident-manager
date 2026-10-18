let tabStream;
let audioContext;
let sourceNode;
let processorNode;
let captureControl = Promise.resolve();
let captureGeneration = 0;
let activeRequest;
let transcriptQueue = Promise.resolve();

function enqueueCaptureOperation(operation) {
  const result = captureControl.then(operation, operation);
  captureControl = result.catch(() => {});
  return result;
}

function report(message) {
  return chrome.runtime.sendMessage({ target: 'background', ...message });
}

function wavFromPcm(input, sourceRate) {
  const sampleRate = 16000;
  const length = Math.floor(input.length * sampleRate / sourceRate);
  const pcm = new Int16Array(length);
  for (let i = 0; i < length; i++) {
    const sample = input[Math.floor(i * sourceRate / sampleRate)] || 0;
    pcm[i] = Math.max(-1, Math.min(1, sample)) * (sample < 0 ? 32768 : 32767);
  }
  const buffer = new ArrayBuffer(44 + pcm.byteLength);
  const view = new DataView(buffer);
  const put = (offset, text) => [...text].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  put(0, 'RIFF'); view.setUint32(4, 36 + pcm.byteLength, true); put(8, 'WAVE'); put(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); put(36, 'data');
  view.setUint32(40, pcm.byteLength, true);
  new Int16Array(buffer, 44).set(pcm);
  return new Blob([buffer], { type: 'audio/wav' });
}

async function transcribe(blob, generation) {
  const { model = 'frozenlab/qwen3-asr:0.6b' } = await report({ type: 'GET_SETTINGS' });
  if (generation !== captureGeneration) return;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const controller = new AbortController();
  activeRequest = controller;
  let response;
  try {
    response = await fetch('http://127.0.0.1:11434/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
      body: JSON.stringify({ model, stream: false, keep_alive: '30m', messages: [{ role: 'user', content: 'language Spanish<asr_text>', images: [btoa(binary)] }] })
    });
  } finally {
    if (activeRequest === controller) activeRequest = undefined;
  }
  if (!response.ok) throw new Error(`Ollama ${response.status}: ${(await response.text()).slice(0, 180)}`);
  const result = await response.json();
  const raw = result.message?.content || '';
  const text = (raw.includes('<asr_text>') ? raw.slice(raw.indexOf('<asr_text>') + 10) : raw).replace(/<\|[^|]+\|>/g, '').trim();
  if (text && generation === captureGeneration) await report({ type: 'APPEND_TRANSCRIPT', text });
}

function queueWindow(samples, sampleRate, generation) {
  const wav = wavFromPcm(samples, sampleRate);
  transcriptQueue = transcriptQueue.then(() => {
    if (generation !== captureGeneration) return;
    return transcribe(wav, generation);
  }).catch((error) => {
    if (generation === captureGeneration) report({ type: 'CAPTURE_STATE', capturing: true, error: error.message });
  });
}

function beginContinuousAudioCapture() {
  const sampleRate = audioContext.sampleRate;
  const generation = captureGeneration;
  const windowSamples = Math.ceil(sampleRate * 4);
  const strideSamples = Math.ceil(sampleRate * 3);
  const ring = new Float32Array(windowSamples);
  let writeIndex = 0;
  let buffered = 0;
  let sinceWindow = 0;

  processorNode = new AudioWorkletNode(audioContext, 'tab-audio-capture', {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [2]
  });
  processorNode.port.onmessage = (event) => {
    if (generation !== captureGeneration) return;
    const input = event.data;
    for (let i = 0; i < input.length; i++) {
      ring[writeIndex] = input[i];
      writeIndex = (writeIndex + 1) % windowSamples;
    }
    buffered = Math.min(windowSamples, buffered + input.length);
    sinceWindow += input.length;
    if (buffered < windowSamples || sinceWindow < strideSamples) return;
    sinceWindow %= strideSamples;
    const chronological = new Float32Array(windowSamples);
    const firstPart = windowSamples - writeIndex;
    chronological.set(ring.subarray(writeIndex), 0);
    chronological.set(ring.subarray(0, writeIndex), firstPart);
    queueWindow(chronological, sampleRate, generation);
  };
  sourceNode = audioContext.createMediaStreamSource(tabStream);
  sourceNode.connect(processorNode);
  processorNode.connect(audioContext.destination);
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
    if (tabStream && generation === captureGeneration) stopCapture();
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
  if (sourceNode) sourceNode.disconnect();
  processorNode = undefined;
  sourceNode = undefined;
  if (tabStream) tabStream.getTracks().forEach((track) => track.stop());
  tabStream = undefined;
  if (audioContext) await audioContext.close().catch(() => {});
  audioContext = undefined;
  if (updateState) await report({ type: 'CAPTURE_STATE', capturing: false });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== 'offscreen') return;
  if (message.type === 'START_CAPTURE') {
    enqueueCaptureOperation(() => startCapture(message.streamId))
      .then(() => sendResponse({ ok: true })).catch(async (error) => {
        await report({ type: 'CAPTURE_STATE', capturing: false, error: error.message });
        sendResponse({ ok: false, error: error.message });
      });
    return true;
  }
  if (message.type === 'STOP_CAPTURE') {
    enqueueCaptureOperation(() => stopCapture())
      .then(() => sendResponse({ ok: true })).catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message.type === 'PRELOAD_MODEL') {
    fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: message.model, prompt: '', keep_alive: '30m', stream: false })
    }).then(async (response) => {
      if (!response.ok) throw new Error(`Ollama ${response.status}: ${(await response.text()).slice(0, 180)}`);
      await chrome.runtime.sendMessage({ type: 'PRELOAD_DONE' });
    }).catch((error) => chrome.runtime.sendMessage({ type: 'PRELOAD_FAILED', error: error.message }));
  }
});
