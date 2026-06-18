import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
import { PiPianoKeysFill } from 'react-icons/pi';
import { useTransport } from '../../audio/sequencer/transport';
import { MODULE_SECTIONS } from './sections';
import './BottomNav.css';

// Etiquetas de la fila de mute/unmute: 4 voces (VCO1-3 + Ruido) y 4 voces de batería.
const VOICE_LABELS = ['V1', 'V2', 'V3', 'N4'];
const DRUM_LABELS = ['K1', 'S2', 'H3', 'O4'];

interface BottomNavProps {
  /** Mute por canal del mixer (índice 0..3 = VCO1, VCO2, VCO3, Ruido); true = muteado. */
  channelMute: boolean[];
  /** Conmuta el mute de un canal (misma instancia que el botón "M" del mixer). */
  onToggleMute: (i: number) => void;
  /** Encendido por voz de batería (índice 0..3); true = sonando. */
  drumEnabled: boolean[];
  /** Conmuta el encendido de una voz (misma instancia que el checkbox del mixer). */
  onToggleDrumEnabled: (i: number) => void;
}

/**
 * Segunda barra de navegación, fija abajo. Su visibilidad depende sólo de la posición de
 * scroll (no de la dirección): aparece cuando se rebasa el header y se queda hasta volver
 * arriba. A la izquierda replica el transporte del header (RST + Play/Stop) usando el MISMO
 * contexto de transporte; en el centro, una fila de checkboxes para mutear/activar al vuelo
 * los 8 canales del mixer (las mismas instancias que los controles del módulo Mixer); a la
 * derecha, el icono de la página despliega un índice de módulos que hace scroll hasta el
 * elegido (anclas por id en el DOM, asignadas en BasicSynth).
 */
const BottomNav: React.FC<BottomNavProps> = ({
  channelMute,
  onToggleMute,
  drumEnabled,
  onToggleDrumEnabled,
}) => {
  const { running, setRunning, reset } = useTransport();
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // El AudioContext debe reanudarse dentro del gesto (igual que en el header).
  const togglePlay = () => {
    Tone.start();
    setRunning((r) => !r);
  };

  // Visibilidad por posición de scroll: visible mientras se haya rebasado el header, y sólo
  // se oculta al volver arriba (independiente de la dirección del scroll).
  useEffect(() => {
    const header = document.querySelector<HTMLElement>('.header-nav');
    const trigger = header ? header.offsetHeight : 60;
    const onScroll = () => setVisible(window.scrollY > trigger);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Cierra el menú al hacer click fuera.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const goTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setOpen(false);
  }, []);

  return (
    <nav className={`bottom-nav ${visible ? 'visible' : ''}`} aria-hidden={!visible}>
      <div className="bottom-nav-left" ref={menuRef}>
        <button
          className="bottom-nav-menu-btn"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label="Índice de módulos"
        >
          <PiPianoKeysFill />
        </button>
        {open && (
          <ul className="bottom-nav-menu">
            {MODULE_SECTIONS.map((s) => (
              <li key={s.id}>
                <button onClick={() => goTo(s.id)}>{s.label}</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Fila de mute/activación rápida: marcado = canal sonando. Acciona la MISMA instancia
          que los controles del Mixer (mute por canal y encendido por voz de batería). Las
          voces se distinguen por color (cian) de la batería (magenta). */}
      <div className="bottom-nav-mutes" role="group" aria-label="Mute de canales">
        <div className="mute-group voices">
          {VOICE_LABELS.map((label, i) => (
            <label key={label} className={`mute-chip voice ${!channelMute[i] ? 'on' : ''}`}>
              <input
                type="checkbox"
                checked={!channelMute[i]}
                onChange={() => onToggleMute(i)}
                aria-label={`Canal ${label}`}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <div className="mute-group drums">
          {DRUM_LABELS.map((label, i) => (
            <label key={label} className={`mute-chip drum ${drumEnabled[i] ? 'on' : ''}`}>
              <input
                type="checkbox"
                checked={!!drumEnabled[i]}
                onChange={() => onToggleDrumEnabled(i)}
                aria-label={`Batería ${label}`}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="bottom-nav-right">
        <button className="hdr-btn hdr-btn-warning" onClick={reset} title="Reiniciar secuencia">
          ⟲ RST
        </button>
        <button
          className={`hdr-btn hdr-transport ${running ? 'active' : ''}`}
          onClick={togglePlay}
          title="Reproducir / detener"
        >
          {running ? '■ STOP' : '▶ PLAY'}
        </button>
      </div>
    </nav>
  );
};

export default BottomNav;
