/**
 * Snapshot del estado guardable de MAKWIL (presets con nombre).
 *
 * Igual patrón que Modulor (presets/types.ts) pero sin batería, con VCO renumerados, octava por
 * secuenciador y 5 secuenciadores (4 lanes de CV). Reutiliza la infraestructura genérica de
 * presets (`usePresets<S>`, `Presets`, io) parametrizada por este tipo.
 */
import type * as Tone from 'tone';
import type { ModPatch, GatePatch, NotePatch } from './cv';
import type { NoiseType, Vcf2Type, Vcf2Source, EnvCurve } from '../useSynthEngine';
import type { SeqConfig, PitchStep, CvStep } from './sequencerTypes';

export interface MakwilPresetState {
  // --- VCO 1 (Fat / poli) ---
  osc1Type: Tone.ToneOscillatorType;
  osc1Freq: number;
  osc1Fine: number;
  osc1Spread: number;
  osc1Count: number;
  /** Modo drone de la VCO1 (voz continua). */
  droneEnabled: boolean;
  // --- VCO 2 (FM) ---
  osc2Type: Tone.ToneOscillatorType;
  osc2Freq: number;
  osc2Fine: number;
  fmHarmonicity: number;
  fmModIndex: number;
  // --- VCO 3 (pulso) ---
  osc3Type: Tone.ToneOscillatorType;
  osc3Freq: number;
  osc3Fine: number;
  pwm3: number;
  // --- VCO 4 (pulso) ---
  osc4Type: Tone.ToneOscillatorType;
  osc4Freq: number;
  osc4Fine: number;
  pwm4: number;
  // --- On/off por voz (5 canales: VCO1-4 + Ruido) ---
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
  vcf2Source: Exclude<Vcf2Source, 'none'>[];
  // --- VCF 3 (insert por voz) ---
  vcf3Type: Vcf2Type;
  vcf3Freq: number;
  vcf3Res: number;
  vcf3Source: Exclude<Vcf2Source, 'none'>[];
  // --- Envolventes AD (modulación) ---
  ad1Attack: number;
  ad1Decay: number;
  ad1Amount: number;
  ad1Curve: EnvCurve;
  ad2Attack: number;
  ad2Decay: number;
  ad2Amount: number;
  ad2Curve: EnvCurve;
  ad3Attack: number;
  ad3Decay: number;
  ad3Amount: number;
  ad3Curve: EnvCurve;
  // --- Envolvente DAHD (modulación) ---
  dahdDelay: number;
  dahdAttack: number;
  dahdHold: number;
  dahdDecay: number;
  dahdAmount: number;
  dahdCurve: EnvCurve;
  // --- ADSR (amplitud; también de las voces poli) ---
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
  lfo3Type: Tone.ToneOscillatorType;
  lfo3Rate: number;
  lfo3Depth: number;
  // --- Reverb / Delay / Chorus / Chebyshev (envíos) ---
  reverbDecay: number;
  reverbWet: number;
  delayTime: number;
  delayFeedback: number;
  chorusRate: number;
  chorusDepth: number;
  chorusWet: number;
  chebyOrder: number;
  chebyWet: number;
  chorusSends: number[];
  chebySends: number[];
  chorusSendEnabled: boolean;
  chebySendEnabled: boolean;
  // --- Matrices de modulación ---
  modPatch: ModPatch;
  gatePatch: GatePatch;
  notePatch: NotePatch;
  // --- Secuenciador (5 secuenciadores) ---
  seqConfigs: SeqConfig[];
  seqBpm: number;
  pitchSteps: PitchStep[];
  cvSteps: CvStep[];
  cv2Steps: CvStep[];
  cv3Steps: CvStep[];
  cv4Steps: CvStep[];
}
