import React from 'react';
import './ADSR.css';

interface ADSRProps {
  attack: number;
  setAttack: (value: number) => void;
  decay: number;
  setDecay: (value: number) => void;
  sustain: number;
  setSustain: (value: number) => void;
  release: number;
  setRelease: (value: number) => void;
}

export const ADSR: React.FC<ADSRProps> = ({
  attack, setAttack,
  decay, setDecay,
  sustain, setSustain,
  release, setRelease
}) => {
  // Manejadores para los controles deslizantes
  const handleAttackChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAttack(parseFloat(e.target.value));
  };
  
  const handleDecayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDecay(parseFloat(e.target.value));
  };
  
  const handleSustainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSustain(parseFloat(e.target.value));
  };
  
  const handleReleaseChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRelease(parseFloat(e.target.value));
  };

  // Crear gráfico de la envolvente ADSR
  const createEnvelopePath = () => {
    // Normalizar valores para la visualización
    const offsetX = -30;
    const width = 300;
    const height = 50;
    const startY = height;
    const attackX = Math.min(50, attack * 25);
    const attackY = 5;
    const decayX = attackX + Math.min(50, decay * 25);
    const sustainY = height - (sustain * (height - 5));
    const releaseX = decayX + 30 + Math.min(width, release * 25);
    const endY = height;
    
    return `M ${offsetX},${startY} L ${offsetX},${startY} L${attackX+offsetX},${attackY} L${decayX+offsetX},${sustainY} L${decayX + 30+offsetX},${sustainY} L${releaseX+offsetX},${endY}`;
  };

  return (
    <div className="module adsr-module">
      <div className="module-header">
        <h2>ADSR</h2>
      </div>
      <div className="module-controls">
        <div className="envelope-display">
          <svg viewBox="0 0 100 50" className="envelope-svg">
            <path 
              d={createEnvelopePath()}
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
            />
          </svg>
        </div>
        
        <div className="control-group">
          <label htmlFor="attack">Attack: {attack.toFixed(2)}s</label>
          <input 
            type="range" 
            id="attack" 
            min="0.01" 
            max="2" 
            step="0.01" 
            value={attack}
            onChange={handleAttackChange}
            className="control-slider"
          />
        </div>
        
        <div className="control-group">
          <label htmlFor="decay">Decay: {decay.toFixed(2)}s</label>
          <input 
            type="range" 
            id="decay" 
            min="0.01" 
            max="2" 
            step="0.01" 
            value={decay}
            onChange={handleDecayChange}
            className="control-slider"
          />
        </div>
        
        <div className="control-group">
          <label htmlFor="sustain">Sustain: {sustain.toFixed(2)}</label>
          <input 
            type="range" 
            id="sustain" 
            min="0" 
            max="1" 
            step="0.01" 
            value={sustain}
            onChange={handleSustainChange}
            className="control-slider"
          />
        </div>
        
        <div className="control-group">
          <label htmlFor="release">Release: {release.toFixed(2)}s</label>
          <input 
            type="range" 
            id="release" 
            min="0.01" 
            max="4" 
            step="0.01" 
            value={release}
            onChange={handleReleaseChange}
            className="control-slider"
          />
        </div>
      </div>
    </div>
  );
};