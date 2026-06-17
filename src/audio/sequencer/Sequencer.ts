import * as Tone from 'tone';
import type { SeqDirection } from './types';

/**
 * Secuenciador de pasos basado en Tone.Transport. Cada instancia agenda su propio
 * `scheduleRepeat` con un intervalo propio (su divisor/multiplicador de reloj), así varios
 * secuenciadores comparten el mismo transporte (mismo BPM, en fase) pero avanzan a ritmos
 * relativos. Traduce un contador monótono a un índice de paso según longitud y dirección
 * (leídas por callback, así cambiarlas no obliga a reconstruirlo).
 *
 * No controla el arranque/parada del transporte (lo hace el hook una sola vez): sólo
 * gestiona su propio repeat. No forma parte del grafo de audio.
 */
export class Sequencer {
  private repeatId: number | null = null;
  private counter = 0;

  constructor(
    private getInterval: () => string,
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
      const length = this.getLength();
      // 0 pasos => secuenciador en silencio; mantiene la fase pero no dispara.
      if (length >= 1) {
        const index = this.indexFor(this.counter, length, this.getDirection());
        this.onStep(index, time);
      }
      this.counter += 1;
    }, this.getInterval());
  }

  stop(): void {
    if (this.repeatId !== null) {
      Tone.getTransport().clear(this.repeatId);
      this.repeatId = null;
    }
  }

  /** Reagenda el repeat con el intervalo actual (al cambiar el reloj en marcha). */
  reschedule(): void {
    if (this.repeatId === null) return; // no corre: el próximo start() ya usa el nuevo reloj
    this.stop();
    this.start();
  }

  /** Reinicia la secuencia al primer paso. */
  reset(): void {
    this.counter = 0;
  }

  dispose(): void {
    this.stop();
  }
}
