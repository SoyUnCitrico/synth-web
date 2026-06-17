import * as Tone from 'tone';
import type { SeqDirection } from './types';

/**
 * Secuenciador de pasos basado en Tone.Transport. Avanza un contador por cada semicorchea
 * y traduce ese contador a un índice de paso según la longitud y la dirección actuales
 * (leídas por callback, así cambiar pasos/dirección no obliga a reconstruirlo). Llama a
 * `onStep(index, time)` con el tiempo preciso del AudioContext.
 *
 * No forma parte del grafo de audio: sólo agenda llamadas a la API imperativa del motor.
 */
export class Sequencer {
  private repeatId: number | null = null;
  private counter = 0;

  constructor(
    private getLength: () => number,
    private getDirection: () => SeqDirection,
    private onStep: (index: number, time: number) => void,
  ) {}

  // Traduce el contador monótono al índice de paso según la dirección.
  private indexFor(counter: number, length: number, dir: SeqDirection): number {
    if (length <= 1) return 0;
    if (dir === 'reverse') return length - 1 - (counter % length);
    if (dir === 'pingpong') {
      const period = 2 * (length - 1);
      const pos = counter % period;
      return pos < length ? pos : period - pos;
    }
    return counter % length; // forward
  }

  start(): void {
    if (this.repeatId !== null) return;
    const transport = Tone.getTransport();
    this.repeatId = transport.scheduleRepeat((time) => {
      const index = this.indexFor(this.counter, this.getLength(), this.getDirection());
      this.onStep(index, time);
      this.counter += 1;
    }, '16n');
    if (transport.state !== 'started') transport.start();
  }

  stop(): void {
    const transport = Tone.getTransport();
    if (this.repeatId !== null) {
      transport.clear(this.repeatId);
      this.repeatId = null;
    }
    transport.stop();
  }

  /** Reinicia la secuencia al primer paso. */
  reset(): void {
    this.counter = 0;
  }

  setBpm(bpm: number): void {
    Tone.getTransport().bpm.value = bpm;
  }

  dispose(): void {
    this.stop();
  }
}
