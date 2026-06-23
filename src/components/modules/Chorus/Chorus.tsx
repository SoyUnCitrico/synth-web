import React from 'react';
import Knob from '../../Knob/Knob';
import { CHORUS_RATE_SCALE } from '../../../utils/scale';

interface ChorusProps {
  rate: number; // Hz (frecuencia del LFO interno)
  setRate: (value: number) => void;
  depth: number; // 0..1
  setDepth: (value: number) => void;
  wet: number; // 0 (seco) a 1 (húmedo)
  setWet: (value: number) => void;
}

// Chorus como efecto de ENVÍO. El nivel por canal lo dan las perillas de envío del mixer;
// aquí sólo se ajustan velocidad, profundidad y mezcla del efecto.
const Chorus: React.FC<ChorusProps> = ({ rate, setRate, depth, setDepth, wet, setWet }) => {
  return (
    <div className="module chorus-module">
      <div className="module-header">
        <h2>Chorus</h2>
      </div>
      <div className="module-controls row">
        {/* Rate con escala logarítmica (exponencial); depth y wet lineales. */}
        <Knob
          id="chorus-rate-fader" label="Rate" scale={CHORUS_RATE_SCALE} step={0.1}
          value={rate} display={`${rate.toFixed(1)} Hz`} onChange={setRate} midiId="chorus-rate"
        />
        <Knob
          id="chorus-depth-fader" label="Depth" min={0} max={1} step={0.01}
          value={depth} display={`${(depth * 100).toFixed(0)}%`} onChange={setDepth} midiId="chorus-depth"
        />
        <Knob
          id="chorus-wet-fader" label="Wet" min={0} max={1} step={0.01}
          value={wet} display={`${(wet * 100).toFixed(0)}%`} onChange={setWet} midiId="chorus-wet"
        />
      </div>
    </div>
  );
};

export default Chorus;
