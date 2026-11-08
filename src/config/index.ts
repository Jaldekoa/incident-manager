/**
 * Configuración por defecto de Incident Manager: todo lo que un desarrollador puede querer ajustar está aquí.
 *
 *   app.ts         Nombre, descripción e icono de la extensión.
 *   models.ts      Servidor de Ollama, modelo STT por defecto y cómo reconocer cada tipo de modelo.
 *   languages.ts   Idiomas de transcripción disponibles y el idioma por defecto.
 *   prompts.ts     Prompts de transcripción, resumen y categorización.
 *   categories.ts  Árbol de categorías inicial.
 *   capture.ts     Etiquetas de hablante y parámetros de captura de audio.
 *
 * Lo que el usuario cambie desde la configuración de la extensión (modelos, idioma, prompt de resumen,
 * categorías) se guarda en `chrome.storage` y tiene prioridad sobre estos valores.
 */
export * from './app';
export * from './models';
export * from './languages';
export * from './prompts';
export * from './categories';
export * from './capture';
