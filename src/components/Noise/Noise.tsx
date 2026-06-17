import React from 'react';
import type { NoiseType } from '../../audio/useSynthEngine';
import './Noise.css';

interface NoiseProps {
  noiseType: NoiseType;
  setNoiseType: (type: NoiseType) => void;
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  filterEnabled: boolean;
  setFilterEnabled: (enabled: boolean) => void;
  filterFreq: number;
  setFilterFreq: (freq: number) => void;
}

const NOISE_TYPES: { value: NoiseType; label: string }[] = [
  { value: 'white', label: 'Blanco' },
  { value: 'pink', label: 'Rosa' },
  { value: 'brown', label: 'Marrón' },
];

// Generador de ruido. Tipo y on/off; su NIVEL vive en el mixer del VCA (fader "Ruido") y
// es un destino modulable en la matriz de CV (noiseLevel).
const Noise: React.FC<NoiseProps> = ({
  noiseType,
  setNoiseType,
  enabled,
  setEnabled,
  filterEnabled,
  setFilterEnabled,
  filterFreq,
  setFilterFreq,
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

        {/* Filtro pasabanda a la salida del ruido */}
        <div className="control-group">
          <label className="checkbox-option">
            <input
              type="checkbox"
              checked={filterEnabled}
              disabled={!enabled}
              onChange={(e) => setFilterEnabled(e.target.checked)}
            />
            Filtro pasabanda
          </label>
          <input
            type="range"
            id="noise-filter-freq"
            min="20"
            max="20000"
            step="1"
            value={filterFreq}
            onChange={(e) => setFilterFreq(parseFloat(e.target.value))}
            className="control-slider"
            disabled={!enabled || !filterEnabled}
          />
          <span className="noise-filter-value">{filterFreq.toFixed(0)} Hz</span>
        </div>
      </div>
    </div>
  );
};

export default Noise;
