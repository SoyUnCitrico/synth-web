import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import VCO from './components/VCO/VCO';
import { VCF } from './components/VCF/VCF';
import { ADSR } from './components/ADSR/ADSR';
import { VCA } from './components/VCA/VCA';
import './App.css';
import Oscilloscope from './components/Oscilloscope/Oscilloscope';

const keyMap : Record<string, string> = {
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

const AnalogSynthEmulator: React.FC = () => {
  // Estado para los dos osciladores
  const [mainOsc, setMainOsc] = useState<Tone.Oscillator | null>(null);
  const [secondOsc, setSecondOsc] = useState<Tone.Oscillator | null>(null);
  
  // Estado para el filtro
  const [filter, setFilter] = useState<Tone.Filter | null>(null);
  
  // Estado para el amplificador y el envelope
  const [envelope, setEnvelope] = useState<Tone.AmplitudeEnvelope | null>(null);
  const [gain, setGain] = useState<Tone.Gain | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Parámetros de los osciladores
  const [oscType, setOscType] = useState<Tone.ToneOscillatorType>('sine');
  const [frequency, setFrequency] = useState<number>(440);
  
  // Parámetros para el segundo oscilador
  const [osc2Type, setOsc2Type] = useState<Tone.ToneOscillatorType>('sawtooth');
  const [detune, setDetune] = useState<number>(0);
  const [osc2Enabled, setOsc2Enabled] = useState<boolean>(false);
  
  // Parámetros del filtro
  const [filterType, setFilterType] = useState<BiquadFilterType>('lowpass');
  const [filterFreq, setFilterFreq] = useState<number>(2000);
  const [filterRes, setFilterRes] = useState<number>(1);
  
   
  // Parámetros ADSR
  const [attack, setAttack] = useState<number>(0.1);
  const [decay, setDecay] = useState<number>(0.2);
  const [sustain, setSustain] = useState<number>(0.5);
  const [release, setRelease] = useState<number>(1);
  
  // Parámetro de volumen
  const [volume, setVolume] = useState<number>(-6);

  // Manejo del teclado
  const [activeNotes, setActiveNotes] = useState<any>({});
  const [octave, setOctave] = useState(4);

  // Referencias a los nodos de Tone.js
  const oscRef = useRef<any>(null);
  const oscillatorRef = useRef<any>(null);
  const oscillator2Ref = useRef<any>(null);
  const envelopeRef = useRef<any>(null);
  const analyzerRef = useRef<any>(null);
  // Inicializar Tone.js
  useEffect(() => {
    // Crear la estructura del sintetizador
    const env = new Tone.AmplitudeEnvelope({
      attack,
      decay,
      sustain,
      release
    });
    
    // Crear el filtro
    const vcf = new Tone.Filter({
        type: filterType,
        frequency: filterFreq,
        Q: filterRes
    });
    
    const gainNode = new Tone.Gain(Tone.dbToGain(volume));
    
    // Crear los osciladoress
    const osc1 = new Tone.Oscillator(
      frequency,
      oscType
    );

    oscillatorRef.current = osc1;
    // @ts-ignore
    const osc2 = new Tone.Oscillator({
      type: osc2Type,
      frequency: frequency,
      detune: detune
    });
    oscillator2Ref.current = osc2;
    const analyzer = new Tone.Analyser({
      type: "waveform",
      size: 1024
    });
    analyzerRef.current = analyzer;
    
    // Conectar la señal
    vcf.connect(env);
    env.connect(gainNode);
    gainNode.connect(analyzer);
    gainNode.toDestination();
    
    // Solo conectamos el oscilador principal por defecto
    osc1.connect(vcf);
    
    setMainOsc(osc1);
    setSecondOsc(osc2);
    setFilter(vcf);
    setEnvelope(env);
    setGain(gainNode);
    
    return () => {
      osc1.dispose();
      osc2.dispose();
      vcf.dispose();
      env.dispose();
      gainNode.dispose();
      if (analyzer) {
        analyzer.dispose();
      }
    };
  }, [oscType, osc2Type, analyzerRef, filterType, attack, decay, sustain, release, volume]);
  
  // Efecto para manejar el segundo oscilador
  useEffect(() => {
    if (secondOsc && filter) {
      // Conectar/desconectar según el estado
      if (osc2Enabled) {
        secondOsc.connect(filter);
      } else {
        secondOsc.disconnect();
      }
    }
  }, [secondOsc, filter, osc2Enabled]);
  
// Efectos para actualizar los parámetros de los componentes
  
  // Actualizar parámetros del oscilador 1
  useEffect(() => {
    if (mainOsc) {
      mainOsc.type = oscType;
      mainOsc.frequency.value = frequency;
      // oscillatorRef.current.type = oscType;
      // oscillatorRef.current.frequency = frequency;
      // mainOsc.frequency.value = "C6";
    }
  }, [mainOsc, oscType, frequency]);
  
  // Actualizar parámetros del oscilador 2
  useEffect(() => {
    if (secondOsc) {
      secondOsc.type = osc2Type;
      secondOsc.frequency.value = frequency;
      secondOsc.detune.value = detune;
      // oscillator2Ref.current.type = osc2Type;
    }
  }, [secondOsc, osc2Type, frequency, detune]);
  
  // Actualizar parámetros del filtro
  useEffect(() => {
    if (filter) {
      filter.type = filterType;
      filter.frequency.value = filterFreq;
      filter.Q.value = filterRes;
    }
  }, [filter, filterType, filterFreq, filterRes]);
  
  // Actualizar parámetros del envelope
  useEffect(() => {
    if (envelopeRef.current) {
      envelopeRef.current.attack = attack;
      envelopeRef.current.decay = decay;
      envelopeRef.current.sustain = sustain;
      envelopeRef.current.release = release;
    }
    envelopeRef.current = envelope;
  }, [envelope, attack, decay, sustain, release]);
  
  // Actualizar parámetros de ganancia
  useEffect(() => {
    if (gain) {
      gain.gain.value = Tone.dbToGain(volume);
    }
  }, [gain, volume]);

  // Función para tocar una nota
  const playNote = () => {
    if (Tone.context.state !== 'running') {
      Tone.start();
    }
    
    if (mainOsc && secondOsc && envelope && !isPlaying) {
      // Iniciar los osciladores si aún no están corriendo
      if (mainOsc.state !== 'started') mainOsc.start();
      if (secondOsc.state !== 'started' && osc2Enabled) secondOsc.start();
      
      envelope.triggerAttack();
      setIsPlaying(true);
    }
  };

  // Función para detener una nota
  const stopNote = () => {
    if (envelope && isPlaying) {
      envelope.triggerRelease();
      setIsPlaying(false);
    }
  };

  useEffect(() => {
    if (Tone.context.state !== 'running') {
      Tone.start();
    }
    if (mainOsc && secondOsc && envelope && !isPlaying) {
      // Iniciar los osciladores si aún no están corriendo
      if (mainOsc.state !== 'started') mainOsc.start();
      if (secondOsc.state !== 'started' && osc2Enabled) secondOsc.start();
    }
    const handleKeyDown : any = (e : React.KeyboardEvent<any>) => {
      if (e.repeat) return;
      const key = e.key.toLowerCase();
      console.log(key)
      // Cambiar octava
      if (key === 'q' && octave > 1) {
        setOctave(octave - 1);
        return;
      }
      if (key === 'e' && octave < 7) {
        setOctave(octave + 1);
        return;
      }
      
      // Verificar si la tecla corresponde a una nota
      if (keyMap[key] && !activeNotes[key]) {
        // Determinar la octava adecuada (las últimas teclas están en octava superior)
        const noteOctave = [',', 'l', '.', 'ñ', '-'].includes(key) ? octave + 1 : octave;
        const note = `${keyMap[key]}${noteOctave}`;
        
        // Reproducir la nota
        // if(envelope) envelope.triggerAttack();

        // Convertir nombre de nota a frecuencia y configurar el oscilador
        if (oscillatorRef.current) {
          oscillatorRef.current.frequency.value = Tone.Frequency(note);
        }
        
        // Activar la envolvente
        if (envelopeRef.current) {
          envelopeRef.current.triggerAttack();
        }
        
        // Actualizar el estado de teclas activas
        setActiveNotes((prev : any) => ({ ...prev, [key]: note }));
      }
    };

    const handleKeyUp : any = (e : React.KeyboardEvent<any>)=> {
      const key = e.key.toLowerCase();
      
      // Si la tecla liberada corresponde a una nota activa
      if (activeNotes[key]) {
        // Detener la nota
        if(envelope) envelope.triggerRelease();
        
        // Actualizar el estado de teclas activas
        setActiveNotes((prev : any) => {
          const newState = { ...prev };
          delete newState[key];
          return newState;
        });
      }
    };

    // Añadir event listeners
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Limpieza
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [envelope, activeNotes, octave]);

return (
    <div className="synth-container">
      <h1 className={"synthTitle"}>React Synth</h1>
      
      <div className="synth-modules" ref={oscRef}>

        <Oscilloscope 
          analyzerRef={analyzerRef}
          containerRef={oscRef}
        />
        <VCO
          oscType={oscType} 
          setOscType={setOscType} 
          frequency={frequency} 
          setFrequency={setFrequency}
          isSecondary={false}
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
        />
      </div>
      
      <div className="keyboard-controls">
        {/* <button 
          className={`play-button ${isPlaying ? 'active' : ''}`} 
          onMouseDown={playNote} 
          onMouseUp={stopNote}
          onTouchStart={playNote}
          onTouchEnd={stopNote}
        >
          PLAY
        </button> */}
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
                {/* <div></div> */}
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

export default AnalogSynthEmulator;