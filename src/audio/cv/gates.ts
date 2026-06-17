/**
 * Matriz de gates/triggers: enruta las fuentes de disparo a las envolventes.
 *
 * A diferencia de la matriz de CV (señales continuas → AudioParams), aquí las fuentes son
 * eventos de disparo (note-on/off) y los destinos son generadores de envolvente. El modo
 * del destino decide la semántica:
 *   - 'gate'    → la envolvente sigue la compuerta: attack en note-on, release en note-off
 *                 (el ADSR principal, que tiene sustain).
 *   - 'trigger' → disparo único en note-on; ignora el note-off (las AD, sustain 0).
 */

export type GateSourceId = 'keyboard' | 'seq1' | 'seq2' | 'seq3' | 'seq4';
export type GateDestId = 'amp' | 'ad1' | 'ad2' | 'dahd';

export interface GateSourceCfg {
  id: GateSourceId;
  label: string;
}

export interface GateDestCfg {
  id: GateDestId;
  label: string;
  mode: 'gate' | 'trigger';
}

export const GATE_SOURCES: GateSourceCfg[] = [
  { id: 'keyboard', label: 'Teclado' },
  { id: 'seq1', label: 'Sec. 1' },
  { id: 'seq2', label: 'Sec. 2' },
  { id: 'seq3', label: 'Sec. 3' },
  { id: 'seq4', label: 'Sec. 4' },
];

export const GATE_DESTS: GateDestCfg[] = [
  { id: 'amp', label: 'ADSR', mode: 'gate' },
  { id: 'ad1', label: 'AD 1', mode: 'trigger' },
  { id: 'ad2', label: 'AD 2', mode: 'trigger' },
  { id: 'dahd', label: 'DAHD', mode: 'trigger' },
];

/** Estado de la matriz de gates: qué intersecciones (fuente→envolvente) están activas. */
export type GatePatch = Partial<Record<string, boolean>>;

export const gateKey = (src: GateSourceId, dst: GateDestId): string => `${src}>${dst}`;

export interface GateConnection {
  source: GateSourceId;
  dest: GateDestId;
}

export const createGatePatch = (connections: GateConnection[]): GatePatch => {
  const patch: GatePatch = {};
  for (const { source, dest } of connections) {
    patch[gateKey(source, dest)] = true;
  }
  return patch;
};
