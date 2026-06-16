import React from 'react';
import * as Tone from 'tone';

interface LFOProps {
  lfoType: Tone.ToneOscillatorType;
  setLfoType: (type: Tone.ToneOscillatorType) => void;
  rate: number; // Hz
  setRate: (rate: number) => void;
  depth: number; // 0 a 1
  setDepth: (depth: number) => void;
  label?: string;
  id?: string;
}

// Oscilador de baja frecuencia (LFO). El destino de modulación se elige en la matriz
// de patcheo; aquí sólo se configuran su forma de onda, velocidad y profundidad.
const LFO: React.FC<LFOProps> = ({
  lfoType,
  setLfoType,
  rate,
  setRate,
  depth,
  setDepth,
  label = 'LFO',
  id = 'lfo',
}) => {
  const waveforms: Tone.ToneOscillatorType[] = ['sine', 'square', 'sawtooth', 'triangle'];

  return (
    <div className="module lfo-module">
      <div className="module-header">
        <h2>{label}</h2>
      </div>

      <div className="module-controls">
        <div className="control-group">
          <label htmlFor={`${id}-type`}>Forma de onda</label>
          <select
            id={`${id}-type`}
            value={lfoType}
            onChange={(e) => setLfoType(e.target.value as Tone.ToneOscillatorType)}
            className="control-select"
          >
            {waveforms.map((type) => (
              <option key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label htmlFor={`${id}-rate`}>Velocidad: {rate.toFixed(2)} Hz</label>
          <input
            type="range"
            id={`${id}-rate`}
            min="0.1"
            max="20"
            step="0.1"
            value={rate}
            onChange={(e) => setRate(parseFloat(e.target.value))}
            className="control-slider"
          />
        </div>

        <div className="control-group">
          <label htmlFor={`${id}-depth`}>Profundidad: {(depth * 100).toFixed(0)}%</label>
          <input
            type="range"
            id={`${id}-depth`}
            min="0"
            max="1"
            step="0.01"
            value={depth}
            onChange={(e) => setDepth(parseFloat(e.target.value))}
            className="control-slider"
          />
        </div>
      </div>
    </div>
  );
};

export default LFO;
