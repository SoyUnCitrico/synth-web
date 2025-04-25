import React from 'react';
import { useSynthContext } from '../../context/SynthContext';
import { FilterType } from '../../models/synth/types';
import './VCF.css';

const VCF: React.FC = () => {
  const { params, setParams } = useSynthContext();
  
  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as FilterType;
    setParams({ filterType: value });
  };
  
  const handleFrequencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setParams({ filterFreq: value });
  };
  
  const handleResonanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setParams({ filterRes: value });
  };
  
  return (
    <div className="vcf-module">
      <h2>VCF</h2>
      
      <div className="control-group">
        <label>Tipo de filtro</label>
        <select value={params.filterType} onChange={handleTypeChange}>
          <option value="lowpass">Paso Bajo</option>
          <option value="highpass">Paso Alto</option>
          <option value="bandpass">Paso Banda</option>
          <option value="notch">Notch</option>
        </select>
      </div>
      
      <div className="control-group">
        <label>Frecuencia: {params.filterFreq} Hz</label>
        <input
          type="range"
          min="20"
          max="20000"
          step="1"
          value={params.filterFreq}
          onChange={handleFrequencyChange}
        />
      </div>
      
      <div className="control-group">
        <label>Resonancia: {params.filterRes}</label>
        <input
          type="range"
          min="0.1"
          max="20"
          step="0.1"
          value={params.filterRes}
          onChange={handleResonanceChange}
        />
      </div>
    </div>
  );
};

export default VCF;