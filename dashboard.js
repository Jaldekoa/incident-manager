import { ollama, KEEP_ALIVE } from './ollama.js';
import { getSettings, populateModelSelects, isCapturableUrl, LANGUAGES, DEFAULT_SUMMARY_PROMPT } from './settings.js';
import { $, createStatus } from './ui.js';

const status = createStatus($('#status'));

// Vista principal
const mainView = $('#main-view');
const tabSource = $('#tab-source');
const micSource = $('#mic-source');
const preloadButton = $('#preload');
const captureToggle = $('#capture-toggle');
const transcriptEl = $('#transcript');
const summarizeButton = $('#summarize');
const summaryEl = $('#summary');

// Vista de configuración
const settingsView = $('#settings-view');
const modelSelect = $('#model');
const languageSelect = $('#language');
const summaryModelSelect = $('#summary-model');
const summaryPromptEl = $('#summary-prompt');

const COPY_SOURCES = {
  transcript: [transcriptEl, 'Transcripción copiada.'],
  summary: [summaryEl, 'Resumen copiado.']
};

const MIC_TITLES = {
  granted: 'Micrófono disponible: se transcribe como [AGENTE].',
  prompt: 'Micrófono sin permiso: pulsa para concederlo (sin él solo se transcribe al usuario).',
  denied: 'Micrófono bloqueado: pulsa para revisar el permiso.'
};
let micGranted = false;

function setSource(element, ok, title) {
  element.classList.toggle('ok', ok);
  element.title = title;
  element.setAttribute('aria-label', title);
}

function setCaptureToggle(capturing) {
  captureToggle.querySelector('span:last-child').textContent = capturing ? 'Detener captura' : 'Comenzar captura';
  captureToggle.classList.toggle('stop', capturing);
}

// ---- Indicadores de fuentes de audio ----

async function refreshTabSource() {
  const [{ capturing }, [tab]] = await Promise.all([
    chrome.storage.session.get('capturing'),
    chrome.tabs.query({ active: true, currentWindow: true })
  ]);
  const ok = Boolean(capturing) || isCapturableUrl(tab?.url);
  setSource(tabSource, ok, ok
    ? 'Audio de la pestaña disponible: se transcribe como [USUARIO].'
    : 'Esta pestaña no se puede capturar: abre la llamada en una página web normal.');
}

function renderMicState(state) {
  micGranted = state === 'granted';
  setSource(micSource, micGranted, MIC_TITLES[state] || MIC_TITLES.prompt);
}

async function watchMicPermission() {
  try {
    const permission = await navigator.permissions.query({ name: 'microphone' });
    renderMicState(permission.state);
    permission.onchange = () => renderMicState(permission.state);
  } catch {
    renderMicState('prompt');
  }
}

// ---- Configuración ----

async function fillSettingsForm() {
  const settings = await getSettings();
  languageSelect.value = settings.language;
  summaryPromptEl.value = settings.summaryPrompt;
  return settings;
}

async function initSettings() {
  languageSelect.replaceChildren(...Object.entries(LANGUAGES).map(([value, label]) => new Option(label, value)));
  const settings = await fillSettingsForm();
  try {
    await chrome.storage.local.set(await populateModelSelects(modelSelect, summaryModelSelect, settings));
  } catch (error) {
    status(error.message, true);
  }
}

async function showSettings(visible) {
  if (visible) {
    // Descarta cambios sin guardar de una visita anterior.
    const { model, summaryModel } = await fillSettingsForm();
    if (model) modelSelect.value = model;
    if (summaryModel) summaryModelSelect.value = summaryModel;
  }
  mainView.hidden = visible;
  settingsView.hidden = !visible;
  status();
}

// ---- Estado inicial y sincronización ----

chrome.storage.local.get(['transcript', 'summary'], ({ transcript = '', summary = '' }) => {
  transcriptEl.value = transcript;
  summaryEl.value = summary;
});

chrome.storage.session.get(['capturing', 'lastError']).then(({ capturing, lastError }) => {
  setCaptureToggle(Boolean(capturing));
  if (lastError) status(lastError, true);
});

initSettings();
refreshTabSource();
watchMicPermission();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.transcript) {
    transcriptEl.value = changes.transcript.newValue || '';
    transcriptEl.scrollTop = transcriptEl.scrollHeight;
  }
  if (area !== 'session') return;
  if (changes.capturing) {
    setCaptureToggle(Boolean(changes.capturing.newValue));
    refreshTabSource();
    status();
  }
  if (changes.lastError?.newValue) status(changes.lastError.newValue, true);
});

