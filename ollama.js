export const OLLAMA_URL = 'http://127.0.0.1:11434';
export const DEFAULT_ASR_MODEL = 'frozenlab/qwen3-asr:0.6b';
export const KEEP_ALIVE = '30m';

/** GET (sin body) o POST JSON contra Ollama. Lanza un Error legible si la respuesta no es 2xx. */
export async function ollama(path, { body, signal } = {}) {
  const response = await fetch(`${OLLAMA_URL}${path}`, body === undefined ? { signal } : {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal
  });
  if (!response.ok) throw new Error(`Ollama ${response.status}: ${(await response.text()).slice(0, 180)}`);
  return response.json();
}
