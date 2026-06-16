import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as Tone from 'tone';
import { ModMatrix } from './cv/ModMatrix';
import { MOD_SOURCES, MOD_DESTS, patchKey, type ModPatch } from './cv/patch';
import type { ModSourceId } from './cv/types';

export type NoiseType = 'white' | 'pink' | 'brown';

// Rangos de modulación a profundidad/cantidad máxima (depth = 1). Sirven como
// `unitPerAmount` de los destinos de la matriz: un depth de 1 produce este desvío.
const LFO_PITCH_RANGE_CENTS = 1200; // ±1 octava
const LFO_FILTER_RANGE_HZ = 6000; // ±6 kHz

/**
 * Aplica la forma de onda a un OmniOscillator. La onda "cuadrada" se implementa con un
 * oscilador de pulso para permitir PWM: su ancho (width, -1..1) controla el ciclo de
 * trabajo; width 0 = cuadrada simétrica (50%). El resto de ondas ignoran el PWM.
 */
function applyWaveform(
  osc: Tone.OmniOscillator<Tone.PulseOscillator>,
  type: Tone.ToneOscillatorType,
  pwm: number,
) {
  if (type === 'square') {
    if (osc.type !== 'pulse') osc.type = 'pulse';
    osc.width.setValueAtTime(pwm, Tone.now());
  } else if (osc.type !== type) {
    osc.type = type;
  }
}

/**
 * Parámetros de control del sintetizador. Cada campo se sincroniza de forma
 * granular con su nodo de Tone.js (ver los efectos de abajo), de modo que mover
 * un control sólo actualiza ese parámetro y nunca reconstruye el grafo de audio.
 */
export interface SynthParams {
  // OSC 1 (oscilador principal, sigue al teclado)
  oscType: Tone.ToneOscillatorType;
  frequency: number;
  pwm: number; // ancho de pulso de OSC 1 cuando la onda es cuadrada (-1..1)
  // OSC 2
  osc2Type: Tone.ToneOscillatorType;
  detune: number;
  osc2Enabled: boolean;
  pwm2: number; // ancho de pulso de OSC 2 (-1..1)
  // OSC 3
  osc3Type: Tone.ToneOscillatorType;
  osc3Detune: number;
  osc3Enabled: boolean;
  pwm3: number; // ancho de pulso de OSC 3 (-1..1)
  // Generador de ruido
  noiseType: NoiseType;
  noiseEnabled: boolean;
  // Mixer: nivel por canal en dB
  mixOsc1: number;
  mixOsc2: number;
  mixOsc3: number;
  mixNoise: number;
  // Filtro
  filterType: BiquadFilterType;
  filterFreq: number;
  filterRes: number;
  // Envolvente AD 1 (fuente de modulación de la matriz)
  ad1Attack: number;
  ad1Decay: number;
  ad1Depth: number; // -1 a 1 (cantidad de la fuente ad1 en la matriz)
  // Envolvente AD 2 (fuente de modulación de la matriz)
  ad2Attack: number;
  ad2Decay: number;
  ad2Depth: number; // -1 a 1 (cantidad de la fuente ad2 en la matriz)
  // Envolvente de amplitud (ADSR)
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  // Amplificador maestro
  volume: number; // en dB
  // LFO 1 (modulación)
  lfoType: Tone.ToneOscillatorType;
  lfoRate: number; // Hz
  lfoDepth: number; // 0 a 1 (profundidad de la fuente lfo1 en la matriz)
  // LFO 2 (modulación)
  lfo2Type: Tone.ToneOscillatorType;
  lfo2Rate: number; // Hz
  lfo2Depth: number; // 0 a 1 (profundidad de la fuente lfo2 en la matriz)
  // Matriz de patcheo: intersecciones fuente→destino conectadas.
  modPatch: ModPatch;
  // Reverb (final de la cadena)
  reverbDecay: number; // segundos
  reverbWet: number; // 0 (seco) a 1 (húmedo)
}

export interface SynthEngine {
  /** Dispara las envolventes. Si se pasa una nota (ej. "C4") fija el pitch primero.
   *  `time` (tiempo del AudioContext) permite agendar con precisión desde el transporte. */
  triggerAttack: (note?: string, time?: number) => void;
  /** Libera las envolventes (fase de release). */
  triggerRelease: (time?: number) => void;
  /** Cambia el pitch de los osciladores sin re-disparar la envolvente (legato). */
  setNote: (note: string, time?: number) => void;
  /** Fija el valor de la fuente de CV del secuenciador (0..1). */
  setSeqCv: (value: number, time?: number) => void;
  /** Analizador de forma de onda (osciloscopio). */
  waveformAnalyser: React.RefObject<Tone.Analyser | null>;
  /** Analizador FFT (espectro). */
  fftAnalyser: React.RefObject<Tone.Analyser | null>;
}

