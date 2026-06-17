import React from 'react';
import Fader from '../Fader/Fader';
import './DAHD.css';

interface DAHDProps {
  delay: number;
  setDelay: (value: number) => void;
  attack: number;
  setAttack: (value: number) => void;
  hold: number;
  setHold: (value: number) => void;
  decay: number;
  setDecay: (value: number) => void;
  amount: number; // profundidad/cantidad de la fuente en la matriz (-1.2 a 1.2)
  setAmount: (value: number) => void;
}

// Generador de envolvente DAHD (Delay-Attack-Hold-Decay). Es una fuente de modulación:
// se rutea en la matriz de CV y se dispara desde la matriz de triggers. Su "cantidad" es
// la profundidad con que modula los destinos (negativa = invierte el sentido).
export const DAHD: React.FC<DAHDProps> = ({
  delay,
  setDelay,
  attack,
  setAttack,
  hold,
  setHold,
  decay,
  setDecay,
  amount,
  setAmount,
}) => {
  // Trazado de la curva DAHD: plano durante el retardo, sube en attack, se mantiene en el
  // hold y baja en decay. Con cantidad negativa el pico apunta hacia abajo.
  const createPath = () => {
    const offsetX = 5;
    const height = 45;
    const baseY = height;
    const peakY = 3;
    const up = amount >= 0;
    const top = up ? peakY : baseY;
    const rest = up ? baseY : peakY;
    const delayX = offsetX + Math.min(22, delay * 22);
    const attackX = delayX + Math.min(22, attack * 22);
    const holdX = attackX + Math.min(22, hold * 22);
    const decayX = holdX + Math.min(28, decay * 22);
    return `M ${offsetX},${rest} L ${delayX},${rest} L ${attackX},${top} L ${holdX},${top} L ${decayX},${rest}`;
  };

  return (
    <div className="module dahd-module">
      <div className="module-header">
        <h2>DAHD</h2>
      </div>
      <div className="module-controls">
        <div className="envelope-display">
          <svg viewBox="0 0 100 50" className="dahd-svg">
            <path d={createPath()} fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        </div>

        <div className="fader-bank">
          <Fader
            id="dahd-delay" label="Dly" min={0} max={2} step={0.01}
            value={delay} display={`${delay.toFixed(2)}s`} onChange={setDelay}
          />
          <Fader
            id="dahd-attack" label="Atk" min={0.01} max={2} step={0.01}
            value={attack} display={`${attack.toFixed(2)}s`} onChange={setAttack}
          />
          <Fader
            id="dahd-hold" label="Hold" min={0} max={2} step={0.01}
            value={hold} display={`${hold.toFixed(2)}s`} onChange={setHold}
          />
          <Fader
            id="dahd-decay" label="Dec" min={0.01} max={3} step={0.01}
            value={decay} display={`${decay.toFixed(2)}s`} onChange={setDecay}
          />
          <Fader
            id="dahd-amount" label="Amt" min={-1.2} max={1.2} step={0.01}
            value={amount} display={`${(amount * 100).toFixed(0)}%`} onChange={setAmount}
          />
        </div>
      </div>
    </div>
  );
};
