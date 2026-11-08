import type { CategoryResult } from '../categorize/categorize';
import type { CategoryTree } from './categories';
import type { Speaker } from './settings';

/** Todo lo que la extensión guarda en `chrome.storage.local` (persistente). */
export interface LocalState {
  transcript: string;
  summary: string;
  category: CategoryResult | null;
  /** Árbol de categorías editado por el usuario; `null`/ausente = árbol por defecto. */
  categories: CategoryTree | null;
  lastSegments: Partial<Record<Speaker, string>>;
  lastSpeaker: Speaker | '';
  model: string;
  summaryModel: string;
  categoryModel: string;
  language: string;
  summaryPrompt: string;
}

/** Estado de la captura en `chrome.storage.session` (se borra al cerrar el navegador). */
export interface SessionState {
  capturing: boolean;
  lastError: string;
}

export type StorageArea = 'local' | 'session';
export type AreaState<A extends StorageArea> = A extends 'local' ? LocalState : SessionState;

export async function getStored<A extends StorageArea, K extends keyof AreaState<A>>(area: A, keys: K[]) {
  const items = await chrome.storage[area].get<Record<string, unknown>>(keys as string[]);
  return items as Partial<Pick<AreaState<A>, K>>;
}

export const setStored = <A extends StorageArea>(area: A, items: Partial<AreaState<A>>) => chrome.storage[area].set(items);

export const getLocal = <K extends keyof LocalState>(keys: K[]) => getStored('local', keys);
export const setLocal = (items: Partial<LocalState>) => setStored('local', items);
export const getSession = <K extends keyof SessionState>(keys: K[]) => getStored('session', keys);
export const setSession = (items: Partial<SessionState>) => setStored('session', items);
