/** Nº de canales del secuenciador (lo elige el dropdown). */
export type SeqChannels = 1 | 2 | 3;

/** Dirección de reproducción de los pasos. */
export type SeqDirection = 'forward' | 'reverse' | 'pingpong';

/** Capacidad máxima de pasos (longitud de los arrays). */
export const MAX_STEPS = 32;

/** Opciones del selector de número de pasos. */
export const STEP_OPTIONS = [4, 8, 16, 32];

/**
 * Paso del canal 1 (pitch). `offset` en semitonos desde la raíz, `gate` dispara el paso,
 * `velocity` (0..1) escala el pico de la envolvente, `gateLen` (0..1) es la fracción del
 * paso que la compuerta permanece abierta (staccato ↔ ligado).
 */
export interface PitchStep {
  offset: number;
  gate: boolean;
  velocity: number;
  gateLen: number;
}

/** Paso del canal 2: `value` es el CV 0..1 (matriz de CV); el resto, como PitchStep. */
export interface CvStep {
  value: number;
  gate: boolean;
  velocity: number;
  gateLen: number;
}

/** Rango de pitch de un paso (semitonos). */
export const PITCH_RANGE = 24; // 2 octavas

/** Nota raíz del secuenciador (offset 0). `MIDI` se usa para las etiquetas en la UI. */
export const SEQ_ROOT = 'C2';
export const SEQ_ROOT_MIDI = 36; // C2 en la convención de Tone (C4 = 60)
