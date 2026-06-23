/**
 * Tipos y constantes del secuenciador de MAKWIL (forkeado del secuenciador compartido).
 *
 * Diferencias con el secuenciador de Modulor (audio/sequencer/types.ts):
 *   - 5 secuenciadores (antes 4): seq1 = pitch base; seq2 y seq3 = Nota + CV; seq4/seq5 = CV.
 *   - Raíz en C0 y control de OCTAVA por secuenciador de pitch (botones +/−): el slider de
 *     nota recorre C0..C4 (offset 0..48) y el offset de octava lo desplaza hasta C8.
 *
 * Reutiliza la clase de transporte genérica `audio/sequencer/Sequencer.ts` (no se forkea).
 */

/** Número total de secuenciadores independientes (seq1..seq5). */
export const SEQ_COUNT = 5;

/** Dirección de reproducción de los pasos. */
export type SeqDirection = 'forward' | 'reverse' | 'pingpong';

/** Capacidad máxima de pasos (longitud de los arrays de datos). */
export const MAX_STEPS = 32;

/** Divisor/multiplicador de reloj por secuenciador (subdivisión de Tone.Transport). */
export interface ClockOption {
  value: string;
  label: string;
}
export const BASE_CLOCK = '16n';
export const CLOCK_OPTIONS: ClockOption[] = [
  { value: '4n', label: '÷4' },
  { value: '8n', label: '÷2' },
  { value: '16n', label: '×1' },
  { value: '32n', label: '×2' },
  { value: '64n', label: '×4' },
];

/**
 * Configuración por secuenciador: nº de pasos, dirección, reloj y desplazamiento de octava.
 * `octave` sólo lo usan los secuenciadores de pitch (1,2,3): suma `octave*12` semitonos al
 * offset de cada paso. 0..MAX_OCTAVE.
 */
export interface SeqConfig {
  steps: number; // 0..MAX_STEPS (0 = secuenciador en silencio)
  direction: SeqDirection;
  clock: string; // subdivisión de Tone; el seq 1 ignora esto y usa BASE_CLOCK
  octave: number; // 0..MAX_OCTAVE (desplazamiento de octava de los pasos de pitch)
}

/** Paso del secuenciador de pitch (seq1). */
export interface PitchStep {
  offset: number; // semitonos desde la raíz (slider C0..C4 = 0..48)
  gate: boolean;
  velocity: number; // 0..1 (escala el pico de la envolvente)
  gateLen: number; // 0..1 (fracción del paso con la compuerta abierta)
}

/**
 * Paso de un secuenciador de CV (seq2..seq5). `value` es el CV 0..1; el resto como PitchStep.
 * `offset` (semitonos) lo usan los seq2 y seq3, que además de CV emiten una NOTA por la matriz
 * MIDI ("Seq 2/3 MIDI"); los seq4/seq5 lo ignoran. Puede faltar en datos antiguos: leer con
 * `?? DEFAULT_PITCH_OFFSET`.
 */
export interface CvStep {
  value: number;
  offset: number;
  gate: boolean;
  velocity: number;
  gateLen: number;
}

/** Rango de pitch del slider de un paso (semitonos): C0 → C4 (4 octavas). */
export const PITCH_RANGE = 48;

/** Desplazamiento máximo de octava (los botones +/−): C4 + 4 octavas = C8. */
export const MAX_OCTAVE = 4;

/** Nota raíz del secuenciador (offset 0 = C0). */
export const SEQ_ROOT = 'C0';
export const SEQ_ROOT_MIDI = 12; // C0 en la convención de Tone (C4 = 60)

/** Offset por defecto de cada paso (C2 = 24 semitonos sobre C0). */
export const DEFAULT_PITCH_OFFSET = 24;
