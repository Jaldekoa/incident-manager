import { ollama, DEFAULT_ASR_MODEL } from './ollama.js';

export const SPEAKERS = { agent: 'AGENTE', user: 'USUARIO' };

/** Idiomas de transcripción: valor que entiende Qwen3-ASR → etiqueta visible. */
export const LANGUAGES = { Spanish: 'Español', English: 'Inglés' };
export const DEFAULT_LANGUAGE = 'Spanish';
export const buildAsrPrompt = (language) => `language ${language}<asr_text>`;
export const DEFAULT_ASR_PROMPT = buildAsrPrompt(DEFAULT_LANGUAGE);

export const DEFAULT_SUMMARY_PROMPT = 'Eres asistente de un servicio técnico de call center. Recibirás la transcripción automática de una llamada en la que cada intervención va etiquetada: [AGENTE] es el técnico que atiende y [USUARIO] es el cliente que reporta la incidencia. La transcripción puede contener errores, cortes o frases incompletas. Reconstruye la conversación y redacta en español un resumen breve, claro y útil para abrir o documentar la incidencia. Incluye, cuando aparezcan: motivo de contacto, producto o servicio afectado, problema y síntomas descritos por el usuario, cuándo ocurre, mensajes de error, pasos que el usuario ya había probado, comprobaciones o pasos indicados por el agente y la respuesta o resultado del usuario en cada uno, solución aplicada o próximos pasos, impacto o urgencia y estado final de la llamada. Atribuye la información a quien la dice cuando sea relevante. No inventes datos ni presentes suposiciones como hechos. Si falta un dato importante, indícalo como pendiente de confirmar. Omite saludos, repeticiones y conversación irrelevante. Devuelve solo el resumen en viñetas, sin introducción.';

const RESTRICTED_URL = /^(chrome|edge|about|chrome-extension):/i;
export const isCapturableUrl = (url) => Boolean(url) && !RESTRICTED_URL.test(url);

/** Configuración efectiva: lo guardado por el usuario o, si está vacío, el valor por defecto. */
export async function getSettings() {
  const saved = await chrome.storage.local.get(['model', 'summaryModel', 'categoryModel', 'language', 'summaryPrompt']);
  const language = LANGUAGES[saved.language] ? saved.language : DEFAULT_LANGUAGE;
  return {
    model: saved.model || DEFAULT_ASR_MODEL,
    summaryModel: saved.summaryModel || '',
    categoryModel: saved.categoryModel || '',
    language,
    asrPrompt: buildAsrPrompt(language),
    summaryPrompt: saved.summaryPrompt?.trim() || DEFAULT_SUMMARY_PROMPT
  };
}

const isAsrModel = (name) => name.toLowerCase().includes('qwen3-asr');
const isDecisionModel = (name) => name.toLowerCase().startsWith('tev1');

/** Qué modelo se prefiere por defecto para cada rol si no hay uno guardado. */
const MODEL_ROLES = {
  model: isAsrModel,
  summaryModel: (name) => !isAsrModel(name) && !isDecisionModel(name),
  categoryModel: isDecisionModel
};

const pickModel = (models, saved, matches) => (models.includes(saved) ? saved : models.find(matches) || models[0]);

function fillSelect(select, models, selected) {
  select.replaceChildren(...models.map((name) => new Option(name, name)));
  select.value = selected;
  return selected;
}

/**
 * Rellena los selectores de modelos (`{ model, summaryModel, categoryModel }` → <select>) con los modelos
 * instalados en Ollama. Devuelve los modelos seleccionados con las mismas claves; lanza un Error legible si no hay modelos.
 */
export async function populateModelSelects(selects, saved) {
  const showPlaceholder = (text) => Object.values(selects).forEach((select) => select.replaceChildren(new Option(text, '')));
  let models;
  try {
    const { models: installed = [] } = await ollama('/api/tags');
    models = installed.map((item) => item.name || item.model).filter(Boolean);
  } catch (error) {
    showPlaceholder('No se pudo leer Ollama');
    throw new Error(`No se pudieron cargar los modelos instalados: ${error.message}`);
  }
  if (!models.length) {
    showPlaceholder('No hay modelos instalados');
    throw new Error('No hay modelos instalados en Ollama.');
  }
  return Object.fromEntries(Object.entries(selects).map(([key, select]) =>
    [key, fillSelect(select, models, pickModel(models, saved[key], MODEL_ROLES[key]))]));
}
