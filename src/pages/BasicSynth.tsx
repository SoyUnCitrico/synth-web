import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import {
  createGatePatch,
  GATE_DESTS,
  gateKey,
  type GatePatch,
  type GateSourceId,
} from '../audio/cv/gates';
import { useSequencer } from '../audio/sequencer/useSequencer';
import {
  MAX_STEPS,
  type SeqChannels,
  type SeqDirection,
  type PitchStep,
  type CvStep,
} from '../audio/sequencer/types';
import { usePersistentState, PERSIST_KEYS } from '../hooks/usePersistentState';
import Presets from '../components/Presets/Presets';
import { usePresets } from '../presets/usePresets';
import type { PresetState } from '../presets/types';
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
  const [noiseFilterEnabled, setNoiseFilterEnabled] = useState<boolean>(false);
  const [noiseFilterFreq, setNoiseFilterFreq] = useState<number>(1000);

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
  // Por defecto el ADSR modula el VCA general (la nota abre el VCA).
  const [modPatch, setModPatch] = usePersistentState<ModPatch>(PERSIST_KEYS.modPatch, () =>
    createPatch([{ source: 'adsr', dest: 'vcaGain' }]),
  );

  // Matriz de gates/triggers (fuentes de disparo → envolventes). Por defecto el teclado y
  // el secuenciador canal 1 abren el ADSR; las AD se disparan sólo si se conectan a mano.
  const [gatePatch, setGatePatch] = usePersistentState<GatePatch>(PERSIST_KEYS.gatePatch, () =>
    createGatePatch([
      { source: 'keyboard', dest: 'amp' },
      { source: 'seq1', dest: 'amp' },
    ]),
  );

  // Parámetros del reverb
  const [reverbDecay, setReverbDecay] = useState<number>(2);
  const [reverbWet, setReverbWet] = useState<number>(0.3);

  // Secuenciador. Canales y nº de pasos son independientes (canal 2 = pitch + CV/gate).
  // Config y pasos se persisten; `running` no (no auto-arranca al recargar).
  const [seqChannels, setSeqChannels] = usePersistentState<SeqChannels>(PERSIST_KEYS.seqChannels, 1);
  const [seqSteps, setSeqSteps] = usePersistentState<number>(PERSIST_KEYS.seqSteps, 16);
  const [seqDirection, setSeqDirection] = usePersistentState<SeqDirection>(
    PERSIST_KEYS.seqDirection,
    'forward',
  );
  const [seqBpm, setSeqBpm] = usePersistentState<number>(PERSIST_KEYS.seqBpm, 120);
  const [seqRunning, setSeqRunning] = useState<boolean>(false);
  const [pitchSteps, setPitchSteps] = usePersistentState<PitchStep[]>(PERSIST_KEYS.pitchSteps, () =>
    Array.from({ length: MAX_STEPS }, () => ({ offset: 12, gate: true, velocity: 1, gateLen: 0.8 })),
  );
  const [cvSteps, setCvSteps] = usePersistentState<CvStep[]>(PERSIST_KEYS.cvSteps, () =>
    Array.from({ length: MAX_STEPS }, () => ({ value: 0, gate: false, velocity: 1, gateLen: 0.8 })),
  );
  const [cv2Steps, setCv2Steps] = usePersistentState<CvStep[]>(PERSIST_KEYS.cv2Steps, () =>
    Array.from({ length: MAX_STEPS }, () => ({ value: 0, gate: false, velocity: 1, gateLen: 0.8 })),
  );

  // Motor de audio: construye el grafo de Tone.js una sola vez y sincroniza
  // estos parámetros con sus nodos sin reconstruirlo.
  const engine = useSynthEngine({
    oscType, frequency, pwm: pwm1,
    osc2Type, detune, osc2Enabled, pwm2,
    osc3Type, osc3Detune, osc3Enabled, pwm3,
    noiseType, noiseEnabled, noiseFilterEnabled, noiseFilterFreq,
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

  // Despachador de gates: dado un evento de una fuente, dispara las envolventes conectadas
  // en la matriz de gates. Se lee gatePatch por ref para no recrear los callbacks.
  const gatePatchRef = useRef(gatePatch);
  gatePatchRef.current = gatePatch;

  const fireGateAttack = useCallback(
    (source: GateSourceId, note: string | undefined, time?: number, velocity = 1) => {
      if (note) engine.setNote(note, time);
      for (const dest of GATE_DESTS) {
        if (gatePatchRef.current[gateKey(source, dest.id)]) engine.envAttack(dest.id, time, velocity);
      }
    },
    [engine],
  );

  const fireGateRelease = useCallback(
    (source: GateSourceId, time?: number) => {
      // Sólo los destinos tipo gate (ADSR) responden al note-off; los trigger lo ignoran.
      for (const dest of GATE_DESTS) {
        if (dest.mode === 'gate' && gatePatchRef.current[gateKey(source, dest.id)]) {
          engine.envRelease(dest.id, time);
        }
      }
    },
    [engine],
  );

  // Orquestación del secuenciador (dispara a través del despachador de gates).
  const { currentStep, reset: resetSequencer } = useSequencer({
    running: seqRunning,
    bpm: seqBpm,
    channels: seqChannels,
    steps: seqSteps,
    direction: seqDirection,
    pitchSteps,
    cvSteps,
    cv2Steps,
    fireAttack: fireGateAttack,
    fireRelease: fireGateRelease,
    setSeqCv: engine.setSeqCv,
    setSeqCv2: engine.setSeqCv2,
  });

  // --- Presets con nombre ---
  // captureState/applyState son el ÚNICO punto a tocar para extender los presets a más
  // parámetros: añade el campo en PresetState y una línea en cada uno (mismo patrón).
  const { presets, save: savePreset, remove: removePreset, get: getPreset, importMany } =
    usePresets();

  const captureState = useCallback(
    (): PresetState => ({
      oscType, frequency, pwm1,
      osc2Type, detune, osc2Enabled, pwm2,
      osc3Type, osc3Detune, osc3Enabled, pwm3,
      noiseType, noiseEnabled, noiseFilterEnabled, noiseFilterFreq,
      mixOsc1, mixOsc2, mixOsc3, mixNoise,
      filterType, filterFreq, filterRes,
      ad1Attack, ad1Decay, ad1Amount,
      ad2Attack, ad2Decay, ad2Amount,
      attack, decay, sustain, release,
      volume,
      lfoType, lfoRate, lfoDepth,
      lfo2Type, lfo2Rate, lfo2Depth,
      reverbDecay, reverbWet,
      modPatch, gatePatch,
      seqChannels, seqSteps, seqDirection, seqBpm, pitchSteps, cvSteps, cv2Steps,
    }),
    [
      oscType, frequency, pwm1,
      osc2Type, detune, osc2Enabled, pwm2,
      osc3Type, osc3Detune, osc3Enabled, pwm3,
      noiseType, noiseEnabled, noiseFilterEnabled, noiseFilterFreq,
      mixOsc1, mixOsc2, mixOsc3, mixNoise,
      filterType, filterFreq, filterRes,
      ad1Attack, ad1Decay, ad1Amount,
      ad2Attack, ad2Decay, ad2Amount,
      attack, decay, sustain, release,
      volume,
      lfoType, lfoRate, lfoDepth,
      lfo2Type, lfo2Rate, lfo2Depth,
      reverbDecay, reverbWet,
      modPatch, gatePatch,
      seqChannels, seqSteps, seqDirection, seqBpm, pitchSteps, cvSteps, cv2Steps,
    ],
  );

  // Aplica un preset. Usa `!== undefined` para no descartar valores válidos 0/false.
  const applyState = useCallback(
    (s: Partial<PresetState>) => {
      if (s.oscType !== undefined) setOscType(s.oscType);
      if (s.frequency !== undefined) setFrequency(s.frequency);
      if (s.pwm1 !== undefined) setPwm1(s.pwm1);
      if (s.osc2Type !== undefined) setOsc2Type(s.osc2Type);
      if (s.detune !== undefined) setDetune(s.detune);
      if (s.osc2Enabled !== undefined) setOsc2Enabled(s.osc2Enabled);
      if (s.pwm2 !== undefined) setPwm2(s.pwm2);
      if (s.osc3Type !== undefined) setOsc3Type(s.osc3Type);
      if (s.osc3Detune !== undefined) setOsc3Detune(s.osc3Detune);
      if (s.osc3Enabled !== undefined) setOsc3Enabled(s.osc3Enabled);
      if (s.pwm3 !== undefined) setPwm3(s.pwm3);
      if (s.noiseType !== undefined) setNoiseType(s.noiseType);
      if (s.noiseEnabled !== undefined) setNoiseEnabled(s.noiseEnabled);
      if (s.noiseFilterEnabled !== undefined) setNoiseFilterEnabled(s.noiseFilterEnabled);
      if (s.noiseFilterFreq !== undefined) setNoiseFilterFreq(s.noiseFilterFreq);
      if (s.mixOsc1 !== undefined) setMixOsc1(s.mixOsc1);
      if (s.mixOsc2 !== undefined) setMixOsc2(s.mixOsc2);
      if (s.mixOsc3 !== undefined) setMixOsc3(s.mixOsc3);
      if (s.mixNoise !== undefined) setMixNoise(s.mixNoise);
      if (s.filterType !== undefined) setFilterType(s.filterType);
      if (s.filterFreq !== undefined) setFilterFreq(s.filterFreq);
      if (s.filterRes !== undefined) setFilterRes(s.filterRes);
      if (s.ad1Attack !== undefined) setAd1Attack(s.ad1Attack);
      if (s.ad1Decay !== undefined) setAd1Decay(s.ad1Decay);
      if (s.ad1Amount !== undefined) setAd1Amount(s.ad1Amount);
      if (s.ad2Attack !== undefined) setAd2Attack(s.ad2Attack);
      if (s.ad2Decay !== undefined) setAd2Decay(s.ad2Decay);
      if (s.ad2Amount !== undefined) setAd2Amount(s.ad2Amount);
      if (s.attack !== undefined) setAttack(s.attack);
      if (s.decay !== undefined) setDecay(s.decay);
      if (s.sustain !== undefined) setSustain(s.sustain);
      if (s.release !== undefined) setRelease(s.release);
      if (s.volume !== undefined) setVolume(s.volume);
      if (s.lfoType !== undefined) setLfoType(s.lfoType);
      if (s.lfoRate !== undefined) setLfoRate(s.lfoRate);
      if (s.lfoDepth !== undefined) setLfoDepth(s.lfoDepth);
      if (s.lfo2Type !== undefined) setLfo2Type(s.lfo2Type);
      if (s.lfo2Rate !== undefined) setLfo2Rate(s.lfo2Rate);
      if (s.lfo2Depth !== undefined) setLfo2Depth(s.lfo2Depth);
      if (s.reverbDecay !== undefined) setReverbDecay(s.reverbDecay);
      if (s.reverbWet !== undefined) setReverbWet(s.reverbWet);
      if (s.modPatch) setModPatch(s.modPatch);
      if (s.gatePatch) setGatePatch(s.gatePatch);
      if (s.seqChannels !== undefined) setSeqChannels(s.seqChannels);
      if (s.seqSteps !== undefined) setSeqSteps(s.seqSteps);
      if (s.seqDirection !== undefined) setSeqDirection(s.seqDirection);
      if (s.seqBpm !== undefined) setSeqBpm(s.seqBpm);
      if (s.pitchSteps) setPitchSteps(s.pitchSteps);
      if (s.cvSteps) setCvSteps(s.cvSteps);
      if (s.cv2Steps) setCv2Steps(s.cv2Steps);
    },
    // Los setters de useState/usePersistentState tienen identidad estable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handleSavePreset = useCallback(
    (name: string) => savePreset(name, captureState()),
    [savePreset, captureState],
  );
  const handleLoadPreset = useCallback(
    (name: string) => {
      const state = getPreset(name);
      if (state) applyState(state);
    },
    [getPreset, applyState],
  );

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
        fireGateAttack('keyboard', note);
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
        fireGateRelease('keyboard');
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
  }, [engine, fireGateAttack, fireGateRelease]);

  // Tocar/soltar con los botones del teclado en pantalla (usa la frecuencia actual).
  const playNote = () => {
    fireGateAttack('keyboard', undefined);
    setIsPlaying(true);
  };

  const stopNote = () => {
    fireGateRelease('keyboard');
    setIsPlaying(false);
  };

  return (
    <div className="synth-container">
      <h1 className={"synthTitle"}>MAKINE</h1>

      <Presets
        presets={presets}
        onSave={handleSavePreset}
        onLoad={handleLoadPreset}
        onDelete={removePreset}
        onImport={importMany}
      />

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

        <Noise
          noiseType={noiseType}
          setNoiseType={setNoiseType}
          enabled={noiseEnabled}
          setEnabled={setNoiseEnabled}
          filterEnabled={noiseFilterEnabled}
          setFilterEnabled={setNoiseFilterEnabled}
          filterFreq={noiseFilterFreq}
          setFilterFreq={setNoiseFilterFreq}
        />

        <VCF
          filterType={filterType}
          setFilterType={setFilterType}
          frequency={filterFreq}
          setFrequency={setFilterFreq}
          resonance={filterRes}
          setResonance={setFilterRes}
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
          mixNoise={mixNoise}
          setMixNoise={setMixNoise}
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

        <Reverb
          decay={reverbDecay}
          setDecay={setReverbDecay}
          wet={reverbWet}
          setWet={setReverbWet}
        />
        
        <PatchMatrix
          patch={modPatch}
          setPatch={setModPatch}
          gatePatch={gatePatch}
          setGatePatch={setGatePatch}
        />

        <Sequencer
          channels={seqChannels}
          setChannels={setSeqChannels}
          steps={seqSteps}
          setSteps={setSeqSteps}
          direction={seqDirection}
          setDirection={setSeqDirection}
          bpm={seqBpm}
          setBpm={setSeqBpm}
          running={seqRunning}
          setRunning={setSeqRunning}
          onReset={resetSequencer}
          pitchSteps={pitchSteps}
          setPitchSteps={setPitchSteps}
          cvSteps={cvSteps}
          setCvSteps={setCvSteps}
          cv2Steps={cv2Steps}
          setCv2Steps={setCv2Steps}
          currentStep={currentStep}
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
