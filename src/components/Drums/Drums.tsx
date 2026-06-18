import React from 'react';
import Knob from '../Knob/Knob';
import { DRUM_LABELS } from '../../audio/drums/kit';
import {
  MAX_STEPS,
  CLOCK_OPTIONS,
  type SeqConfig,
  type SeqDirection,
  type DrumStep,
} from '../../audio/sequencer/types';
import './Drums.css';

interface DrumsProps {
  pitch: number[];
  setPitch: (i: number, v: number) => void;
  decay: number[];
  setDecay: (i: number, v: number) => void;
  vol: number[];
  setVol: (i: number, v: number) => void;
  revSends: number[];
  setRevSend: (i: number, v: number) => void;
  delSends: number[];
  setDelSend: (i: number, v: number) => void;
  configs: SeqConfig[];
  setConfig: (i: number, patch: Partial<SeqConfig>) => void;
  steps: DrumStep[][];
  toggleStep: (voice: number, step: number) => void;
  currentSteps: number[];
  onLoadSample: (voice: number, file: File) => void;
  // Efectos propios de la batería (independientes del sinte).
  reverbDecay: number;
  setReverbDecay: (v: number) => void;
  delayTime: number;
  setDelayTime: (v: number) => void;
  delayFeedback: number;
  setDelayFeedback: (v: number) => void;
}

const DIRECTIONS: { value: SeqDirection; label: string }[] = [
  { value: 'forward', label: '→' },
  { value: 'reverse', label: '←' },
  { value: 'pingpong', label: '↔' },
];

// Marcador de compás: cada 8 pasos ('bar') y cada 4 ('beat').
const stepMarker = (i: number): string => (i % 8 === 0 ? 'bar' : i % 4 === 0 ? 'beat' : '');

const Drums: React.FC<DrumsProps> = ({
  pitch,
  setPitch,
  decay,
  setDecay,
  vol,
  setVol,
  revSends,
  setRevSend,
  delSends,
  setDelSend,
  configs,
  setConfig,
  steps,
  toggleStep,
  currentSteps,
  onLoadSample,
  reverbDecay,
  setReverbDecay,
  delayTime,
  setDelayTime,
  delayFeedback,
  setDelayFeedback,
}) => {
  return (
    <div className="module drums-module">
      <div className="module-header">
        <h2>Batería</h2>
      </div>
      <div className="module-controls">
        {/* Efectos propios de la batería (independientes de los del sinte). */}
        <div className="drum-fx">
          <span className="drum-fx-title">FX batería</span>
          <label className="drum-cfg-item">
            Reverb decay: {reverbDecay.toFixed(2)}s
            <input
              type="range" min={0.1} max={10} step={0.1} value={reverbDecay}
              className="control-slider"
              onChange={(e) => setReverbDecay(parseFloat(e.target.value))}
            />
          </label>
          <label className="drum-cfg-item">
            Delay: {(delayTime * 1000).toFixed(0)} ms
            <input
              type="range" min={0.01} max={1} step={0.01} value={delayTime}
              className="control-slider"
              onChange={(e) => setDelayTime(parseFloat(e.target.value))}
            />
          </label>
          <label className="drum-cfg-item">
            Feedback: {(delayFeedback * 100).toFixed(0)}%
            <input
              type="range" min={0} max={0.95} step={0.01} value={delayFeedback}
              className="control-slider"
              onChange={(e) => setDelayFeedback(parseFloat(e.target.value))}
            />
          </label>
        </div>

        {DRUM_LABELS.map((label, v) => {
          const cfg = configs[v];
          const voiceSteps = steps[v] ?? [];
          return (
            <div className="drum-voice" key={label}>
              <div className="drum-voice-top">
                <span className="drum-voice-name">{label}</span>
                <label className="drum-load" title="Cargar sample propio">
                  ⬆ Sample
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onLoadSample(v, f);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>

              <div className="drum-voice-row">
                <div className="drum-controls">
                <Knob
                  label="Pitch" value={pitch[v] ?? 1} min={0.25} max={4} step={0.01}
                  display={`×${(pitch[v] ?? 1).toFixed(2)}`} onChange={(x) => setPitch(v, x)}
                />
                <Knob
                  label="Decay" value={decay[v] ?? 0.3} min={0.02} max={1} step={0.01}
                  display={`${((decay[v] ?? 0.3) * 1000).toFixed(0)}ms`} onChange={(x) => setDecay(v, x)}
                />
                <Knob
                  label="Vol" value={vol[v] ?? 0} min={-40} max={6} step={0.5}
                  display={(vol[v] ?? 0) <= -40 ? 'Mute' : `${(vol[v] ?? 0).toFixed(0)}`} onChange={(x) => setVol(v, x)}
                />
                <Knob
                  label="Rev" value={revSends[v] ?? 0} min={0} max={1} step={0.01}
                  display={`${((revSends[v] ?? 0) * 100).toFixed(0)}%`} onChange={(x) => setRevSend(v, x)}
                />
                <Knob
                  label="Dly" value={delSends[v] ?? 0} min={0} max={1} step={0.01}
                  display={`${((delSends[v] ?? 0) * 100).toFixed(0)}%`} onChange={(x) => setDelSend(v, x)}
                />
                </div>

                <div className="drum-seq-inputs">
                  <div className="drum-seq-config">
                    <label className="drum-cfg-item">
                      Pasos: {cfg.steps}
                      <input
                        type="range" min={0} max={MAX_STEPS} step={1} value={cfg.steps}
                        className="control-slider"
                        onChange={(e) => setConfig(v, { steps: parseInt(e.target.value, 10) })}
                      />
                    </label>
                    <select
                      className="control-select"
                      value={cfg.clock}
                      aria-label="Reloj"
                      onChange={(e) => setConfig(v, { clock: e.target.value })}
                    >
                      {CLOCK_OPTIONS.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                    <select
                      className="control-select"
                      value={cfg.direction}
                      aria-label="Dirección"
                      onChange={(e) => setConfig(v, { direction: e.target.value as SeqDirection })}
                    >
                      {DIRECTIONS.map((d) => (
                        <option key={d.value} value={d.value}>{d.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="seq-steps">
                    {voiceSteps.slice(0, cfg.steps).map((s, i) => (
                      <div key={i} className={`seq-step ${stepMarker(i)} ${currentSteps[v] === i ? 'playing' : ''}`}>
                        <button
                          className={`seq-gate ${s.gate ? 'on' : ''}`}
                          onClick={() => toggleStep(v, i)}
                          aria-label={`${label} paso ${i + 1}`}
                          aria-pressed={s.gate}
                        />
                      </div> 
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Drums;
