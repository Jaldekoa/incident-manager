import { ollama, DEFAULT_ASR_MODEL, type TagsResponse } from './ollama';
import { errorMessage } from './errors';
import { getLocal } from './storage';

export const SPEAKERS = { agent: 'AGENTE', user: 'USUARIO' } as const;
export type Speaker = (typeof SPEAKERS)[keyof typeof SPEAKERS];
export const isSpeaker = (value: unknown): value is Speaker => Object.values(SPEAKERS).includes(value as Speaker);

/** Idiomas de transcripción: valor que entiende Qwen3-ASR → etiqueta visible. */
export const LANGUAGES = { Spanish: 'Español', English: 'Inglés' } as const;
export type Language = keyof typeof LANGUAGES;
export const DEFAULT_LANGUAGE: Language = 'Spanish';
export const isLanguage = (value: unknown): value is Language => typeof value === 'string' && value in LANGUAGES;
export const buildAsrPrompt = (language: Language): string => `language ${language}<asr_text>`;
export const DEFAULT_ASR_PROMPT = buildAsrPrompt(DEFAULT_LANGUAGE);

export const DEFAULT_SUMMARY_PROMPT = 'Eres asistente de un servicio técnico de call center. Recibirás la transcripción automática de una llamada en la que cada intervención va etiquetada: [AGENTE] es el técnico que atiende y [USUARIO] es el cliente que reporta la incidencia. La transcripción puede contener errores, cortes o frases incompletas. Reconstruye la conversación y redacta en español un resumen breve, claro y útil para abrir o documentar la incidencia. Incluye, cuando aparezcan: motivo de contacto, producto o servicio afectado, problema y síntomas descritos por el usuario, cuándo ocurre, mensajes de error, pasos que el usuario ya había probado, comprobaciones o pasos indicados por el agente y la respuesta o resultado del usuario en cada uno, solución aplicada o próximos pasos, impacto o urgencia y estado final de la llamada. Atribuye la información a quien la dice cuando sea relevante. No inventes datos ni presentes suposiciones como hechos. Si falta un dato importante, indícalo como pendiente de confirmar. Omite saludos, repeticiones y conversación irrelevante. Devuelve solo el resumen en viñetas, sin introducción.';

const RESTRICTED_URL = /^(chrome|edge|about|chrome-extension):/i;
export const isCapturableUrl = (url: string | undefined): boolean => Boolean(url) && !RESTRICTED_URL.test(url!);

// ---- Modelos ----

export type ModelRole = 'model' | 'summaryModel' | 'categoryModel';
export type ModelChoice = Record<ModelRole, string>;

const isAsrModel = (name: string) => name.toLowerCase().includes('qwen3-asr');
const isDecisionModel = (name: string) => name.toLowerCase().startsWith('tev1');

/** Qué modelo se prefiere por defecto para cada rol si no hay uno guardado. */
const MODEL_ROLES: Record<ModelRole, (name: string) => boolean> = {
  model: isAsrModel,
  summaryModel: (name) => !isAsrModel(name) && !isDecisionModel(name),
  categoryModel: isDecisionModel
};

/** Para cada rol: el modelo guardado si está instalado; si no, el primero que encaje con el rol o el primero de la lista. */
export function pickModels(models: string[], saved: Partial<ModelChoice>): ModelChoice {
  const pick = (role: ModelRole) => {
    const current = saved[role];
    return current && models.includes(current) ? current : models.find(MODEL_ROLES[role]) ?? models[0] ?? '';
  };
  return { model: pick('model'), summaryModel: pick('summaryModel'), categoryModel: pick('categoryModel') };
}

/** Nombres de los modelos instalados en Ollama. Lanza un Error legible si Ollama no responde. */
export async function listInstalledModels(): Promise<string[]> {
  try {
    const { models = [] } = await ollama<TagsResponse>('/api/tags');
    return models.map((item) => item.name || item.model || '').filter(Boolean);
  } catch (error) {
    throw new Error(`No se pudieron cargar los modelos instalados: ${errorMessage(error)}`);
  }
}

// ---- Configuración efectiva ----

export interface Settings extends ModelChoice {
  language: Language;
  asrPrompt: string;
  summaryPrompt: string;
}

/** Configuración efectiva: lo guardado por el usuario o, si está vacío, el valor por defecto. */
export async function getSettings(): Promise<Settings> {
  const saved = await getLocal(['model', 'summaryModel', 'categoryModel', 'language', 'summaryPrompt']);
  const language = isLanguage(saved.language) ? saved.language : DEFAULT_LANGUAGE;
  return {
    model: saved.model || DEFAULT_ASR_MODEL,
    summaryModel: saved.summaryModel || '',
    categoryModel: saved.categoryModel || '',
    language,
    asrPrompt: buildAsrPrompt(language),
    summaryPrompt: saved.summaryPrompt?.trim() || DEFAULT_SUMMARY_PROMPT
  };
}