chrome.runtime.onMessage.addListener(({ type, error }) => {
  if (type !== 'PRELOAD_DONE' && type !== 'PRELOAD_FAILED') return;
  preloadButton.disabled = false;
  if (type === 'PRELOAD_DONE') status('Modelo cargado y listo.');
  else status(`No se pudo cargar el modelo: ${error}`, true);
});

// ---- Acciones: vista principal ----

micSource.addEventListener('click', () => {
  // Chrome no muestra la petición de permiso dentro del popup: se concede en una pestaña aparte.
  if (micGranted) status('Micrófono disponible.');
  else chrome.tabs.create({ url: chrome.runtime.getURL('permission.html') });
});

$('#open-settings').addEventListener('click', () => showSettings(true));

$('#clear').addEventListener('click', async () => {
  transcriptEl.value = '';
  summaryEl.value = '';
  await chrome.storage.local.set({ transcript: '', lastSegments: {}, lastSpeaker: '', summary: '' });
});

preloadButton.addEventListener('click', async () => {
  const { model } = await getSettings();
  preloadButton.disabled = true;
  status(`Cargando ${model} en Ollama…`);
  chrome.runtime.sendMessage({ target: 'background', type: 'PRELOAD_MODEL', model });
});

captureToggle.addEventListener('click', async () => {
  captureToggle.disabled = true;
  try {
    const { capturing } = await chrome.storage.session.get('capturing');
    const request = capturing
      ? { type: 'STOP_CAPTURE' }
      : { type: 'START_CAPTURE', tabId: (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id };
    const result = await chrome.runtime.sendMessage({ target: 'background', ...request });
    if (!result?.ok) status(result?.error || 'No se pudo cambiar el estado de captura.', true);
  } catch (error) {
    status(`No se pudo cambiar el estado de captura: ${error.message}`, true);
  } finally {
    captureToggle.disabled = false;
  }
});

summarizeButton.addEventListener('click', async () => {
  const transcript = transcriptEl.value.trim();
  const { summaryModel: model, summaryPrompt } = await getSettings();
  if (!transcript) return status('Aún no hay transcripción para resumir.', true);
  if (!model) return status('Elige un modelo de resumen en Configuración.', true);

  summarizeButton.disabled = true;
  status(`Generando resumen con ${model}…`);
  try {
    const { message } = await ollama('/api/chat', {
      body: {
        model,
        stream: false,
        keep_alive: KEEP_ALIVE,
        messages: [
          { role: 'system', content: summaryPrompt },
          { role: 'user', content: `Resume esta transcripción de una llamada de soporte técnico:\n\n${transcript}` }
        ]
      }
    });
    const summary = message?.content?.trim();
    if (!summary) throw new Error('El modelo devolvió un resumen vacío.');
    summaryEl.value = summary;
    await chrome.storage.local.set({ summary });
    status('Resumen generado.');
  } catch (error) {
    status(`No se pudo generar el resumen: ${error.message}`, true);
  } finally {
    summarizeButton.disabled = false;
  }
});

document.querySelectorAll('[data-copy]').forEach((button) => button.addEventListener('click', async () => {
  const [source, doneMessage] = COPY_SOURCES[button.dataset.copy];
  if (!source.value.trim()) return status('No hay texto para copiar.', true);
  try {
    await navigator.clipboard.writeText(source.value);
    status(doneMessage);
  } catch (error) {
    status(`No se pudo copiar: ${error.message}`, true);
  }
}));

// ---- Acciones: configuración ----

$('#close-settings').addEventListener('click', () => showSettings(false));

$('#reset-prompt').addEventListener('click', () => {
  summaryPromptEl.value = DEFAULT_SUMMARY_PROMPT;
  status('Prompt por defecto restaurado. Pulsa Guardar para aplicarlo.');
});

$('#save-settings').addEventListener('click', async () => {
  try {
    await chrome.storage.local.set({
      language: languageSelect.value,
      summaryPrompt: summaryPromptEl.value.trim(),
      ...(modelSelect.value && { model: modelSelect.value }),
      ...(summaryModelSelect.value && { summaryModel: summaryModelSelect.value })
    });
    await fillSettingsForm(); // un prompt vacío vuelve al valor por defecto
    status('Configuración guardada.');
  } catch (error) {
    status(`No se pudo guardar: ${error.message}`, true);
  }
});
