import React from 'react';
import { useSynthContext } from '../../context/SynthContext';
import { ToneOscillatorType } from '../../models/synth/types';
import './VCO.css';

interface VCOProps {
  isSecondary?: boolean;
  vcoTitle?: string;
}

const VCO: React.FC<VCOProps> = ({ 
  isSecondary = false, 
  vcoTitle }) => {
  const { params, setParams } = useSynthContext();
  
  // Obtener los valores según si es el oscilador principal o secundario
  const oscType = isSecondary ? params.osc2Type : params.oscType;
  const frequency = params.frequency;
  const frequency2 = params.frequency2;
  const detune = params.detune;
  const enabled = isSecondary ? params.osc2Enabled : true;
  
  // Manejar cambios en los parámetros
  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as ToneOscillatorType;
    if (isSecondary) {
      setParams({ osc2Type: value });
    } else {
      setParams({ oscType: value });
    }
  };
  
  const handleFrequencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setParams({ frequency: value });
  };

  const handleFrequency2Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setParams({ frequency2: value });
  };
  
  const handleDetuneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setParams({ detune: value });
  };
  
  const handleEnabledChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isSecondary) {
      setParams({ osc2Enabled: e.target.checked });
    }
  };
  
  return (
    <div className="vco-module">
      <h2>{isSecondary ?  vcoTitle == null ? 'VCO 2' :  vcoTitle : 'VCO 1'}</h2>
      
      {isSecondary && (
        <div className="control-group">
          <label>
            <input
              type="checkbox"
              checked={enabled}
              onChange={handleEnabledChange}
            />
            Activado
          </label>
        </div>
      )}
      
      <div className="control-group">
        <label>Forma de onda</label>
        <select value={oscType} onChange={handleTypeChange}>cv
          <option value="sine">Senoidal</option>
          <option value="triangle">Triangular</option>
          <option value="sawtooth">Sierra</option>
          <option value="square">Cuadrada</option>c
        </select>
      </div>
      
      <div className="control-group">
        <label>Frecuencia: {isSecondary ? frequency2 : frequency} Hz</label>
        <input
          type="range"
          min="20"
          max="5000"
          step="1"
          value={isSecondary ? frequency2 : frequency}
          onChange={isSecondary ? handleFrequency2Change : handleFrequencyChange}
        />
      </div>
      
      {isSecondary && (
        <div className="control-group">
          <label>Desafinación: {detune} cents</label>
          <input
            type="range"
            min="-200"
            max="200"
            step="1"
            value={detune}
            onChange={handleDetuneChange}
          />
        </div>
      )}
    </div>
  );
};

export default VCO;

