import React from 'react';
import Fader from '../Fader/Fader';
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
  amount: number; // cantidad/AMT de la fuente ADSR en la matriz (-1.2 a 1.2)
  setAmount: (value: number) => void;
}

export const ADSR: React.FC<ADSRProps> = ({
  attack, setAttack,
  decay, setDecay,
  sustain, setSustain,
  release, setRelease,
  amount, setAmount
}) => {
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

        <div className="fader-bank">
          <Fader
            id="attack" label="Atk" min={0.01} max={2} step={0.01}
            value={attack} display={`${attack.toFixed(2)}s`} onChange={setAttack}
          />
          <Fader
            id="decay" label="Dec" min={0.01} max={2} step={0.01}
            value={decay} display={`${decay.toFixed(2)}s`} onChange={setDecay}
          />
          <Fader
            id="sustain" label="Sus" min={0} max={1} step={0.01}
            value={sustain} display={sustain.toFixed(2)} onChange={setSustain}
          />
          <Fader
            id="release" label="Rel" min={0.01} max={4} step={0.01}
            value={release} display={`${release.toFixed(2)}s`} onChange={setRelease}
          />
          <Fader
            id="adsr-amount" label="Amt" min={-1.2} max={1.2} step={0.01}
            value={amount} display={`${(amount * 100).toFixed(0)}%`} onChange={setAmount}
          />
        </div>
      </div>
    </div>
  );
};
