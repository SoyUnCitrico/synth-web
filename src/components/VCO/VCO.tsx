import React from 'react';
import * as Tone from 'tone';
import './VCO.css';

interface VCOProps {
  oscType: Tone.ToneOscillatorType;
  setOscType: (type: Tone.ToneOscillatorType) => void;
  frequency: number;
  setFrequency: (freq: number) => void;
  isSecondary: boolean;
  detune?: number;
  setDetune?: (detune: number) => void;
  enabled?: boolean;
  setEnabled?: (enabled: boolean) => void;
  pwm: number;
  setPwm: (value: number) => void;
  oscRef?: React.RefObject<HTMLElement | HTMLDivElement | null> | null
  label?: string;
  index?: number;
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
  isSecondary,
  detune = 0,
  setDetune,
  enabled = true,
  setEnabled,
  pwm,
  setPwm,
  // oscRef
  label,
  index,
}) => {
  // Etiqueta e identificador (únicos) del módulo.
  const title = label ?? (isSecondary ? 'VCO 2' : 'VCO 1');
  const idSuffix = index ?? (isSecondary ? 2 : 1);

  // El módulo se deshabilita si es secundario y está apagado.
  const isDisabled = isSecondary && !enabled;

  // Manejador para cambiar la frecuencia
  const handleFrequencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFrequency(parseFloat(e.target.value));
  };

  // Manejador para cambiar el detune (solo para VCO secundario)
  const handleDetuneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (setDetune) {
      setDetune(parseFloat(e.target.value));
    }
  };

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
        {isSecondary && setEnabled && (
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

        {/* PWM: sólo activo con onda cuadrada (oscilador de pulso). width 0 = 50%. */}
        {oscType === 'square' && (
          <div className="control-group">
            <label htmlFor={`pwm-${idSuffix}`}>PWM: {(pwm * 100).toFixed(0)}%</label>
            <input
              type="range"
              id={`pwm-${idSuffix}`}
              min="-0.95"
              max="0.95"
              step="0.01"
              value={pwm}
              onChange={(e) => setPwm(parseFloat(e.target.value))}
              className="control-slider"
              disabled={isDisabled}
            />
          </div>
        )}

        {!isSecondary && (
          <div className="control-group">
            <label htmlFor="frequency">Frecuencia: {frequency.toFixed(0)} Hz</label>
            <input 
              type="number"           
              value={frequency}
              onChange={handleFrequencyChange}
              className="control-input"
            />
            <input 
              type="range" 
              id="frequency" 
              min="20" 
              max="2000" 
              step="1" 
              value={frequency}
              onChange={handleFrequencyChange}
              className="control-slider"
            />
          </div>
        )}
        
        {isSecondary && setDetune && (
          <div className="control-group">
            <label htmlFor={`detune-${idSuffix}`}>Detune: {detune} cents</label>
            <input
              type="number"
              value={detune}
              onChange={handleDetuneChange}
              className="control-input"
              disabled={!enabled}
            />
            <input
              type="range"
              id={`detune-${idSuffix}`}
              min="-1200" 
              max="1200" 
              step="1" 
              value={detune}
              onChange={handleDetuneChange}
              className="control-slider"
              disabled={!enabled}
            />
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