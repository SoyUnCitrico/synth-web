import React from 'react';
import Fader from '../Fader/Fader';
import './VCA.css';

interface VCAProps {
  volume: number;
  setVolume: (value: number) => void;
  // Mixer: nivel por canal (dB)
  mixOsc1: number;
  setMixOsc1: (value: number) => void;
  mixOsc2: number;
  setMixOsc2: (value: number) => void;
  mixOsc3: number;
  setMixOsc3: (value: number) => void;
}

export const VCA: React.FC<VCAProps> = ({
  volume,
  setVolume,
  mixOsc1,
  setMixOsc1,
  mixOsc2,
  setMixOsc2,
  mixOsc3,
  setMixOsc3,
}) => {
  // Convertir dB a un valor normalizado para visualización
  const normalizedVolume = (volume + 30) / 32; // -30dB a +10dB normalizado de 0 a 1

  return (
    <div className="module vca-module">
      <div className="module-header">
        <h2>VCA</h2>
      </div>
      <div className="module-controls">
        <div className="mixer">
          <span className="mixer-title">Mixer</span>
          <div className="fader-bank">
            <Fader
              id="mix-osc1" label="VCO 1" min={-40} max={6} step={0.5}
              value={mixOsc1} display={`${mixOsc1.toFixed(1)}`} onChange={setMixOsc1}
            />
            <Fader
              id="mix-osc2" label="VCO 2" min={-40} max={6} step={0.5}
              value={mixOsc2} display={`${mixOsc2.toFixed(1)}`} onChange={setMixOsc2}
            />
            <Fader
              id="mix-osc3" label="VCO 3" min={-40} max={6} step={0.5}
              value={mixOsc3} display={`${mixOsc3.toFixed(1)}`} onChange={setMixOsc3}
            />
          </div>
        </div>

        <div className="master-section">
          <div className="fader-bank">
            <Fader
              id="volume" label="Master" min={-30} max={2} step={0.1}
              value={volume} display={`${volume.toFixed(1)} dB`} onChange={setVolume}
            />
            <div className="volume-display">
              <div className="volume-meter">
                <div
                  className="volume-level"
                  style={{ height: `${normalizedVolume * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
