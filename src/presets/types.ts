import type * as Tone from 'tone';
import type { ModPatch } from '../audio/cv/patch';
import type { GatePatch } from '../audio/cv/gates';
import type { NotePatch } from '../audio/cv/notes';
import type { NoiseType, Vcf2Type, Vcf2Source, EnvCurve } from '../audio/useSynthEngine';
import type { SeqConfig, PitchStep, CvStep, DrumStep } from '../audio/sequencer/types';

/**
 * Snapshot del estado guardable del sinte.
 *
 * PATRÓN PARA EXTENDER: para incluir un parámetro nuevo en los presets basta con
 *   1) añadir su campo aquí,
 *   2) añadir una línea en `captureState` y otra en `applyState` (en BasicSynth).
 * `applyState` ignora los campos ausentes, así un preset viejo sin campos nuevos sigue
 * cargando sin romper.
 */
export interface PresetState {
  // --- OSC 1 ---
  oscType: Tone.ToneOscillatorType;
  frequency: number;
  osc1Fine: number;
  pwm1: number;
  // --- OSC 2 ---
  osc2Type: Tone.ToneOscillatorType;
  osc2Freq: number;
  detune: number;
  pwm2: number;
  // --- OSC 3 (Fat) ---
  osc3Type: Tone.ToneOscillatorType;
  osc3Freq: number;
  osc3Detune: number;
  osc3Spread: number;
  osc3Count: number;
  // --- OSC 4 (FM) ---
  osc4Type: Tone.ToneOscillatorType;
  osc4Freq: number;
  osc4Fine: number;
  fmHarmonicity: number;
  fmModIndex: number;
  // --- On/off por voz (5 canales: VCO1-3, FM, Ruido) ---
  channelEnabled: boolean[];
  // --- Cuantizador de escala MIDI ---
  quantScale: string;
  quantRoot: number;
  // --- Ruido ---
  noiseType: NoiseType;
  noiseFilterEnabled: boolean;
  noiseFilterFreq: number;
  noiseFilterRes: number;
  // --- Mixer ---
  mixOsc1: number;
  mixOsc2: number;
  mixOsc3: number;
  mixOsc4: number;
  mixNoise: number;
  channelSolo: boolean[];
  channelPan: number[];
  reverbSends: number[];
  delaySends: number[];
  reverbSendEnabled: boolean;
  delaySendEnabled: boolean;
  // --- Filtro ---
  filterType: BiquadFilterType;
  filterFreq: number;
  filterRes: number;
  // --- VCF 2 (insert por voz) ---
  vcf2Type: Vcf2Type;
  vcf2Freq: number;
  vcf2Res: number;
  vcf2Source: Vcf2Source;
  // --- Envolventes AD (modulación) ---
  ad1Attack: number;
  ad1Decay: number;
  ad1Amount: number;
  ad1Curve: EnvCurve;
  ad2Attack: number;
  ad2Decay: number;
  ad2Amount: number;
  ad2Curve: EnvCurve;
  // --- Envolvente DAHD (modulación) ---
  dahdDelay: number;
  dahdAttack: number;
  dahdHold: number;
  dahdDecay: number;
  dahdAmount: number;
  dahdCurve: EnvCurve;
  // --- ADSR (amplitud) ---
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  adsrAmount: number;
  adsrCurve: EnvCurve;
  // --- Volumen maestro ---
  volume: number;
  // --- LFO 1 / LFO 2 ---
  lfoType: Tone.ToneOscillatorType;
  lfoRate: number;
  lfoDepth: number;
  lfo2Type: Tone.ToneOscillatorType;
  lfo2Rate: number;
  lfo2Depth: number;
  // --- Reverb / Delay (envíos) ---
  reverbDecay: number;
  reverbWet: number;
  delayTime: number;
  delayFeedback: number;
  // --- Matriz de modulación ---
  modPatch: ModPatch;
  gatePatch: GatePatch;
  notePatch: NotePatch;
  // --- Secuenciador (4 secuenciadores independientes) ---
  seqConfigs: SeqConfig[];
  seqBpm: number;
  pitchSteps: PitchStep[];
  cvSteps: CvStep[];
  cv2Steps: CvStep[];
  cv3Steps: CvStep[];
  // --- Batería (no incluye los buffers de sample del usuario) ---
  drumEnabled: boolean[];
  drumSampleSel: string[];
  drumPitch: number[];
  drumDecay: number[];
  drumVol: number[];
  drumRevSends: number[];
  drumDelSends: number[];
  drumConfigs: SeqConfig[];
  drumSteps: DrumStep[][];
  drumReverbDecay: number;
  drumDelayTime: number;
  drumDelayFeedback: number;
}

export interface Preset {
  name: string;
  state: PresetState;
}
