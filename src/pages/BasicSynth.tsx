import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import VCO from '../components/VCO/VCO';
import { VCF } from '../components/VCF/VCF';
import { ADSR } from '../components/ADSR/ADSR';
import { VCA } from '../components/VCA/VCA';
import Noise from '../components/Noise/Noise';
import LFO from '../components/LFO/LFO';
import { FilterEnv } from '../components/FilterEnv/FilterEnv';
import Reverb from '../components/Reverb/Reverb';
import PatchMatrix from '../components/PatchMatrix/PatchMatrix';
import Sequencer from '../components/Sequencer/Sequencer';
import { useSynthEngine, type NoiseType } from '../audio/useSynthEngine';
import { createPatch, type ModPatch } from '../audio/cv/patch';
import { useSequencer } from '../audio/sequencer/useSequencer';
import type { SeqMode, PitchStep, CvStep } from '../audio/sequencer/types';
import '../App.css';
// import Oscilloscope from '../components/Oscilloscope/Oscilloscope';
// import SpectrumAnalyzer from '../components/Spectrum/Spectrum';

const keyMap: Record<string, string> = {
  'z': 'C',
  's': 'C#',
  'x': 'D',
  'd': 'D#',
  'c': 'E',
  'v': 'F',
  'g': 'F#',
  'b': 'G',
  'h': 'G#',
  'n': 'A',
  'j': 'A#',
  'm': 'B',
  ',': 'C', // Octava superior
  'l': 'C#',
  '.': 'D',
  'ñ': 'D#',
  '-': 'E',
};

// Teclas que suenan una octava por encima de la octava base.
const UPPER_OCTAVE_KEYS = [',', 'l', '.', 'ñ', '-'];

