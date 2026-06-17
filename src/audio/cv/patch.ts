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
}

export interface PatchDest {
  id: ModDestId;
  label: string;
}

// Orden de las filas: primero las envolventes (ADSR, DAHD, AD 1, AD 2) y después el resto
// (LFOs y CV/Vel de los secuenciadores).
export const MOD_SOURCES: PatchSource[] = [
  { id: 'adsr', label: 'ADSR' },
  { id: 'dahd', label: 'DAHD' },
  { id: 'ad1', label: 'AD 1' },
  { id: 'ad2', label: 'AD 2' },
  { id: 'lfo1', label: 'LFO 1' },
  { id: 'lfo2', label: 'LFO 2' },
  { id: 'seqVel', label: 'Seq1 Vel' },
  { id: 'seqCv', label: 'Seq2 CV' },
  { id: 'seqCv2', label: 'Seq3 CV' },
  { id: 'seqCv3', label: 'Seq4 CV' },
];

export const MOD_DESTS: PatchDest[] = [
  { id: 'osc1Detune', label: 'VCO 1' },
  { id: 'osc2Detune', label: 'VCO 2' },
  { id: 'osc3Detune', label: 'VCO 3' },
  { id: 'filterFreq', label: 'Cutoff' },
  { id: 'filterQ', label: 'Reson.' },
  { id: 'vcf2Freq', label: 'Cutoff 2' },
  { id: 'vcaGain', label: 'VCA' },
  { id: 'osc1Level', label: 'Vol 1' },
  { id: 'osc2Level', label: 'Vol 2' },
  { id: 'osc3Level', label: 'Vol 3' },
  { id: 'noiseLevel', label: 'Ruido' },
  { id: 'noiseFilterFreq', label: 'Pasab.' },
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
