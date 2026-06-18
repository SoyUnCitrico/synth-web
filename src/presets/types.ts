import type * as Tone from 'tone';
import type { ModPatch } from '../audio/cv/patch';
import type { GatePatch } from '../audio/cv/gates';
import type { NotePatch } from '../audio/cv/notes';
import type { NoiseType, Vcf2Type, Vcf2Source } from '../audio/useSynthEngine';
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
  osc2Enabled: boolean;
  pwm2: number;
  // --- OSC 3 ---
  osc3Type: Tone.ToneOscillatorType;
  osc3Freq: number;
  osc3Detune: number;
  osc3Enabled: boolean;
  pwm3: number;
  // --- Ruido ---
  noiseType: NoiseType;
  noiseEnabled: boolean;
  noiseFilterEnabled: boolean;
  noiseFilterFreq: number;
  noiseFilterRes: number;
  // --- Mixer ---
  mixOsc1: number;
  mixOsc2: number;
  mixOsc3: number;
  mixNoise: number;
  channelMute: boolean[];
  channelSolo: boolean[];
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
  ad2Attack: number;
  ad2Decay: number;
  ad2Amount: number;
  // --- Envolvente DAHD (modulación) ---
  dahdDelay: number;
  dahdAttack: number;
  dahdHold: number;
  dahdDecay: number;
  dahdAmount: number;
  // --- ADSR (amplitud) ---
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  adsrAmount: number;
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
