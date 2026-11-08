// ---- Transcripción (STT) ----

/** Etiqueta que delimita el texto transcrito en la respuesta de Qwen3-ASR. */
export const ASR_TEXT_TAG = '<asr_text>';

/** Prompt que acompaña a cada fragmento de audio; `language` es una clave de `LANGUAGES`. */
export const asrPrompt = (language: string) => `language ${language}${ASR_TEXT_TAG}`;

// ---- Resumen ----

/** Instrucción de sistema por defecto del resumen (el usuario puede cambiarla en la configuración). */
export const DEFAULT_SUMMARY_PROMPT = 'Eres asistente de un servicio técnico de call center. Recibirás la transcripción automática de una llamada en la que cada intervención va etiquetada: [AGENTE] es el técnico que atiende y [USUARIO] es el cliente que reporta la incidencia. La transcripción puede contener errores, cortes o frases incompletas. Reconstruye la conversación y redacta en español un resumen breve, claro y útil para abrir o documentar la incidencia. Incluye, cuando aparezcan: motivo de contacto, producto o servicio afectado, problema y síntomas descritos por el usuario, cuándo ocurre, mensajes de error, pasos que el usuario ya había probado, comprobaciones o pasos indicados por el agente y la respuesta o resultado del usuario en cada uno, solución aplicada o próximos pasos, impacto o urgencia y estado final de la llamada. Atribuye la información a quien la dice cuando sea relevante. No inventes datos ni presentes suposiciones como hechos. Si falta un dato importante, indícalo como pendiente de confirmar. Omite saludos, repeticiones y conversación irrelevante. Devuelve solo el resumen en viñetas, sin introducción.';

/** Mensaje de usuario que lleva la transcripción al modelo de resumen. */
export const summaryUserPrompt = (transcript: string) => `Resume esta transcripción de una llamada de soporte técnico:\n\n${transcript}`;

// ---- Categorización (modelo decisional) ----

/** Pregunta para elegir entre las categorías de primer nivel. */
export const CATEGORY_ROOT_QUESTION = '¿A qué área pertenece la incidencia descrita en este resumen de una llamada de soporte?';

/** Pregunta para elegir entre las subcategorías de `path` (redactada como probabilidad condicionada). */
export const categorySubQuestion = (path: readonly string[]) =>
  `Suponiendo que la incidencia descrita en este resumen de una llamada de soporte pertenece a "${path.join(' › ')}", ¿qué subcategoría la describe mejor?`;

/** Opción extra que se añade cuando un nivel tiene demasiadas opciones y se divide en bloques. */
export const CATEGORY_NONE_OPTION = {
  name: 'ninguna_de_las_anteriores',
  description: 'Ninguna de las demás opciones describe la incidencia.'
};
