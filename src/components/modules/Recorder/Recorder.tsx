import React from 'react';
import './Recorder.css';

interface RecorderProps {
  /** ¿Grabando ahora? */
  recording: boolean;
  /** Segundos transcurridos de la grabación en curso. */
  elapsed: number;
  onStart: () => void;
  onStop: () => void;
}

const fmtTime = (s: number): string => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

/**
 * Grabadora de la salida maestra. Captura lo que se oye (con efectos) vía Tone.Recorder
 * (MediaRecorder del navegador) y, al detener, descarga un archivo .webm al disco del usuario.
 * Presentacional: el estado y la descarga viven en Makwil.tsx.
 */
const Recorder: React.FC<RecorderProps> = ({ recording, elapsed, onStart, onStop }) => (
  <div className="module recorder-module">
    <div className="module-header">
      <h2>Grabadora</h2>
    </div>
    <div className="module-controls recorder-controls">
      <button
        type="button"
        className={`rec-btn ${recording ? 'recording' : ''}`}
        onClick={recording ? onStop : onStart}
        aria-label={recording ? 'Detener grabación' : 'Iniciar grabación'}
      >
        <span className="rec-dot" aria-hidden="true" />
        {recording ? 'Detener' : 'Grabar'}
      </button>
      <span className="rec-time">{recording ? fmtTime(elapsed) : '0:00'}</span>
    </div>
  </div>
);

export default Recorder;
