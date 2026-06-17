import type * as Tone from 'tone';
import type { ModPatch } from '../audio/cv/patch';
import type { GatePatch } from '../audio/cv/gates';
import type { NoiseType } from '../audio/useSynthEngine';
import type { SeqChannels, SeqDirection, PitchStep, CvStep } from '../audio/sequencer/types';

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
  pwm1: number;
  // --- OSC 2 ---
  osc2Type: Tone.ToneOscillatorType;
  detune: number;
  osc2Enabled: boolean;
  pwm2: number;
  // --- OSC 3 ---
  osc3Type: Tone.ToneOscillatorType;
  osc3Detune: number;
  osc3Enabled: boolean;
  pwm3: number;
  // --- Ruido ---
  noiseType: NoiseType;
  noiseEnabled: boolean;
  noiseFilterEnabled: boolean;
  noiseFilterFreq: number;
  // --- Mixer ---
  mixOsc1: number;
  mixOsc2: number;
  mixOsc3: number;
  mixNoise: number;
  // --- Filtro ---
  filterType: BiquadFilterType;
  filterFreq: number;
  filterRes: number;
  // --- Envolventes AD (modulación) ---
  ad1Attack: number;
  ad1Decay: number;
  ad1Amount: number;
  ad2Attack: number;
  ad2Decay: number;
  ad2Amount: number;
  // --- ADSR (amplitud) ---
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  // --- Volumen maestro ---
  volume: number;
  // --- LFO 1 / LFO 2 ---
  lfoType: Tone.ToneOscillatorType;
  lfoRate: number;
  lfoDepth: number;
  lfo2Type: Tone.ToneOscillatorType;
  lfo2Rate: number;
  lfo2Depth: number;
  // --- Reverb ---
  reverbDecay: number;
  reverbWet: number;
  // --- Matriz de modulación ---
  modPatch: ModPatch;
  gatePatch: GatePatch;
  // --- Secuenciador ---
  seqChannels: SeqChannels;
  seqSteps: number;
  seqDirection: SeqDirection;
  seqBpm: number;
  pitchSteps: PitchStep[];
  cvSteps: CvStep[];
  cv2Steps: CvStep[];
}

export interface Preset {
  name: string;
  state: PresetState;
}
