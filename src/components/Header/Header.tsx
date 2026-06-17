import React from  'react';
import { PiPianoKeysFill } from "react-icons/pi";
import { useTransport } from '../../audio/sequencer/transport';
import LedDisplay from '../LedDisplay/LedDisplay';
import './Header.css'

// Cabecera global. Incluye un transporte (Play/Stop · Reset · BPM) que controla la MISMA
// instancia del secuenciador que el módulo de la página, vía el contexto de transporte.
const Header : React.FC = () => {
    const { running, setRunning, bpm, setBpm, reset, resetAll } = useTransport();
    return(
        <nav className={"header-nav"}>
            <div className={"header-container"}>
                <div className={"logo-container"}>
                    <PiPianoKeysFill/>
                    <h4>MODULOR</h4>
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
                        onClick={() => setRunning(!running)}
                        title="Reproducir / detener"
                    >
                        {running ? '■ STOP' : '▶ PLAY'}
                    </button>
                    <div className="hdr-bpm">
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
                    </div>
                </div>
            </div>
        </nav>
    )
}

export default Header;
