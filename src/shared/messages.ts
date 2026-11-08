import type { Speaker } from './settings';

/** Mensajes que atiende el service worker. */
export type BackgroundRequest =
  | { target: 'background'; type: 'START_CAPTURE'; tabId?: number }
  | { target: 'background'; type: 'STOP_CAPTURE' }
  | { target: 'background'; type: 'GET_SETTINGS' }
  | { target: 'background'; type: 'APPEND_TRANSCRIPT'; speaker: Speaker; text: string }
  | { target: 'background'; type: 'CAPTURE_STATE'; capturing: boolean; error?: string }
  | { target: 'background'; type: 'PRELOAD_MODEL'; model: string };

/** Mensajes que atiende el documento offscreen. */
export type OffscreenRequest =
  | { target: 'offscreen'; type: 'PING' }
  | { target: 'offscreen'; type: 'START_CAPTURE'; streamId: string }
  | { target: 'offscreen'; type: 'STOP_CAPTURE' }
  | { target: 'offscreen'; type: 'PRELOAD_MODEL'; model: string };

/** Avisos sin destinatario concreto (los escucha el popup si está abierto). */
export type Broadcast = { type: 'PRELOAD_DONE' } | { type: 'PRELOAD_FAILED'; error: string };

export interface AsrSettings {
  model: string;
  asrPrompt: string;
}

export type Ok = { ok: true };
export type Failure = { ok: false; error: string };

export type BackgroundResponse<T extends BackgroundRequest['type']> = (T extends 'GET_SETTINGS' ? AsrSettings : Ok) | Failure;
export type OffscreenResponse = Ok | Failure;

type WithoutTarget<M> = M extends unknown ? Omit<M, 'target'> : never;

// `sendMessage` resuelve `undefined` si nadie responde, de ahí el `| undefined`.
export const sendToBackground = <M extends WithoutTarget<BackgroundRequest>>(message: M) =>
  chrome.runtime.sendMessage({ target: 'background', ...message }) as Promise<BackgroundResponse<M['type']> | undefined>;

export const sendToOffscreen = <M extends WithoutTarget<OffscreenRequest>>(message: M) =>
  chrome.runtime.sendMessage({ target: 'offscreen', ...message }) as Promise<OffscreenResponse | undefined>;

export const broadcast = (message: Broadcast) => chrome.runtime.sendMessage(message) as Promise<unknown>;
