import * as Tone from 'tone';

/**
 * Escalas musicales para el cuantizador de las fuentes MIDI.
 *
 * Cada escala es un conjunto de SEMITONOS (0..11) relativos a la raíz (tónica). El
 * cuantizador ajusta cada nota entrante a la altura permitida más cercana de la escala
 * elegida. La raíz se elige aparte (ver ROOT_NOTES).
 */

export interface RootNote {
  pc: number; // clase de altura 0..11 (0 = C)
  label: string;
}

export interface Scale {
  id: string;
  label: string;
  intervals: number[]; // semitonos desde la raíz (0..11)
}

// Notas raíz (clases de altura). Se usan sostenidos para nombrar las negras.
export const ROOT_NOTES: RootNote[] = [
  { pc: 0, label: 'C' },
  { pc: 1, label: 'C#' },
  { pc: 2, label: 'D' },
  { pc: 3, label: 'D#' },
  { pc: 4, label: 'E' },
  { pc: 5, label: 'F' },
  { pc: 6, label: 'F#' },
  { pc: 7, label: 'G' },
  { pc: 8, label: 'G#' },
  { pc: 9, label: 'A' },
  { pc: 10, label: 'A#' },
  { pc: 11, label: 'B' },
];

// Catálogo de escalas: mayores/menores, modos griegos y escalas exóticas.
export const SCALES: Scale[] = [
  { id: 'chromatic', label: 'Cromática', intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  { id: 'major', label: 'Mayor (Jónico)', intervals: [0, 2, 4, 5, 7, 9, 11] },
  { id: 'minor', label: 'Menor natural (Eólico)', intervals: [0, 2, 3, 5, 7, 8, 10] },
  { id: 'dorian', label: 'Dórico', intervals: [0, 2, 3, 5, 7, 9, 10] },
  { id: 'phrygian', label: 'Frigio', intervals: [0, 1, 3, 5, 7, 8, 10] },
  { id: 'lydian', label: 'Lidio', intervals: [0, 2, 4, 6, 7, 9, 11] },
  { id: 'mixolydian', label: 'Mixolidio', intervals: [0, 2, 4, 5, 7, 9, 10] },
  { id: 'locrian', label: 'Locrio', intervals: [0, 1, 3, 5, 6, 8, 10] },
  { id: 'harmonicMinor', label: 'Menor armónica', intervals: [0, 2, 3, 5, 7, 8, 11] },
  { id: 'melodicMinor', label: 'Menor melódica', intervals: [0, 2, 3, 5, 7, 9, 11] },
  { id: 'pentaMajor', label: 'Pentatónica mayor', intervals: [0, 2, 4, 7, 9] },
  { id: 'pentaMinor', label: 'Pentatónica menor', intervals: [0, 3, 5, 7, 10] },
  { id: 'blues', label: 'Blues', intervals: [0, 3, 5, 6, 7, 10] },
  { id: 'wholeTone', label: 'Tonos enteros', intervals: [0, 2, 4, 6, 8, 10] },
  // Exóticas
  { id: 'hungarianMinor', label: 'Húngara menor', intervals: [0, 2, 3, 6, 7, 8, 11] },
  { id: 'phrygianDominant', label: 'Frigia dominante', intervals: [0, 1, 4, 5, 7, 8, 10] },
  { id: 'doubleHarmonic', label: 'Doble armónica (árabe)', intervals: [0, 1, 4, 5, 7, 8, 11] },
  { id: 'hirajoshi', label: 'Hirajoshi (japonesa)', intervals: [0, 2, 3, 7, 8] },
];

const SCALE_BY_ID = new Map(SCALES.map((s) => [s.id, s]));

/** Devuelve los intervalos de una escala por id (mayor por defecto si no existe). */
export function scaleIntervals(id: string): number[] {
  return (SCALE_BY_ID.get(id) ?? SCALES[1]).intervals;
}

/**
 * Ajusta un número MIDI a la altura permitida más cercana de la escala (intervalos
 * relativos a `rootPc`). En caso de empate redondea hacia arriba. La escala se replica en
 * todas las octavas. Si `intervals` está vacío, devuelve el MIDI sin cambios.
 */
export function quantizeMidi(midi: number, rootPc: number, intervals: number[]): number {
  if (intervals.length === 0) return midi;
  // Conjunto de alturas permitidas (0..11) relativas a do, ya rotadas a la raíz.
  const allowed = intervals.map((i) => (((i + rootPc) % 12) + 12) % 12);
  const pc = ((midi % 12) + 12) % 12;
  let best = midi;
  let bestDist = Infinity;
  // Probar el grado en la octava de abajo, la actual y la de arriba para hallar el más cercano.
  for (const a of allowed) {
    for (const octave of [-12, 0, 12]) {
      const candidate = midi - pc + a + octave;
      const dist = Math.abs(candidate - midi);
      // Empate (dist igual) → preferir el más agudo (candidate mayor).
      if (dist < bestDist || (dist === bestDist && candidate > best)) {
        best = candidate;
        bestDist = dist;
      }
    }
  }
  return best;
}

/**
 * Cuantiza una nota (nombre, p. ej. "C#4") a la escala y devuelve el nuevo nombre de nota.
 */
export function quantizeNote(note: string, rootPc: number, intervals: number[]): string {
  const midi = Tone.Frequency(note).toMidi();
  const q = quantizeMidi(midi, rootPc, intervals);
  return Tone.Frequency(q, 'midi').toNote();
}
