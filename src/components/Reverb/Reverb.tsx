import React from 'react';

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
      <div className="module-controls">
        <div className="control-group">
          <label htmlFor="reverb-decay">Decay: {decay.toFixed(2)}s</label>
          <input
            type="range"
            id="reverb-decay"
            min="0.1"
            max="10"
            step="0.1"
            value={decay}
            onChange={(e) => setDecay(parseFloat(e.target.value))}
            className="control-slider"
          />
        </div>

        <div className="control-group">
          <label htmlFor="reverb-wet">Mezcla: {(wet * 100).toFixed(0)}%</label>
          <input
            type="range"
            id="reverb-wet"
            min="0"
            max="1"
            step="0.01"
            value={wet}
            onChange={(e) => setWet(parseFloat(e.target.value))}
            className="control-slider"
          />
        </div>
      </div>
    </div>
  );
};

export default Reverb;
