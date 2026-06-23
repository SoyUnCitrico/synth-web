/**
 * Matriz MIDI (notas): enruta fuentes de NOTA (pitch) a los osciladores y al seguimiento de
 * cutoff de los filtros.
 *
 * A diferencia de la matriz CV (señales continuas → AudioParams) y la de gates (eventos de
 * disparo → envolventes), aquí las fuentes emiten una NOTA (frecuencia) y los destinos la
 * consumen:
 *   - osc1/osc2/osc3 → fijan la frecuencia de ese VCO (parafónico: cada VCO sigue la fuente
 *                      ruteada; última nota gana por VCO).
 *   - filter1/vcf2/noiseFilter → seguimiento de teclado: la nota desplaza el cutoff RELATIVO
 *                      a la perilla (vía detune en cents, C4 = neutral).
 */

export type NoteSourceId = 'keyboard' | 'midi' | 'seq1' | 'seq2';
export type NoteDestId = 'osc1' | 'osc2' | 'osc3' | 'osc4' | 'filter1' | 'vcf2' | 'noiseFilter' | 'quant';

export interface NoteSourceCfg {
  id: NoteSourceId;
  label: string;
  /** Etiqueta abreviada para móvil (la matriz cabe en una sola columna). */
  short?: string;
}

export interface NoteDestCfg {
  id: NoteDestId;
  label: string;
  /** Etiqueta abreviada para móvil (la matriz cabe en una sola columna). */
  short?: string;
}

export const NOTE_SOURCES: NoteSourceCfg[] = [
  { id: 'keyboard', label: 'Teclado', short: 'Tcl' },
  { id: 'midi', label: 'MIDI', short: 'MIDI' },
  { id: 'seq1', label: 'Seq 1', short: 'S1' },
  { id: 'seq2', label: 'Seq 2', short: 'S2' },
];

export const NOTE_DESTS: NoteDestCfg[] = [
  { id: 'osc1', label: 'VCO 1', short: 'V1' },
  { id: 'osc2', label: 'VCO 2', short: 'V2' },
  { id: 'osc3', label: 'VCO 3', short: 'V3' },
  { id: 'osc4', label: 'VCO 4', short: 'V4' },
  { id: 'filter1', label: 'Cut 1', short: 'C1' },
  { id: 'vcf2', label: 'Cut 2', short: 'C2' },
  { id: 'noiseFilter', label: 'Cut-BP', short: 'BP' },
  // 'quant' no es un destino de pitch: marca que la fuente pasa por el cuantizador de escala
  // (se aplica en routeNote antes de rutear a los VCO/filtros).
  { id: 'quant', label: 'Cuant', short: 'Q' },
];

/** Estado de la matriz MIDI: qué intersecciones (fuente→destino) están conectadas. */
export type NotePatch = Partial<Record<string, boolean>>;

export const noteKey = (src: NoteSourceId, dst: NoteDestId): string => `${src}>${dst}`;

export interface NoteConnection {
  source: NoteSourceId;
  dest: NoteDestId;
}

export const createNotePatch = (connections: NoteConnection[]): NotePatch => {
  const patch: NotePatch = {};
  for (const { source, dest } of connections) {
    patch[noteKey(source, dest)] = true;
  }
  return patch;
};
