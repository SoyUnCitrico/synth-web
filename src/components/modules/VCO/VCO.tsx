import React from 'react';
import * as Tone from 'tone';
import Knob from '../../Knob/Knob';
import FrequencyInput from '../../FrequencyInput/FrequencyInput';
import { OSC_FREQ_SCALE } from '../../../utils/scale';
import './VCO.css';

interface VCOProps {
  oscType: Tone.ToneOscillatorType;
  setOscType: (type: Tone.ToneOscillatorType) => void;
  frequency: number;
  setFrequency: (freq: number) => void;
  /** Afinado fino en cents (±200). Independiente por oscilador; se suma a la matriz. */
  fine: number;
  setFine: (cents: number) => void;
  isSecondary: boolean;
  enabled?: boolean;
  setEnabled?: (enabled: boolean) => void;
  pwm?: number;
  setPwm?: (value: number) => void;
  oscRef?: React.RefObject<HTMLElement | HTMLDivElement | null> | null
  label?: string;
  index?: number;
  // Modo FAT (VCO 3): unísono/súper-saw. Oculta PWM y muestra perillas de voces y spread.
  fat?: boolean;
  spread?: number;
  setSpread?: (value: number) => void;
  count?: number;
  setCount?: (value: number) => void;
  // Modo FM (VCO 4): oscilador FM. Oculta PWM y muestra perillas de armonicidad e índice.
  fm?: boolean;
  harmonicity?: number;
  setHarmonicity?: (value: number) => void;
  modIndex?: number;
  setModIndex?: (value: number) => void;
}

// Trazos SVG de cada forma de onda (viewBox 0 0 100 50). Se reutilizan para el icono
// del selector y para la pantalla de visualización.
const WAVE_PATHS: Record<string, string> = {
  sine: 'M0,25 Q25,0 50,25 T100,25',
  square: 'M0,45 L0,5 L50,5 L50,45 L100,45 L100,5',
  sawtooth: 'M0,45 L50,5 L50,45 L100,5',
  triangle: 'M0,25 L25,0 L75,50 L100,25',
};

// Formas de onda disponibles (selector único, estilo checkbox como el canal de ruido).
// `label` se usa como tooltip/accesibilidad; el control muestra un icono de la onda.
const WAVEFORMS: { value: Tone.ToneOscillatorType; label: string }[] = [
  { value: 'sine', label: 'Senoidal' },
  { value: 'square', label: 'Cuadrada' },
  { value: 'sawtooth', label: 'Sierra' },
  { value: 'triangle', label: 'Triangular' },
];

