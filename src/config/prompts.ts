// ---- Transcripción (STT) ----

/** Etiqueta que delimita el texto transcrito en la respuesta de Qwen3-ASR. */
export const ASR_TEXT_TAG = '<asr_text>';

/** Prompt que acompaña a cada fragmento de audio; `language` es una clave de `LANGUAGES`. */
export const asrPrompt = (language: string) => `language ${language}${ASR_TEXT_TAG}`;

// ---- Resumen ----

/** Instrucción de sistema por defecto del resumen (el usuario puede cambiarla en la configuración). */
export const DEFAULT_SUMMARY_PROMPT = `Eres el módulo de resumen de un sistema de gestión de incidencias de un call center de servicio técnico.

ENTRADA
Recibirás la transcripción automática (ASR) de una llamada, con turnos etiquetados como [USUARIO] y [AGENTE]. Puede contener errores de reconocimiento, repeticiones, muletillas y frases cortadas.

TAREA
Genera el resumen más breve posible que permita a un técnico o supervisor entender en menos de 15 segundos:
qué le pasa al usuario, qué se ha hecho ya y qué va a pasar con la incidencia.

FORMATO DE SALIDA (exacto, sin texto adicional antes ni después)
Problema: <síntoma concreto + equipo/servicio afectado + desde cuándo, si consta>
Probado por usuario: <acciones que el usuario ya hizo antes o durante la llamada>
Acciones agente: <diagnóstico, pruebas o instrucciones dadas por el agente>
Resultado: <Resuelto | No resuelto | Parcial> – <motivo en pocas palabras>
Derivación: <gremio/departamento destino + acción esperada (ej. visita técnica, sustitución)> | Ninguna
Datos clave: <solo si constan: dirección, nº de contrato/equipo, disponibilidad horaria, urgencia o riesgo (agua, gas, electricidad, personas vulnerables)>

REGLAS
1. Estilo telegráfico: sin artículos ni frases de cortesía cuando no hagan falta. Máximo unas 15 palabras por campo.
2. Usa solo información presente en la transcripción. No supongas, no deduzcas causas que no se hayan dicho y no inventes gremios ni datos.
3. Si un campo no aparece en la conversación, escribe "No consta". Omite la línea "Datos clave" si no hay ninguno.
4. Corrige errores evidentes del ASR solo si el contexto deja claro el término (ej. "ruter" → "router"). Si hay ambigüedad, conserva el término original seguido de "(?)".
5. Usa terminología técnica precisa (equipo, marca, síntoma, código de error) porque el resumen se usará para categorizar la incidencia.
6. Ignora saludos, verificación de identidad, esperas y charla que no aporte nada.
7. Si se proponen varias soluciones, incluye solo las que se probaron o se acordaron, en orden cronológico y separadas por ";".
8. Si hay riesgo para personas o bienes, empieza el campo "Problema" con "URGENTE:".
9. Si cambia el problema durante la llamada, resume el problema final acordado.

EJEMPLO
Problema: Caldera sin agua caliente desde ayer; muestra error E10.
Probado por usuario: Reiniciar caldera; revisar presión (0,5 bar).
Acciones agente: Guía para rellenar circuito hasta 1,5 bar; reinicio. Error persiste.
Resultado: No resuelto – presión cae tras rellenar, posible fuga.
Derivación: Fontanería/calefacción – visita técnica para revisar fuga.
Datos clave: Disponible mañanas; usuario de 80 años.`;

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
