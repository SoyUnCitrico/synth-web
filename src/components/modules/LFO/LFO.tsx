import React from 'react';
import * as Tone from 'tone';
import Knob from '../../Knob/Knob';
import { LFO_RATE_SCALE } from '../../../utils/scale';
import './LFO.css';

interface LFOProps {
  lfoType: Tone.ToneOscillatorType;
  setLfoType: (type: Tone.ToneOscillatorType) => void;
  rate: number; // Hz
  setRate: (rate: number) => void;
  depth: number; // -1 a 1 (bipolar: ± = sube/baja desde el valor base)
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
      <div className="module-header lfo-header">
        <h2>{label}</h2>
      </div>

      <div className="module-controls">
        <div className="control-group lfo-controls">
            <div>
              <label className="control-label lfo-type" htmlFor={`${id}-type`}>
                Onda
              </label>
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
            <div>
               {/* <label htmlFor={`${id}-rate`}>Velocidad</label> */}
              {/* Perilla con escala logarítmica: más resolución en velocidades lentas. */}
              <Knob
                id={`${id}-rate`}
                label="Velocidad"
                value={rate}
                scale={LFO_RATE_SCALE}
                step={0.01}
                display={`${rate.toFixed(2)} Hz`}
                onChange={setRate}
                midiId={`${id}-rate`}
              />
            </div>

            <div>
                {/* <label>Profundidad</label> */}
                  {/* Profundidad bipolar como perilla: -100% (resta del base) … +100% (suma al base). */}
                  <Knob
                    id={`${id}-depth`}
                    label="Profundidad"
                    value={depth}
                    min={-1}
                    max={1}
                    step={0.01}
                    display={`${(depth * 100).toFixed(0)}%`}
                    onChange={setDepth}
                    midiId={`${id}-depth`}
                  />
            </div>
        </div>
      </div>
    </div>
  );
};

export default LFO;
