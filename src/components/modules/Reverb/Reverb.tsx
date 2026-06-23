import React from 'react';
import Knob from '../../Knob/Knob';
import { REVERB_DECAY_SCALE } from '../../../utils/scale';

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
        {/* Decay con escala logarítmica (exponencial); wet lineal. */}
        <Knob
          id="reverb-decay-fader" label="Decay" scale={REVERB_DECAY_SCALE} step={0.1}
          value={decay} display={`${decay.toFixed(2)}s`} onChange={setDecay} midiId="reverb-decay"
        />
        <Knob
          id="reverb-wet-fader" label="Wet" min={0} max={1} step={0.01}
          value={wet} display={`${(wet * 100).toFixed(0)}%`} onChange={setWet} midiId="reverb-wet"
        />
      </div>
    </div>
  );
};

export default Reverb;
