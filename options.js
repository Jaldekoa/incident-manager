import { getSettings, populateModelSelects, DEFAULT_ASR_PROMPT, DEFAULT_SUMMARY_PROMPT } from './settings.js';
import { $, createStatus } from './ui.js';

const modelSelect = $('#model');
const summaryModelSelect = $('#summary-model');
const asrPromptEl = $('#asr-prompt');
const summaryPromptEl = $('#summary-prompt');
const micStateEl = $('#mic-state');
const micButton = $('#mic-permission');
const status = createStatus($('#status'));

const MIC_STATES = {
  granted: ['Permiso concedido.', 'ok', ''],
  prompt: ['Permiso pendiente: sin él solo se transcribe al usuario.', '', 'Permitir micrófono'],
  denied: ['Permiso denegado: habilítalo en los permisos de la extensión.', 'error', 'Abrir permisos']
};
let micPermission = 'prompt';

function renderMicState(state) {
  micPermission = MIC_STATES[state] ? state : 'prompt';
  const [text, tone, action] = MIC_STATES[micPermission];
  micStateEl.textContent = text;
  micStateEl.className = `hint ${tone}`;
  micButton.textContent = action;
  micButton.hidden = !action;
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

async function init() {
  const settings = await getSettings();
  asrPromptEl.value = settings.asrPrompt;
  summaryPromptEl.value = settings.summaryPrompt;
  watchMicPermission();
  try {
    await populateModelSelects(modelSelect, summaryModelSelect, settings);
  } catch (error) {
    status(error.message, true);
  }
}

micButton.addEventListener('click', async () => {
  if (micPermission === 'denied') {
    chrome.tabs.create({ url: `chrome://settings/content/siteDetails?site=${encodeURIComponent(location.origin)}` });
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    renderMicState('granted');
  } catch (error) {
    status(`No se pudo acceder al micrófono: ${error.message}`, true);
  }
});

$('#reset').addEventListener('click', () => {
  asrPromptEl.value = DEFAULT_ASR_PROMPT;
  summaryPromptEl.value = DEFAULT_SUMMARY_PROMPT;
  status('Prompts por defecto restaurados. Pulsa Guardar para aplicarlos.');
});

$('#save').addEventListener('click', async () => {
  try {
    await chrome.storage.local.set({
      asrPrompt: asrPromptEl.value.trim(),
      summaryPrompt: summaryPromptEl.value.trim(),
      ...(modelSelect.value && { model: modelSelect.value }),
      ...(summaryModelSelect.value && { summaryModel: summaryModelSelect.value })
    });
    const { asrPrompt, summaryPrompt } = await getSettings(); // un prompt vacío vuelve al valor por defecto
    asrPromptEl.value = asrPrompt;
    summaryPromptEl.value = summaryPrompt;
    status('Configuración guardada.');
  } catch (error) {
    status(`No se pudo guardar: ${error.message}`, true);
  }
});

init();
