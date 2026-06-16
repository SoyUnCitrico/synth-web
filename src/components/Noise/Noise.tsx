import React from 'react';
import type { NoiseType } from '../../audio/useSynthEngine';
import './Noise.css';

interface NoiseProps {
  noiseType: NoiseType;
  setNoiseType: (type: NoiseType) => void;
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  level: number; // dB
  setLevel: (value: number) => void;
}

const NOISE_TYPES: { value: NoiseType; label: string }[] = [
  { value: 'white', label: 'Blanco' },
  { value: 'pink', label: 'Rosa' },
  { value: 'brown', label: 'Marrón' },
];

// Generador de ruido como módulo propio. Su nivel (canal del mixer) es un destino
// modulable en la matriz de CV (noiseLevel).
const Noise: React.FC<NoiseProps> = ({
  noiseType,
  setNoiseType,
  enabled,
  setEnabled,
  level,
  setLevel,
}) => {
  return (
    <div className="module noise-module">
      <div className="module-header">
        <h2>Ruido</h2>
        <div className="toggle-switch">
          <label className="switch">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <span className="slider"></span>
          </label>
          <span className="toggle-label">{enabled ? 'ON' : 'OFF'}</span>
        </div>
      </div>

      <div className={`module-controls ${!enabled ? 'disabled' : ''}`}>
        <div className="control-group">
          <label>Tipo</label>
          <div className={`checkbox-group ${!enabled ? 'disabled' : ''}`}>
            {NOISE_TYPES.map((type) => (
              <label key={type.value} className="checkbox-option">
                <input
                  type="checkbox"
                  checked={noiseType === type.value}
                  disabled={!enabled}
                  onChange={() => setNoiseType(type.value)}
                />
                {type.label}
              </label>
            ))}
          </div>
        </div>

        <div className="control-group">
          <label htmlFor="noise-level">Nivel: {level.toFixed(1)} dB</label>
          <input
            type="range"
            id="noise-level"
            min="-40"
            max="6"
            step="0.5"
            value={level}
            onChange={(e) => setLevel(parseFloat(e.target.value))}
            className="control-slider"
            disabled={!enabled}
          />
        </div>
      </div>
    </div>
  );
};

export default Noise;
