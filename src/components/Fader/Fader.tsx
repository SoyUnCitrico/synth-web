import React from 'react';

interface FaderProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string; // valor ya formateado para mostrar
  onChange: (value: number) => void;
  isMaster?: boolean; // para estilos específicos del master
}

// Fader vertical reutilizable (banco de deslizadores ADSR / mixer).
const Fader: React.FC<FaderProps> = ({ id, label, value, min, max, step, display, onChange, isMaster = false }) => (
  <div className={`fader `}>
    <span className={`fader-name ${isMaster ? 'master' : ''}`}>{label}</span>
    <input
      type="range"
      id={id}
      className={`control-slider vertical ${isMaster ? 'master' : ''}`}
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
    />
    <span className="fader-value">{display}</span>
  </div>
);

export default Fader;
