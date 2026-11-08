import { ollama, KEEP_ALIVE } from './ollama.js';

const $ = (selector) => document.querySelector(selector);
const statusEl = $('#status');
const preloadButton = $('#preload');
const clearButton = $('#clear');
const captureToggle = $('#capture-toggle');
const modelSelect = $('#model');
const transcriptEl = $('#transcript');
const summaryModelSelect = $('#summary-model');
const summarizeButton = $('#summarize');
const summaryEl = $('#summary');

const ASR_HINT = 'qwen3-asr';
const SUMMARY_PROMPT = 'Eres asistente de un servicio técnico de call center. Resume únicamente lo que comunica el cliente en la transcripción. Escribe en español, de forma breve, clara y útil para que el agente pueda gestionar el caso. Incluye, cuando aparezcan: motivo de contacto, producto o servicio afectado, problema y síntomas, cuándo ocurre, mensajes de error, pasos que el cliente ya probó, impacto o urgencia, y resultado o petición del cliente. No inventes datos ni presentes suposiciones como hechos. Si falta un dato importante, indícalo como pendiente de confirmar. Omite saludos, repeticiones y conversación irrelevante. Devuelve solo el resumen en viñetas, sin introducción.';
const COPY_SOURCES = {
  transcript: [transcriptEl, 'Transcripción copiada.'],
  summary: [summaryEl, 'Resumen copiado.']
};

/** Muestra un mensaje en la barra de estado; un texto vacío la oculta. */
function status(text = '', error = false) {
  statusEl.textContent = text;
  statusEl.hidden = !text;
  statusEl.classList.toggle('error', error);
}

function setCaptureToggle(capturing) {
  captureToggle.querySelector('span:last-child').textContent = capturing ? 'Detener captura' : 'Comenzar captura';
  captureToggle.classList.toggle('stop', capturing);
}

// ---- Modelos ----

const isAsrModel = (name) => name.toLowerCase().includes(ASR_HINT);
const pickModel = (models, saved, matches) => (models.includes(saved) ? saved : models.find(matches) || models[0]);

function fillSelect(select, models, selected) {
  select.replaceChildren(...models.map((name) => new Option(name, name)));
  select.value = selected;
  return selected;
}

async function loadInstalledModels() {
  const showPlaceholder = (text) => [modelSelect, summaryModelSelect].forEach((select) => select.replaceChildren(new Option(text, '')));
  try {
    const [saved, { models: installed = [] }] = await Promise.all([
      chrome.storage.local.get(['model', 'summaryModel']),
      ollama('/api/tags')
    ]);
    const models = installed.map((item) => item.name || item.model).filter(Boolean);
    if (!models.length) {
      showPlaceholder('No hay modelos instalados');
      status('No hay modelos instalados en Ollama.', true);
      return;
    }
    await chrome.storage.local.set({
      model: fillSelect(modelSelect, models, pickModel(models, saved.model, isAsrModel)),
      summaryModel: fillSelect(summaryModelSelect, models, pickModel(models, saved.summaryModel, (name) => !isAsrModel(name)))
    });
  } catch (error) {
    showPlaceholder('No se pudo leer Ollama');
    status(`No se pudieron cargar los modelos instalados: ${error.message}`, true);
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

clearButton.addEventListener('click', async () => {
  transcriptEl.value = '';
  summaryEl.value = '';
  await chrome.storage.local.set({ transcript: '', lastSegment: '', summary: '' });
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
    const { message } = await ollama('/api/chat', {
      body: {
        model,
        stream: false,
        keep_alive: KEEP_ALIVE,
        messages: [
          { role: 'system', content: SUMMARY_PROMPT },
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
