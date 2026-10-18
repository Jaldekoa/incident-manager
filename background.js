const DASHBOARD = 'dashboard.html';

async function ensureOffscreen() {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (!contexts.length) {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['USER_MEDIA', 'AUDIO_PLAYBACK'],
      justification: 'Capturar audio de pestaña, reproducirlo localmente y transcribirlo sin mostrar una ventana.'
    });
  }
}

async function dashboardTab() {
  const url = chrome.runtime.getURL(DASHBOARD);
  const tabs = await chrome.tabs.query({ url });
  if (tabs.length) {
    await chrome.tabs.update(tabs[0].id, { active: true });
    await chrome.windows.update(tabs[0].windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
  chrome.contextMenus.create({ id: 'open-dashboard', title: 'Abrir transcripción y ajustes', contexts: ['action'] });
  chrome.contextMenus.create({ id: 'stop-capture', title: 'Detener captura', contexts: ['action'] });
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target === 'background' && message.type === 'STOP_CAPTURE') {
    stopActiveCapture().then(() => sendResponse({ ok: true })).catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message.target === 'background' && message.type === 'START_CAPTURE') {
    chrome.storage.session.get('captureTabId').then(({ captureTabId }) => captureTabId && chrome.tabs.get(captureTabId))
      .then((tab) => startCaptureForTab(tab))
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message.target === 'background' && message.type === 'GET_SETTINGS') {
    chrome.storage.local.get(['model', 'transcript']).then(({ transcript = '', model }) => {
      sendResponse({ transcript, model: model || 'frozenlab/qwen3-asr:0.6b' });
    });
    return true;
  }
  if (message.target === 'background' && message.type === 'APPEND_TRANSCRIPT') {
    chrome.storage.local.get(['transcript', 'lastSegment']).then(({ transcript = '', lastSegment = '' }) => {
      const previous = lastSegment.trim().split(/\s+/).filter(Boolean);
      const incoming = message.text.trim().split(/\s+/).filter(Boolean);
      const normalize = (word) => word.toLocaleLowerCase('es').replace(/[^\p{L}\p{N}]/gu, '');
      let overlap = 0;
      for (let count = Math.min(10, previous.length, incoming.length); count >= 2; count--) {
        const left = previous.slice(-count).map(normalize);
        const right = incoming.slice(0, count).map(normalize);
        if (left.every((word, index) => word && word === right[index])) { overlap = count; break; }
      }
      const addition = incoming.slice(overlap).join(' ');
      const next = addition ? `${transcript}${transcript && !transcript.endsWith(' ') ? ' ' : ''}${addition}` : transcript;
      return chrome.storage.local.set({ transcript: next, lastSegment: message.text.trim() }).then(() => sendResponse({ ok: true }));
    });
    return true;
  }
  if (message.target === 'background' && message.type === 'CAPTURE_STATE') {
    const capturing = Boolean(message.capturing);
    chrome.storage.session.set({ capturing, ...(message.error ? { lastError: message.error } : {}) }).then(async () => {
      await chrome.action.setTitle({ title: capturing ? 'Detener transcripción' : 'Iniciar transcripción' });
      await chrome.action.setBadgeText({ text: capturing ? 'REC' : '' });
      sendResponse({ ok: true });
    });
    return true;
  }
  if (message.target === 'background' && message.type === 'PRELOAD_MODEL') {
    ensureOffscreen().then(() => chrome.runtime.sendMessage({ target: 'offscreen', type: 'PRELOAD_MODEL', model: message.model }))
      .catch((error) => chrome.runtime.sendMessage({ type: 'PRELOAD_FAILED', error: error.message }));
  }
});

async function stopActiveCapture() {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (contexts.length) {
    try { await chrome.runtime.sendMessage({ target: 'offscreen', type: 'STOP_CAPTURE' }); }
    catch { /* También limpiamos el estado si el documento ya desapareció. */ }
  }
  await chrome.storage.session.set({ capturing: false, lastError: '' });
  await chrome.action.setTitle({ title: 'Iniciar transcripción' });
  await chrome.action.setBadgeText({ text: '' });
}

async function startCaptureForTab(tab) {
  if (!tab?.id || !tab.url || /^(chrome|edge|about|chrome-extension):/i.test(tab.url)) {
    throw new Error('Abre la llamada en una pestaña web normal y pulsa allí el icono de la extensión.');
  }
  await ensureOffscreen();
  const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
  await chrome.storage.session.set({ captureTabId: tab.id, capturing: false, lastError: '' });
  await chrome.storage.local.set({ lastSegment: '' });
  const result = await chrome.runtime.sendMessage({ target: 'offscreen', type: 'START_CAPTURE', streamId });
  if (!result?.ok) throw new Error(result?.error || 'No se pudo iniciar la captura.');
}

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === 'open-dashboard') dashboardTab();
  if (info.menuItemId === 'stop-capture') stopActiveCapture();
});

chrome.action.onClicked.addListener(async (tab) => {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (contexts.length) {
    try {
      const state = await chrome.runtime.sendMessage({ target: 'offscreen', type: 'GET_CAPTURE_STATE' });
      if (state?.capturing) {
        await stopActiveCapture();
        return;
      }
    } catch { /* Un documento obsoleto no bloquea una nueva captura. */ }
  }
  try {
    await startCaptureForTab(tab);
  } catch (error) {
    await chrome.storage.session.set({ capturing: false, lastError: error.message });
    await chrome.action.setTitle({ title: 'Iniciar transcripción' });
    await chrome.action.setBadgeText({ text: '' });
    await dashboardTab();
  }
});
