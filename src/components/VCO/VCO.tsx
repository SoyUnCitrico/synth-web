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
}

export const VCO: React.FC<VCOProps> = ({ 
  oscType, 
  setOscType, 
  frequency, 
  setFrequency,
  isSecondary,
  detune = 0,
  setDetune,
  enabled = true,
  setEnabled
}) => {
  // Tipos de osciladores disponibles
  const oscillatorTypes: Tone.ToneOscillatorType[] = ['sine', 'square', 'sawtooth', 'triangle'];
  
  // Manejador para cambiar el tipo de oscilador
  const handleOscTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setOscType(e.target.value as Tone.ToneOscillatorType);
  };
  
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
        <h2>{isSecondary ? 'VCO 2' : 'VCO 1'}</h2>
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
      
      <div className={`module-controls ${isSecondary && !enabled ? 'disabled' : ''}`}>
        <div className="control-group">
          <label htmlFor={`osc-type-${isSecondary ? '2' : '1'}`}>Forma de onda</label>
          <select 
            id={`osc-type-${isSecondary ? '2' : '1'}`}
            value={oscType}
            onChange={handleOscTypeChange}
            className="control-select"
            disabled={isSecondary && !enabled}
          >
            {oscillatorTypes.map(type => (
              <option key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
        </div>
        
        {!isSecondary && (
          <div className="control-group">
            <label htmlFor="frequency">Frecuencia: {frequency.toFixed(0)} Hz</label>
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
            <label htmlFor="detune">Detune: {detune} cents</label>
            <input 
              type="range" 
              id="detune" 
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
            <svg viewBox="0 0 100 50" className={`waveform-svg ${isSecondary && !enabled ? 'disabled' : ''}`}>
              {oscType === 'sine' && (
                <path 
                  d="M0,25 Q25,0 50,25 T100,25" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2"
                />
              )}
              {oscType === 'square' && (
                <path 
                  d="M0,45 L0,5 L50,5 L50,45 L100,45 L100,5" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2"
                />
              )}
              {oscType === 'sawtooth' && (
                <path 
                  d="M0,45 L50,5 L50,45 L100,5" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2"
                />
              )}
              {oscType === 'triangle' && (
                <path 
                  d="M0,45 L25,5 L75,45 L100,5" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2"
                />
              )}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};