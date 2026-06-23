import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
import { PiPianoKeysFill } from 'react-icons/pi';
import { useTransport } from '../../audio/sequencer/transport';
import { MODULE_SECTIONS, type ModuleSection } from './sections';
import './BottomNav.css';

// Etiquetas por defecto de la fila de on/off: 5 voces (VCO1-3, FM y Ruido) y 4 de batería.
const DEFAULT_VOICE_LABELS = ['V1', 'V2', 'V3', 'FM', 'N'];
const DRUM_LABELS = ['K1', 'S2', 'H3', 'O4'];

interface BottomNavProps {
  /** On/off por canal del mixer; true = sonando. */
  channelEnabled: boolean[];
  /** Conmuta el on/off de un canal (misma instancia que el botón "M" del mixer y el switch del VCO). */
  onToggleChannel: (i: number) => void;
  /** Encendido por voz de batería (opcional; sin él no se muestran chips de batería). */
  drumEnabled?: boolean[];
  /** Conmuta el encendido de una voz de batería (opcional). */
  onToggleDrumEnabled?: (i: number) => void;
  /** Índice de módulos del menú. Por defecto MODULE_SECTIONS (Modulor). */
  sections?: ModuleSection[];
  /** Etiquetas de los chips de voz. Por defecto V1-V3 + FM + N. */
  voiceLabels?: string[];
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
  channelEnabled,
  onToggleChannel,
  drumEnabled,
  onToggleDrumEnabled,
  sections,
  voiceLabels,
}) => {
  const { running, setRunning, reset } = useTransport();
  const moduleSections = sections ?? MODULE_SECTIONS;
  const voiceChips = voiceLabels ?? DEFAULT_VOICE_LABELS;
  const showDrums = !!drumEnabled && !!onToggleDrumEnabled;
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
            {moduleSections.map((s) => (
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
          {voiceChips.map((label, i) => (
            <label key={label} className={`mute-chip voice ${channelEnabled[i] ? 'on' : ''}`}>
              <input
                type="checkbox"
                checked={!!channelEnabled[i]}
                onChange={() => onToggleChannel(i)}
                aria-label={`Canal ${label}`}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
        {showDrums && (
          <div className="mute-group drums">
            {DRUM_LABELS.map((label, i) => (
              <label key={label} className={`mute-chip drum ${drumEnabled![i] ? 'on' : ''}`}>
                <input
                  type="checkbox"
                  checked={!!drumEnabled![i]}
                  onChange={() => onToggleDrumEnabled!(i)}
                  aria-label={`Batería ${label}`}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        )}
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
