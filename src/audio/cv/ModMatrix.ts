import * as Tone from 'tone';
import type { ModSource, ModSourceId, ModDest, ModDestId } from './types';

/**
 * Matriz de modulación (CV) del sintetizador.
 *
 * Cada conexión fuente→destino es un Tone.Gain que escala la señal de la fuente
 * (normalizada) a las unidades del destino y la suma a su AudioParam:
 *
 *   fuente.output ─> Gain(amount · unitPerAmount) ─> destino.param
 *
 * `amount` positivo = modulación positiva; `amount` NEGATIVO = modulación negativa
 * (resta del valor base del param). Las rutas no usadas se dejan con ganancia 0 en vez
 * de desconectarse, para evitar clics al cambiar de destino.
 *
 * Pensada para vivir en un useRef dentro de useSynthEngine: se construye una vez con el
 * grafo y luego sólo se mutan las ganancias. No reconstruye nada.
 */
export class ModMatrix {
  private sources = new Map<ModSourceId, ModSource>();
  private dests = new Map<ModDestId, ModDest>();
  private conns = new Map<string, Tone.Gain>(); // clave `${src}->${dst}`

  registerSource(source: ModSource): void {
    this.sources.set(source.id, source);
  }

  registerDest(dest: ModDest): void {
    this.dests.set(dest.id, dest);
  }

  private connKey(srcId: ModSourceId, dstId: ModDestId): string {
    return `${srcId}->${dstId}`;
  }

  /**
   * Fija la cantidad de una ruta (creándola la primera vez). `amount` suele ir en
   * -1..1, pero puede excederlo. Mutar a 0 anula la ruta sin desconectarla.
   */
  setAmount(srcId: ModSourceId, dstId: ModDestId, amount: number): void {
    const dst = this.dests.get(dstId);
    if (!dst) return;

    const key = this.connKey(srcId, dstId);
    let gain = this.conns.get(key);
    if (!gain) {
      const src = this.sources.get(srcId);
      if (!src) return;
      gain = new Tone.Gain(0);
      src.output.connect(gain);
      gain.connect(dst.param);
      this.conns.set(key, gain);
    }
    gain.gain.setValueAtTime(amount * dst.unitPerAmount, Tone.now());
  }

  dispose(): void {
    this.conns.forEach((gain) => gain.dispose());
    this.conns.clear();
    this.sources.clear();
    this.dests.clear();
  }
}
