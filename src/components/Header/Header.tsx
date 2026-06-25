import React, { useEffect, useRef, useState } from  'react';
import { Link } from 'react-router-dom';
import * as Tone from 'tone';
import { useTransport } from '../../audio/sequencer/transport';
import { useMakwilTheme } from '../../theme/MakwilThemeContext';
// import LedDisplay from '../LedDisplay/LedDisplay';
import logoIcon from '../../assets/modulorLogo.svg';
import './Header.css'

// Cabecera global. Incluye un transporte (Play/Stop · Reset · BPM) que controla la MISMA
// instancia del secuenciador que el módulo de la página, vía el contexto de transporte.
// El logo es un menú desplegable de navegación entre páginas.
interface HeaderProps {
  label?: string;
  /** Muestra el toggle de tema (claro/oscuro). Solo aplica en Makwil. */
  showThemeToggle?: boolean;
}

const Header : React.FC<HeaderProps> = ({label = "MAKWIL", showThemeToggle = false}) => {
    const { running, setRunning, reset, resetAll } = useTransport();
    const { theme, toggle: toggleTheme } = useMakwilTheme();
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement | null>(null);

    // Cerrar el menú al hacer click fuera o pulsar Escape.
    useEffect(() => {
        if (!menuOpen) return;
        const onClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setMenuOpen(false);
        };
        document.addEventListener('mousedown', onClick);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onClick);
            document.removeEventListener('keydown', onKey);
        };
    }, [menuOpen]);

    // El AudioContext debe reanudarse DENTRO del gesto del usuario (la misma pila del click);
    // si se hiciera en un useEffect el navegador rechaza la reanudación y el transporte queda
    // congelado. Por eso arrancamos Tone aquí, en el onClick, antes de cambiar el estado.
    const togglePlay = () => {
        Tone.start();
        setRunning((r) => !r);
    };
    return(
        <nav className={"header-nav"}>
            <div className={"header-container"}>
                <div className={"logo-container"} ref={menuRef}>
                    <button
                        type="button"
                        className={`logo-trigger ${menuOpen ? 'open' : ''}`}
                        onClick={() => setMenuOpen((o) => !o)}
                        aria-haspopup="menu"
                        aria-expanded={menuOpen}
                        aria-label="Menú de navegación"
                    >
                        <img src={logoIcon} width={40} height={40} alt="" />
                        <h4>{label}</h4>
                        <span className="logo-caret" aria-hidden="true">▾</span>
                    </button>
                    {menuOpen && (
                        <div className="header-menu" role="menu">
                            <Link to="/" role="menuitem" className="header-menu-item" onClick={() => setMenuOpen(false)}>
                                Makwil
                            </Link>
                            <Link to="/modulor" role="menuitem" className="header-menu-item" onClick={() => setMenuOpen(false)}>
                                Modulor
                            </Link>
                            <a
                                href="https://emme.vercel.app"
                                target="_blank"
                                rel="noopener noreferrer"
                                role="menuitem"
                                className="header-menu-item"
                                onClick={() => setMenuOpen(false)}
                            >
                                EmmE d Makwil <span className="ext-mark" aria-hidden="true">↗</span>
                            </a>
                            <Link to="/about" role="menuitem" className="header-menu-item" onClick={() => setMenuOpen(false)}>
                                About
                            </Link>
                            {showThemeToggle && (
                                <button
                                    type="button"
                                    role="menuitem"
                                    className="header-menu-item theme-toggle"
                                    onClick={() => { toggleTheme(); setMenuOpen(false); }}
                                >
                                    Tema: {theme === 'dark' ? 'Oscuro' : 'Claro'}
                                    <span className="theme-mark" aria-hidden="true">{theme === 'dark' ? '☾' : '☀'}</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>
                <div className={"transport-container"}>
                    <button
                        className="hdr-btn hdr-btn-default"
                        onClick={resetAll}
                        title="Restablecer todos los controles a valores por defecto"
                    >
                        ⌂ DEF
                    </button>
                    <button
                        className="hdr-btn hdr-btn-warning"
                        onClick={reset}
                        title="Reiniciar secuencia"
                    >
                        ⟲ RST
                    </button>
                    <button
                        className={`hdr-btn hdr-transport ${running ? 'active' : ''}`}
                        onClick={togglePlay}
                        title="Reproducir / detener"
                    >
                        {running ? '■ STOP' : '▶ PLAY'}
                    </button>
                    {/* <div className="hdr-bpm">
                        <LedDisplay label="BPM" value={bpm} chars={3} tone="amber" />
                        <input
                            type="range"
                            min="40"
                            max="240"
                            step="1"
                            value={bpm}
                            aria-label="BPM"
                            onChange={(e) => setBpm(parseInt(e.target.value, 10))}
                        />
                    </div> */}
                </div>
            </div>
        </nav>
    )
}

export default Header;
