import React from 'react';
import { MIDI_CC_SOURCES } from '../../audio/cv/patch';
import './Midi.css';

interface MidiProps {
  supported: boolean;
  enabled: boolean;
  deviceNames: string[];
  /** Indicador de actividad (cambia con cada mensaje recibido). */
  activity: number;
  /** Mapa slot→número de CC (null = sin asignar). */
  midiMap: (number | null)[];
  /** Slot actualmente en "aprendizaje" (o null). */
  learningSlot: number | null;
  onEnable: () => void;
  onLearn: (slot: number) => void;
  onClear: (slot: number) => void;
}

/**
 * Panel de control MIDI: activa la Web MIDI API, muestra el/los dispositivo(s) conectado(s)
 * y mapea las perillas/CC físicas a los slots-fuente de la matriz de modulación. El ruteo
 * de cada slot a sus destinos (Cutoff, VCO, VCA…) se hace en la Matriz de modulación.
 */
const Midi: React.FC<MidiProps> = ({
  supported,
  enabled,
  deviceNames,
  activity,
  midiMap,
  learningSlot,
  onEnable,
  onLearn,
  onClear,
}) => {
  return (
    <div className="module midi-module">
      <div className="module-header">
        <h2>MIDI</h2>
      </div>

      <div className="module-controls">
        {!supported ? (
          <p className="midi-msg">
            Este navegador no soporta Web MIDI. Usa Chrome, Edge u Opera (en localhost o https).
          </p>
        ) : (
          <>
            <div className="midi-status">
              {!enabled ? (
                <button type="button" className="midi-enable" onClick={onEnable}>
                  Activar MIDI
                </button>
              ) : (
                <>
                  <span className={`midi-led ${activity % 2 ? 'blink' : ''}`} aria-hidden="true" />
                  <span className="midi-devices">
                    {deviceNames.length ? deviceNames.join(', ') : 'Sin dispositivos'}
                  </span>
                </>
              )}
            </div>

            <p className="midi-hint">
              Asigna una perilla a un slot y patchéalo a un destino en la Matriz de modulación.
            </p>

            <ul className="midi-slots">
              {MIDI_CC_SOURCES.map((src, i) => {
                const cc = midiMap[i] ?? null;
                const learning = learningSlot === i;
                return (
                  <li className="midi-slot" key={src.id}>
                    <span className="midi-slot-name">{src.label}</span>
                    <span className="midi-slot-cc">{cc != null ? `CC ${cc}` : '—'}</span>
                    <button
                      type="button"
                      className={`midi-learn ${learning ? 'learning' : ''}`}
                      onClick={() => onLearn(i)}
                      disabled={!enabled}
                    >
                      {learning ? 'Mueve…' : 'Aprender'}
                    </button>
                    <button
                      type="button"
                      className="midi-clear"
                      onClick={() => onClear(i)}
                      disabled={cc == null}
                      aria-label={`Borrar mapeo de ${src.label}`}
                    >
                      ✕
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
};

export default Midi;
