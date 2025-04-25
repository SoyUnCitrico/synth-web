import SynthModel from '../../models/synth/SynthModel';
import { SynthParams } from '../../models/synth/types';

export default class SynthController {
  private model: SynthModel;

  constructor(model: SynthModel) {
    this.model = model;
  }

  // Inicialización
  public initialize(): void {
    this.model.setupAudio();
  }

  public cleanup(): void {
    this.model.disposeAudio();
  }

  // Métodos para manipular parámetros
  public updateParams(params: Partial<SynthParams>): void {
    this.model.setParams(params);
  }

  // Métodos de control
  public playNote(note?: string): void {
    this.model.playNote(note);
  }

  public stopNote(): void {
    this.model.stopNote();
  }

  // Getters para la vista
  public getParams(): SynthParams {
    return this.model.getParams();
  }

  public isPlaying(): boolean {
    return this.model.isPlaying();
  }

  // Métodos de análisis
  public getWaveformData(): Float32Array {
    return this.model.getWaveformData();
  }

  public getSpectrumData(): Float32Array {
    return this.model.getSpectrumData();
  }
}