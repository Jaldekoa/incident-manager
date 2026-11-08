import { OLLAMA_URL } from '../config';

export interface ChatResponse {
  message?: { content?: string };
}

export interface TagsResponse {
  models?: Array<{ name?: string; model?: string }>;
}

interface OllamaOptions {
  body?: unknown;
  signal?: AbortSignal;
}

/** GET (sin body) o POST JSON contra Ollama. Lanza un Error legible si la respuesta no es 2xx. */
export async function ollama<T>(path: string, { body, signal }: OllamaOptions = {}): Promise<T> {
  const response = await fetch(`${OLLAMA_URL}${path}`, body === undefined ? { signal } : {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal
  });
  if (!response.ok) throw new Error(`Ollama ${response.status}: ${(await response.text()).slice(0, 180)}`);
  return response.json() as Promise<T>;
}
