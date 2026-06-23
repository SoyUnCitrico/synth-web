import React from 'react';
import type { EnvCurve } from '../../../audio/useSynthEngine';

interface CurveToggleProps {
  curve: EnvCurve;
  setCurve: (value: EnvCurve) => void;
}

// Interruptor lineal↔exponencial para las curvas de una envolvente. Reutiliza el estilo de
// toggle del resto de módulos (toggle-switch/switch/slider). Exp = rampas logarítmicas (como
// un sinte analógico); Lin = rampas rectas.
const CurveToggle: React.FC<CurveToggleProps> = ({ curve, setCurve }) => (
  <div className="toggle-switch curve-toggle">
    <label className="switch">
      <input
        type="checkbox"
        checked={curve === 'exponential'}
        onChange={(e) => setCurve(e.target.checked ? 'exponential' : 'linear')}
        aria-label="Curva de la envolvente"
      />
      <span className="slider"></span>
    </label>
    <span className="toggle-label">{curve === 'exponential' ? 'Exp' : 'Lin'}</span>
  </div>
);

export default CurveToggle;
