import {
  ASR_MODEL_PATTERN, DECISION_MODEL_PATTERN, DEFAULT_ASR_MODEL, DEFAULT_CATEGORY_MODEL, DEFAULT_LANGUAGE,
  DEFAULT_SUMMARY_MODEL, DEFAULT_SUMMARY_PROMPT,
  LANGUAGES, SPEAKERS, asrPrompt
} from '../config';
import { ollama, type TagsResponse } from './ollama';
import { errorMessage } from './errors';
import { getLocal } from './storage';

export type Speaker = (typeof SPEAKERS)[keyof typeof SPEAKERS];
export const isSpeaker = (value: unknown): value is Speaker => Object.values(SPEAKERS).includes(value as Speaker);

export type Language = keyof typeof LANGUAGES;
export const isLanguage = (value: unknown): value is Language => typeof value === 'string' && value in LANGUAGES;

const RESTRICTED_URL = /^(chrome|edge|about|chrome-extension):/i;
export const isCapturableUrl = (url: string | undefined): boolean => Boolean(url) && !RESTRICTED_URL.test(url!);

// ---- Modelos ----

export type ModelRole = 'model' | 'summaryModel' | 'categoryModel';
export type ModelChoice = Record<ModelRole, string>;

const isAsrModel = (name: string) => ASR_MODEL_PATTERN.test(name);
const isDecisionModel = (name: string) => DECISION_MODEL_PATTERN.test(name);

/** Modelo por defecto de cada rol (ver `src/config/models.ts`). */
export const DEFAULT_MODELS: ModelChoice = {
  model: DEFAULT_ASR_MODEL,
  summaryModel: DEFAULT_SUMMARY_MODEL,
  categoryModel: DEFAULT_CATEGORY_MODEL
};

/** Si el modelo por defecto no está instalado, cómo reconocer otro adecuado para cada rol. */
const MODEL_ROLES: Record<ModelRole, (name: string) => boolean> = {
  model: isAsrModel,
  summaryModel: (name) => !isAsrModel(name) && !isDecisionModel(name),
  categoryModel: isDecisionModel
};

/** Nombre instalado de `name`, aceptando que `modelo` y `modelo:latest` son el mismo. */
const findInstalled = (models: string[], name: string | undefined) =>
  name ? models.find((model) => model === name || model === `${name}:latest`) : undefined;

/**
 * Para cada rol, el primero que esté instalado de: el modelo guardado, el modelo por defecto,
 * uno que encaje con el rol o el primero de la lista.
 */
export function pickModels(models: string[], saved: Partial<ModelChoice>): ModelChoice {
  const pick = (role: ModelRole) =>
    findInstalled(models, saved[role]) ?? findInstalled(models, DEFAULT_MODELS[role]) ?? models.find(MODEL_ROLES[role]) ?? models[0] ?? '';
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

/** Configuración efectiva: lo guardado por el usuario o, si está vacío, el valor por defecto de `src/config`. */
export async function getSettings(): Promise<Settings> {
  const saved = await getLocal(['model', 'summaryModel', 'categoryModel', 'language', 'summaryPrompt']);
  const language = isLanguage(saved.language) ? saved.language : DEFAULT_LANGUAGE;
  return {
    model: saved.model || DEFAULT_MODELS.model,
    summaryModel: saved.summaryModel || DEFAULT_MODELS.summaryModel,
    categoryModel: saved.categoryModel || DEFAULT_MODELS.categoryModel,
    language,
    asrPrompt: asrPrompt(language),
    summaryPrompt: saved.summaryPrompt?.trim() || DEFAULT_SUMMARY_PROMPT
  };
}
