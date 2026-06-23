import React, { useEffect, useRef } from 'react';
import { useMidiLearn } from '../../audio/midi/MidiLearnContext';

interface FaderProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string; // valor ya formateado para mostrar
  onChange: (value: number) => void;
  isMaster?: boolean; // para estilos específicos del master
  /** Id estable para MIDI-learn directo (opcional; solo activo bajo MidiLearnProvider). */
  midiId?: string;
}

// Fader vertical reutilizable (banco de deslizadores ADSR / mixer). Soporta MIDI-learn directo:
// con `midiId` y un MidiLearnProvider activo, en modo aprendizaje un clic lo ARMA; el CC asignado
// lo mueve por posición lineal min..max.
const Fader: React.FC<FaderProps> = ({ id, label, value, min, max, step, display, onChange, isMaster = false, midiId }) => {
  const midi = useMidiLearn();
  const learnable = midi.active && !!midiId;
  const armed = learnable && midi.armedId === midiId;
  const cc = learnable ? midi.ccFor(midiId!) : null;

  // Aplicador por ref (siempre la última `onChange`) para registrar una sola vez.
  const applyRef = useRef<(norm: number) => void>(() => {});
  applyRef.current = (norm: number) => {
    const v = min + (max - min) * norm;
    const q = step ? Math.round(v / step) * step : v;
    onChange(Math.min(max, Math.max(min, q)));
  };
  useEffect(() => {
    if (!learnable || !midiId) return;
    return midi.register(midiId, (norm) => applyRef.current(norm));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [learnable, midiId, midi.register]);

  const onPointerDownCapture = (e: React.PointerEvent) => {
    if (learnable && midi.learnMode) {
      e.preventDefault();
      e.stopPropagation();
      midi.arm(midiId!);
    }
  };

  return (
    <div className={`fader ${armed ? 'midi-armed' : ''} ${cc != null ? 'midi-assigned' : ''}`}>
      <span className={`fader-name ${isMaster ? 'master' : ''}`}>{label}</span>
      <input
        type="range"
        id={id}
        className={`control-slider vertical ${isMaster ? 'master' : ''}`}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        onPointerDownCapture={onPointerDownCapture}
      />
      <span className="fader-value">{display}</span>
      {cc != null && <span className="midi-cc-badge">CC{cc}</span>}
    </div>
  );
};

export default Fader;
