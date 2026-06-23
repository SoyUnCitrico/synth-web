import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MAKWIL_MODULE_SECTIONS } from '../components/BottomNav/makwilSections';
import '../App.css';
import './About.css';

// Landing de About: presenta el proyecto, su arquitectura de software, los módulos y el
// origen del nombre Macuilxochitl ("5 flor"). Texto en español (acorde a CLAUDE.md).
// El fondo generativo de flores se monta a nivel App; aquí solo va el contenido.

// Lookup label por id de sección (fuente única de verdad de nombres/orden).
const labelOf = (id: string): string =>
  MAKWIL_MODULE_SECTIONS.find((s) => s.id === id)?.label ?? id;

// Familias de módulos con el color de acento del códice. Los nombres se derivan de
// MAKWIL_MODULE_SECTIONS para no duplicar la lista canónica.
interface Family {
  title: string;
  accent: string;
  desc: string;
  ids: string[];
}

const FAMILIES: Family[] = [
  {
    title: 'Voces',
    accent: '#FE0000',
    desc: 'Cinco fuentes de sonido — los cinco pétalos: dos VCO polifónico/FM, dos VCO de pulso y un generador de ruido.',
    ids: ['mod-vco1', 'mod-vco2', 'mod-vco3', 'mod-vco4', 'mod-noise'],
  },
  {
    title: 'Filtros',
    accent: '#FECE01',
    desc: 'Filtro maestro más dos filtros de inserción por voz para esculpir el timbre.',
    ids: ['mod-vcf', 'mod-vcf2', 'mod-vcf3'],
  },
  {
    title: 'Envolventes y amplitud',
    accent: '#19A516',
    desc: 'ADSR de amplitud, envolventes AD/DAHD de modulación y el mixer de 5 canales con paneo y envíos.',
    ids: ['mod-adsr', 'mod-ad1', 'mod-ad2', 'mod-ad3', 'mod-dahd', 'mod-mixer'],
  },
  {
    title: 'Modulación y secuencia',
    accent: '#016DCD',
    desc: 'Tres LFO, secuenciadores de pitch/CV, la matriz de ruteo (CV/gates/notas), MIDI y teclado.',
    ids: ['mod-lfo1', 'mod-lfo2', 'mod-lfo3', 'mod-seq', 'mod-patch', 'mod-midi', 'mod-keyboard'],
  },
  {
    title: 'Efectos',
    accent: '#016DCD',
    desc: 'Cadena de envío: reverb, delay, chorus y waveshaper Chebyshev.',
    ids: ['mod-reverb', 'mod-delay', 'mod-chorus', 'mod-cheby'],
  },
];

const About: React.FC = () => {
  // Mismo patrón que Makwil: tematiza el chrome compartido con el "códice mexica"
  // (fondo de papel + paleta oro). El cleanup deja el resto de la app intacto.
  useEffect(() => {
    document.body.classList.add('makwil-codex');
    return () => document.body.classList.remove('makwil-codex');
  }, []);

  return (
    <div className="about-page makwil-codex">
      {/* Hero */}
      <header className="about-hero">
        <h1 className="about-title">MAKWIL</h1>
        <p className="about-sub">
          <em>Macuilxochitl</em> · «5 flor» · cinco voces, cinco pétalos
        </p>
      </header>

      {/* Origen del nombre */}
      <section className="about-section">
        <h2>El nombre</h2>
        <p>
          <strong>Makwil</strong> viene de <em>Macuilxochitl</em>, «cinco flor» en náhuatl —
          deidad mexica de la música, la danza, el canto y el juego. Las{' '}
          <strong>cinco voces</strong> del sintetizador (VCO 1 poli, VCO 2 FM, VCO 3, VCO 4 y
          ruido) son los cinco pétalos de esa flor: cinco fuentes que florecen juntas en cada
          sonido.
        </p>
      </section>

      {/* Qué es */}
      <section className="about-section">
        <h2>Qué es</h2>
        <p>
          Un emulador de sintetizador analógico modular que corre por completo en el navegador.
          La arquitectura de señal imita un modular real: osciladores → filtros → envolventes →
          amplificador, con matriz de modulación, secuenciadores y entrada MIDI. Dos consolas
          comparten el motor: <strong>Makwil</strong> (esta) y <strong>Modulor</strong>.
        </p>
      </section>

      {/* Software */}
      <section className="about-section">
        <h2>Cómo está hecho</h2>
        <p>
          Construido con <strong>React 19 + TypeScript + Vite</strong> y el motor de audio{' '}
          <strong>Tone.js</strong> sobre la Web Audio API. El grafo de audio se construye{' '}
          <em>una sola vez</em> y se muta en sitio para mantener la latencia baja; el DSP corre
          en su propio hilo de audio. El ruteo de modulación, gates y notas se resuelve con una
          matriz CV; el estado y los presets se guardan en <code>localStorage</code>.
        </p>
      </section>

      {/* Módulos */}
      <section className="about-section">
        <h2>Módulos</h2>
        <div className="about-modules">
          {FAMILIES.map((fam) => (
            <article
              key={fam.title}
              className="about-module-card"
              style={{ ['--card-accent' as string]: fam.accent }}
            >
              <h3>{fam.title}</h3>
              <p>{fam.desc}</p>
              <ul className="about-module-list">
                {fam.ids.map((id) => (
                  <li key={id}>{labelOf(id)}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      {/* Pie */}
      <footer className="about-footer">
        <Link to="/" className="about-link">
          ← Entrar al sinte
        </Link>
        <a href="https://emme.vercel.app" target="_blank" rel="noopener noreferrer" className="about-link">
          EmmE d Makwil ↗
        </a>
      </footer>
    </div>
  );
};

export default About;
