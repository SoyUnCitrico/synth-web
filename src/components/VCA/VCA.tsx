import React from 'react';
import Fader from '../Fader/Fader';
import Knob from '../Knob/Knob';
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
  // Mute/solo por canal (índice 0..3 = VCO1, VCO2, VCO3, Ruido)
  mutes: boolean[];
  onToggleMute: (i: number) => void;
  solos: boolean[];
  onToggleSolo: (i: number) => void;
  // Envíos por canal hacia los efectos (0..1)
  reverbSends: number[];
  onReverbSend: (i: number, v: number) => void;
  reverbSendEnabled: boolean;
  onToggleReverbSend: () => void;
  delaySends: number[];
  onDelaySend: (i: number, v: number) => void;
  delaySendEnabled: boolean;
  onToggleDelaySend: () => void;
}

const CHANNEL_LABELS = ['VCO 1', 'VCO 2', 'VCO 3', 'Ruido'];

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
  mutes,
  onToggleMute,
  solos,
  onToggleSolo,
  reverbSends,
  onReverbSend,
  reverbSendEnabled,
  onToggleReverbSend,
  delaySends,
  onDelaySend,
  delaySendEnabled,
  onToggleDelaySend,
}) => {
  // El extremo inferior del master (-40 dB) silencia por completo (el motor pone gain 0).
  const muted = volume <= -40;
  // Convertir dB a un valor normalizado para visualización (-40dB a +2dB → 0..1).
  const normalizedVolume = (volume + 40) / 42;

  const channels = [
    { mix: mixOsc1, setMix: setMixOsc1 },
    { mix: mixOsc2, setMix: setMixOsc2 },
    { mix: mixOsc3, setMix: setMixOsc3 },
    { mix: mixNoise, setMix: setMixNoise },
  ];

  // Una columna de envío (reverb/delay): checkbox de activación + una perilla por canal.
  const sendRow = (
    label: string,
    enabled: boolean,
    onToggle: () => void,
    sends: number[],
    onSend: (i: number, v: number) => void,
  ) => (
    <div className="send-row">
      <label className="send-enable checkbox-option">
        <input type="checkbox" checked={enabled} onChange={onToggle} />
        {label}
      </label>
      <div className="send-knobs">
        {CHANNEL_LABELS.map((c, i) => (
          <Knob
            key={c}
            label={c}
            value={sends[i] ?? 0}
            min={0}
            max={1}
            step={0.01}
            display={`${((sends[i] ?? 0) * 100).toFixed(0)}%`}
            onChange={(v) => onSend(i, v)}
            disabled={!enabled}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div className="module vca-module">
      <div className="module-header">
        <h2>MIXER</h2>
      </div>
      <div className="module-controls row big">
        <div className="mixer">
          <span className="mixer-title">VCA</span>
          <div className="mixer-strips">
            {channels.map((ch, i) => (
              <div className="mixer-strip" key={CHANNEL_LABELS[i]}>
                <Fader
                  id={`mix-${i}`}
                  label={CHANNEL_LABELS[i]}
                  min={-40}
                  max={6}
                  step={0.5}
                  value={ch.mix}
                  display={`${ch.mix.toFixed(1)}`}
                  onChange={ch.setMix}
                />
                <div className="mixer-ms">
                  <label className={`ms-btn mute ${mutes[i] ? 'on' : ''}`}>
                    <input type="checkbox" checked={mutes[i] ?? false} onChange={() => onToggleMute(i)} />
                    M
                  </label>
                  <label className={`ms-btn solo ${solos[i] ? 'on' : ''}`}>
                    <input type="checkbox" checked={solos[i] ?? false} onChange={() => onToggleSolo(i)} />
                    S
                  </label>
                </div>
              </div>
            ))}
          </div>

  
        </div>
        <div className="sends">
          {sendRow('Reverb', reverbSendEnabled, onToggleReverbSend, reverbSends, onReverbSend)}
          {sendRow('Delay', delaySendEnabled, onToggleDelaySend, delaySends, onDelaySend)}
        </div>
        <div className="master-section">

          <div className="fader-bank">
            <Fader
              id="volume" label="Master" min={-40} max={2} step={0.1} isMaster
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
