import React, { useEffect, useMemo, useRef } from 'react';
import { LinearScale, type Scale } from '../../utils/scale';
import { useMidiLearn } from '../../audio/midi/MidiLearnContext';
import './Knob.css';

interface KnobProps {
  id?: string;
  label?: string;
  value: number;
  /** Para escala lineal por defecto; ignorados si se pasa `scale`. */
  min?: number;
  max?: number;
  /** Cuantización del valor (p. ej. 1 Hz). Omitir = continuo. */
  step?: number;
  /** Mapeo posición↔valor. Por defecto lineal min..max; pásalo para log (frecuencias). */
  scale?: Scale;
  /** Valor ya formateado para la lectura bajo la perilla (opcional). */
  display?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
  /** Id estable para MIDI-learn directo (opcional; solo activo bajo MidiLearnProvider). */
  midiId?: string;
}

// Recorrido angular de la perilla (270°, hueco abajo) estilo equipo analógico.
const ANGLE_MIN = -135;
const ANGLE_MAX = 135;
// Píxeles de arrastre vertical para recorrer todo el rango (en posición 0..1).
const DRAG_RANGE_PX = 200;
// Paso de posición para las flechas del teclado.
const KEY_POS_STEP = 0.02;

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/**
 * Perilla giratoria reutilizable (parámetros continuos: cutoff, resonancia, frecuencia…).
 * Presentacional pura (`value` + `onChange`). Opera internamente en POSICIÓN 0..1 y traduce a
 * valor con `scale`, así una `LogScale` da control proporcional extendido en graves y acotado
 * en agudos. Se ajusta arrastrando en vertical o con las flechas; sólo anima `transform`.
 */
const Knob: React.FC<KnobProps> = ({
  id,
  label = "",
  value,
  min = 0,
  max = 1,
  step,
  scale,
  display,
  disabled = false,
  onChange,
  midiId,
}) => {
  const dragRef = useRef<{ startY: number; startPos: number } | null>(null);
  const resolved = useMemo<Scale>(() => scale ?? new LinearScale(min, max), [scale, min, max]);

  const position = resolved.toPosition(value);
  const angle = ANGLE_MIN + position * (ANGLE_MAX - ANGLE_MIN);

  const applyPosition = (pos: number) => {
    const v = resolved.toValue(clamp01(pos));
    const q = step ? Math.round(v / step) * step : v;
    onChange(Math.min(resolved.max, Math.max(resolved.min, q)));
  };

  // --- MIDI-learn directo ---
  const midi = useMidiLearn();
  const learnable = midi.active && !!midiId && !disabled;
  const armed = learnable && midi.armedId === midiId;
  const cc = midi.active && midiId ? midi.ccFor(midiId) : null;
  // El CC mueve la perilla por POSICIÓN 0..1 (respeta la escala log). Registro único vía ref.
  const applyRef = useRef<(norm: number) => void>(() => {});
  applyRef.current = (norm: number) => applyPosition(norm);
  useEffect(() => {
    if (!learnable || !midiId) return;
    return midi.register(midiId, (norm) => applyRef.current(norm));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [learnable, midiId, midi.register]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    if (learnable && midi.learnMode) {
      e.preventDefault();
      midi.arm(midiId!);
      return;
    }
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    dragRef.current = { startY: e.clientY, startPos: position };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    // Arrastrar hacia arriba sube el valor.
    applyPosition(d.startPos + (d.startY - e.clientY) / DRAG_RANGE_PX);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    try {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    } catch {
      /* el puntero ya se liberó */
    }
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault();
      applyPosition(position + KEY_POS_STEP);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault();
      applyPosition(position - KEY_POS_STEP);
    }
  };

  return (
    <div className={`knob-wrap ${disabled ? 'disabled' : ''} ${armed ? 'midi-armed' : ''} ${cc != null ? 'midi-assigned' : ''}`}>
      <span className="knob-name">{label}</span>
      <div
        id={id}
        className="knob"
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-valuemin={resolved.min}
        aria-valuemax={resolved.max}
        aria-valuenow={value}
        aria-disabled={disabled}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={onKeyDown}
      >
        <div className="knob-dial" style={{ transform: `rotate(${angle}deg)` }}>
          <span className="knob-indicator" />
        </div>
      </div>
      {display !== undefined && <span className="knob-value">{display}</span>}
      {cc != null && <span className="midi-cc-badge">CC{cc}</span>}
    </div>
  );
};

export default Knob;
