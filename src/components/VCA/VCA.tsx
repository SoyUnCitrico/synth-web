import React from 'react';
import './VCA.css';

interface VCAProps {
  volume: number;
  setVolume: (value: number) => void;
}

const VCA: React.FC<VCAProps> = ({ volume, setVolume }) => {
  // Manejador para el control de volumen
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseFloat(e.target.value));
  };

  // Convertir dB a un valor normalizado para visualización
  const normalizedVolume = (volume + 30) / 32; // -30dB a +10dB normalizado de 0 a 1
  
  return (
    <div className="module vca-module">
      <div className="module-header">
        <h2>VCA</h2>
      </div>
      <div className="module-controls">
        <div className="control-group">
          <label htmlFor="volume">Volumen: {volume.toFixed(1)} dB</label>
          <input 
            type="range" 
            id="volume" 
            min="-30" 
            max="2" 
            step="0.1" 
            value={volume}
            onChange={handleVolumeChange}
            className="control-slider"
          />
        </div>
        
        <div className="volume-display">
          <div className="volume-meter">
            <div 
              className="volume-level" 
              style={{ height: `${normalizedVolume * 100}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VCA;