import { ollama, KEEP_ALIVE } from './ollama.js';
import { getSettings, populateModelSelects } from './settings.js';
import { $, createStatus } from './ui.js';

const preloadButton = $('#preload');
const clearButton = $('#clear');
const settingsButton = $('#settings');
const captureToggle = $('#capture-toggle');
const modelSelect = $('#model');
const transcriptEl = $('#transcript');
const summaryModelSelect = $('#summary-model');
const summarizeButton = $('#summarize');
const summaryEl = $('#summary');
const status = createStatus($('#status'));

const COPY_SOURCES = {
  transcript: [transcriptEl, 'Transcripción copiada.'],
  summary: [summaryEl, 'Resumen copiado.']
};

function setCaptureToggle(capturing) {
  captureToggle.querySelector('span:last-child').textContent = capturing ? 'Detener captura' : 'Comenzar captura';
  captureToggle.classList.toggle('stop', capturing);
}

async function loadInstalledModels() {
  try {
    await chrome.storage.local.set(await populateModelSelects(modelSelect, summaryModelSelect, await getSettings()));
  } catch (error) {
    status(error.message, true);
  }
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

loadInstalledModels();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.transcript) {
    transcriptEl.value = changes.transcript.newValue || '';
    transcriptEl.scrollTop = transcriptEl.scrollHeight;
  }
  if (area !== 'session') return;
  if (changes.capturing) {
    setCaptureToggle(Boolean(changes.capturing.newValue));
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

// ---- Acciones ----

modelSelect.addEventListener('change', () => chrome.storage.local.set({ model: modelSelect.value }));
summaryModelSelect.addEventListener('change', () => chrome.storage.local.set({ summaryModel: summaryModelSelect.value }));

settingsButton.addEventListener('click', () => chrome.runtime.openOptionsPage());

clearButton.addEventListener('click', async () => {
  transcriptEl.value = '';
  summaryEl.value = '';
  await chrome.storage.local.set({ transcript: '', lastSegments: {}, lastSpeaker: '', summary: '' });
});

preloadButton.addEventListener('click', () => {
  preloadButton.disabled = true;
  status(`Cargando ${modelSelect.value} en Ollama…`);
  chrome.runtime.sendMessage({ target: 'background', type: 'PRELOAD_MODEL', model: modelSelect.value });
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
  const model = summaryModelSelect.value;
  if (!transcript) return status('Aún no hay transcripción para resumir.', true);
  if (!model) return status('Elige un modelo de texto instalado en Ollama.', true);

  summarizeButton.disabled = true;
  status(`Generando resumen con ${model}…`);
  try {
    const { summaryPrompt } = await getSettings();
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
