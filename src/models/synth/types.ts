export type ToneOscillatorType = 'sine' | 'square' | 'sawtooth' | 'triangle';
export type FilterType = 'lowpass' | 'highpass' | 'bandpass' | 'notch';

export interface SynthParams {
  // Oscilador 1
  oscType: ToneOscillatorType;
  frequency: number;
  
  // Oscilador 2
  osc2Type: ToneOscillatorType;
  osc2Enabled: boolean;
  detune: number;
  
  // Filtro
  filterType: FilterType;
  filterFreq: number;
  filterRes: number;
  
  // ADSR
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  
  // Volumen
  volume: number;
}

export interface KeyboardState {
  activeNotes: Record<string, string>;
  octave: number;
}

export interface SynthModelInterface {
  // Getters
  getParams(): SynthParams;
  getKeyboardState(): KeyboardState;
  isPlaying(): boolean;
  
  // Setters
  setParams(params: Partial<SynthParams>): void;
  setKeyboardState(state: Partial<KeyboardState>): void;

  // Audio
  setupAudio(): void;
  disposeAudio(): void;
  
  // Acciones
  playNote(note?: string): void;
  stopNote(): void;
  
  // Análisis
  getWaveformData(): Float32Array;
  getSpectrumData(): Float32Array;
}