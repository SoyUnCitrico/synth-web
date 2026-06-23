/**
 * Configuración de las 3 matrices de MAKWIL (CV, gates, notas).
 *
 * Forkea sólo las LISTAS de fuentes/destinos; reutiliza los tipos y helpers compartidos
 * (`patchKey`/`gateKey`/`noteKey`/`create*Patch`) de `audio/cv/*`. Diferencias con Modulor:
 *   - VCO renumerados (VCO1 Fat/poli, VCO2 FM, VCO3/4 pulso). VCO1 poli NO expone un detune
 *     modulable de forma continua, así que se quita su destino de pitch de la matriz CV.
 *   - Fuentes de secuenciador: Seq2..Seq5 CV (4 lanes CV); Seq3 también emite nota; Sec.5 gate.
 */
import {
  MIDI_CC_SOURCES,
  type PatchSource,
  type PatchDest,
} from '../cv/patch';
import { type GateSourceCfg, type GateDestCfg, GATE_DESTS } from '../cv/gates';
import { type NoteSourceCfg, type NoteDestCfg, NOTE_DESTS } from '../cv/notes';

export { patchKey, createPatch, MIDI_CC_SLOTS, MIDI_CC_SOURCES } from '../cv/patch';
export type { ModPatch, PatchSource } from '../cv/patch';
export { gateKey, createGatePatch, GATE_DESTS } from '../cv/gates';
export type { GatePatch, GateSourceId } from '../cv/gates';
export { noteKey, createNotePatch, NOTE_DESTS } from '../cv/notes';
export type { NotePatch, NoteSourceId } from '../cv/notes';

// --- Matriz CV (fuentes × AudioParams) ---
export const MAKWIL_MOD_SOURCES: PatchSource[] = [
  { id: 'adsr', label: 'ADSR', short: 'ADSR' },
  { id: 'dahd', label: 'DAHD', short: 'DAHD' },
  { id: 'ad1', label: 'AD 1', short: 'AD1' },
  { id: 'ad2', label: 'AD 2', short: 'AD2' },
  { id: 'lfo1', label: 'LFO 1', short: 'LF1' },
  { id: 'lfo2', label: 'LFO 2', short: 'LF2' },
  { id: 'seqCv', label: 'Seq2 CV', short: 'S2' },
  { id: 'seqCv2', label: 'Seq3 CV', short: 'S3' },
  { id: 'seqCv3', label: 'Seq4 CV', short: 'S4' },
  { id: 'seqCv4', label: 'Seq5 CV', short: 'S5' },
  ...MIDI_CC_SOURCES,
];

// VCO1 (poli) no aparece como destino de pitch (PolySynth no expone detune modulable).
export const MAKWIL_MOD_DESTS: PatchDest[] = [
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

// --- Matriz de gates/triggers (fuentes de disparo → envolventes) ---
export const MAKWIL_GATE_SOURCES: GateSourceCfg[] = [
  { id: 'keyboard', label: 'Teclado', short: 'Tcl' },
  { id: 'midi', label: 'MIDI', short: 'MIDI' },
  { id: 'seq1', label: 'Sec. 1', short: 'S1' },
  { id: 'seq2', label: 'Sec. 2', short: 'S2' },
  { id: 'seq3', label: 'Sec. 3', short: 'S3' },
  { id: 'seq4', label: 'Sec. 4', short: 'S4' },
  { id: 'seq5', label: 'Sec. 5', short: 'S5' },
];
export const MAKWIL_GATE_DESTS: GateDestCfg[] = GATE_DESTS;

// --- Matriz MIDI (fuentes de nota → VCO / seguimiento de cutoff) ---
export const MAKWIL_NOTE_SOURCES: NoteSourceCfg[] = [
  { id: 'keyboard', label: 'Teclado', short: 'Tcl' },
  { id: 'midi', label: 'MIDI', short: 'MIDI' },
  { id: 'seq1', label: 'Seq 1', short: 'S1' },
  { id: 'seq2', label: 'Seq 2', short: 'S2' },
  { id: 'seq3', label: 'Seq 3', short: 'S3' },
];
export const MAKWIL_NOTE_DESTS: NoteDestCfg[] = NOTE_DESTS;
