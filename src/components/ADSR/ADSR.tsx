import React from 'react';
import { useSynthContext } from '../../context/SynthContext';
import './ADSR.css';
// import '../../App.css';

const ADSR: React.FC = () => {
  const { params, setParams } = useSynthContext();
  
  const handleAttackChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setParams({ attack: value });
  };
  
  const handleDecayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setParams({ decay: value });
  };
  
  const handleSustainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setParams({ sustain: value });
  };
  
  const handleReleaseChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setParams({ release: value });
  };
  
  return (
    <div className="adsr-module">
      <h2>ADSR</h2>
      
      <div className="control-group">
        <label>Attack: {params.attack.toFixed(2)} s</label>
        <input
          type="range"
          min="0.01"
          max="2"
          step="0.01"
          value={params.attack}
          onChange={handleAttackChange}
        />
      </div>
      
      <div className="control-group">
        <label>Decay: {params.decay.toFixed(2)} s</label>
        <input
          type="range"
          min="0.01"
          max="2"
          step="0.01"
          value={params.decay}
          onChange={handleDecayChange}
        />
      </div>
      
      <div className="control-group">
        <label>Sustain: {params.sustain.toFixed(2)}</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={params.sustain}
          onChange={handleSustainChange}
        />
      </div>
      
      <div className="control-group">
        <label>Release: {params.release.toFixed(2)} s</label>
        <input
          type="range"
          min="0.01"
          max="5"
          step="0.01"
          value={params.release}
          onChange={handleReleaseChange}
        />
      </div>
    </div>
  );
};

export default ADSR;