import type { ModSourceId, ModDestId } from './types';

/**
 * Configuración de la matriz de patcheo (estilo EMS VCS3).
 *
 * `MOD_SOURCES` son las filas y `MOD_DESTS` las columnas de la matriz. Para añadir o
 * quitar puntos de conexión basta editar estos arrays (y registrar la fuente/destino
 * correspondiente en useSynthEngine). La intersección fila×columna es un checkbox que,
 * al activarse, conecta la fuente con el destino con la profundidad de esa fuente.
 */

export interface PatchSource {
  id: ModSourceId;
  label: string;
  /** Etiqueta abreviada para móvil (la matriz cabe en una sola columna). */
  short?: string;
}

export interface PatchDest {
  id: ModDestId;
  label: string;
  /** Etiqueta abreviada para móvil (la matriz cabe en una sola columna). */
  short?: string;
}

// Número de slots de perillas/CC MIDI disponibles como fuentes de la matriz. Sobra para el
// controlador actual (4 perillas) y deja margen para mapear más perillas/botones de otro.
export const MIDI_CC_SLOTS = 8;

// Slots CC MIDI como fuentes de la matriz. El número de CC real de cada slot se asigna en
// runtime (ver midiMap en BasicSynth); en la UI sólo se muestran los slots ya mapeados.
export const MIDI_CC_SOURCES: PatchSource[] = Array.from(
  { length: MIDI_CC_SLOTS },
  (_, i) => ({ id: `midiCC${i + 1}` as ModSourceId, label: `CC ${i + 1}`, short: `${i + 1}` }),
);

// Orden de las filas: primero las envolventes (ADSR, DAHD, AD 1, AD 2) y después el resto
// (LFOs, CV/Vel de los secuenciadores y los slots CC MIDI).
export const MOD_SOURCES: PatchSource[] = [
  { id: 'adsr', label: 'ADSR', short: 'ADSR' },
  { id: 'dahd', label: 'DAHD', short: 'DAHD' },
  { id: 'ad1', label: 'AD 1', short: 'AD1' },
  { id: 'ad2', label: 'AD 2', short: 'AD2' },
  { id: 'lfo1', label: 'LFO 1', short: 'LF1' },
  { id: 'lfo2', label: 'LFO 2', short: 'LF2' },
  { id: 'seqCv', label: 'Seq2 CV', short: 'S2' },
  { id: 'seqCv2', label: 'Seq3 CV', short: 'S3' },
  { id: 'seqCv3', label: 'Seq4 CV', short: 'S4' },
  ...MIDI_CC_SOURCES,
];

export const MOD_DESTS: PatchDest[] = [
  { id: 'osc1Detune', label: 'VCO 1', short: 'V1' },
  { id: 'osc2Detune', label: 'VCO 2', short: 'V2' },
  { id: 'osc3Detune', label: 'VCO 3', short: 'V3' },
  { id: 'osc4Detune', label: 'VCO 4', short: 'V4' },
  { id: 'fmIndex', label: 'FM idx', short: 'FMi' },
  { id: 'fmHarmonicity', label: 'FM hrm', short: 'FMh' },
  { id: 'filterFreq', label: 'Cut 1', short: 'C1' },
  { id: 'filterQ', label: 'Res 1', short: 'R1' },
  { id: 'vcf2Freq', label: 'Cut 2', short: 'C2' },
  { id: 'noiseFilterFreq', label: 'BPF N', short: 'BPF N' },
  { id: 'osc1Level', label: 'Vol 1', short: 'V1' },
  { id: 'osc2Level', label: 'Vol 2', short: 'V2' },
  { id: 'osc3Level', label: 'Vol 3', short: 'V3' },
  { id: 'osc4Level', label: 'Vol 4', short: 'V4' },
  { id: 'noiseLevel', label: 'Noise', short: 'Noiz' },
  { id: 'vcaGain', label: 'VCA', short: 'VCA' },
];

/** Estado de la matriz: qué intersecciones (fuente→destino) están conectadas. */
export type ModPatch = Partial<Record<string, boolean>>;

/** Clave única de una conexión fuente→destino. */
export const patchKey = (src: ModSourceId, dst: ModDestId): string => `${src}>${dst}`;

export interface PatchConnection {
  source: ModSourceId;
  dest: ModDestId;
}

/**
 * Construye un patch inicial a partir de una lista de conexiones. Permite definir el
 * cableado por defecto de forma declarativa, p. ej.:
 *   createPatch([{ source: 'lfo1', dest: 'filterFreq' }])
 */
export const createPatch = (connections: PatchConnection[]): ModPatch => {
  const patch: ModPatch = {};
  for (const { source, dest } of connections) {
    patch[patchKey(source, dest)] = true;
  }
  return patch;
};
