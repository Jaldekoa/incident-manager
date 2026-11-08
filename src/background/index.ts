import { getSettings, isCapturableUrl, isSpeaker } from '../shared/settings';
import { getLocal, setLocal, setSession } from '../shared/storage';
import { broadcast, sendToOffscreen, type BackgroundRequest, type BackgroundResponse } from '../shared/messages';
import { errorMessage } from '../shared/errors';
import { appendSegment } from './transcript';

const OFFSCREEN_URL = 'src/offscreen/index.html';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function hasOffscreen(): Promise<boolean> {
  const contexts = await chrome.runtime.getContexts({ contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT] });
  return contexts.length > 0;
}

/** Crea el documento offscreen si no existe y espera a que su listener responda (los módulos cargan diferidos). */
async function ensureOffscreen(): Promise<void> {
  if (!(await hasOffscreen())) {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: [chrome.offscreen.Reason.USER_MEDIA, chrome.offscreen.Reason.AUDIO_PLAYBACK],
      justification: 'Capturar audio de pestaña y micrófono, reproducirlo localmente y transcribirlo sin mostrar una ventana.'
    });
  }
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      if ((await sendToOffscreen({ type: 'PING' }))?.ok) return;
    } catch { /* Aún no hay receptor. */ }
    await sleep(50);
  }
  throw new Error('El documento de captura no respondió.');
}

/** Persiste el estado de captura y lo refleja en el icono. `error` solo se escribe si se indica. */
async function setCaptureState(capturing: boolean, error?: string): Promise<void> {
  await setSession({ capturing, ...(error !== undefined && { lastError: error }) });
  await Promise.all([
    chrome.action.setTitle({ title: capturing ? 'Detener transcripción' : 'Iniciar transcripción' }),
    chrome.action.setBadgeText({ text: capturing ? 'REC' : '' })
  ]);
}

async function startCaptureForTab(tab: chrome.tabs.Tab): Promise<void> {
  if (!tab.id || !isCapturableUrl(tab.url)) {
    throw new Error('Abre la llamada en una pestaña web normal y pulsa allí el icono de la extensión.');
  }
  await ensureOffscreen();
  const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
  await setSession({ capturing: false, lastError: '' });
  await setLocal({ lastSegments: {}, lastSpeaker: '' });
  const result = await sendToOffscreen({ type: 'START_CAPTURE', streamId });
  if (!result?.ok) throw new Error((result && !result.ok && result.error) || 'No se pudo iniciar la captura.');
}

async function stopActiveCapture(): Promise<void> {
  if (await hasOffscreen()) {
    try { await sendToOffscreen({ type: 'STOP_CAPTURE' }); }
    catch { /* También limpiamos el estado si el documento ya desapareció. */ }
  }
  await setCaptureState(false, '');
}

type Handlers = {
  [T in BackgroundRequest['type']]: (message: Extract<BackgroundRequest, { type: T }>) => Promise<BackgroundResponse<T>>;
};

const OK = { ok: true } as const;

const handlers: Handlers = {
  async START_CAPTURE({ tabId }) {
    if (tabId === undefined) throw new Error('No hay ninguna pestaña activa.');
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
    if (!isSpeaker(speaker)) throw new Error(`Hablante desconocido: ${speaker}`);
    const state = await getLocal(['transcript', 'lastSegments', 'lastSpeaker']);
    await setLocal(appendSegment(state, speaker, text));
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
      await sendToOffscreen({ type: 'PRELOAD_MODEL', model });
    } catch (error) {
      broadcast({ type: 'PRELOAD_FAILED', error: errorMessage(error) });
    }
    return OK;
  }
};

chrome.runtime.onMessage.addListener((message: BackgroundRequest, _sender, sendResponse) => {
  if (message?.target !== 'background' || !(message.type in handlers)) return false;
  const handler = handlers[message.type] as (message: BackgroundRequest) => Promise<unknown>;
  handler(message).then(sendResponse, (error) => sendResponse({ ok: false, error: errorMessage(error) }));
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
