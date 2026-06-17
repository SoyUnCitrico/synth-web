import React from 'react';
import {
  PITCH_RANGE,
  SEQ_ROOT_MIDI,
  MAX_STEPS,
  CLOCK_OPTIONS,
  type SeqConfig,
  type SeqDirection,
  type PitchStep,
  type CvStep,
} from '../../audio/sequencer/types';
import './Sequencer.css';

interface SequencerProps {
  configs: SeqConfig[];
  setConfigs: React.Dispatch<React.SetStateAction<SeqConfig[]>>;
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
  cv3Steps: CvStep[];
  setCv3Steps: React.Dispatch<React.SetStateAction<CvStep[]>>;
  currentSteps: number[];
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

// Controles por secuenciador: nº de pasos (slider 0-32), dirección y reloj (los seq 2-4
// con divisor/multiplicador relativo al seq 1, que es la base).
const SeqControls: React.FC<{
  index: number;
  config: SeqConfig;
  onChange: (patch: Partial<SeqConfig>) => void;
}> = ({ index, config, onChange }) => (
  <div className="seq-config">
    <div className="control-group seq-steps-ctl">
      <label htmlFor={`seq-${index}-steps`}>Pasos: {config.steps}</label>
      <input
        type="range"
        id={`seq-${index}-steps`}
        min={0}
        max={MAX_STEPS}
        step={1}
        value={config.steps}
        onChange={(e) => onChange({ steps: parseInt(e.target.value, 10) })}
        className="control-slider"
      />
    </div>
    <div className="control-group">
      <label htmlFor={`seq-${index}-dir`}>Dirección</label>
      <select
        id={`seq-${index}-dir`}
        className="control-select"
        value={config.direction}
        onChange={(e) => onChange({ direction: e.target.value as SeqDirection })}
      >
        {DIRECTIONS.map((d) => (
          <option key={d.value} value={d.value}>
            {d.label}
          </option>
        ))}
      </select>
    </div>
    <div className="control-group">
      <label htmlFor={`seq-${index}-clock`}>Reloj</label>
      {index === 0 ? (
        <span className="seq-clock-base">×1 · base</span>
      ) : (
        <select
          id={`seq-${index}-clock`}
          className="control-select"
          value={config.clock}
          onChange={(e) => onChange({ clock: e.target.value })}
        >
          {CLOCK_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      )}
    </div>
  </div>
);

const Sequencer: React.FC<SequencerProps> = ({
  configs,
  setConfigs,
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
  cv3Steps,
  setCv3Steps,
  currentSteps,
}) => {
  const updateConfig = (i: number, patch: Partial<SeqConfig>) =>
    setConfigs((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  const updatePitch = (i: number, patch: Partial<PitchStep>) =>
    setPitchSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  // Editores de los tres secuenciadores de CV (2, 3, 4).
  const cvData = [
    { steps: cvSteps, setSteps: setCvSteps },
    { steps: cv2Steps, setSteps: setCv2Steps },
    { steps: cv3Steps, setSteps: setCv3Steps },
  ];
  const updateCv = (which: number, i: number, patch: Partial<CvStep>) =>
    cvData[which].setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

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

        {/* Secuenciador 1: pitch (reloj base). */}
        <div className="seq-channel">
          <span className="seq-channel-title">Seq 1 · Pitch (base)</span>
          <SeqControls index={0} config={configs[0]} onChange={(p) => updateConfig(0, p)} />
          <SliderLane
            label="Nota"
            values={pitchSteps.map((s) => s.offset)}
            count={configs[0].steps}
            currentStep={currentSteps[0]}
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
            count={configs[0].steps}
            currentStep={currentSteps[0]}
            min={0}
            max={1}
            step={0.01}
            onChange={(i, v) => updatePitch(i, { velocity: v })}
          />
          <SliderLane
            label="Gate"
            values={pitchSteps.map((s) => s.gateLen)}
            count={configs[0].steps}
            currentStep={currentSteps[0]}
            min={0.05}
            max={1}
            step={0.01}
            onChange={(i, v) => updatePitch(i, { gateLen: v })}
          />
          <GateLane
            label="On"
            gates={pitchSteps.map((s) => s.gate)}
            count={configs[0].steps}
            currentStep={currentSteps[0]}
            onToggle={(i) => updatePitch(i, { gate: !pitchSteps[i].gate })}
          />
        </div>

        {/* Secuenciadores 2-4: CV + gate. Sin Vel. */}
        {cvData.map((cv, which) => {
          const seqIndex = which + 1;
          return (
            <div className="seq-channel" key={seqIndex}>
              <span className="seq-channel-title">{`Seq ${seqIndex + 1} · CV`}</span>
              <SeqControls
                index={seqIndex}
                config={configs[seqIndex]}
                onChange={(p) => updateConfig(seqIndex, p)}
              />
              <SliderLane
                label="CV"
                values={cv.steps.map((s) => s.value)}
                count={configs[seqIndex].steps}
                currentStep={currentSteps[seqIndex]}
                min={0}
                max={1}
                step={0.01}
                tall
                valueLabel={(v) => `${(v * 100).toFixed(0)}`}
                onChange={(i, v) => updateCv(which, i, { value: v })}
              />
              <SliderLane
                label="Gate"
                values={cv.steps.map((s) => s.gateLen)}
                count={configs[seqIndex].steps}
                currentStep={currentSteps[seqIndex]}
                min={0.05}
                max={1}
                step={0.01}
                onChange={(i, v) => updateCv(which, i, { gateLen: v })}
              />
              <GateLane
                label="On"
                gates={cv.steps.map((s) => s.gate)}
                count={configs[seqIndex].steps}
                currentStep={currentSteps[seqIndex]}
                onToggle={(i) => updateCv(which, i, { gate: !cv.steps[i].gate })}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Sequencer;
