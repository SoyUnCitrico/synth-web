import React from 'react';
import Knob from '../../Knob/Knob';
import CurveToggle from '../CurveToggle/CurveToggle';
import { ENV_ATTACK_SCALE, ENV_DECAY_SCALE } from '../../../utils/scale';
import type { EnvCurve } from '../../../audio/useSynthEngine';
import './FilterEnv.css';

interface FilterEnvProps {
  attack: number;
  setAttack: (value: number) => void;
  decay: number;
  setDecay: (value: number) => void;
  amount: number; // profundidad/cantidad de la fuente en la matriz (-1.2 a 1.2)
  setAmount: (value: number) => void;
  curve: EnvCurve; // forma de las rampas (lineal/exponencial)
  setCurve: (value: EnvCurve) => void;
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
  curve,
  setCurve,
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
        <CurveToggle curve={curve} setCurve={setCurve} />
      </div>
      <div className="module-controls filterenv-controls">
        <div className="envelope-display filterenv-display">
          <svg viewBox="0 0 100 10" className="filterenv-svg">
            <path d={createPath()} fill="none" stroke="currentColor" strokeWidth="3" />
          </svg>
        </div>

        <div className="filterenv-knobs">
          {/* Ataque y decay con escala logarítmica: control exponencial, más resolución en tiempos cortos. */}
          <Knob
            id={`${id}-attack`} label="Atk" scale={ENV_ATTACK_SCALE} step={0.01}
            value={attack} display={`${attack.toFixed(2)}s`} onChange={setAttack}
            midiId={`${id}-attack`}
          />
          <Knob
            id={`${id}-decay`} label="Dec" scale={ENV_DECAY_SCALE} step={0.01}
            value={decay} display={`${decay.toFixed(2)}s`} onChange={setDecay}
            midiId={`${id}-decay`}
          />
          <Knob
            id={`${id}-amount`} label="Amt" min={-1.2} max={1.2} step={0.01}
            value={amount} display={`${(amount * 100).toFixed(0)}%`} onChange={setAmount}
            midiId={`${id}-amount`}
          />
        </div>
      </div>
    </div>
  );
};
