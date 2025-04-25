import React from 'react';
import { useSynthContext } from '../../context/SynthContext';
import './VCA.css';

const VCA: React.FC = () => {
  const { params, setParams } = useSynthContext();
  
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setParams({ volume: value });
  };
  
  return (
    <div className="vca-module">
      <h2>VCA</h2>
      
      <div className="control-group">
        <label>Volumen: {params.volume.toFixed(1)} dB</label>
        <input
          type="range"
          min="-60"
          max="0"
          step="0.1"
          value={params.volume}
          onChange={handleVolumeChange}
        />
      </div>
    </div>
  );
};

export default VCA;