const VCO: React.FC<VCOProps> = ({
  oscType,
  setOscType,
  frequency,
  setFrequency,
  fine,
  setFine,
  isSecondary,
  enabled = true,
  setEnabled,
  pwm = 0,
  setPwm,
  // oscRef
  label,
  index,
  fat = false,
  spread = 0,
  setSpread,
  count = 1,
  setCount,
  fm = false,
  harmonicity = 1,
  setHarmonicity,
  modIndex = 0,
  setModIndex,
}) => {
  // Etiqueta e identificador (únicos) del módulo.
  const title = label ?? (isSecondary ? 'VCO 2' : 'VCO 1');
  const idSuffix = index ?? (isSecondary ? 2 : 1);

  // El módulo se deshabilita si la voz está apagada (todos los VCO tienen switch).
  const isDisabled = !enabled;

  // Manejador para activar/desactivar el oscilador secundario
  const handleEnabledChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (setEnabled) {
      setEnabled(e.target.checked);
    }
  };

  return (
    <div className={`module vco-module ${isSecondary ? 'secondary-vco' : 'primary-vco'}`}>
      <div className="module-header">
        <h2>{title}</h2>
        {setEnabled && (
          <div className="toggle-switch">
            <label className="switch">
              <input 
                type="checkbox" 
                checked={enabled}
                onChange={handleEnabledChange}
              />
              <span className="slider"></span>
            </label>
            <span className="toggle-label">{enabled ? 'ON' : 'OFF'}</span>
          </div>
        )}
      </div>
      
      <div className={`module-controls ${isDisabled ? 'disabled' : ''}`}>
        <div className="control-group">
          <label>Forma de onda</label>
          <div className={`checkbox-group ${isDisabled ? 'disabled' : ''}`}>
            {WAVEFORMS.map((wave) => (
              <label key={wave.value} className="checkbox-option" title={wave.label}>
                <input
                  type="checkbox"
                  checked={oscType === wave.value}
                  disabled={isDisabled}
                  onChange={() => setOscType(wave.value)}
                />
                <svg viewBox="0 0 100 50" className="wave-icon" role="img" aria-label={wave.label}>
                  <path d={WAVE_PATHS[wave.value]} fill="none" strokeWidth="8" />
                </svg>
              </label>
            ))}
          </div>
        </div>

        {/* PWM: sólo activo con onda cuadrada (oscilador de pulso). width 0 = 50%. Los modos
            FAT y FM no usan oscilador de pulso, así que no muestran PWM. */}
        {!fat && !fm && oscType === 'square' && (
          <div className="control-group">
            <label htmlFor={`pwm-${idSuffix}`}>PWM: {(pwm * 100).toFixed(0)}%</label>
            <input
              type="range"
              id={`pwm-${idSuffix}`}
              min="-0.95"
              max="0.95"
              step="0.01"
              value={pwm}
              onChange={(e) => setPwm?.(parseFloat(e.target.value))}
              className="control-slider"
              disabled={isDisabled}
            />
          </div>
        )}

        {/* Frecuencia base (Hz) independiente por oscilador + afinado fino (±200 cents). */}
        <div className="control-group">
          <label htmlFor={`freq-${idSuffix}`}>Frecuencia (log)</label>
          <FrequencyInput
            id={`freq-${idSuffix}`}
            value={frequency}
            onChange={setFrequency}
            min={20}
            max={8000}
            defaultValue={440}
            disabled={isDisabled}
          />
          <div className="vco-tune-knobs">
            {/* Perilla con escala logarítmica: más recorrido en graves, menos en agudos. */}
            <Knob
              label="Freq"
              value={frequency}
              scale={OSC_FREQ_SCALE}
              step={1}
              display={`${frequency.toFixed(0)} Hz`}
              onChange={setFrequency}
              disabled={isDisabled}
            />
            {/* Afinado fino: ±200 cents en pasos suaves. No entra en la matriz. */}
            <Knob
              label="Fina"
              value={fine}
              min={-200}
              max={200}
              step={1}
              display={`${fine > 0 ? '+' : ''}${fine} ct`}
              onChange={setFine}
              disabled={isDisabled}
            />
          </div>
        </div>

        {/* FAT (VCO 3): nº de voces (unísono) y separación entre ellas (spread, cents). */}
        {fat && (
          <div className="control-group">
            <label>Unísono</label>
            <div className="vco-tune-knobs">
              <Knob
                label="Voces"
                value={count}
                min={1}
                max={5}
                step={1}
                display={`${count}`}
                onChange={(v) => setCount?.(v)}
                disabled={isDisabled}
              />
              <Knob
                label="Spread"
                value={spread}
                min={0}
                max={100}
                step={1}
                display={`${spread.toFixed(0)} ct`}
                onChange={(v) => setSpread?.(v)}
                disabled={isDisabled}
              />
            </div>
          </div>
        )}

        {/* FM (VCO 4): armonicidad (razón de frecuencias) e índice de modulación (brillo). */}
        {fm && (
          <div className="control-group">
            <label>FM</label>
            <div className="vco-tune-knobs">
              <Knob
                label="Harm"
                value={harmonicity}
                min={0}
                max={8}
                step={0.01}
                display={harmonicity.toFixed(2)}
                onChange={(v) => setHarmonicity?.(v)}
                disabled={isDisabled}
              />
              <Knob
                label="Índice"
                value={modIndex}
                min={0}
                max={30}
                step={0.1}
                display={modIndex.toFixed(1)}
                onChange={(v) => setModIndex?.(v)}
                disabled={isDisabled}
              />
            </div>
          </div>
        )}

        <div className="control-display">
          <div className="waveform-display">
            <svg viewBox="0 0 100 50" className={`waveform-svg ${isDisabled ? 'disabled' : ''}`}>
              <path d={WAVE_PATHS[oscType]} fill="none" strokeWidth="2" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VCO;