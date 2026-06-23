import React from 'react';
import LedDisplay from '../../LedDisplay/LedDisplay';
import { WHITE_KEYS, BLACK_KEYS, type KeyDef } from './layout';
import './Keyboard.css';

interface KeyboardProps {
  octave: number;
  onOctaveDown: () => void;
  onOctaveUp: () => void;
  /** Note-on monofónico: `id` identifica el origen (tecla) para no re-disparar duplicados. */
  noteOn: (id: string, note: string) => void;
  noteOff: (id: string) => void;
  /** Notas activas por `id` (sincroniza el resaltado con el teclado físico). */
  activeNotes: Record<string, string>;
}

const keycapLabel = (k: string): string => (k === 'ñ' ? 'Ñ' : k.toUpperCase());

/**
 * Teclado en pantalla (estética de consola). Cada tecla muestra su nota + número de octava
 * (se actualiza al cambiar de octava) y la letra del teclado de computadora que la dispara.
 * Usa Pointer Events con captura para funcionar igual con ratón y con presión táctil en
 * móvil (sin notas "pegadas", sin scroll/zoom accidental).
 */
const Keyboard: React.FC<KeyboardProps> = ({
  octave,
  onOctaveDown,
  onOctaveUp,
  noteOn,
  noteOff,
  activeNotes,
}) => {
  const whiteCount = WHITE_KEYS.length;
  const noteFull = (k: KeyDef) => `${k.note}${octave + k.octaveOffset}`;

  const down = (e: React.PointerEvent, id: string, note: string) => {
    // Evita el scroll/selección y la emulación de ratón; captura el puntero para que el
    // pointerup llegue siempre a esta tecla (release fiable en táctil).
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    noteOn(id, note);
  };

  const renderKey = (k: KeyDef, kind: 'white' | 'black', style?: React.CSSProperties) => {
    const id = k.key;
    const isActive = activeNotes[id] !== undefined;
    return (
      <button
        key={id}
        type="button"
        className={`kbd-key ${kind} ${isActive ? 'active' : ''}`}
        style={style}
        onPointerDown={(e) => down(e, id, noteFull(k))}
        onPointerUp={() => noteOff(id)}
        onPointerCancel={() => noteOff(id)}
        aria-label={`${k.note}${octave + k.octaveOffset} (${keycapLabel(k.key)})`}
      >
        <span className="kbd-note">{noteFull(k)}</span>
        <span className="kbd-keycap">{keycapLabel(k.key)}</span>
      </button>
    );
  };

  return (
    <div className="keyboard">
      <div className="keyboard-topbar">
        <div className="kbd-octave">
          <button className="kbd-oct-btn" type="button" onClick={onOctaveDown} aria-label="Bajar octava">
            <span>OCT −</span>
            <kbd>Q</kbd>
          </button>
          <LedDisplay label="Octava" value={octave} chars={1} tone="cyan" />
          <button className="kbd-oct-btn" type="button" onClick={onOctaveUp} aria-label="Subir octava">
            <span>OCT +</span>
            <kbd>E</kbd>
          </button>
        </div>
        <LedDisplay
          label="Notas activas"
          tone="green"
          value={Object.values(activeNotes).join(' ') || '----'}
          chars={12}
        />
      </div>

      <div className="kbd-keys">
        {WHITE_KEYS.map((k) => renderKey(k, 'white'))}
        {BLACK_KEYS.map((k) =>
          renderKey(k, 'black', { left: `${((k.afterIndex + 1) / whiteCount) * 100}%` }),
        )}
      </div>
    </div>
  );
};

export default Keyboard;
