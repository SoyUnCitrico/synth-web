import React from 'react';
import {
  stepCount,
  PITCH_RANGE,
  SEQ_ROOT_MIDI,
  type SeqMode,
  type PitchStep,
  type CvStep,
} from '../../audio/sequencer/types';
import './Sequencer.css';

interface SequencerProps {
  mode: SeqMode;
  setMode: (mode: SeqMode) => void;
  bpm: number;
  setBpm: (bpm: number) => void;
  running: boolean;
  setRunning: (running: boolean) => void;
  pitchSteps: PitchStep[];
  setPitchSteps: React.Dispatch<React.SetStateAction<PitchStep[]>>;
  cvSteps: CvStep[];
  setCvSteps: React.Dispatch<React.SetStateAction<CvStep[]>>;
  currentStep: number;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const noteLabel = (offset: number): string => {
  const semi = SEQ_ROOT_MIDI + offset;
  return `${NOTE_NAMES[((semi % 12) + 12) % 12]}${Math.floor(semi / 12) - 1}`;
};

const Sequencer: React.FC<SequencerProps> = ({
  mode,
  setMode,
  bpm,
  setBpm,
  running,
  setRunning,
  pitchSteps,
  setPitchSteps,
  cvSteps,
  setCvSteps,
  currentStep,
}) => {
  const length = stepCount(mode);

  const updatePitch = (i: number, patch: Partial<PitchStep>) =>
    setPitchSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const updateCv = (i: number, value: number) =>
    setCvSteps((prev) => prev.map((s, idx) => (idx === i ? { value } : s)));

  return (
    <div className="module sequencer-module">
      <div className="module-header">
        <h2>Secuenciador</h2>
        <button
          className={`seq-transport ${running ? 'active' : ''}`}
          onClick={() => setRunning(!running)}
        >
          {running ? '■ Stop' : '▶ Play'}
        </button>
      </div>

      <div className="module-controls">
        <div className="seq-toolbar">
          <div className="control-group">
            <label htmlFor="seq-mode">Modo</label>
            <select
              id="seq-mode"
              className="control-select"
              value={mode}
              onChange={(e) => setMode(e.target.value as SeqMode)}
            >
              <option value="single32">1 canal · 32 pasos</option>
              <option value="dual16">2 canales · 16 pasos</option>
            </select>
          </div>
          <div className="control-group">
            <label htmlFor="seq-bpm">Tempo: {bpm} BPM</label>
            <input
              type="range"
              id="seq-bpm"
              min="40"
              max="240"
              step="1"
              value={bpm}
              onChange={(e) => setBpm(parseInt(e.target.value, 10))}
              className="control-slider"
            />
          </div>
        </div>

        {/* Canal de pitch */}
        <div className="seq-lane">
          <span className="seq-lane-label">Pitch</span>
          <div className="seq-steps">
            {pitchSteps.slice(0, length).map((step, i) => (
              <div key={i} className={`seq-step ${currentStep === i ? 'playing' : ''}`}>
                <span className="seq-note">{noteLabel(step.offset)}</span>
                <input
                  type="range"
                  className="control-slider vertical"
                  min="0"
                  max={PITCH_RANGE}
                  step="1"
                  value={step.offset}
                  onChange={(e) => updatePitch(i, { offset: parseInt(e.target.value, 10) })}
                  aria-label={`Paso ${i + 1} nota`}
                />
                <button
                  className={`seq-gate ${step.gate ? 'on' : ''}`}
                  onClick={() => updatePitch(i, { gate: !step.gate })}
                  aria-label={`Paso ${i + 1} compuerta`}
                  aria-pressed={step.gate}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Canal de CV (sólo en 2×16) → fuente "Seq CV" de la matriz */}
        {mode === 'dual16' && (
          <div className="seq-lane">
            <span className="seq-lane-label">CV</span>
            <div className="seq-steps">
              {cvSteps.slice(0, length).map((step, i) => (
                <div key={i} className={`seq-step ${currentStep === i ? 'playing' : ''}`}>
                  <span className="seq-note">{(step.value * 100).toFixed(0)}</span>
                  <input
                    type="range"
                    className="control-slider vertical"
                    min="0"
                    max="1"
                    step="0.01"
                    value={step.value}
                    onChange={(e) => updateCv(i, parseFloat(e.target.value))}
                    aria-label={`Paso ${i + 1} CV`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sequencer;
