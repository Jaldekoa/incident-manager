/** Servidor de Ollama. Si cambias el puerto, el manifest ajusta `host_permissions` automáticamente. */
export const OLLAMA_URL = 'http://127.0.0.1:11434';

/** Cuánto tiempo mantiene Ollama un modelo cargado en memoria tras usarlo. */
export const KEEP_ALIVE = '30m';

/** Modelo de transcripción (STT) que se usa si el usuario aún no ha elegido ninguno. */
export const DEFAULT_ASR_MODEL = 'frozenlab/qwen3-asr:0.6b';

/**
 * Cómo reconocer cada tipo de modelo entre los instalados en Ollama, para preseleccionar uno por rol
 * cuando no hay ninguno guardado. El modelo de resumen es el primero que no encaja con ninguno de los dos.
 */
export const ASR_MODEL_PATTERN = /qwen3-asr/i;
export const DECISION_MODEL_PATTERN = /^tev1/i;
