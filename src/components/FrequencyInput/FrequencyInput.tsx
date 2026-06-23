import React, { useEffect, useState } from 'react';

interface FrequencyInputProps {
  /** Valor confirmado (Hz). Siempre un número válido. */
  value: number;
  /** Se llama sólo con valores finitos dentro de [min, max]. */
  onChange: (value: number) => void;
  min: number;
  max: number;
  /** Valor al que vuelve si el campo queda vacío/0/fuera del rango de audio. */
  defaultValue: number;
  id?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Input numérico de frecuencia robusto y controlado. Evita el bug en que dejar el campo vacío
 * o en 0 propagaba `NaN` al estado (y a localStorage), colgando la página.
 *
 * - Mantiene el texto en estado local para poder borrar/teclear sin empujar basura al padre.
 * - Mientras se teclea, sólo confirma (`onChange`) valores finitos dentro de [min, max].
 * - Al perder el foco, si el valor es inválido o sale del rango de audio, vuelve a `defaultValue`.
 */
const FrequencyInput: React.FC<FrequencyInputProps> = ({
  value,
  onChange,
  min,
  max,
  defaultValue,
  id,
  disabled = false,
  className = 'control-input',
}) => {
  const [text, setText] = useState(String(value));

  // Resincroniza el texto cuando el valor cambia por fuera (perilla, preset, reset).
  useEffect(() => {
    setText(String(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setText(raw);
    const v = parseFloat(raw);
    // Sólo se confirma un valor finito y dentro del rango; si no, el motor conserva el anterior.
    if (Number.isFinite(v) && v >= min && v <= max) onChange(v);
  };

  const handleBlur = () => {
    const v = parseFloat(text);
    if (!Number.isFinite(v) || v < min || v > max) {
      onChange(defaultValue);
      setText(String(defaultValue));
    } else {
      setText(String(v));
    }
  };

  return (
    <input
      type="number"
      id={id}
      className={className}
      min={min}
      max={max}
      step={1}
      value={text}
      onChange={handleChange}
      onBlur={handleBlur}
      disabled={disabled}
    />
  );
};

export default FrequencyInput;
