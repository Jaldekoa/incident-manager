import { getSettings, SPEAKERS } from './settings.js';

const RESTRICTED_URL = /^(chrome|edge|about|chrome-extension):/i;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function hasOffscreen() {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  return contexts.length > 0;
}

/** Crea el documento offscreen si no existe y espera a que su listener responda (los módulos cargan diferidos). */
async function ensureOffscreen() {
  if (!(await hasOffscreen())) {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['USER_MEDIA', 'AUDIO_PLAYBACK'],
      justification: 'Capturar audio de pestaña y micrófono, reproducirlo localmente y transcribirlo sin mostrar una ventana.'
    });
  }
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      if ((await chrome.runtime.sendMessage({ target: 'offscreen', type: 'PING' }))?.ok) return;
    } catch { /* Aún no hay receptor. */ }
    await sleep(50);
  }
  throw new Error('El documento de captura no respondió.');
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

/** Devuelve `text` sin las 2–10 primeras palabras que repiten el final de `lastSegment` (solape entre ventanas). */
function removeOverlap(lastSegment, text) {
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
function appendSegment({ transcript = '', lastSegments = {}, lastSpeaker = '' }, speaker, text) {
  const addition = removeOverlap(lastSegments[speaker] || '', text);
  const nextSegments = { ...lastSegments, [speaker]: text.trim() };
  if (!addition) return { transcript, lastSegments: nextSegments, lastSpeaker };
  const continues = transcript && speaker === lastSpeaker;
  const next = continues
    ? `${transcript}${/\s$/.test(transcript) ? '' : ' '}${addition}`
    : `${transcript}${transcript ? '\n' : ''}[${speaker}] ${addition}`;
  return { transcript: next, lastSegments: nextSegments, lastSpeaker: speaker };
}

async function startCaptureForTab(tab) {
  if (!tab?.id || !tab.url || RESTRICTED_URL.test(tab.url)) {
    throw new Error('Abre la llamada en una pestaña web normal y pulsa allí el icono de la extensión.');
  }
  await ensureOffscreen();
  const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
  await chrome.storage.session.set({ capturing: false, lastError: '' });
  await chrome.storage.local.set({ lastSegments: {}, lastSpeaker: '' });
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
    const { model, asrPrompt } = await getSettings();
    return { model, asrPrompt };
  },
  async APPEND_TRANSCRIPT({ speaker, text }) {
    if (!Object.values(SPEAKERS).includes(speaker)) throw new Error(`Hablante desconocido: ${speaker}`);
    const state = await chrome.storage.local.get(['transcript', 'lastSegments', 'lastSpeaker']);
    await chrome.storage.local.set(appendSegment(state, speaker, text));
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
