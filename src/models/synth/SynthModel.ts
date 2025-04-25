import * as Tone from 'tone';
import { SynthModelInterface, SynthParams, KeyboardState } from './types';

export default class SynthModel implements SynthModelInterface {
  // Parámetros del sintetizador
  private params: SynthParams = {
    oscType: 'sawtooth',
    frequency: 440,
    osc2Type: 'sawtooth',
    osc2Enabled: false,
    detune: 0,
    filterType: 'lowpass',
    filterFreq: 20000,
    filterRes: 1,
    attack: 0.1,
    decay: 0.2,
    sustain: 0.5,
    release: 1,
    volume: -6
  };

  // Estado del teclado
  private keyboard: KeyboardState = {
    activeNotes: {},
    octave: 4
  };

  // Estado de reproducción
  private playing = false;

  // Nodos de audio
  private oscillator1: Tone.Oscillator | null = null;
  private oscillator2: Tone.Oscillator | null = null;
  private filter: Tone.Filter | null = null;
  private envelope: Tone.AmplitudeEnvelope | null = null;
  private gain: Tone.Gain | null = null;
  private waveformAnalyzer: Tone.Analyser | null = null;
  private spectrumAnalyzer: Tone.Analyser | null = null;

  constructor() {
    // Constructor vacío
  }

  // Getters
  public getParams(): SynthParams {
    return { ...this.params };
  }

  public getKeyboardState(): KeyboardState {
    return { ...this.keyboard };
  }

  public isPlaying(): boolean {
    return this.playing;
  }

  // Setters
  public setParams(newParams: Partial<SynthParams>): void {
    this.params = { ...this.params, ...newParams };
    this.updateAudioNodes();
  }

  public setKeyboardState(state: Partial<KeyboardState>): void {
    this.keyboard = { ...this.keyboard, ...state };
  }

  // Audio setup
  public setupAudio(): void {
    // Asegurarse de que el contexto de audio esté iniciado
    if (Tone.context.state !== 'running') {
      Tone.start();
    }

    // Crear osciladores
    this.oscillator1 = new Tone.Oscillator({
      frequency: this.params.frequency,
      type: this.params.oscType
    });

    this.oscillator2 = new Tone.Oscillator({
      frequency: this.params.frequency,
      type: this.params.osc2Type,
      detune: this.params.detune
    });

    // Crear filtro
    this.filter = new Tone.Filter({
      type: this.params.filterType,
      frequency: this.params.filterFreq,
      Q: this.params.filterRes
    });

    // Crear envelope
    this.envelope = new Tone.AmplitudeEnvelope({
      attack: this.params.attack,
      decay: this.params.decay,
      sustain: this.params.sustain,
      release: this.params.release
    });

    // Crear gain
    this.gain = new Tone.Gain(Tone.dbToGain(this.params.volume));

    // Crear analizadores
    this.waveformAnalyzer = new Tone.Analyser({
      type: "waveform",
      size: 512,
      smoothing: 0.8
    });

    this.spectrumAnalyzer = new Tone.Analyser({
      type: "fft",
      size: 512,
      smoothing: 0.8
    });

    // Crear splitter para enviar señal a ambos analizadores
    const splitter = new Tone.Split();

    // Conectar módulos
    this.oscillator1.connect(this.filter);
    if (this.params.osc2Enabled) {
      this.oscillator2.connect(this.filter);
    }
    this.filter.connect(this.envelope);
    this.envelope.connect(this.gain);
    this.gain.connect(splitter);
    splitter.connect(this.waveformAnalyzer);
    splitter.connect(this.spectrumAnalyzer);
    splitter.toDestination();

    // Iniciar osciladores
    this.oscillator1.start();
    if (this.params.osc2Enabled) {
      this.oscillator2.start();
    }
  }

  public disposeAudio(): void {
    // Liberar recursos de audio
    this.oscillator1?.dispose();
    this.oscillator2?.dispose();
    this.filter?.dispose();
    this.envelope?.dispose();
    this.gain?.dispose();
    this.waveformAnalyzer?.dispose();
    this.spectrumAnalyzer?.dispose();

    this.oscillator1 = null;
    this.oscillator2 = null;
    this.filter = null;
    this.envelope = null;
    this.gain = null;
    this.waveformAnalyzer = null;
    this.spectrumAnalyzer = null;
  }

  // Actualizar nodos basado en cambios en los parámetros
  private updateAudioNodes(): void {
    if (!this.oscillator1) return;

    // Actualizar oscilador 1
    this.oscillator1.type = this.params.oscType;
    this.oscillator1.frequency.value = this.params.frequency;

    // Actualizar oscilador 2
    if (this.oscillator2) {
      this.oscillator2.type = this.params.osc2Type;
      this.oscillator2.frequency.value = this.params.frequency;
      this.oscillator2.detune.value = this.params.detune;
      
      // Conectar/desconectar según el estado
      if (this.params.osc2Enabled && this.filter) {
        this.oscillator2.connect(this.filter);
      } else {
        this.oscillator2.disconnect();
      }
    }

    // Actualizar filtro
    if (this.filter) {
      this.filter.type = this.params.filterType;
      this.filter.frequency.value = this.params.filterFreq;
      this.filter.Q.value = this.params.filterRes;
    }

    // Actualizar envelope
    if (this.envelope) {
      this.envelope.attack = this.params.attack;
      this.envelope.decay = this.params.decay;
      this.envelope.sustain = this.params.sustain;
      this.envelope.release = this.params.release;
    }

    // Actualizar gain
    if (this.gain) {
      this.gain.gain.value = Tone.dbToGain(this.params.volume);
    }
  }

  // Acciones
  public playNote(note?: string): void {
    if (Tone.context.state !== 'running') {
      Tone.start();
    }

    // Si se especifica una nota, actualizar la frecuencia
    if (note && this.oscillator1 && this.oscillator2) {
      const frequency = Tone.Frequency(note).toFrequency();
      this.oscillator1.frequency.value = frequency;
      this.oscillator2.frequency.value = frequency;
    }

    // Disparar el envelope
    if (this.envelope) {
      this.envelope.triggerAttack();
      this.playing = true;
    }
  }

  public stopNote(): void {
    if (this.envelope) {
      this.envelope.triggerRelease();
      this.playing = false;
    }
  }

  // Análisis
  public getWaveformData(): Float32Array {
    return this.waveformAnalyzer?.getValue() || new Float32Array();
  }

  public getSpectrumData(): Float32Array {
    return this.spectrumAnalyzer?.getValue() || new Float32Array();
  }
}
