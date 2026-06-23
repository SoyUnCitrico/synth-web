import React from 'react';
import Knob from '../../Knob/Knob';
import { DELAY_TIME_SCALE } from '../../../utils/scale';

interface DelayProps {
  time: number; // segundos
  setTime: (value: number) => void;
  feedback: number; // 0..1
  setFeedback: (value: number) => void;
}

// Delay (eco) como efecto de ENVÍO. El nivel por canal lo dan las perillas de envío del
// mixer; aquí sólo se ajustan el tiempo y la realimentación del eco.
const Delay: React.FC<DelayProps> = ({ time, setTime, feedback, setFeedback }) => {
  return (
    <div className="module delay-module">
      <div className="module-header">
        <h2>Delay</h2>
      </div>
      <div className="module-controls row">
          {/* Time con escala logarítmica (exponencial); feedback lineal. */}
          <Knob
            id="delay-time-fader" label="Time" scale={DELAY_TIME_SCALE} step={0.01}
            value={time} display={`${(time * 1000).toFixed(0)} ms`} onChange={setTime} midiId="delay-time"
          />
          <Knob
            id="delay-feedback-fader" label="Feedback" min={0} max={0.95} step={0.01}
            value={feedback} display={`${(feedback * 100).toFixed(0)}%`} onChange={setFeedback} midiId="delay-feedback"
          />
        </div>
    </div>
  );
};

export default Delay;
