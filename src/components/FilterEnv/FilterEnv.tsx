import React from 'react';
import Fader from '../Fader/Fader';
import './FilterEnv.css';

interface FilterEnvProps {
  attack: number;
  setAttack: (value: number) => void;
  decay: number;
  setDecay: (value: number) => void;
  amount: number; // profundidad/cantidad de la fuente en la matriz (-1.2 a 1.2)
  setAmount: (value: number) => void;
  label?: string;
  id?: string;
}

// Generador de envolvente Ataque-Decay (AD). Es una fuente de modulación: se rutea en la
// matriz de patcheo; su "cantidad" es la profundidad con que modula los destinos.
export const FilterEnv: React.FC<FilterEnvProps> = ({
  attack,
  setAttack,
  decay,
  setDecay,
  amount,
  setAmount,
  label = 'AD',
  id = 'ad',
}) => {
  // Trazado de la curva AD para visualización (sube en attack, baja en decay).
  const createPath = () => {
    const offsetX = 5;
    const height = 45;
    const baseY = height;
    const peakY = 3;
    const attackX = offsetX + Math.min(40, attack * 30);
    const decayX = attackX + Math.min(45, decay * 30);
    // Si la cantidad es negativa, el pico apunta hacia abajo.
    const up = amount >= 0;
    const top = up ? peakY : baseY;
    const rest = up ? baseY : peakY;
    return `M ${offsetX},${rest} L ${attackX},${top} L ${decayX},${rest}`;
  };

  return (
    <div className="module filterenv-module">
      <div className="module-header">
        <h2>{label}</h2>
      </div>
      <div className="module-controls">
        <div className="envelope-display">
          <svg viewBox="0 0 100 50" className="filterenv-svg">
            <path d={createPath()} fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        </div>

        <div className="fader-bank">
          <Fader
            id={`${id}-attack`} label="Atk" min={0.01} max={2} step={0.01}
            value={attack} display={`${attack.toFixed(2)}s`} onChange={setAttack}
          />
          <Fader
            id={`${id}-decay`} label="Dec" min={0.01} max={3} step={0.01}
            value={decay} display={`${decay.toFixed(2)}s`} onChange={setDecay}
          />
          <Fader
            id={`${id}-amount`} label="Amt" min={-1.2} max={1.2} step={0.01}
            value={amount} display={`${(amount * 100).toFixed(0)}%`} onChange={setAmount}
          />
        </div>
      </div>
    </div>
  );
};
