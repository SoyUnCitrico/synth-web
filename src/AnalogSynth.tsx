import React, { useState, useEffect } from 'react';
import * as Tone from 'tone';
import { VCO } from './components/VCO/VCO';
import { VCF } from './components/VCF/VCF';
import { ADSR } from './components/ADSR/ADSR';
import { VCA } from './components/VCA/VCA';
import './App.css';

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
  const [oscType, setOscType] = useState<Tone.ToneOscillatorType>('sawtooth');
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
    
    // Crear los osciladores
    // @ts-ignore
    const osc1 = new Tone.Oscillator({
      type: oscType,
      frequency: frequency
    });
    // @ts-ignore
    const osc2 = new Tone.Oscillator({
      type: osc2Type,
      frequency: frequency,
      detune: detune
    });
    
    // Conectar la señal
    vcf.connect(env);
    env.connect(gainNode);
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
    };
  }, [oscType, osc2Type, filterType, attack, decay, sustain, release, volume]);
  
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
    }
  }, [mainOsc, oscType, frequency]);
  
  // Actualizar parámetros del oscilador 2
  useEffect(() => {
    if (secondOsc) {
      secondOsc.type = osc2Type;
      secondOsc.frequency.value = frequency;
      secondOsc.detune.value = detune;
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

return (
    <div className="synth-container">
      <h1 className={"synthTitle"}>React Synth</h1>
      
      <div className="synth-modules">
        <VCO 
          oscType={oscType} 
          setOscType={setOscType} 
          frequency={frequency} 
          setFrequency={setFrequency}
          isSecondary={false}
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
      </div>
    </div>
  );
};

export default AnalogSynthEmulator;