const BasicSynth: React.FC = () => {
  // Parámetros del oscilador 1
  const [oscType, setOscType] = useState<Tone.ToneOscillatorType>('sawtooth');
  const [frequency, setFrequency] = useState<number>(440);
  const [pwm1, setPwm1] = useState<number>(0);

  // Parámetros del oscilador 2
  const [osc2Type, setOsc2Type] = useState<Tone.ToneOscillatorType>('sawtooth');
  const [detune, setDetune] = useState<number>(0);
  const [osc2Enabled, setOsc2Enabled] = useState<boolean>(false);
  const [pwm2, setPwm2] = useState<number>(0);

  // Parámetros del oscilador 3
  const [osc3Type, setOsc3Type] = useState<Tone.ToneOscillatorType>('square');
  const [osc3Detune, setOsc3Detune] = useState<number>(0);
  const [osc3Enabled, setOsc3Enabled] = useState<boolean>(false);
  const [pwm3, setPwm3] = useState<number>(0);

  // Generador de ruido
  const [noiseType, setNoiseType] = useState<NoiseType>('white');
  const [noiseEnabled, setNoiseEnabled] = useState<boolean>(false);

  // Mixer: nivel por canal (dB)
  const [mixOsc1, setMixOsc1] = useState<number>(0);
  const [mixOsc2, setMixOsc2] = useState<number>(0);
  const [mixOsc3, setMixOsc3] = useState<number>(0);
  const [mixNoise, setMixNoise] = useState<number>(-10);

  // Parámetros del filtro
  const [filterType, setFilterType] = useState<BiquadFilterType>('lowpass');
  const [filterFreq, setFilterFreq] = useState<number>(20000);
  const [filterRes, setFilterRes] = useState<number>(1);

  // Envolvente AD 1 (fuente de modulación; antes ligada al filtro, ahora va por la matriz)
  const [ad1Attack, setAd1Attack] = useState<number>(0.05);
  const [ad1Decay, setAd1Decay] = useState<number>(0.3);
  const [ad1Amount, setAd1Amount] = useState<number>(0);

  // Envolvente AD 2 (fuente de modulación)
  const [ad2Attack, setAd2Attack] = useState<number>(0.05);
  const [ad2Decay, setAd2Decay] = useState<number>(0.3);
  const [ad2Amount, setAd2Amount] = useState<number>(0);

  // Parámetros ADSR
  const [attack, setAttack] = useState<number>(0.1);
  const [decay, setDecay] = useState<number>(0.2);
  const [sustain, setSustain] = useState<number>(0.5);
  const [release, setRelease] = useState<number>(1);

  // Volumen (dB)
  const [volume, setVolume] = useState<number>(-6);

  // Parámetros del LFO 1
  const [lfoType, setLfoType] = useState<Tone.ToneOscillatorType>('sine');
  const [lfoRate, setLfoRate] = useState<number>(5);
  const [lfoDepth, setLfoDepth] = useState<number>(0.3);

  // Parámetros del LFO 2
  const [lfo2Type, setLfo2Type] = useState<Tone.ToneOscillatorType>('triangle');
  const [lfo2Rate, setLfo2Rate] = useState<number>(2);
  const [lfo2Depth, setLfo2Depth] = useState<number>(0.3);

  // Matriz de patcheo (fuentes × destinos). Vacía por defecto; createPatch permite
  // declarar conexiones iniciales, p. ej. createPatch([{ source:'lfo1', dest:'filterFreq' }]).
  const [modPatch, setModPatch] = useState<ModPatch>(() => createPatch([]));

  // Parámetros del reverb
  const [reverbDecay, setReverbDecay] = useState<number>(2);
  const [reverbWet, setReverbWet] = useState<number>(0.3);

  // Secuenciador (1 canal × 32 pasos  ó  2 canales × 16: pitch + CV a la matriz)
  const [seqMode, setSeqMode] = useState<SeqMode>('single32');
  const [seqBpm, setSeqBpm] = useState<number>(120);
  const [seqRunning, setSeqRunning] = useState<boolean>(false);
  const [pitchSteps, setPitchSteps] = useState<PitchStep[]>(() =>
    Array.from({ length: 32 }, () => ({ offset: 12, gate: true })),
  );
  const [cvSteps, setCvSteps] = useState<CvStep[]>(() =>
    Array.from({ length: 16 }, () => ({ value: 0 })),
  );

  // Motor de audio: construye el grafo de Tone.js una sola vez y sincroniza
  // estos parámetros con sus nodos sin reconstruirlo.
  const engine = useSynthEngine({
    oscType, frequency, pwm: pwm1,
    osc2Type, detune, osc2Enabled, pwm2,
    osc3Type, osc3Detune, osc3Enabled, pwm3,
    noiseType, noiseEnabled,
    mixOsc1, mixOsc2, mixOsc3, mixNoise,
    filterType, filterFreq, filterRes,
    ad1Attack, ad1Decay, ad1Depth: ad1Amount,
    ad2Attack, ad2Decay, ad2Depth: ad2Amount,
    attack, decay, sustain, release,
    volume,
    lfoType, lfoRate, lfoDepth,
    lfo2Type, lfo2Rate, lfo2Depth,
    modPatch,
    reverbDecay, reverbWet,
  });

  // Orquestación del secuenciador (usa la API imperativa del motor).
  const currentStep = useSequencer({
    engine,
    running: seqRunning,
    bpm: seqBpm,
    mode: seqMode,
    pitchSteps,
    cvSteps,
  });

  // Estado de interacción (para mostrar notas activas y el estado de los botones)
  const [activeNotes, setActiveNotes] = useState<Record<string, string>>({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [octave, setOctave] = useState(4);

  const oscRef = useRef<HTMLDivElement | null>(null);

  // Octava actual accesible desde el manejador de teclado sin re-registrar listeners.
  const octaveRef = useRef(octave);
  octaveRef.current = octave;

  // Pila de notas mantenidas (prioridad a la última nota, monofónico estilo MiniMoog).
  const heldNotesRef = useRef<{ key: string; note: string }[]>([]);

  // Tocar con el teclado de la computadora. Los listeners se registran una sola
  // vez; el estado vivo (octava, notas mantenidas) se lee desde refs.
  useEffect(() => {
    const handleKeyDown = (ev: KeyboardEvent) => {
      if (ev.repeat) return;
      const key = ev.key.toLowerCase();

      // Cambiar octava
      if (key === 'q') {
        setOctave((o) => Math.max(1, o - 1));
        return;
      }
      if (key === 'e') {
        setOctave((o) => Math.min(7, o + 1));
        return;
      }

      const noteName = keyMap[key];
      if (!noteName) return;
      // Ignorar si la tecla ya está sonando.
      if (heldNotesRef.current.some((h) => h.key === key)) return;

      const noteOctave = UPPER_OCTAVE_KEYS.includes(key) ? octaveRef.current + 1 : octaveRef.current;
      const note = `${noteName}${noteOctave}`;

      const wasIdle = heldNotesRef.current.length === 0;
      heldNotesRef.current.push({ key, note });

      if (wasIdle) {
        engine.triggerAttack(note);
        setIsPlaying(true);
      } else {
        // Ya hay una nota sonando: cambiar el pitch sin re-disparar (legato).
        engine.setNote(note);
      }

      setActiveNotes((prev) => ({ ...prev, [key]: note }));
    };

    const handleKeyUp = (ev: KeyboardEvent) => {
      const key = ev.key.toLowerCase();
      const idx = heldNotesRef.current.findIndex((h) => h.key === key);
      if (idx === -1) return;

      heldNotesRef.current.splice(idx, 1);

      if (heldNotesRef.current.length === 0) {
        engine.triggerRelease();
        setIsPlaying(false);
      } else {
        // Volver a la última nota que sigue mantenida.
        engine.setNote(heldNotesRef.current[heldNotesRef.current.length - 1].note);
      }

      setActiveNotes((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [engine]);

  // Tocar/soltar con los botones del teclado en pantalla (usa la frecuencia actual).
  const playNote = () => {
    engine.triggerAttack();
    setIsPlaying(true);
  };

  const stopNote = () => {
    engine.triggerRelease();
    setIsPlaying(false);
  };

  return (
    <div className="synth-container">
      <h1 className={"synthTitle"}>Synth Básico</h1>

      <div className="synth-modules" ref={oscRef}>
        {/* <Oscilloscope
          analyzerRef={engine.waveformAnalyser}
          containerRef={oscRef}
          key={`${oscType},${osc2Type},${frequency??440},${detune?? 0},${filterFreq},${filterType},${filterRes},${volume ?? 0.2},${attack??0},${decay??0},${sustain??0},${release??0}`}
        />

        <SpectrumAnalyzer
          key={`2${oscType},${osc2Enabled},${osc2Type},${frequency??440},${detune?? 0},${filterFreq},${filterType},${filterRes},${volume ?? 0.2},${attack??0},${decay??0},${sustain??0},${release??0}`}
          fftAnalyzerRef={engine.fftAnalyser}
          specRef={oscRef}
        /> */}

        <VCO
          oscType={oscType}
          setOscType={setOscType}
          frequency={frequency}
          setFrequency={setFrequency}
          isSecondary={false}
          pwm={pwm1}
          setPwm={setPwm1}
          oscRef={oscRef}
        />

        <VCO
          oscType={osc2Type}
          setOscType={setOsc2Type}
          frequency={frequency}
          setFrequency={setFrequency}
          isSecondary={true}
          detune={detune}
          setDetune={setDetune}
          enabled={osc2Enabled}
          setEnabled={setOsc2Enabled}
          pwm={pwm2}
          setPwm={setPwm2}
        />

        <VCO
          oscType={osc3Type}
          setOscType={setOsc3Type}
          frequency={frequency}
          setFrequency={setFrequency}
          isSecondary={true}
          detune={osc3Detune}
          setDetune={setOsc3Detune}
          enabled={osc3Enabled}
          setEnabled={setOsc3Enabled}
          pwm={pwm3}
          setPwm={setPwm3}
          label="VCO 3"
          index={3}
        />

        <VCF
          filterType={filterType}
          setFilterType={setFilterType}
          frequency={filterFreq}
          setFrequency={setFilterFreq}
          resonance={filterRes}
          setResonance={setFilterRes}
        />

        <ADSR
          attack={attack}
          setAttack={setAttack}
          decay={decay}
          setDecay={setDecay}
          sustain={sustain}
          setSustain={setSustain}
          release={release}
          setRelease={setRelease}
        />

        <VCA
          volume={volume}
          setVolume={setVolume}
          mixOsc1={mixOsc1}
          setMixOsc1={setMixOsc1}
          mixOsc2={mixOsc2}
          setMixOsc2={setMixOsc2}
          mixOsc3={mixOsc3}
          setMixOsc3={setMixOsc3}
        />

        <Noise
          noiseType={noiseType}
          setNoiseType={setNoiseType}
          enabled={noiseEnabled}
          setEnabled={setNoiseEnabled}
          level={mixNoise}
          setLevel={setMixNoise}
        />

        <LFO
          label="LFO 1"
          id="lfo1"
          lfoType={lfoType}
          setLfoType={setLfoType}
          rate={lfoRate}
          setRate={setLfoRate}
          depth={lfoDepth}
          setDepth={setLfoDepth}
        />

        <LFO
          label="LFO 2"
          id="lfo2"
          lfoType={lfo2Type}
          setLfoType={setLfo2Type}
          rate={lfo2Rate}
          setRate={setLfo2Rate}
          depth={lfo2Depth}
          setDepth={setLfo2Depth}
        />

        <FilterEnv
          label="AD 1"
          id="ad1"
          attack={ad1Attack}
          setAttack={setAd1Attack}
          decay={ad1Decay}
          setDecay={setAd1Decay}
          amount={ad1Amount}
          setAmount={setAd1Amount}
        />

        <FilterEnv
          label="AD 2"
          id="ad2"
          attack={ad2Attack}
          setAttack={setAd2Attack}
          decay={ad2Decay}
          setDecay={setAd2Decay}
          amount={ad2Amount}
          setAmount={setAd2Amount}
        />

        <PatchMatrix patch={modPatch} setPatch={setModPatch} />

        <Sequencer
          mode={seqMode}
          setMode={setSeqMode}
          bpm={seqBpm}
          setBpm={setSeqBpm}
          running={seqRunning}
          setRunning={setSeqRunning}
          pitchSteps={pitchSteps}
          setPitchSteps={setPitchSteps}
          cvSteps={cvSteps}
          setCvSteps={setCvSteps}
          currentStep={currentStep}
        />

        <Reverb
          decay={reverbDecay}
          setDecay={setReverbDecay}
          wet={reverbWet}
          setWet={setReverbWet}
        />
      </div>

     <div className="keyboard-controls">
         <div className="mt-6 text-sm text-gray-600">
          Notas activas: {Object.values(activeNotes).join(', ') || 'Ninguna'}
        </div>
        <div className={"keys-container"}>
            <div className={"keys-black"}>
                <button
                    className={`play-button ${isPlaying ? 'active' : ''}`}
                    onMouseDown={playNote}
                    onMouseUp={stopNote}
                    onTouchStart={playNote}
                    onTouchEnd={stopNote}
                >
                    C#
                </button>
                <button
                    className={`play-button ${isPlaying ? 'active' : ''}`}
                >
                    D#
                </button>
                <div></div>
                <button
                    className={`play-button ${isPlaying ? 'active' : ''}`}
                >
                    F#
                </button>
                <button
                    className={`play-button ${isPlaying ? 'active' : ''}`}
                >
                    G#
                </button>
                <button
                    className={`play-button ${isPlaying ? 'active' : ''}`}
                >
                    A#
                </button>
                <div></div>
                <button
                    className={`play-button ${isPlaying ? 'active' : ''}`}
                >
                    C#
                </button>
                <button
                    className={`play-button ${isPlaying ? 'active' : ''}`}
                >
                    D#
                </button>
            </div>
            <div className={"keys-white"}>
                <button
                    className={`play-button ${isPlaying ? 'active' : ''}`}
                    onMouseDown={playNote}
                    onMouseUp={stopNote}
                    onTouchStart={playNote}
                    onTouchEnd={stopNote}
                >
                    C
                </button>
                <button
                    className={`play-button ${isPlaying ? 'active' : ''}`}
                >
                    D
                </button>
                <button
                    className={`play-button ${isPlaying ? 'active' : ''}`}
                >
                    E
                </button>
                <button
                    className={`play-button ${isPlaying ? 'active' : ''}`}
                >
                    F
                </button>
                <button
                    className={`play-button ${isPlaying ? 'active' : ''}`}
                >
                    G
                </button>
                <button
                    className={`play-button ${isPlaying ? 'active' : ''}`}
                >
                    A
                </button>
                <button
                    className={`play-button ${isPlaying ? 'active' : ''}`}
                >
                    B
                </button>
                <button
                    className={`play-button ${isPlaying ? 'active' : ''}`}
                >
                    C
                </button>
                <button
                    className={`play-button ${isPlaying ? 'active' : ''}`}
                >
                    D
                </button>
                <button
                    className={`play-button ${isPlaying ? 'active' : ''}`}
                >
                    E
                </button>
            </div>
        </div>
      </div>

    </div>
  );
};

export default BasicSynth;
