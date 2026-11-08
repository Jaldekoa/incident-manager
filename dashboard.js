import { ollama, KEEP_ALIVE } from './ollama.js';
import { getSettings, populateModelSelects, isCapturableUrl, LANGUAGES, DEFAULT_SUMMARY_PROMPT } from './settings.js';
import { categorize } from './categorize.js';
import { createCategoryTree } from './category-tree.js';
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
const categorizeButton = $('#categorize');
// Una selección manual en el árbol se guarda como la categoría de la llamada.
const categoryTree = createCategoryTree($('#category'), { onSelect: (category) => chrome.storage.local.set({ category }) });

// Vista de configuración
const settingsView = $('#settings-view');
const languageSelect = $('#language');
const summaryPromptEl = $('#summary-prompt');
const MODEL_SELECTS = {
  model: $('#model'),
  summaryModel: $('#summary-model'),
  categoryModel: $('#category-model')
};

const COPY_SOURCES = {
  transcript: [transcriptEl, 'Transcripción copiada.'],
  summary: [summaryEl, 'Resumen copiado.'],
  category: [categoryTree, 'Categoría copiada.']
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
    ? 'Audio de la pestaña disponible.'
    : 'Esta pestaña no se puede capturar.');
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
    await chrome.storage.local.set(await populateModelSelects(MODEL_SELECTS, settings));
  } catch (error) {
    status(error.message, true);
  }
}

async function showSettings(visible) {
  if (visible) {
    // Descarta cambios sin guardar de una visita anterior.
    const settings = await fillSettingsForm();
    for (const [key, select] of Object.entries(MODEL_SELECTS)) if (settings[key]) select.value = settings[key];
  }
  mainView.hidden = visible;
  settingsView.hidden = !visible;
  status();
}

// ---- Estado inicial y sincronización ----

chrome.storage.local.get(['transcript', 'summary', 'category'], ({ transcript = '', summary = '', category }) => {
  transcriptEl.value = transcript;
  summaryEl.value = summary;
  categoryTree.setCategory(category);
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

tabSource.addEventListener('click', () => status(tabSource.title, !tabSource.classList.contains('ok')));

micSource.addEventListener('click', () => {
  // Chrome no muestra la petición de permiso dentro del popup: se concede en una pestaña aparte.
  if (micGranted) status('Micrófono disponible.');
  else chrome.tabs.create({ url: chrome.runtime.getURL('permission.html') });
});

$('#open-settings').addEventListener('click', () => showSettings(true));

$('#clear').addEventListener('click', async () => {
  transcriptEl.value = '';
  summaryEl.value = '';
  categoryTree.setCategory(null);
  await chrome.storage.local.set({ transcript: '', lastSegments: {}, lastSpeaker: '', summary: '', category: null });
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

categorizeButton.addEventListener('click', async () => {
  const summary = summaryEl.value.trim();
  const { categoryModel: model } = await getSettings();
  if (!summary) return status('Genera primero el resumen para poder categorizarlo.', true);
  if (!model) return status('Elige un modelo decisional en Configuración.', true);

  categorizeButton.disabled = true;
  status(`Categorizando con ${model}…`);
  try {
    const category = await categorize(model, summary, (done, total) =>
      status(`Categorizando con ${model}…${total > 1 ? ` (${done}/${total})` : ''}`));
    categoryTree.setCategory(category);
    await chrome.storage.local.set({ category });
    status('Incidencia categorizada.');
  } catch (error) {
    status(`No se pudo categorizar: ${error.message}`, true);
  } finally {
    categorizeButton.disabled = false;
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
      ...Object.fromEntries(Object.entries(MODEL_SELECTS).filter(([, select]) => select.value).map(([key, select]) => [key, select.value]))
    });
    await fillSettingsForm(); // un prompt vacío vuelve al valor por defecto
    status('Configuración guardada.');
  } catch (error) {
    status(`No se pudo guardar: ${error.message}`, true);
  }
});
