/**
 * Conversores posición↔valor reutilizables para controles (perillas/sliders). La "posición"
 * es siempre 0..1 (recorrido lineal del control); el "valor" es la unidad real del parámetro.
 *
 * Pensado para que un mismo objeto de escala se comparta entre varios controles de distintos
 * módulos (p. ej. una sola `AUDIO_FREQ_SCALE` para el cutoff del VCF y el pasabanda del ruido).
 */

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export interface Scale {
  readonly min: number;
  readonly max: number;
  /** posición 0..1 → valor en unidades reales. */
  toValue(position: number): number;
  /** valor en unidades reales → posición 0..1. */
  toPosition(value: number): number;
}

/** Escala lineal simple (valor proporcional a la posición). */
export class LinearScale implements Scale {
  constructor(
    readonly min: number,
    readonly max: number,
  ) {}
  toValue(position: number): number {
    return this.min + clamp(position, 0, 1) * (this.max - this.min);
  }
  toPosition(value: number): number {
    const range = this.max - this.min;
    return range === 0 ? 0 : clamp((value - this.min) / range, 0, 1);
  }
}

/**
 * Escala logarítmica (exponencial). Posiciones iguales producen RAZONES de valor iguales, de
 * modo que el recorrido se "estira" en valores bajos y se "acorta" en los altos — ideal para
 * frecuencias dentro del rango auditivo: más resolución en graves donde el oído distingue
 * mejor. Requiere `min > 0` y `max > min`.
 */
export class LogScale implements Scale {
  private readonly span: number; // ln(max/min)
  constructor(
    readonly min: number,
    readonly max: number,
  ) {
    if (min <= 0 || max <= min) {
      throw new Error('LogScale requiere 0 < min < max');
    }
    this.span = Math.log(max / min);
  }
  toValue(position: number): number {
    return this.min * Math.exp(clamp(position, 0, 1) * this.span);
  }
  toPosition(value: number): number {
    return clamp(Math.log(clamp(value, this.min, this.max) / this.min) / this.span, 0, 1);
  }
}

// ── Escalas compartidas (un solo objeto reutilizable por varios controles/módulos) ──
/** Rango auditivo completo: cutoff del VCF y centro del pasabanda del ruido. */
export const AUDIO_FREQ_SCALE = new LogScale(20, 20000);
/** Frecuencia base del oscilador (VCO). */
export const OSC_FREQ_SCALE = new LogScale(20, 8000);
/** Velocidad del LFO (Hz): más resolución en velocidades lentas. */
export const LFO_RATE_SCALE = new LogScale(0.1, 20);
