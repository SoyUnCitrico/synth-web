import React from 'react';
import { MIDI_CC_SOURCES } from '../../../audio/cv/patch';
import { ROOT_NOTES, SCALES } from '../../../audio/scales';
import Knob from '../../Knob/Knob';
import { GLIDE_MIN, GLIDE_MAX, GLIDE_DEFAULT } from '../../../audio/makwil/sequencerTypes';
import './Midi.css';

interface MidiProps {
  supported: boolean;
  enabled: boolean;
  deviceNames: string[];
  /** Indicador de actividad (cambia con cada mensaje recibido). */
  activity: number;
  onEnable: () => void;
  // Cuantizador de escala (se aplica a las fuentes conectadas a "Cuant" en la matriz MIDI).
  quantScale: string;
  setQuantScale: (id: string) => void;
  quantRoot: number; // clase de altura 0..11
  setQuantRoot: (pc: number) => void;
  // Glide (portamento) de la entrada MIDI: desliza el pitch entre notas (VCO2/3/4).
  // Opcional — si no se pasan (p. ej. en Modulor) el control de glide no se muestra.
  glideEnabled?: boolean;
  setGlideEnabled?: (on: boolean) => void;
  glideTime?: number; // segundos (GLIDE_MIN..GLIDE_MAX)
  setGlideTime?: (s: number) => void;
  // --- Modo slots (Modulor): mapa slot→CC como fuentes de la matriz. ---
  /** Mapa slot→número de CC (null = sin asignar). */
  midiMap?: (number | null)[];
  /** Slot actualmente en "aprendizaje" (o null). */
  learningSlot?: number | null;
  onLearn?: (slot: number) => void;
  onClear?: (slot: number) => void;
  // --- Modo directo (Makwil): MIDI-learn global a perillas/sliders. ---
  /** Si se pasa, activa la UI de "MIDI Learn" directo en vez de la lista de slots. */
  learnMode?: boolean;
  onToggleLearnMode?: () => void;
  /** Asignaciones actuales paramId→nº de CC. */
  assignments?: Record<string, number>;
  /** ¿Hay un control armado a la espera de CC? */
  armed?: boolean;
  onClearAssignment?: (id: string) => void;
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
  quantScale,
  setQuantScale,
  quantRoot,
  setQuantRoot,
  glideEnabled,
  setGlideEnabled,
  glideTime,
  setGlideTime,
  learnMode,
  onToggleLearnMode,
  assignments,
  armed,
  onClearAssignment,
}) => {
  // Modo directo (Makwil): MIDI-learn a perillas/sliders. Si no, modo slots (Modulor).
  const directMode = onToggleLearnMode != null;
  return (
    <div className="module midi-module">
      <div className="module-header">
        <h2>MIDI</h2>
      </div>

      <div className="module-controls">
        {/* Cuantizador: ajusta a la escala elegida las notas de las fuentes conectadas a
            "Cuant" en la matriz MIDI. Raíz (tónica) + tipo de escala. */}
        <div className="midi-quant">
          <span className="midi-quant-title">Cuantizador</span>
          <div className="midi-quant-selects">
            <label className="midi-quant-field">
              Raíz
              <select value={quantRoot} onChange={(e) => setQuantRoot(parseInt(e.target.value, 10))}>
                {ROOT_NOTES.map((r) => (
                  <option key={r.pc} value={r.pc}>{r.label}</option>
                ))}
              </select>
            </label>
            <label className="midi-quant-field">
              Escala
              <select value={quantScale} onChange={(e) => setQuantScale(e.target.value)}>
                {SCALES.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* Glide (portamento) de la entrada MIDI: desliza el pitch entre notas en los VCO mono. */}
        {setGlideEnabled && setGlideTime && (
          <div className="midi-glide">
            <span className="midi-glide-title">Glide</span>
            <div className="midi-glide-ctl">
              <div className="toggle-switch">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={glideEnabled ?? false}
                    onChange={(e) => setGlideEnabled(e.target.checked)}
                    aria-label="Activar/desactivar glide del MIDI"
                  />
                  <span className="slider"></span>
                </label>
                <span className="toggle-label">{(glideEnabled ?? false) ? 'ON' : 'OFF'}</span>
              </div>
              <Knob
                label="Velocidad"
                value={glideTime ?? GLIDE_DEFAULT}
                min={GLIDE_MIN}
                max={GLIDE_MAX}
                step={0.005}
                display={`${((glideTime ?? GLIDE_DEFAULT) * 1000).toFixed(0)} ms`}
                onChange={setGlideTime}
                disabled={!(glideEnabled ?? false)}
              />
            </div>
          </div>
        )}

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

            {directMode ? (
              <>
                <p className="midi-hint">
                  Activa "MIDI Learn", haz clic en una perilla o slider para armarlo y mueve un
                  control físico para asignarlo.
                </p>
                <button
                  type="button"
                  className={`midi-learn midi-learn-toggle ${learnMode ? 'learning' : ''}`}
                  onClick={onToggleLearnMode}
                  disabled={!enabled}
                >
                  {learnMode ? (armed ? 'Mueve un control…' : 'Learn: clic en un control') : 'MIDI Learn'}
                </button>

                <ul className="midi-slots">
                  {Object.entries(assignments ?? {}).length === 0 ? (
                    <li className="midi-slot midi-slot-empty">Sin asignaciones</li>
                  ) : (
                    Object.entries(assignments ?? {}).map(([id, cc]) => (
                      <li className="midi-slot" key={id}>
                        <span className="midi-slot-name">{id}</span>
                        <span className="midi-slot-cc">{`CC ${cc}`}</span>
                        <button
                          type="button"
                          className="midi-clear"
                          onClick={() => onClearAssignment?.(id)}
                          aria-label={`Borrar asignación de ${id}`}
                        >
                          ✕
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </>
            ) : (
              <>
                <p className="midi-hint">
                  Asigna una perilla a un slot y patchéalo a un destino en la Matriz de modulación.
                </p>

                <ul className="midi-slots">
                  {MIDI_CC_SOURCES.map((src, i) => {
                    const cc = midiMap?.[i] ?? null;
                    const learning = learningSlot === i;
                    return (
                      <li className="midi-slot" key={src.id}>
                        <span className="midi-slot-name">{src.label}</span>
                        <span className="midi-slot-cc">{cc != null ? `CC ${cc}` : '—'}</span>
                        <button
                          type="button"
                          className={`midi-learn ${learning ? 'learning' : ''}`}
                          onClick={() => onLearn?.(i)}
                          disabled={!enabled}
                        >
                          {learning ? 'Mueve…' : 'Aprender'}
                        </button>
                        <button
                          type="button"
                          className="midi-clear"
                          onClick={() => onClear?.(i)}
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
          </>
        )}
      </div>
    </div>
  );
};

export default Midi;