/**
 * Motor de audio del sintetizador (estilo MiniMoog, monofónico).
 *
 * Cadena de señal:
 *   osc1 ─> ch1 ┐
 *   osc2 ─> ch2 ┤ (mixer: una ganancia por canal)
 *   osc3 ─> ch3 ┼─> VCF ─> ADSR ─> VCA maestro ─┬─> waveform/fft Analyser
 *   ruido─> chN ┘                                └─> Reverb ─> destination
 *
 *   Fuentes de modulación: LFO 1, LFO 2, AD 1, AD 2 ──> ModMatrix ──> destinos
 *   (detune/cutoff/Q/VCA/nivel de ruido). El cableado lo decide modPatch (matriz de
 *   patcheo estilo VCS3). Las AD se disparan con la nota. Ver src/audio/cv/.
 *
 * El grafo se construye una sola vez al montar; los cambios de parámetro se
 * aplican mutando los nodos existentes para minimizar latencia y evitar clics.
 */
export function useSynthEngine(params: SynthParams): SynthEngine {
  const osc1Ref = useRef<Tone.OmniOscillator<Tone.PulseOscillator> | null>(null);
  const osc2Ref = useRef<Tone.OmniOscillator<Tone.PulseOscillator> | null>(null);
  const osc3Ref = useRef<Tone.OmniOscillator<Tone.PulseOscillator> | null>(null);
  const noiseRef = useRef<Tone.Noise | null>(null);
  // Mixer: una ganancia por canal.
  const ch1Ref = useRef<Tone.Gain | null>(null);
  const ch2Ref = useRef<Tone.Gain | null>(null);
  const ch3Ref = useRef<Tone.Gain | null>(null);
  const chNRef = useRef<Tone.Gain | null>(null);
  const lfoRef = useRef<Tone.LFO | null>(null);
  const lfo2Ref = useRef<Tone.LFO | null>(null);
  const seqCvRef = useRef<Tone.Signal<'number'> | null>(null);
  const matrixRef = useRef<ModMatrix | null>(null);
  const filterRef = useRef<Tone.Filter | null>(null);
  const envelopeRef = useRef<Tone.AmplitudeEnvelope | null>(null);
  // Envolventes AD (fuentes de modulación de la matriz).
  const ad1Ref = useRef<Tone.Envelope | null>(null);
  const ad2Ref = useRef<Tone.Envelope | null>(null);
  const gainRef = useRef<Tone.Gain | null>(null);
  const reverbRef = useRef<Tone.Reverb | null>(null);
  const waveformRef = useRef<Tone.Analyser | null>(null);
  const fftRef = useRef<Tone.Analyser | null>(null);

  // --- Construcción del grafo (una sola vez) ---
  useEffect(() => {
    const osc1 = new Tone.OmniOscillator<Tone.PulseOscillator>(params.frequency, 'sine');
    applyWaveform(osc1, params.oscType, params.pwm);
    const osc2 = new Tone.OmniOscillator<Tone.PulseOscillator>(params.frequency, 'sine');
    applyWaveform(osc2, params.osc2Type, params.pwm2);
    osc2.detune.value = params.detune;
    const osc3 = new Tone.OmniOscillator<Tone.PulseOscillator>(params.frequency, 'sine');
    applyWaveform(osc3, params.osc3Type, params.pwm3);
    osc3.detune.value = params.osc3Detune;
    const noise = new Tone.Noise(params.noiseType);

    const ch1 = new Tone.Gain(Tone.dbToGain(params.mixOsc1));
    const ch2 = new Tone.Gain(Tone.dbToGain(params.mixOsc2));
    const ch3 = new Tone.Gain(Tone.dbToGain(params.mixOsc3));
    const chN = new Tone.Gain(Tone.dbToGain(params.mixNoise));

    const filter = new Tone.Filter({
      type: params.filterType,
      frequency: params.filterFreq,
      Q: params.filterRes,
    });

    const envelope = new Tone.AmplitudeEnvelope({
      attack: params.attack,
      decay: params.decay,
      sustain: params.sustain,
      release: params.release,
    });
    const gain = new Tone.Gain(Tone.dbToGain(params.volume));

    const reverb = new Tone.Reverb({
      decay: params.reverbDecay,
      preDelay: 0.01,
      wet: params.reverbWet,
    });

    const waveform = new Tone.Analyser({ type: 'waveform', size: 512, smoothing: 0.8 });
    const fft = new Tone.Analyser({ type: 'fft', size: 512, smoothing: 0.8 });

    const lfo = new Tone.LFO({
      frequency: params.lfoRate,
      type: params.lfoType,
      min: -1,
      max: 1,
    });
    const lfo2 = new Tone.LFO({
      frequency: params.lfo2Rate,
      type: params.lfo2Type,
      min: -1,
      max: 1,
    });

    // Envolventes AD (sustain 0 => Ataque-Decay). Son fuentes de modulación: su salida
    // (0..1) se rutea por la matriz; no están cableadas a nada por defecto.
    const ad1 = new Tone.Envelope({
      attack: params.ad1Attack,
      decay: params.ad1Decay,
      sustain: 0,
      release: 0.05,
    });
    const ad2 = new Tone.Envelope({
      attack: params.ad2Attack,
      decay: params.ad2Decay,
      sustain: 0,
      release: 0.05,
    });

    // Señal de CV del secuenciador (canal B). El secuenciador la actualiza por paso;
    // la matriz la rutea a cualquier destino.
    const seqCv = new Tone.Signal(0);

    // Ruteo. Cada fuente pasa por su canal del mixer; osc1 va siempre al filtro,
    // los demás canales los conectan sus efectos de habilitación (corren al montar).
    osc1.connect(ch1);
    osc2.connect(ch2);
    osc3.connect(ch3);
    noise.connect(chN);
    ch1.connect(filter);

    filter.chain(envelope, gain);
    gain.connect(waveform);
    gain.connect(fft);
    gain.connect(reverb);
    reverb.toDestination();

    // Matriz de modulación (CV): los LFO (-1..1) y las envolventes AD (0..1) son fuentes;
    // los AudioParams modulables son destinos. El cableado concreto lo fija el efecto de
    // sincronización de la matriz (desde modPatch). Ver src/audio/cv/.
    const matrix = new ModMatrix();
    matrix.registerSource({ id: 'lfo1', output: lfo, range: 'bipolar' });
    matrix.registerSource({ id: 'lfo2', output: lfo2, range: 'bipolar' });
    matrix.registerSource({ id: 'ad1', output: ad1, range: 'unipolar' });
    matrix.registerSource({ id: 'ad2', output: ad2, range: 'unipolar' });
    matrix.registerSource({ id: 'seqCv', output: seqCv, range: 'unipolar' });
    matrix.registerDest({ id: 'osc1Detune', param: osc1.detune, unitPerAmount: LFO_PITCH_RANGE_CENTS });
    matrix.registerDest({ id: 'osc2Detune', param: osc2.detune, unitPerAmount: LFO_PITCH_RANGE_CENTS });
    matrix.registerDest({ id: 'osc3Detune', param: osc3.detune, unitPerAmount: LFO_PITCH_RANGE_CENTS });
    matrix.registerDest({ id: 'filterFreq', param: filter.frequency, unitPerAmount: LFO_FILTER_RANGE_HZ });
    matrix.registerDest({ id: 'filterQ', param: filter.Q, unitPerAmount: 10 });
    matrix.registerDest({ id: 'vcaGain', param: gain.gain, unitPerAmount: 1 });
    matrix.registerDest({ id: 'noiseLevel', param: chN.gain, unitPerAmount: 1 });

    // Las fuentes corren en continuo; la envolvente de amplitud las abre/cierra.
    osc1.start();
    osc2.start();
    osc3.start();
    noise.start();
    lfo.start();
    lfo2.start();

    osc1Ref.current = osc1;
    osc2Ref.current = osc2;
    osc3Ref.current = osc3;
    noiseRef.current = noise;
    ch1Ref.current = ch1;
    ch2Ref.current = ch2;
    ch3Ref.current = ch3;
    chNRef.current = chN;
    lfoRef.current = lfo;
    lfo2Ref.current = lfo2;
    matrixRef.current = matrix;
    filterRef.current = filter;
    envelopeRef.current = envelope;
    ad1Ref.current = ad1;
    ad2Ref.current = ad2;
    seqCvRef.current = seqCv;
    gainRef.current = gain;
    reverbRef.current = reverb;
    waveformRef.current = waveform;
    fftRef.current = fft;

    return () => {
      osc1.dispose();
      osc2.dispose();
      osc3.dispose();
      noise.dispose();
      ch1.dispose();
      ch2.dispose();
      ch3.dispose();
      chN.dispose();
      matrix.dispose();
      lfo.dispose();
      lfo2.dispose();
      filter.dispose();
      envelope.dispose();
      ad1.dispose();
      ad2.dispose();
      seqCv.dispose();
      gain.dispose();
      reverb.dispose();
      waveform.dispose();
      fft.dispose();
    };
    // Sólo al montar: los valores iniciales se leen una vez y los cambios
    // posteriores los gestionan los efectos de sincronización de abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Sincronización granular de parámetros (sin reconstruir el grafo) ---

  // OSC 1: forma de onda + PWM
  useEffect(() => {
    if (osc1Ref.current) applyWaveform(osc1Ref.current, params.oscType, params.pwm);
  }, [params.oscType, params.pwm]);

  // Frecuencia base compartida por los tres osciladores.
  useEffect(() => {
    const now = Tone.now();
    osc1Ref.current?.frequency.setValueAtTime(params.frequency, now);
    osc2Ref.current?.frequency.setValueAtTime(params.frequency, now);
    osc3Ref.current?.frequency.setValueAtTime(params.frequency, now);
  }, [params.frequency]);

  // OSC 2: forma de onda + PWM
  useEffect(() => {
    if (osc2Ref.current) applyWaveform(osc2Ref.current, params.osc2Type, params.pwm2);
  }, [params.osc2Type, params.pwm2]);

  useEffect(() => {
    osc2Ref.current?.detune.setValueAtTime(params.detune, Tone.now());
  }, [params.detune]);

  useEffect(() => {
    const ch2 = ch2Ref.current;
    const filter = filterRef.current;
    if (!ch2 || !filter) return;
    if (params.osc2Enabled) ch2.connect(filter);
    else ch2.disconnect();
  }, [params.osc2Enabled]);

  // OSC 3: forma de onda + PWM
  useEffect(() => {
    if (osc3Ref.current) applyWaveform(osc3Ref.current, params.osc3Type, params.pwm3);
  }, [params.osc3Type, params.pwm3]);

  useEffect(() => {
    osc3Ref.current?.detune.setValueAtTime(params.osc3Detune, Tone.now());
  }, [params.osc3Detune]);

  useEffect(() => {
    const ch3 = ch3Ref.current;
    const filter = filterRef.current;
    if (!ch3 || !filter) return;
    if (params.osc3Enabled) ch3.connect(filter);
    else ch3.disconnect();
  }, [params.osc3Enabled]);

  // Ruido
  useEffect(() => {
    if (noiseRef.current) noiseRef.current.type = params.noiseType;
  }, [params.noiseType]);

  useEffect(() => {
    const chN = chNRef.current;
    const filter = filterRef.current;
    if (!chN || !filter) return;
    if (params.noiseEnabled) chN.connect(filter);
    else chN.disconnect();
  }, [params.noiseEnabled]);

  // Mixer: nivel por canal
  useEffect(() => {
    ch1Ref.current?.gain.setValueAtTime(Tone.dbToGain(params.mixOsc1), Tone.now());
  }, [params.mixOsc1]);

  useEffect(() => {
    ch2Ref.current?.gain.setValueAtTime(Tone.dbToGain(params.mixOsc2), Tone.now());
  }, [params.mixOsc2]);

  useEffect(() => {
    ch3Ref.current?.gain.setValueAtTime(Tone.dbToGain(params.mixOsc3), Tone.now());
  }, [params.mixOsc3]);

  useEffect(() => {
    chNRef.current?.gain.setValueAtTime(Tone.dbToGain(params.mixNoise), Tone.now());
  }, [params.mixNoise]);

  // Filtro
  useEffect(() => {
    const filter = filterRef.current;
    if (!filter) return;
    filter.type = params.filterType;
    filter.frequency.setValueAtTime(params.filterFreq, Tone.now());
    filter.Q.setValueAtTime(params.filterRes, Tone.now());
  }, [params.filterType, params.filterFreq, params.filterRes]);

  // Envolventes AD de modulación (attack/decay). La cantidad (depth) la aplica el efecto
  // de la matriz; aquí sólo se sincroniza la forma de la envolvente.
  useEffect(() => {
    const ad = ad1Ref.current;
    if (!ad) return;
    ad.attack = params.ad1Attack;
    ad.decay = params.ad1Decay;
  }, [params.ad1Attack, params.ad1Decay]);

  useEffect(() => {
    const ad = ad2Ref.current;
    if (!ad) return;
    ad.attack = params.ad2Attack;
    ad.decay = params.ad2Decay;
  }, [params.ad2Attack, params.ad2Decay]);

  // Envolvente de amplitud
  useEffect(() => {
    const env = envelopeRef.current;
    if (!env) return;
    env.attack = params.attack;
    env.decay = params.decay;
    env.sustain = params.sustain;
    env.release = params.release;
  }, [params.attack, params.decay, params.sustain, params.release]);

  // Amplificador maestro
  useEffect(() => {
    gainRef.current?.gain.setValueAtTime(Tone.dbToGain(params.volume), Tone.now());
  }, [params.volume]);

  // LFO 1: forma de onda y velocidad
  useEffect(() => {
    if (lfoRef.current) lfoRef.current.type = params.lfoType;
  }, [params.lfoType]);

  useEffect(() => {
    lfoRef.current?.frequency.setValueAtTime(params.lfoRate, Tone.now());
  }, [params.lfoRate]);

  // LFO 2: forma de onda y velocidad
  useEffect(() => {
    if (lfo2Ref.current) lfo2Ref.current.type = params.lfo2Type;
  }, [params.lfo2Type]);

  useEffect(() => {
    lfo2Ref.current?.frequency.setValueAtTime(params.lfo2Rate, Tone.now());
  }, [params.lfo2Rate]);

  // Matriz de patcheo: cada intersección conectada rutea su fuente al destino con la
  // profundidad de esa fuente; las no conectadas quedan en 0 (sin desconectar, evita
  // clics). Recorre la configuración (MOD_SOURCES × MOD_DESTS), así añadir filas o
  // columnas no requiere tocar este efecto.
  useEffect(() => {
    const matrix = matrixRef.current;
    if (!matrix) return;
    const depths: Partial<Record<ModSourceId, number>> = {
      lfo1: params.lfoDepth,
      lfo2: params.lfo2Depth,
      ad1: params.ad1Depth,
      ad2: params.ad2Depth,
      // El CV del secuenciador ya trae su valor por paso (0..1); depth 1 = rango completo.
      seqCv: 1,
    };
    for (const src of MOD_SOURCES) {
      const depth = depths[src.id] ?? 0;
      for (const dst of MOD_DESTS) {
        const connected = params.modPatch[patchKey(src.id, dst.id)] ?? false;
        matrix.setAmount(src.id, dst.id, connected ? depth : 0);
      }
    }
  }, [params.modPatch, params.lfoDepth, params.lfo2Depth, params.ad1Depth, params.ad2Depth]);

  // Reverb
  useEffect(() => {
    reverbRef.current?.wet.setValueAtTime(params.reverbWet, Tone.now());
  }, [params.reverbWet]);

  useEffect(() => {
    const reverb = reverbRef.current;
    if (!reverb) return;
    reverb.decay = params.reverbDecay;
    // Regenerar la respuesta al impulso con el nuevo decay.
    reverb.generate().catch(() => {});
  }, [params.reverbDecay]);

  // --- API imperativa para tocar notas (baja latencia) ---
  const setNote = useCallback((note: string, time?: number) => {
    const freq = Tone.Frequency(note).toFrequency();
    const t = time ?? Tone.now();
    osc1Ref.current?.frequency.setValueAtTime(freq, t);
    osc2Ref.current?.frequency.setValueAtTime(freq, t);
    osc3Ref.current?.frequency.setValueAtTime(freq, t);
  }, []);

  const triggerAttack = useCallback(
    (note?: string, time?: number) => {
      if (Tone.context.state !== 'running') Tone.start();
      const t = time ?? Tone.now();
      if (note) setNote(note, t);
      envelopeRef.current?.triggerAttack(t);
      // Disparar las envolventes AD de modulación junto con la nota.
      ad1Ref.current?.triggerAttack(t);
      ad2Ref.current?.triggerAttack(t);
    },
    [setNote],
  );

  const triggerRelease = useCallback((time?: number) => {
    const t = time ?? Tone.now();
    envelopeRef.current?.triggerRelease(t);
    ad1Ref.current?.triggerRelease(t);
    ad2Ref.current?.triggerRelease(t);
  }, []);

  const setSeqCv = useCallback((value: number, time?: number) => {
    seqCvRef.current?.setValueAtTime(value, time ?? Tone.now());
  }, []);

  return useMemo(
    () => ({
      triggerAttack,
      triggerRelease,
      setNote,
      setSeqCv,
      waveformAnalyser: waveformRef,
      fftAnalyser: fftRef,
    }),
    [triggerAttack, triggerRelease, setNote, setSeqCv],
  );
}
