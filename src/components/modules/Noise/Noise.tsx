import React from 'react';
import type { NoiseType } from '../../../audio/useSynthEngine';
import Knob from '../../Knob/Knob';
import { AUDIO_FREQ_SCALE } from '../../../utils/scale';
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
  filterRes: number;
  setFilterRes: (res: number) => void;
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
  filterRes,
  setFilterRes,
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
      <div className={`module-controls row ${!enabled ? 'disabled' : ''}`}>
        <div className="control-group noise-group">
          <label>Tipo</label>
          <div className={`checkbox-group vertical ${!enabled ? 'disabled' : ''}`}>
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
          <div className="noise-filter-knobs">
            {/* Perilla con escala logarítmica (20 Hz – 20 kHz) para el centro del pasabanda. */}
            <Knob
              label="Centro"
              value={filterFreq}
              scale={AUDIO_FREQ_SCALE}
              step={1}
              display={`${filterFreq.toFixed(0)} Hz`}
              onChange={setFilterFreq}
              disabled={!enabled || !filterEnabled}
            />
            {/* Resonancia (Q) del pasabanda. Control directo, fuera de la matriz. */}
            <Knob
              label="Reso"
              value={filterRes}
              min={0.1}
              max={20}
              step={0.1}
              display={filterRes.toFixed(1)}
              onChange={setFilterRes}
              disabled={!enabled || !filterEnabled}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Noise;
