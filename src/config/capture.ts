/** Etiquetas de cada hablante en la transcripción. El prompt de resumen las menciona: si las cambias, revísalo. */
export const SPEAKERS = {
  /** Micrófono del equipo. */
  agent: 'AGENTE',
  /** Audio de la pestaña de la llamada. */
  user: 'USUARIO'
} as const;

/** Frecuencia a la que se remuestrea el audio antes de enviarlo al modelo STT. */
export const ASR_SAMPLE_RATE = 16000;

/** Duración de cada fragmento de audio que se transcribe y cada cuánto se envía uno (la diferencia es el solape). */
export const WINDOW_SECONDS = 4;
export const STRIDE_SECONDS = 3;

/** Volumen medio (RMS, 0–1) por debajo del cual un fragmento se considera silencio y no se transcribe. */
export const SILENCE_RMS = 0.005;

/** Procesado del micrófono del agente. */
export const MIC_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true
};
