/** Modo del secuenciador: 1 canal de 32 pasos, o 2 canales (pitch + CV) de 16 pasos. */
export type SeqMode = 'single32' | 'dual16';

/** Paso del canal de pitch: semitonos desde la nota raíz + compuerta (silencio si off). */
export interface PitchStep {
  offset: number; // semitonos desde la raíz
  gate: boolean;
}

/** Paso del canal de CV (canal B, sólo en dual16): valor 0..1 enviado a la matriz. */
export interface CvStep {
  value: number; // 0..1
}

/** Nº de pasos según el modo. */
export const stepCount = (mode: SeqMode): number => (mode === 'single32' ? 32 : 16);

/** Rango de pitch de un paso (semitonos). */
export const PITCH_RANGE = 24; // 2 octavas

/** Nota raíz del secuenciador (offset 0). `MIDI` se usa para las etiquetas en la UI. */
export const SEQ_ROOT = 'C2';
export const SEQ_ROOT_MIDI = 36; // C2 en la convención de Tone (C4 = 60)
