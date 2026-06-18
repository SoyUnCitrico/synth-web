/** Número total de secuenciadores independientes. Seq 1 = base (pitch); 2-4 = CV. */
export const SEQ_COUNT = 4;

/** Dirección de reproducción de los pasos. */
export type SeqDirection = 'forward' | 'reverse' | 'pingpong';

/** Capacidad máxima de pasos (longitud de los arrays de datos). */
export const MAX_STEPS = 32;

/**
 * Divisor/multiplicador de reloj por secuenciador. El valor es una subdivisión de
 * Tone.Transport: como el transporte avanza en "ticks" proporcionales al BPM, una
 * subdivisión mayor/menor que la base (`16n`) corre más lento/rápido en relación al
 * reloj del secuenciador 1 (base) y sigue el tempo en vivo.
 */
export interface ClockOption {
  value: string; // subdivisión de Tone (p. ej. '8n')
  label: string; // etiqueta divisor/multiplicador relativa a la base
}
export const BASE_CLOCK = '16n';
export const CLOCK_OPTIONS: ClockOption[] = [
  { value: '4n', label: '÷4' },
  { value: '8n', label: '÷2' },
  { value: '16n', label: '×1' },
  { value: '32n', label: '×2' },
  { value: '64n', label: '×4' },
];

/** Configuración por secuenciador: nº de pasos, dirección y reloj. */
export interface SeqConfig {
  steps: number; // 0..MAX_STEPS (0 = secuenciador en silencio)
  direction: SeqDirection;
  clock: string; // subdivisión de Tone; el seq 1 ignora esto y usa BASE_CLOCK
}

/**
 * Paso del secuenciador 1 (pitch). `offset` en semitonos desde la raíz, `gate` dispara el
 * paso, `velocity` (0..1) escala el pico de la envolvente, `gateLen` (0..1) es la fracción
 * del paso que la compuerta permanece abierta (staccato ↔ ligado).
 */
export interface PitchStep {
  offset: number;
  gate: boolean;
  velocity: number;
  gateLen: number;
}

/** Paso de un secuenciador de CV (2-4): `value` es el CV 0..1; el resto, como PitchStep. */
export interface CvStep {
  value: number;
  gate: boolean;
  velocity: number;
  gateLen: number;
}

/** Paso de un secuenciador de trigger de batería: sólo dispara (gate) con su velocidad. */
export interface DrumStep {
  gate: boolean;
  velocity: number;
}

/** Rango de pitch de un paso (semitonos): C1 → C5. */
export const PITCH_RANGE = 48; // 4 octavas (C1..C5)

/** Nota raíz del secuenciador (offset 0 = C1). `MIDI` se usa para las etiquetas en la UI. */
export const SEQ_ROOT = 'C1';
export const SEQ_ROOT_MIDI = 24; // C1 en la convención de Tone (C4 = 60)

/** Offset por defecto de cada paso (C3 = 24 semitonos sobre C1). */
export const DEFAULT_PITCH_OFFSET = 24;
