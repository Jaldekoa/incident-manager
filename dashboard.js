const statusEl = document.querySelector('#status');
const preloadButton = document.querySelector('#preload');
const clearButton = document.querySelector('#clear');
const captureToggle = document.querySelector('#capture-toggle');
const modelSelect = document.querySelector('#model');
const transcriptEl = document.querySelector('#transcript');
const summaryModelSelect = document.querySelector('#summary-model');
const summarizeButton = document.querySelector('#summarize');
const summaryEl = document.querySelector('#summary');

function status(text, error = false) {
  statusEl.textContent = text;
  statusEl.hidden = text === 'Captura detenida' || text === 'Capturando audio de la pestaña…';
  statusEl.style.color = error ? '#b83737' : '';
}

chrome.storage.local.get(['transcript', 'summary'], ({ transcript = '', summary = '' }) => {
  transcriptEl.value = transcript;
  summaryEl.value = summary;
});

async function loadInstalledModels() {
  try {
    const { model: savedModel, summaryModel: savedSummaryModel } = await chrome.storage.local.get(['model', 'summaryModel']);
    const response = await fetch('http://127.0.0.1:11434/api/tags');
    if (!response.ok) throw new Error(`Ollama respondió ${response.status}`);
    const data = await response.json();
    const models = (data.models || []).map((item) => item.name || item.model).filter(Boolean);
    modelSelect.replaceChildren();
    if (!models.length) {
      modelSelect.add(new Option('No hay modelos instalados', ''));
      summaryModelSelect.replaceChildren(new Option('No hay modelos instalados', ''));
      status('No hay modelos instalados en Ollama.', true);
      return;
    }
    for (const name of models) modelSelect.add(new Option(name, name));
    const preferred = models.includes(savedModel) ? savedModel : models.find((name) => name.toLowerCase().includes('qwen3-asr')) || models[0];
    modelSelect.value = preferred;
    await chrome.storage.local.set({ model: preferred });

    summaryModelSelect.replaceChildren();
    for (const name of models) summaryModelSelect.add(new Option(name, name));
    const summaryPreferred = models.includes(savedSummaryModel)
      ? savedSummaryModel
      : models.find((name) => !name.toLowerCase().includes('qwen3-asr')) || models[0];
    summaryModelSelect.value = summaryPreferred;
    await chrome.storage.local.set({ summaryModel: summaryPreferred });
  } catch (error) {
    modelSelect.replaceChildren(new Option('No se pudo leer Ollama', ''));
    summaryModelSelect.replaceChildren(new Option('No se pudo leer Ollama', ''));
    status(`No se pudieron cargar los modelos instalados: ${error.message}`, true);
  }
}

loadInstalledModels();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.transcript) {
    transcriptEl.value = changes.transcript.newValue || '';
    transcriptEl.scrollTop = transcriptEl.scrollHeight;
  }
  if (area === 'session' && changes.capturing) {
    setCaptureToggle(Boolean(changes.capturing.newValue));
    status(changes.capturing.newValue ? 'Capturando audio de la pestaña…' : 'Captura detenida');
  }
  if (area === 'session' && changes.lastError?.newValue) status(changes.lastError.newValue, true);
});

chrome.storage.session.get(['capturing', 'lastError']).then(({ capturing, lastError }) => {
  setCaptureToggle(Boolean(capturing));
  if (lastError) status(lastError, true);
  else if (capturing) status('Capturando audio de la pestaña…');
});

modelSelect.addEventListener('change', () => chrome.storage.local.set({ model: modelSelect.value }));
summaryModelSelect.addEventListener('change', () => chrome.storage.local.set({ summaryModel: summaryModelSelect.value }));

summarizeButton.addEventListener('click', async () => {
  const transcript = transcriptEl.value.trim();
  const model = summaryModelSelect.value;
  if (!transcript) {
    status('Aún no hay transcripción para resumir.', true);
    return;
  }
  if (!model) {
    status('Elige un modelo de texto instalado en Ollama.', true);
    return;
  }

  summarizeButton.disabled = true;
  status(`Generando resumen con ${model}…`);
  try {
    const response = await fetch('http://127.0.0.1:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        keep_alive: '30m',
        messages: [
          {
            role: 'system',
            content: 'Eres asistente de un servicio técnico de call center. Resume únicamente lo que comunica el cliente en la transcripción. Escribe en español, de forma breve, clara y útil para que el agente pueda gestionar el caso. Incluye, cuando aparezcan: motivo de contacto, producto o servicio afectado, problema y síntomas, cuándo ocurre, mensajes de error, pasos que el cliente ya probó, impacto o urgencia, y resultado o petición del cliente. No inventes datos ni presentes suposiciones como hechos. Si falta un dato importante, indícalo como pendiente de confirmar. Omite saludos, repeticiones y conversación irrelevante. Devuelve solo el resumen en viñetas, sin introducción.'
          },
          { role: 'user', content: `Resume esta transcripción de una llamada de soporte técnico:\n\n${transcript}` }
        ]
      })
    });
    if (!response.ok) throw new Error(`Ollama respondió ${response.status}: ${(await response.text()).slice(0, 180)}`);
    const result = await response.json();
    const summary = result.message?.content?.trim();
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

preloadButton.addEventListener('click', async () => {
  preloadButton.disabled = true;
  status(`Cargando ${modelSelect.value} en Ollama…`);
  await chrome.storage.local.set({ model: modelSelect.value });
  chrome.runtime.sendMessage({ target: 'background', type: 'PRELOAD_MODEL', model: modelSelect.value });
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'PRELOAD_DONE') {
    status('Modelo cargado y listo.'); preloadButton.disabled = false;
  }
  if (message.type === 'PRELOAD_FAILED') {
    status(`No se pudo cargar el modelo: ${message.error}`, true); preloadButton.disabled = false;
  }
});

clearButton.addEventListener('click', async () => {
  transcriptEl.value = '';
  summaryEl.value = '';
  await chrome.storage.local.set({ transcript: '', lastSegment: '', summary: '' });
});

function setCaptureToggle(capturing) {
  captureToggle.querySelector('span:last-child').textContent = capturing ? 'Detener captura' : 'Comenzar captura';
  captureToggle.classList.toggle('stop', capturing);
}

document.querySelectorAll('[data-copy]').forEach((button) => {
  button.addEventListener('click', async () => {
    const source = button.dataset.copy === 'transcript' ? transcriptEl : summaryEl;
    if (!source.value.trim()) {
      status('No hay texto para copiar.', true);
      return;
    }
    try {
      await navigator.clipboard.writeText(source.value);
      status(button.dataset.copy === 'transcript' ? 'Transcripción copiada.' : 'Resumen copiado.');
    } catch (error) {
      status(`No se pudo copiar: ${error.message}`, true);
    }
  });
});

captureToggle.addEventListener('click', async () => {
  const { capturing } = await chrome.storage.session.get('capturing');
  captureToggle.disabled = true;
  try {
    const activeTabs = capturing ? [] : await chrome.tabs.query({ active: true, currentWindow: true });
    const result = await chrome.runtime.sendMessage({
      target: 'background',
      type: capturing ? 'STOP_CAPTURE' : 'START_CAPTURE',
      ...(capturing ? {} : { tabId: activeTabs[0]?.id })
    });
    if (!result?.ok) status(result?.error || 'No se pudo cambiar el estado de captura.', true);
  } catch (error) {
    status(`No se pudo cambiar el estado de captura: ${error.message}`, true);
  } finally {
    captureToggle.disabled = false;
    const current = await chrome.storage.session.get('capturing');
    setCaptureToggle(Boolean(current.capturing));
  }
});
