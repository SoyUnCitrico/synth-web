import React from 'react';
import './LedDisplay.css';

type LedTone = 'amber' | 'green' | 'cyan' | 'red';

interface LedDisplayProps {
  /** Texto/valor a mostrar (se muestra en mayúsculas, estilo panel). */
  value: string | number;
  /** Ancho mínimo en caracteres (rellena con espacios a la izquierda para no "saltar"). */
  chars?: number;
  /** Color de fósforo del LED. */
  tone?: LedTone;
  /** Etiqueta grabada opcional encima del display. */
  label?: string;
}

/**
 * Pantalla de matriz de LEDs alfanumérica (estética de equipo científico ochentero). El
 * texto brilla en color fósforo sobre un panel hundido, y una rejilla de puntos superpuesta
 * simula los huecos entre LEDs. Es 100% CSS (sin canvas/imágenes) para no costar render.
 *
 * Presentacional puro: sólo muestra `value`. El color por defecto sale de los tokens
 * --led-display / --led-display-glow; `tone` permite verde/cian/rojo por display.
 */
const LedDisplay: React.FC<LedDisplayProps> = ({ value, chars, tone = 'amber', label }) => {
  const text = String(value).toUpperCase();
  const padded = chars ? text.padStart(chars, ' ') : text;
  return (
    <div className="led-display-wrap">
      {label && <span className="led-display-label">{label}</span>}
      <div className={`led-display led-${tone}`} role="status" aria-label={String(value)}>
        <span className="led-display-text">{padded}</span>
      </div>
    </div>
  );
};

export default LedDisplay;
