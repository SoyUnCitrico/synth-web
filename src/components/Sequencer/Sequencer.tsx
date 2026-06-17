import React from 'react';
import {
  PITCH_RANGE,
  SEQ_ROOT_MIDI,
  STEP_OPTIONS,
  type SeqChannels,
  type SeqDirection,
  type PitchStep,
  type CvStep,
} from '../../audio/sequencer/types';
import './Sequencer.css';

interface SequencerProps {
  channels: SeqChannels;
  setChannels: (channels: SeqChannels) => void;
  steps: number;
  setSteps: (steps: number) => void;
  direction: SeqDirection;
  setDirection: (direction: SeqDirection) => void;
  bpm: number;
  setBpm: (bpm: number) => void;
  running: boolean;
  setRunning: (running: boolean) => void;
  onReset: () => void;
  pitchSteps: PitchStep[];
  setPitchSteps: React.Dispatch<React.SetStateAction<PitchStep[]>>;
  cvSteps: CvStep[];
  setCvSteps: React.Dispatch<React.SetStateAction<CvStep[]>>;
  cv2Steps: CvStep[];
  setCv2Steps: React.Dispatch<React.SetStateAction<CvStep[]>>;
  currentStep: number;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const noteLabel = (offset: number): string => {
  const semi = SEQ_ROOT_MIDI + offset;
  return `${NOTE_NAMES[((semi % 12) + 12) % 12]}${Math.floor(semi / 12) - 1}`;
};

const DIRECTIONS: { value: SeqDirection; label: string }[] = [
  { value: 'forward', label: '→ Adelante' },
  { value: 'reverse', label: '← Reversa' },
  { value: 'pingpong', label: '↔ Ping-pong' },
];

// Marcador de compás: cada 8 pasos ('bar', acento fuerte) y cada 4 ('beat', acento suave).
const stepMarker = (i: number): string => (i % 8 === 0 ? 'bar' : i % 4 === 0 ? 'beat' : '');

// Fila de sliders verticales (una por paso). `tall` para el lane de pitch/CV.
const SliderLane: React.FC<{
  label: string;
  values: number[];
  count: number;
  currentStep: number;
  min: number;
  max: number;
  step: number;
  tall?: boolean;
  valueLabel?: (v: number) => string;
  onChange: (i: number, v: number) => void;
}> = ({ label, values, count, currentStep, min, max, step, tall, valueLabel, onChange }) => (
  <div className="seq-lane">
    <span className="seq-lane-label">{label}</span>
    <div className="seq-steps">
      {values.slice(0, count).map((v, i) => (
        <div key={i} className={`seq-step ${stepMarker(i)} ${currentStep === i ? 'playing' : ''}`}>
          {valueLabel && <span className="seq-note">{valueLabel(v)}</span>}
          <input
            type="range"
            className={`control-slider vertical ${tall ? '' : 'short'}`}
            min={min}
            max={max}
            step={step}
            value={v}
            onChange={(e) => onChange(i, parseFloat(e.target.value))}
            aria-label={`${label} paso ${i + 1}`}
          />
        </div>
      ))}
    </div>
  </div>
);

// Fila de botones de compuerta (uno por paso).
const GateLane: React.FC<{
  label: string;
  gates: boolean[];
  count: number;
  currentStep: number;
  onToggle: (i: number) => void;
}> = ({ label, gates, count, currentStep, onToggle }) => (
  <div className="seq-lane">
    <span className="seq-lane-label">{label}</span>
    <div className="seq-steps">
      {gates.slice(0, count).map((on, i) => (
        <div key={i} className={`seq-step ${stepMarker(i)} ${currentStep === i ? 'playing' : ''}`}>
          <button
            className={`seq-gate ${on ? 'on' : ''}`}
            onClick={() => onToggle(i)}
            aria-label={`Compuerta paso ${i + 1}`}
            aria-pressed={on}
          />
        </div>
      ))}
    </div>
  </div>
);

const Sequencer: React.FC<SequencerProps> = ({
  channels,
  setChannels,
  steps,
  setSteps,
  direction,
  setDirection,
  bpm,
  setBpm,
  running,
  setRunning,
  onReset,
  pitchSteps,
  setPitchSteps,
  cvSteps,
  setCvSteps,
  cv2Steps,
  setCv2Steps,
  currentStep,
}) => {
  const updatePitch = (i: number, patch: Partial<PitchStep>) =>
    setPitchSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const updateCv = (i: number, patch: Partial<CvStep>) =>
    setCvSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const updateCv2 = (i: number, patch: Partial<CvStep>) =>
    setCv2Steps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  return (
    <div className="module sequencer-module">
      <div className="module-header">
        <h2>Secuenciador</h2>
        <div className="seq-header-controls">
          <button className="seq-btn seq-btn-warning" onClick={onReset}>
            ⟲ RST
          </button>
          <button
            className={`seq-btn seq-transport ${running ? 'active' : ''}`}
            onClick={() => setRunning(!running)}
          >
            {running ? '■ STOP' : '▶ PLAY'}
          </button>
        </div>
      </div>

      <div className="module-controls">
        <div className="seq-toolbar">
          <div className="control-group">
            <label htmlFor="seq-channels">Canales</label>
            <select
              id="seq-channels"
              className="control-select"
              value={channels}
              onChange={(e) => setChannels(parseInt(e.target.value, 10) as SeqChannels)}
            >
              <option value={1}>1 canal</option>
              <option value={2}>2 canales</option>
              <option value={3}>3 canales</option>
            </select>
          </div>
          <div className="control-group">
            <label htmlFor="seq-steps">Pasos</label>
            <select
              id="seq-steps"
              className="control-select"
              value={steps}
              onChange={(e) => setSteps(parseInt(e.target.value, 10))}
            >
              {STEP_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="control-group">
            <label htmlFor="seq-dir">Dirección</label>
            <select
              id="seq-dir"
              className="control-select"
              value={direction}
              onChange={(e) => setDirection(e.target.value as SeqDirection)}
            >
              {DIRECTIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
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

        {/* Canal 1: pitch */}
        <div className="seq-channel">
          <span className="seq-channel-title">Canal 1 · Pitch</span>
          <SliderLane
            label="Nota"
            values={pitchSteps.map((s) => s.offset)}
            count={steps}
            currentStep={currentStep}
            min={0}
            max={PITCH_RANGE}
            step={1}
            tall
            valueLabel={(v) => noteLabel(v)}
            onChange={(i, v) => updatePitch(i, { offset: v })}
          />
          <SliderLane
            label="Vel"
            values={pitchSteps.map((s) => s.velocity)}
            count={steps}
            currentStep={currentStep}
            min={0}
            max={1}
            step={0.01}
            onChange={(i, v) => updatePitch(i, { velocity: v })}
          />
          <SliderLane
            label="Gate"
            values={pitchSteps.map((s) => s.gateLen)}
            count={steps}
            currentStep={currentStep}
            min={0.05}
            max={1}
            step={0.01}
            onChange={(i, v) => updatePitch(i, { gateLen: v })}
          />
          <GateLane
            label="On"
            gates={pitchSteps.map((s) => s.gate)}
            count={steps}
            currentStep={currentStep}
            onToggle={(i) => updatePitch(i, { gate: !pitchSteps[i].gate })}
          />
        </div>

        {/* Canal 2: CV + gate (con 2 o 3 canales) → fuentes "Seq2 CV" / "Sec. 2". Sin Vel. */}
        {channels >= 2 && (
          <div className="seq-channel">
            <span className="seq-channel-title">Canal 2 · CV</span>
            <SliderLane
              label="CV"
              values={cvSteps.map((s) => s.value)}
              count={steps}
              currentStep={currentStep}
              min={0}
              max={1}
              step={0.01}
              tall
              valueLabel={(v) => `${(v * 100).toFixed(0)}`}
              onChange={(i, v) => updateCv(i, { value: v })}
            />
            <SliderLane
              label="Gate"
              values={cvSteps.map((s) => s.gateLen)}
              count={steps}
              currentStep={currentStep}
              min={0.05}
              max={1}
              step={0.01}
              onChange={(i, v) => updateCv(i, { gateLen: v })}
            />
            <GateLane
              label="On"
              gates={cvSteps.map((s) => s.gate)}
              count={steps}
              currentStep={currentStep}
              onToggle={(i) => updateCv(i, { gate: !cvSteps[i].gate })}
            />
          </div>
        )}

        {/* Canal 3: segundo CV + gate (sólo con 3 canales) → fuentes "Seq3 CV" / "Sec. 3". Sin Vel. */}
        {channels === 3 && (
          <div className="seq-channel">
            <span className="seq-channel-title">Canal 3 · CV</span>
            <SliderLane
              label="CV"
              values={cv2Steps.map((s) => s.value)}
              count={steps}
              currentStep={currentStep}
              min={0}
              max={1}
              step={0.01}
              tall
              valueLabel={(v) => `${(v * 100).toFixed(0)}`}
              onChange={(i, v) => updateCv2(i, { value: v })}
            />
            <SliderLane
              label="Gate"
              values={cv2Steps.map((s) => s.gateLen)}
              count={steps}
              currentStep={currentStep}
              min={0.05}
              max={1}
              step={0.01}
              onChange={(i, v) => updateCv2(i, { gateLen: v })}
            />
            <GateLane
              label="On"
              gates={cv2Steps.map((s) => s.gate)}
              count={steps}
              currentStep={currentStep}
              onToggle={(i) => updateCv2(i, { gate: !cv2Steps[i].gate })}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Sequencer;
