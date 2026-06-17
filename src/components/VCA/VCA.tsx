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
  mixNoise: number;
  setMixNoise: (value: number) => void;
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
  mixNoise,
  setMixNoise,
}) => {
  // El extremo inferior del master (-40 dB) silencia por completo (el motor pone gain 0).
  const muted = volume <= -40;
  // Convertir dB a un valor normalizado para visualización (-40dB a +2dB → 0..1).
  const normalizedVolume = (volume + 40) / 42;

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
            <Fader
              id="mix-noise" label="Ruido" min={-40} max={6} step={0.5}
              value={mixNoise} display={`${mixNoise.toFixed(1)}`} onChange={setMixNoise}
            />
          </div>
        </div>

        <div className="master-section">
          <div className="fader-bank">
            <Fader
              id="volume" label="Master" min={-40} max={2} step={0.1}
              value={volume} display={muted ? 'Mute' : `${volume.toFixed(1)} dB`} onChange={setVolume}
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
