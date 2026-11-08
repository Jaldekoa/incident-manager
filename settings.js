import { ollama, DEFAULT_ASR_MODEL } from './ollama.js';

export const SPEAKERS = { agent: 'AGENTE', user: 'USUARIO' };

export const DEFAULT_ASR_PROMPT = 'language Spanish<asr_text>';

export const DEFAULT_SUMMARY_PROMPT = 'Eres asistente de un servicio técnico de call center. Recibirás la transcripción automática de una llamada en la que cada intervención va etiquetada: [AGENTE] es el técnico que atiende y [USUARIO] es el cliente que reporta la incidencia. La transcripción puede contener errores, cortes o frases incompletas. Reconstruye la conversación y redacta en español un resumen breve, claro y útil para abrir o documentar la incidencia. Incluye, cuando aparezcan: motivo de contacto, producto o servicio afectado, problema y síntomas descritos por el usuario, cuándo ocurre, mensajes de error, pasos que el usuario ya había probado, comprobaciones o pasos indicados por el agente y la respuesta o resultado del usuario en cada uno, solución aplicada o próximos pasos, impacto o urgencia y estado final de la llamada. Atribuye la información a quien la dice cuando sea relevante. No inventes datos ni presentes suposiciones como hechos. Si falta un dato importante, indícalo como pendiente de confirmar. Omite saludos, repeticiones y conversación irrelevante. Devuelve solo el resumen en viñetas, sin introducción.';

/** Configuración efectiva: lo guardado por el usuario o, si está vacío, el valor por defecto. */
export async function getSettings() {
  const saved = await chrome.storage.local.get(['model', 'summaryModel', 'asrPrompt', 'summaryPrompt']);
  return {
    model: saved.model || DEFAULT_ASR_MODEL,
    summaryModel: saved.summaryModel || '',
    asrPrompt: saved.asrPrompt?.trim() || DEFAULT_ASR_PROMPT,
    summaryPrompt: saved.summaryPrompt?.trim() || DEFAULT_SUMMARY_PROMPT
  };
}

const isAsrModel = (name) => name.toLowerCase().includes('qwen3-asr');
const pickModel = (models, saved, matches) => (models.includes(saved) ? saved : models.find(matches) || models[0]);

function fillSelect(select, models, selected) {
  select.replaceChildren(...models.map((name) => new Option(name, name)));
  select.value = selected;
  return selected;
}

/**
 * Rellena los selectores STT y LLM con los modelos instalados en Ollama.
 * Devuelve `{ model, summaryModel }` seleccionados; lanza un Error legible si no hay modelos.
 */
export async function populateModelSelects(asrSelect, summarySelect, saved) {
  const showPlaceholder = (text) => [asrSelect, summarySelect].forEach((select) => select.replaceChildren(new Option(text, '')));
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
  return {
    model: fillSelect(asrSelect, models, pickModel(models, saved.model, isAsrModel)),
    summaryModel: fillSelect(summarySelect, models, pickModel(models, saved.summaryModel, (name) => !isAsrModel(name)))
  };
}
