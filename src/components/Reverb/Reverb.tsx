import React from 'react';
import Fader from '../Fader/Fader';

interface ReverbProps {
  decay: number; // segundos
  setDecay: (value: number) => void;
  wet: number; // 0 (seco) a 1 (húmedo)
  setWet: (value: number) => void;
}

// Reverb al final de la cadena de audio.
const Reverb: React.FC<ReverbProps> = ({ decay, setDecay, wet, setWet }) => {
  return (
    <div className="module reverb-module">
      <div className="module-header">
        <h2>Reverb</h2>
      </div>
      <div className="module-controls row">
        <Fader 
          id="reverb-decay-fader" label="Decay" min={0.1} max={10} step={0.1}
          value={decay} display={`${decay.toFixed(2)}s`} onChange={setDecay}
        />
        <Fader 
          id="reverb-wet-fader" label="Wet" min={0} max={1} step={0.01}
          value={wet} display={`${(wet * 100).toFixed(0)}%`} onChange={setWet}
        />  
       
      </div>
    </div>
  );
};

export default Reverb;
