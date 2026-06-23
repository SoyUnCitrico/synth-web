import React from 'react';
import Knob from '../../Knob/Knob';

interface ChebyshevProps {
  order: number; // 1..50 (entero; grado del waveshaper)
  setOrder: (value: number) => void;
  wet: number; // 0 (seco) a 1 (húmedo)
  setWet: (value: number) => void;
}

// Distorsión Chebyshev (waveshaper por orden) como efecto de ENVÍO. El nivel por canal lo dan
// las perillas de envío del mixer; aquí sólo se ajustan el orden y la mezcla del efecto.
const Chebyshev: React.FC<ChebyshevProps> = ({ order, setOrder, wet, setWet }) => {
  return (
    <div className="module cheby-module">
      <div className="module-header">
        <h2>Cheby</h2>
      </div>
      <div className="module-controls row">
        <Knob
          id="cheby-order-fader" label="Orden" min={1} max={50} step={1}
          value={order} display={`${Math.round(order)}`} onChange={setOrder} midiId="cheby-order"
        />
        <Knob
          id="cheby-wet-fader" label="Wet" min={0} max={1} step={0.01}
          value={wet} display={`${(wet * 100).toFixed(0)}%`} onChange={setWet} midiId="cheby-wet"
        />
      </div>
    </div>
  );
};

export default Chebyshev;
