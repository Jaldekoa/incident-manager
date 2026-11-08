import { DEFAULT_ASR_MODEL } from './ollama.js';

const RESTRICTED_URL = /^(chrome|edge|about|chrome-extension):/i;

async function hasOffscreen() {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  return contexts.length > 0;
}

async function ensureOffscreen() {
  if (await hasOffscreen()) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['USER_MEDIA', 'AUDIO_PLAYBACK'],
    justification: 'Capturar audio de pestaña, reproducirlo localmente y transcribirlo sin mostrar una ventana.'
  });
}

/** Persiste el estado de captura y lo refleja en el icono. `error` solo se escribe si se indica. */
async function setCaptureState(capturing, error) {
  await chrome.storage.session.set({ capturing, ...(error !== undefined && { lastError: error }) });
  await Promise.all([
    chrome.action.setTitle({ title: capturing ? 'Detener transcripción' : 'Iniciar transcripción' }),
    chrome.action.setBadgeText({ text: capturing ? 'REC' : '' })
  ]);
}

const splitWords = (text) => text.trim().split(/\s+/).filter(Boolean);
const normalize = (word) => word.toLocaleLowerCase('es').replace(/[^\p{L}\p{N}]/gu, '');

/** Añade `text` a la transcripción descartando las 2–10 palabras que se solapan con el segmento anterior. */
function mergeTranscript(transcript, lastSegment, text) {
  const previous = splitWords(lastSegment).map(normalize);
  const incoming = splitWords(text);
  const incomingNorm = incoming.map(normalize);
  let overlap = 0;
  for (let count = Math.min(10, previous.length, incoming.length); count >= 2; count--) {
    if (previous.slice(-count).every((word, i) => word && word === incomingNorm[i])) { overlap = count; break; }
  }
  const addition = incoming.slice(overlap).join(' ');
  if (!addition) return transcript;
  return transcript && !transcript.endsWith(' ') ? `${transcript} ${addition}` : transcript + addition;
}

async function startCaptureForTab(tab) {
  if (!tab?.id || !tab.url || RESTRICTED_URL.test(tab.url)) {
    throw new Error('Abre la llamada en una pestaña web normal y pulsa allí el icono de la extensión.');
  }
  await ensureOffscreen();
  const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
  await chrome.storage.session.set({ capturing: false, lastError: '' });
  await chrome.storage.local.set({ lastSegment: '' });
  const result = await chrome.runtime.sendMessage({ target: 'offscreen', type: 'START_CAPTURE', streamId });
  if (!result?.ok) throw new Error(result?.error || 'No se pudo iniciar la captura.');
}

async function stopActiveCapture() {
  if (await hasOffscreen()) {
    try { await chrome.runtime.sendMessage({ target: 'offscreen', type: 'STOP_CAPTURE' }); }
    catch { /* También limpiamos el estado si el documento ya desapareció. */ }
  }
  await setCaptureState(false, '');
}

const OK = { ok: true };

const handlers = {
  async START_CAPTURE({ tabId }) {
    await startCaptureForTab(await chrome.tabs.get(tabId));
    return OK;
  },
  async STOP_CAPTURE() {
    await stopActiveCapture();
    return OK;
  },
  async GET_SETTINGS() {
    const { model } = await chrome.storage.local.get('model');
    return { model: model || DEFAULT_ASR_MODEL };
  },
  async APPEND_TRANSCRIPT({ text }) {
    const { transcript = '', lastSegment = '' } = await chrome.storage.local.get(['transcript', 'lastSegment']);
    await chrome.storage.local.set({ transcript: mergeTranscript(transcript, lastSegment, text), lastSegment: text.trim() });
    return OK;
  },
  async CAPTURE_STATE({ capturing, error }) {
    await setCaptureState(Boolean(capturing), error || undefined);
    return OK;
  },
  async PRELOAD_MODEL({ model }) {
    // El offscreen hace la petición para que sobreviva al cierre del popup y notifica PRELOAD_DONE/FAILED.
    try {
      await ensureOffscreen();
      await chrome.runtime.sendMessage({ target: 'offscreen', type: 'PRELOAD_MODEL', model });
    } catch (error) {
      chrome.runtime.sendMessage({ type: 'PRELOAD_FAILED', error: error.message });
    }
    return OK;
  }
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const handler = message.target === 'background' && handlers[message.type];
  if (!handler) return false;
  handler(message).then(sendResponse, (error) => sendResponse({ ok: false, error: error.message }));
  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'stop-capture', title: 'Detener captura', contexts: ['action'] });
  });
});

chrome.contextMenus.onClicked.addListener(({ menuItemId }) => {
  if (menuItemId === 'stop-capture') stopActiveCapture();
});
