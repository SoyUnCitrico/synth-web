import * as Tone from 'tone';

/**
 * Secuenciador de pasos basado en Tone.Transport. Avanza un paso por cada semicorchea y
 * llama a `onStep(index, time)` con el tiempo preciso del AudioContext (para agendar con
 * exactitud). La longitud (nº de pasos) se lee de `getLength` en cada paso, así cambiar de
 * modo no obliga a reconstruir el secuenciador.
 *
 * No forma parte del grafo de audio: sólo agenda llamadas a la API imperativa del motor.
 */
export class Sequencer {
  private repeatId: number | null = null;
  private step = 0;

  constructor(
    private getLength: () => number,
    private onStep: (index: number, time: number) => void,
  ) {}

  start(): void {
    if (this.repeatId !== null) return;
    this.step = 0;
    const transport = Tone.getTransport();
    this.repeatId = transport.scheduleRepeat((time) => {
      const index = this.step % this.getLength();
      this.onStep(index, time);
      this.step += 1;
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

  setBpm(bpm: number): void {
    Tone.getTransport().bpm.value = bpm;
  }

  dispose(): void {
    this.stop();
  }
}
