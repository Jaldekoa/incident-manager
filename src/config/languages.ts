/**
 * Idiomas de transcripción que aparecen en la configuración.
 * Clave: nombre del idioma que entiende el modelo STT (va en el prompt). Valor: etiqueta visible.
 */
export const LANGUAGES = {
  Spanish: 'Español',
  English: 'Inglés'
} as const;

export const DEFAULT_LANGUAGE: keyof typeof LANGUAGES = 'Spanish';
