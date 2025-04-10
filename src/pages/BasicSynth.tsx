import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import VCO from '../components/VCO/VCO';
import { VCF } from '../components/VCF/VCF';
import { ADSR } from '../components/ADSR/ADSR';
import { VCA } from '../components/VCA/VCA';
import '../App.css';
// import Oscilloscope from './components/Oscilloscope/Oscilloscope';
// import SpectrumAnalyzer from './components/Spectrum/Spectrum';

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

const BasicSynth: React.FC = () => {
  // Estado para los dos osciladores
  const [mainOsc, setMainOsc] = useState<Tone.Oscillator | null>(null);
  const [secondOsc, setSecondOsc] = useState<Tone.Oscillator | null>(null);
  
  // Estado para el filtro
  const [filter, setFilter] = useState<Tone.Filter | null>(null);
  
  // Estado para el amplificador y el envelope
  const [envelope, setEnvelope] = useState<Tone.AmplitudeEnvelope | null>(null);
  const [gain, setGain] = useState<Tone.Gain | null>(null);
  const [analyser, setAnalyser] = useState<Tone.Analyser | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Parámetros de los osciladores
  const [oscType, setOscType] = useState<Tone.ToneOscillatorType>('sawtooth');
  const [frequency, setFrequency] = useState<number>(440);
  
  // Parámetros para el segundo oscilador
  const [osc2Type, setOsc2Type] = useState<Tone.ToneOscillatorType>('sawtooth');
  const [detune, setDetune] = useState<number>(0);
  const [osc2Enabled, setOsc2Enabled] = useState<boolean>(false);
  
  // Parámetros del filtro
  const [filterType, setFilterType] = useState<BiquadFilterType>('lowpass');
  const [filterFreq, setFilterFreq] = useState<number>(20000);
  const [filterRes, setFilterRes] = useState<number>(1);
  
   
  // Parámetros ADSR
  const [attack, setAttack] = useState<number>(0.1);
  const [decay, setDecay] = useState<number>(0.2);
  const [sustain, setSustain] = useState<number>(0.5);
  const [release, setRelease] = useState<number>(1);
  
  // Parámetro de volumen
  const [volume, setVolume] = useState<number>(-6);

  // Manejo del teclado
  const [activeNotes, setActiveNotes] = useState<Record<string, string>>({});
  const [octave, setOctave] = useState(4);

  const oscRef = useRef<HTMLDivElement | null>(null);  
  
  // Referencias a los nodos de Tone.js
  const oscillatorRef = useRef<Tone.Oscillator | null>(null);
  const oscillator2Ref = useRef<Tone.Oscillator | null>(null);
  const vcfRef = useRef<Tone.Filter | null>(null);
  const gainRef = useRef<Tone.Gain | null>(null);
  const envelopeRef = useRef<Tone.AmplitudeEnvelope | null>(null);
  const analyserRef = useRef<Tone.Analyser | null>(null);
  const spectrumRef = useRef<Tone.Analyser | null>(null);


  useEffect(() => {
        // Crear los osciladoress
    
    const osc1 = new Tone.Oscillator(
      frequency,
      oscType
    );
    oscillatorRef.current = osc1;
    
    // @ts-expect-error Se crea un nuevo objeto de opciones para Tone Oscillator que no esta especificado en los tipos pero puede usarse
    const osc2 = new Tone.Oscillator({
      type: osc2Type,
      frequency: frequency,
      detune: detune
    });
    oscillator2Ref.current = osc2;

    // Crear la estructura del sintetizador
    const env = new Tone.AmplitudeEnvelope({
      attack,
      decay,
      sustain,
      release
    });
    envelopeRef.current = env;
    // Crear el filtro
    const vcf = new Tone.Filter({
        type: filterType,
        frequency: filterFreq,
        Q: filterRes
    });
    vcfRef.current = vcf;

    const gainNode = new Tone.Gain(Tone.dbToGain(volume));
    gainRef.current = gainNode;

    const analyserNode = new Tone.Analyser({
      type: "waveform",
      size: 512,
      smoothing : 0.8
    });
    analyserRef.current = analyserNode;
    
    // Crear un analizador para FFT (espectro)
    const fftAnalyzer = new Tone.Analyser({
      type: "fft",
      size: 512,
      smoothing: 0.8
    });
    spectrumRef.current = fftAnalyzer;
    
    // Dividir la señal para ambos analizadores
    const splitter = new Tone.Split();
    splitter.connect(analyserNode);
    splitter.connect(fftAnalyzer);

    //Conexion
    // Solo conectamos el oscilador principal por defecto
    osc1.connect(vcf);
    vcf.connect(env);
    env.connect(gainNode);
    gainNode.connect(splitter);
    splitter.toDestination();
    
    setMainOsc(osc1);
    setSecondOsc(osc2);
    setFilter(vcf);
    setEnvelope(env);
    setGain(gainNode);
    setAnalyser(analyserNode)
    
    return () => {
      osc1.dispose();
      osc2.dispose();
      vcf.dispose();
      env.dispose();
      gainNode.dispose();
      analyserNode.dispose();
      splitter.dispose();
      
    };
  }, [oscType, osc2Type, detune, filterType, filterFreq, filterRes, frequency, attack, decay, sustain, release, volume]);
  
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
  

  // Actualizar parámetros del oscilador 1
  useEffect(() => {
    if (mainOsc && analyser) {
      // mainOsc.type = oscType;
      // mainOsc.frequency.value = frequency; 
      if(oscillatorRef.current) oscillatorRef.current.type = oscType;
      if(oscillatorRef.current) oscillatorRef.current.frequency.value = frequency;
    
    }
      
  }, [mainOsc, oscType, frequency, analyser]);
  
  // Actualizar parámetros del oscilador 2
  useEffect(() => {
    if (secondOsc) {
      // secondOsc.type = osc2Type;
      // secondOsc.frequency.value = frequency;
      // secondOsc.detune.value = detune;
      if(oscillator2Ref.current) {        
        oscillator2Ref.current.type = osc2Type;
        oscillator2Ref.current.frequency.value = frequency;
        oscillator2Ref.current.detune.value = detune;
      }
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
    if (envelope) {
      envelope.attack = attack;
      envelope.decay = decay;
      envelope.sustain = sustain;
      envelope.release = release;
    }
    
  }, [envelope, attack, decay, sustain, release]);
  
  // Actualizar parámetros de ganancia
  useEffect(() => {
    if (gain) {
      // gain.disconnect();
      // envelope?.connect(gain);
      // analyser?.connect(gain)
      gain.gain.value = Tone.dbToGain(volume);
      // gain.toDestination();
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
      // envelopeRef.current.triggerAttack();
      setIsPlaying(true);
    }
  };

  // Función para detener una nota
  const stopNote = () => {
    if (envelope && isPlaying) {
      envelope.triggerRelease();
      // envelopeRef.current.triggerRelease();
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
    const handleKeyDown = (ev : React.KeyboardEvent) => {
      if (ev.repeat) return;
      const key = ev.key.toLowerCase();

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

        // Convertir nombre de nota a frecuencia y configurar el oscilador
        if (oscillatorRef.current) {
          // @ts-expect-error frequency value esta especificado en el onjeto Tone.Oscillator al que hace referencia oscillatorRef.current
          oscillatorRef.current.frequency.value = Tone.Frequency(note);
        }
        
        // Activar la envolvente
        if (envelopeRef.current) {     
          envelopeRef.current.triggerAttack();
        }

        // if(mainOsc) {
        //   mainOsc.frequency.value = Tone.Frequency(note)
        // }
                
        // if(envelope) {
        //   envelope.triggerAttack();
        // }
        
        // Actualizar el estado de teclas activas
        setActiveNotes((prev) => ({ ...prev, [key]: note }));
      }
    };

    const handleKeyUp = (ev : React.KeyboardEvent)=> {
      const key = ev.key.toLowerCase();
      
      // Si la tecla liberada corresponde a una nota activa
      if (activeNotes[key]) {
        // Detener la nota
        if(envelope) envelope.triggerRelease();
        
        // Actualizar el estado de teclas activas
        setActiveNotes((prev) => {
          const newState = { ...prev };
          delete newState[key];
          return newState;
        });
      }
    };

    // Añadir event listeners
    // @ts-expect-error No se encuentra el tipo especifico para este listener
    window.addEventListener('keydown', handleKeyDown);
    // @ts-expect-error No se encuentra el tipo especifico para este listener
    window.addEventListener('keyup', handleKeyUp);

    // Limpieza
    return () => {
      // @ts-expect-error No se encuentra el tipo especifico para este listener
      window.removeEventListener('keydown', handleKeyDown);
      // @ts-expect-error No se encuentra el tipo especifico para este listener
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isPlaying, mainOsc, osc2Enabled, secondOsc, envelope, activeNotes, octave]);

return (
    <div className="synth-container">
      <h1 className={"synthTitle"}>Synth Básico</h1>
      
      <div className="synth-modules" ref={oscRef}>        
        {/* <Oscilloscope           
          analyzerRef={analyserRef}
          containerRef={oscRef}
          key={`${oscType},${osc2Type},${frequency??440},${detune?? 0},${filterFreq},${filterType},${filterRes},${volume ?? 0.2},${attack??0},${decay??0},${sustain??0},${release??0}`}
        /> */}

        {/* <SpectrumAnalyzer
          key={`2${oscType},${osc2Enabled},${osc2Type},${frequency??440},${detune?? 0},${filterFreq},${filterType},${filterRes},${volume ?? 0.2},${attack??0},${decay??0},${sustain??0},${release??0}`}          
          fftAnalyzerRef={spectrumRef}
          specRef={oscRef}
        /> */}
        
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

export default BasicSynth;