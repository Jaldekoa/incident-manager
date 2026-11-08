/** Servidor de Ollama. Si cambias el puerto, el manifest ajusta `host_permissions` automáticamente. */
export const OLLAMA_URL = 'http://127.0.0.1:11434';

/** Cuánto tiempo mantiene Ollama un modelo cargado en memoria tras usarlo. */
export const KEEP_ALIVE = '30m';

/**
 * Modelos que se usan si el usuario aún no ha elegido ninguno en Configuración.
 * Un nombre sin etiqueta (p. ej. `tev1`) equivale a `:latest`.
 */
export const DEFAULT_ASR_MODEL = 'frozenlab/qwen3-asr:0.6b'; // transcripción (STT)
export const DEFAULT_SUMMARY_MODEL = 'gemma4:12b'; // resumen (LLM)
export const DEFAULT_CATEGORY_MODEL = 'tev1'; // categoría (modelo decisional)

/**
 * Si el modelo por defecto de un rol no está instalado, se preselecciona el primero instalado que encaje
 * con su patrón. Para el resumen, el primero que no encaje con ninguno de los dos.
 */
export const ASR_MODEL_PATTERN = /qwen3-asr/i;
export const DECISION_MODEL_PATTERN = /^tev1/i;
