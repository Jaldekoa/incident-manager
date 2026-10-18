const statusEl = document.querySelector('#status');
const preloadButton = document.querySelector('#preload');
const clearButton = document.querySelector('#clear');
const captureToggle = document.querySelector('#capture-toggle');
const modelSelect = document.querySelector('#model');
const refreshModelsButton = document.querySelector('#refresh-models');
const transcriptEl = document.querySelector('#transcript');

function status(text, error = false) {
  statusEl.textContent = text;
  statusEl.style.color = error ? '#b83737' : '';
}

chrome.storage.local.get('transcript', ({ transcript = '' }) => { transcriptEl.value = transcript; });

async function loadInstalledModels() {
  refreshModelsButton.disabled = true;
  try {
    const { model: savedModel } = await chrome.storage.local.get('model');
    const response = await fetch('http://127.0.0.1:11434/api/tags');
    if (!response.ok) throw new Error(`Ollama respondió ${response.status}`);
    const data = await response.json();
    const models = (data.models || []).map((item) => item.name || item.model).filter(Boolean);
    modelSelect.replaceChildren();
    if (!models.length) {
      modelSelect.add(new Option('No hay modelos instalados', ''));
      status('No hay modelos instalados en Ollama.', true);
      return;
    }
    for (const name of models) modelSelect.add(new Option(name, name));
    const preferred = models.includes(savedModel) ? savedModel : models.find((name) => name.toLowerCase().includes('qwen3-asr')) || models[0];
    modelSelect.value = preferred;
    await chrome.storage.local.set({ model: preferred });
  } catch (error) {
    modelSelect.replaceChildren(new Option('No se pudo leer Ollama', ''));
    status(`No se pudieron cargar los modelos instalados: ${error.message}`, true);
  } finally {
    refreshModelsButton.disabled = false;
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
refreshModelsButton.addEventListener('click', loadInstalledModels);

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

clearButton.addEventListener('click', () => chrome.storage.local.set({ transcript: '', lastSegment: '' }));

function setCaptureToggle(capturing) {
  captureToggle.textContent = capturing ? 'Detener captura' : 'Comenzar captura';
  captureToggle.classList.toggle('stop', capturing);
}

captureToggle.addEventListener('click', async () => {
  const { capturing } = await chrome.storage.session.get('capturing');
  captureToggle.disabled = true;
  const result = await chrome.runtime.sendMessage({ target: 'background', type: capturing ? 'STOP_CAPTURE' : 'START_CAPTURE' });
  captureToggle.disabled = false;
  if (!result?.ok) status(result?.error || 'No se pudo cambiar el estado de captura.', true);
  const current = await chrome.storage.session.get('capturing');
  setCaptureToggle(Boolean(current.capturing));
});
