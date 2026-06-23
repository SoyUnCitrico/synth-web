import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as Tone from 'tone';
import { ModMatrix } from './cv/ModMatrix';
import { MOD_SOURCES, MOD_DESTS, MIDI_CC_SOURCES, patchKey, type ModPatch } from './cv/patch';
import type { ModSourceId } from './cv/types';
import type { GateDestId } from './cv/gates';
import { DRUM_VOICES, synthesizeKit } from './drums/kit';

export type NoiseType = 'white' | 'pink' | 'brown';
// VCF 2: filtro insertable en serie sobre una sola voz (su propio routeo, fuera de la
// matriz). Sólo 3 tipos, todos de 2 polos (-12 dB/oct).
export type Vcf2Type = 'lowpass' | 'highpass' | 'bandpass';
export type Vcf2Source = 'none' | 'vco1' | 'vco2' | 'vco3' | 'vco4';
// Curva de las etapas de una envolvente: lineal (recta) o exponencial (logarítmica, como un
// sinte analógico). Aplica a attack/decay/release a la vez.
export type EnvCurve = 'linear' | 'exponential';

// Rangos de modulación a profundidad/cantidad máxima (depth = 1). Sirven como
// `unitPerAmount` de los destinos de la matriz: un depth de 1 produce este desvío.
// Los destinos de FRECUENCIA (detune de los VCO y cutoff del VCF) se modulan en CENTS, es
// decir de forma logarítmica/exponencial: como los controles "VCO × Octava" de un sinte
// analógico, +1200 cents = +1 octava (×2 de frecuencia), independiente de la nota base.
const LFO_PITCH_RANGE_CENTS = 1200; // ±1 octava (detune de los osciladores)
const FILTER_MOD_RANGE_CENTS = 4800; // ±4 octavas (cutoff del VCF, vía detune del filtro)
const LFO_FILTER_RANGE_HZ = 6000; // ±6 kHz (pasabanda del ruido, lineal en Hz)

// Fondo de cualquier fader de volumen (master y canales del mixer) → silencio total.
// A -40 dB, dbToGain(-40) ≈ 0.01 todavía sonaría (fuga), así que se fuerza la ganancia a 0.
const VOL_MUTE_DB = -40;
const dbToGainMuted = (db: number): number => (db <= VOL_MUTE_DB ? 0 : Tone.dbToGain(db));

// Defensa: una frecuencia no finita o ≤ 0 (p. ej. un input vacío que quedó como NaN/null en
// localStorage) cuelga/ensucia el grafo de Tone.js. Se reemplaza por un valor por defecto.
const safeFreq = (v: number, fallback: number): number => (Number.isFinite(v) && v > 0 ? v : fallback);

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
 * Aplica la forma de onda a un oscilador FAT (VCO 3): antepone "fat" al tipo base
 * (p. ej. 'sawtooth' → 'fatsawtooth') y fija el número de voces (count) y su separación en
 * cents (spread). El count se capa fuera (1..5) para no disparar la CPU en móvil. Los
 * osciladores fat no soportan pulso/PWM (de ahí que el VCO 3 no tenga PWM).
 */
function applyFatWaveform(
  osc: Tone.OmniOscillator<Tone.FatOscillator>,
  type: Tone.ToneOscillatorType,
  spread: number,
  count: number,
) {
  const fatType = `fat${type}` as Tone.ToneOscillatorType;
  if (osc.type !== fatType) osc.type = fatType;
  osc.count = count;
  osc.spread = spread;
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
  osc1Fine: number; // afinado fino de OSC 1 (cents, ±200); se suma al detune de la matriz
  pwm: number; // ancho de pulso de OSC 1 cuando la onda es cuadrada (-1..1)
  // OSC 2
  osc2Type: Tone.ToneOscillatorType;
  osc2Freq: number; // frecuencia base de OSC 2 (Hz, independiente)
  detune: number; // afinado fino de OSC 2 (cents, ±200)
  pwm2: number; // ancho de pulso de OSC 2 (-1..1)
  // OSC 3 (FatOscillator: súper-saw/unísono). Sin PWM.
  osc3Type: Tone.ToneOscillatorType;
  osc3Freq: number; // frecuencia base de OSC 3 (Hz, independiente)
  osc3Detune: number; // afinado fino de OSC 3 (cents, ±200)
  osc3Spread: number; // separación entre las voces fat (cents)
  osc3Count: number; // nº de voces del fat (1..5)
  // OSC 4 (FM: Tone.FMOscillator). Voz completa: tocable y ruteable.
  osc4Type: Tone.ToneOscillatorType; // onda portadora
  osc4Freq: number; // frecuencia base de OSC 4 (Hz, independiente)
  osc4Fine: number; // afinado fino de OSC 4 (cents, ±200)
  fmHarmonicity: number; // razón moduladora/portadora (base; la matriz suma encima)
  fmModIndex: number; // índice de modulación FM (base; la matriz suma encima)
  // Generador de ruido
  noiseType: NoiseType;
  noiseFilterEnabled: boolean; // filtro pasabanda a la salida del ruido
  noiseFilterFreq: number; // Hz (centro del pasabanda)
  noiseFilterRes: number; // Q del pasabanda del ruido (fuera de la matriz)
  // Mixer: nivel por canal en dB
  mixOsc1: number;
  mixOsc2: number;
  mixOsc3: number;
  mixOsc4: number; // nivel del VCO 4 (FM)
  mixNoise: number;
  // On/off por canal (índice 0..4 = VCO1, VCO2, VCO3, VCO4-FM, Ruido). true = voz encendida.
  // Fuente única de verdad: el switch del VCO/Ruido, el botón del mixer y el chip del BottomNav
  // escriben este array. El Solo es aparte (channelSolo) y opera por encima.
  channelEnabled: boolean[];
  channelSolo: boolean[];
  // PAN por canal (-1 izq .. 0 centro .. 1 der), índice 0..4 como arriba.
  channelPan: number[];
  // Envíos por canal hacia los efectos (0..1), índice 0..4 como arriba.
  reverbSends: number[];
  delaySends: number[];
  reverbSendEnabled: boolean;
  delaySendEnabled: boolean;
  // ¿La compuerta de FX está gateada? true = la abre fxGateEnv (alguna fuente conectada al
  // destino 'fx' de la matriz de gates); false = siempre abierta (los envíos pasan continuos).
  fxGated: boolean;
  // Filtro
  filterType: BiquadFilterType;
  filterFreq: number;
  filterRes: number;
  // VCF 2 (insertable en una voz; fuera de la matriz). LPF/HPF/BPF de 2 polos.
  vcf2Type: Vcf2Type;
  vcf2Freq: number;
  vcf2Res: number;
  vcf2Source: Vcf2Source; // qué VCO se enruta a través del VCF 2 ('none' = ninguno)
  // Envolvente AD 1 (fuente de modulación de la matriz)
  ad1Attack: number;
  ad1Decay: number;
  ad1Depth: number; // -1 a 1 (cantidad de la fuente ad1 en la matriz)
  ad1Curve: EnvCurve; // forma de las rampas (lineal/exponencial)
  // Envolvente AD 2 (fuente de modulación de la matriz)
  ad2Attack: number;
  ad2Decay: number;
  ad2Depth: number; // -1 a 1 (cantidad de la fuente ad2 en la matriz)
  ad2Curve: EnvCurve;
  // Envolvente DAHD (Delay-Attack-Hold-Decay; fuente de modulación de la matriz)
  dahdDelay: number; // s (retardo antes del ataque)
  dahdAttack: number; // s
  dahdHold: number; // s (sostiene el pico antes del decay)
  dahdDecay: number; // s
  dahdDepth: number; // -1 a 1 (cantidad de la fuente dahd en la matriz)
  dahdCurve: EnvCurve;
  // Envolvente de amplitud (ADSR). También es fuente de la matriz con su propia cantidad.
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  adsrDepth: number; // -1 a 1 (cantidad/AMT de la fuente adsr en la matriz)
  adsrCurve: EnvCurve; // forma de las rampas (lineal/exponencial)
  // Amplificador maestro
  volume: number; // en dB
  // LFO 1 (modulación)
  lfoType: Tone.ToneOscillatorType;
  lfoRate: number; // Hz
  lfoDepth: number; // -1 a 1 (profundidad/sentido de la fuente lfo1; ± = sube/baja del base)
  // LFO 2 (modulación)
  lfo2Type: Tone.ToneOscillatorType;
  lfo2Rate: number; // Hz
  lfo2Depth: number; // -1 a 1 (profundidad/sentido de la fuente lfo2; ± = sube/baja del base)
  // Matriz de patcheo: intersecciones fuente→destino conectadas.
  modPatch: ModPatch;
  // Reverb (efecto de envío)
  reverbDecay: number; // segundos
  reverbWet: number; // humedad del retorno (1 = envío limpio)
  // Delay (efecto de envío)
  delayTime: number; // segundos
  delayFeedback: number; // 0..1
  // Batería: 4 voces de sample en paralelo (índice 0..3). Arrays de longitud DRUM_VOICES.
  drumPitch: number[]; // playbackRate por voz (0.25..4)
  drumDecay: number[]; // s (decay de la envolvente de cada golpe)
  drumVol: number[]; // dB por voz
  drumRevSends: number[]; // envío al reverb de batería por voz (0..1)
  drumDelSends: number[]; // envío al delay de batería por voz (0..1)
  // Efectos propios de la batería (independientes de los del sinte).
  drumReverbDecay: number; // s
  drumDelayTime: number; // s
  drumDelayFeedback: number; // 0..1
}

export interface SynthEngine {
  /** Ataque de UNA envolvente (amp/ad1/ad2). El ruteo fuente→envolvente lo decide la
   *  matriz de gates; el motor sólo dispara la envolvente indicada. `time` (tiempo del
   *  AudioContext) permite agendar con precisión desde el transporte; `velocity` (0..1)
   *  escala el pico de la envolvente. */
  envAttack: (dest: GateDestId, time?: number, velocity?: number) => void;
  /** Release de UNA envolvente (usado por los destinos tipo gate, p. ej. el ADSR). */
  envRelease: (dest: GateDestId, time?: number) => void;
  /** Fija el pitch (frecuencia) de UN oscilador (0=VCO1, 1=VCO2, 2=VCO3, 3=VCO4-FM) sin
   *  re-disparar la envolvente. El ruteo nota→VCO lo decide la matriz MIDI; aquí sólo se
   *  escribe el VCO indicado (parafónico: cada VCO independiente). */
  setOscNote: (oscIndex: 0 | 1 | 2 | 3, note: string, time?: number) => void;
  /** Seguimiento de teclado sobre un filtro: desplaza su cutoff RELATIVO a la perilla, vía
   *  el detune (cents) del filtro (C4 = neutral). 'filter1'=VCF1, 'vcf2'=VCF2,
   *  'noiseFilter'=pasabanda del ruido. */
  setFilterKeyTrack: (dest: 'filter1' | 'vcf2' | 'noiseFilter', note: string, time?: number) => void;
  /** Fija el valor de la fuente de CV del secuenciador canal 2 (0..1). */
  setSeqCv: (value: number, time?: number) => void;
  /** Fija el valor de la fuente de CV del secuenciador canal 3 (0..1). */
  setSeqCv2: (value: number, time?: number) => void;
  /** Fija el valor de la fuente de CV del secuenciador canal 4 (0..1). */
  setSeqCv3: (value: number, time?: number) => void;
  /** Fija el valor de una perilla/CC MIDI (fuente de la matriz), slot 0..MIDI_CC_SLOTS-1,
   *  con value normalizado 0..1. */
  setCCValue: (slot: number, value: number, time?: number) => void;
  /** Dispara una voz de batería (one-shot): reproduce su sample con su pitch y la moldea con
   *  su envolvente de decay. `velocity` (0..1) escala el pico. */
  triggerDrum: (voice: number, time?: number, velocity?: number) => void;
  /** Carga un sample (URL o File del usuario) en una voz de batería. */
  loadDrumSample: (voice: number, src: string | File) => Promise<void>;
  /** Carga el sonido sintetizado por defecto en una voz de batería. */
  loadDrumSynth: (voice: number) => Promise<void>;
  /** Analizador de forma de onda (osciloscopio). */
  waveformAnalyser: React.RefObject<Tone.Analyser | null>;
  /** Analizador FFT (espectro). */
  fftAnalyser: React.RefObject<Tone.Analyser | null>;
}

/**
 * Motor de audio del sintetizador (estilo MiniMoog, monofónico).
 *
 * Cadena de señal:
 *   osc1 ─> ch1 ┐ (mixer: 1 ganancia por canal, con mute/solo)
 *   osc2 ─> ch2 ┤── VCF ─> ganancia maestra (= VCA) ─┬─> waveform/fft Analyser
 *   osc3 ─> ch3 ┤                                     └─> destination
 *   ruido─> chN ┘
 *   Envíos por canal (post-fader): chX ─> reverbSend/delaySend ─> Reverb/Delay ─> VCA
 *   (los retornos vuelven a la VCA, así quedan gateados como la señal seca; sin fuga).
 *
 *   Envolventes de control (NO en la cadena de audio): ADSR, AD 1, AD 2 (0..1). Junto a
 *   LFO 1/2 y el CV del secuenciador son fuentes de la ModMatrix. Destinos: detune, cutoff,
 *   Q, niveles de canal/ruido (mixer) y VCA (= ganancia maestra). El destino VCA modula la
 *   ganancia maestra: sin fuente la base es el volumen; con fuente, base 0 y el volumen es
 *   el pico (por defecto adsr→vcaGain). Cableado por modPatch (matriz estilo VCS3).
 *
 * El grafo se construye una sola vez al montar; los cambios de parámetro se
 * aplican mutando los nodos existentes para minimizar latencia y evitar clics.
 */
export function useSynthEngine(params: SynthParams): SynthEngine {
  const osc1Ref = useRef<Tone.OmniOscillator<Tone.PulseOscillator> | null>(null);
  const osc2Ref = useRef<Tone.OmniOscillator<Tone.PulseOscillator> | null>(null);
  const osc3Ref = useRef<Tone.OmniOscillator<Tone.FatOscillator> | null>(null);
  // VCO 4: oscilador FM (portadora + moduladora internas). 5ª voz.
  const osc4Ref = useRef<Tone.FMOscillator | null>(null);
  const noiseRef = useRef<Tone.Noise | null>(null);
  const noiseFilterRef = useRef<Tone.Filter | null>(null);
  // Mixer: una ganancia de NIVEL por canal (la modula la matriz CV vía oscNLevel/noiseLevel).
  const ch1Ref = useRef<Tone.Gain | null>(null);
  const ch2Ref = useRef<Tone.Gain | null>(null);
  const ch3Ref = useRef<Tone.Gain | null>(null);
  const ch4Ref = useRef<Tone.Gain | null>(null); // nivel del VCO 4 (FM)
  const chNRef = useRef<Tone.Gain | null>(null);
  // PAN por canal (índice 0..4): chOut[i] → panner[i] → filtro + envíos.
  const pannerRefs = useRef<Tone.Panner[]>([]);
  // Nodo de MUTE por canal (0..3), DESPUÉS del nivel. Conexiones permanentes a filtro +
  // envíos; el silencio del mixer se hace poniendo su ganancia a 0. Como está después del
  // nivel (que es lo que modula la matriz CV), mutear aquí silencia de verdad —seco y
  // envíos— sin que la modulación se cuele, y sin desconectar nodos (envíos siempre cableados).
  const chOutRefs = useRef<Tone.Gain[]>([]);
  const lfoRef = useRef<Tone.LFO | null>(null);
  const lfo2Ref = useRef<Tone.LFO | null>(null);
  const seqCvRef = useRef<Tone.Signal<'number'> | null>(null);
  const seqCv2Ref = useRef<Tone.Signal<'number'> | null>(null);
  const seqCv3Ref = useRef<Tone.Signal<'number'> | null>(null);
  // Señales de las perillas/CC MIDI (una por slot): fuentes externas de la matriz.
  const ccSignalsRef = useRef<Tone.Signal<'number'>[]>([]);
  const matrixRef = useRef<ModMatrix | null>(null);
  const filterRef = useRef<Tone.Filter | null>(null);
  // VCF 2: insert en serie sobre una voz (osc → vcf2 → canal del mixer). Routeo propio.
  const vcf2Ref = useRef<Tone.Filter | null>(null);
  // Envolventes de control (fuentes de la matriz). El ADSR ya no va en la cadena de audio:
  // modula el VCA (y lo que se le conecte) desde la matriz.
  const envelopeRef = useRef<Tone.Envelope | null>(null);
  const ad1Ref = useRef<Tone.Envelope | null>(null);
  const ad2Ref = useRef<Tone.Envelope | null>(null);
  // DAHD: Tone.Envelope no tiene etapas delay/hold, así que se implementa con una señal
  // de control y automatización manual por disparo (one-shot). `dahdShapeRef` guarda los
  // tiempos vivos para leerlos al disparar sin recrear el callback.
  const dahdSigRef = useRef<Tone.Signal<'number'> | null>(null);
  const dahdShapeRef = useRef<{
    delay: number;
    attack: number;
    hold: number;
    decay: number;
    curve: EnvCurve;
  }>({ delay: 0, attack: 0.01, hold: 0.1, decay: 0.3, curve: 'linear' });
  // Ganancia maestra: hace de VCA. Sin fuente en la matriz su base es el volumen; con
  // alguna fuente (p. ej. ADSR) su base es 0 y la fuente la abre (master = volumen pico).
  const gainRef = useRef<Tone.Gain | null>(null);
  const reverbRef = useRef<Tone.Reverb | null>(null);
  const delayRef = useRef<Tone.FeedbackDelay | null>(null);
  // Efectos PROPIOS de la batería (independientes de los del sinte).
  const drumReverbRef = useRef<Tone.Reverb | null>(null);
  const drumDelayRef = useRef<Tone.FeedbackDelay | null>(null);
  // Envíos por canal (índice 0..3 = VCO1, VCO2, VCO3, Ruido) hacia cada efecto.
  const reverbSendRefs = useRef<Tone.Gain[]>([]);
  const delaySendRefs = useRef<Tone.Gain[]>([]);
  // Compuertas del envío del SINTE a los efectos (reverb/delay) para que no zumben con los
  // osciladores continuos. La abre la envolvente fxGateEnv, ruteada por la matriz de gates
  // (destino 'fx'); sin fuente conectada queda siempre abierta. La batería entra a los efectos
  // sin compuerta (es transitoria).
  const synthRevGateRef = useRef<Tone.Gain | null>(null);
  const synthDelGateRef = useRef<Tone.Gain | null>(null);
  // Envolvente de la compuerta de FX (sostiene 1 mientras hay nota; cierre rápido al soltar).
  const fxGateEnvRef = useRef<Tone.Envelope | null>(null);
  // Bus de salida final (post-VCA): suma sinte seco + retornos de efectos + batería seca.
  const outBusRef = useRef<Tone.Gain | null>(null);
  // Batería: por voz, player → envolvente (decay) → volumen → bus de salida + envíos.
  const drumPlayerRefs = useRef<Tone.Player[]>([]);
  const drumEnvRefs = useRef<Tone.AmplitudeEnvelope[]>([]);
  // Buffers del kit sintetizado, cacheados como promesa: la página decide qué voz los usa
  // (vía loadDrumSynth) en vez de auto-cargarlos al montar.
  const synthKitPromiseRef = useRef<Promise<Tone.ToneAudioBuffer[]> | null>(null);
  const drumVolRefs = useRef<Tone.Gain[]>([]);
  const drumRevSendRefs = useRef<Tone.Gain[]>([]);
  const drumDelSendRefs = useRef<Tone.Gain[]>([]);
  const waveformRef = useRef<Tone.Analyser | null>(null);
  const fftRef = useRef<Tone.Analyser | null>(null);

  // --- Construcción del grafo (una sola vez) ---
  useEffect(() => {
    const osc1 = new Tone.OmniOscillator<Tone.PulseOscillator>(safeFreq(params.frequency, 440), 'sine');
    applyWaveform(osc1, params.oscType, params.pwm);
    osc1.detune.value = params.osc1Fine; // afinado fino (cents); la matriz suma encima
    // VCO 2 y 3: cada uno con su propia frecuencia base; el detune es su afinado fino (cents).
    const osc2 = new Tone.OmniOscillator<Tone.PulseOscillator>(safeFreq(params.osc2Freq, 440), 'sine');
    applyWaveform(osc2, params.osc2Type, params.pwm2);
    osc2.detune.value = params.detune;
    // VCO 3: FatOscillator (unísono/súper-saw). Sin PWM; spread/count en su lugar.
    const osc3 = new Tone.OmniOscillator<Tone.FatOscillator>(safeFreq(params.osc3Freq, 440), 'fatsawtooth');
    applyFatWaveform(osc3, params.osc3Type, params.osc3Spread, params.osc3Count);
    osc3.detune.value = params.osc3Detune;
    // VCO 4: oscilador FM. harmonicity/modulationIndex son señales (destinos de la matriz).
    const osc4 = new Tone.FMOscillator(safeFreq(params.osc4Freq, 440), params.osc4Type);
    osc4.harmonicity.value = params.fmHarmonicity;
    osc4.modulationIndex.value = params.fmModIndex;
    osc4.detune.value = params.osc4Fine;
    const noise = new Tone.Noise(params.noiseType);
    // Filtro pasabanda opcional a la salida del ruido (activable por checkbox).
    const noiseFilter = new Tone.Filter({
      type: 'bandpass',
      frequency: params.noiseFilterFreq,
      Q: params.noiseFilterRes,
    });

    const ch1 = new Tone.Gain(Tone.dbToGain(params.mixOsc1));
    const ch2 = new Tone.Gain(Tone.dbToGain(params.mixOsc2));
    const ch3 = new Tone.Gain(Tone.dbToGain(params.mixOsc3));
    const ch4 = new Tone.Gain(Tone.dbToGain(params.mixOsc4));
    const chN = new Tone.Gain(Tone.dbToGain(params.mixNoise));

    const filter = new Tone.Filter({
      type: params.filterType,
      frequency: safeFreq(params.filterFreq, 20000),
      Q: params.filterRes,
    });

    // VCF 2: filtro de 2 polos insertable en una voz. Su conexión la gestiona el efecto de
    // routeo (vcf2Source); aquí sólo se crea.
    const vcf2 = new Tone.Filter({
      type: params.vcf2Type,
      frequency: params.vcf2Freq,
      Q: params.vcf2Res,
      rolloff: -12, // 2 polos
    });

    // ADSR: envolvente de control (NO en la cadena de audio). Es una fuente de la matriz
    // que por defecto modula el VCA.
    const envelope = new Tone.Envelope({
      attack: params.attack,
      decay: params.decay,
      sustain: params.sustain,
      release: params.release,
      attackCurve: params.adsrCurve,
      decayCurve: params.adsrCurve,
      releaseCurve: params.adsrCurve,
    });
    // Ganancia maestra = VCA. Base la fija el efecto de la matriz (volumen o 0 según haya
    // fuentes conectadas a vcaGain).
    const gain = new Tone.Gain(Tone.dbToGain(params.volume));

    // Efectos de ENVÍO: reciben la suma de los envíos por canal y su salida vuelve a la
    // ganancia maestra (VCA), por lo que quedan gateados como la señal seca (sin fuga).
    const reverb = new Tone.Reverb({
      decay: params.reverbDecay,
      preDelay: 0.01,
      wet: params.reverbWet,
    });
    const delay = new Tone.FeedbackDelay({
      delayTime: params.delayTime,
      feedback: params.delayFeedback,
      wet: 1, // envío puro: el nivel lo dan los envíos por canal
    });

    const waveform = new Tone.Analyser({ type: 'waveform', size: 512, smoothing: 0.8 });
    const fft = new Tone.Analyser({ type: 'fft', size: 512, smoothing: 0.8 });

    // LFOs UNIPOLARES (0..1): modulan a partir del valor base. La cantidad/profundidad
    // (lfoDepth, -1..1) decide cuánto y en qué sentido se suma sobre la base: profundidad
    // positiva sube desde la base, negativa baja (la señal resultante puede ser bipolar).
    const lfo = new Tone.LFO({
      frequency: params.lfoRate,
      type: params.lfoType,
      min: 0,
      max: 1,
    });
    const lfo2 = new Tone.LFO({
      frequency: params.lfo2Rate,
      type: params.lfo2Type,
      min: 0,
      max: 1,
    });

    // Envolventes AD (sustain 0 => Ataque-Decay). Son fuentes de modulación: su salida
    // (0..1) se rutea por la matriz; no están cableadas a nada por defecto.
    const ad1 = new Tone.Envelope({
      attack: params.ad1Attack,
      decay: params.ad1Decay,
      sustain: 0,
      release: 0.05,
      attackCurve: params.ad1Curve,
      decayCurve: params.ad1Curve,
      releaseCurve: params.ad1Curve,
    });
    const ad2 = new Tone.Envelope({
      attack: params.ad2Attack,
      decay: params.ad2Decay,
      sustain: 0,
      release: 0.05,
      attackCurve: params.ad2Curve,
      decayCurve: params.ad2Curve,
      releaseCurve: params.ad2Curve,
    });

    // DAHD: señal de control (0..pico) disparada por automatización manual. Es una fuente
    // de la matriz como las AD, pero con etapas de retardo y sostenido (hold).
    const dahd = new Tone.Signal(0);
    dahdShapeRef.current = {
      delay: params.dahdDelay,
      attack: params.dahdAttack,
      hold: params.dahdHold,
      decay: params.dahdDecay,
      curve: params.dahdCurve,
    };

    // Señales de CV del secuenciador (canales 2 y 3). El secuenciador las actualiza por
    // paso; la matriz las rutea a cualquier destino.
    const seqCv = new Tone.Signal(0);
    const seqCv2 = new Tone.Signal(0);
    const seqCv3 = new Tone.Signal(0);
    // Señales de las perillas/CC MIDI (0..1): cada CC entrante escribe en la suya.
    const ccSignals = MIDI_CC_SOURCES.map(() => new Tone.Signal(0));

    // Ruteo osc → canal del mixer: lo gestiona el efecto de routeo del VCF 2 (que corre al
    // montar), porque el VCO seleccionado pasa por el VCF 2 antes de su canal.
    // El ruido va a su canal directo (bypass) o pasando por el filtro pasabanda según el
    // checkbox; el efecto de noiseFilterEnabled hace la conmutación. El filtro siempre
    // tiene su salida en chN.
    noiseFilter.connect(chN);
    noise.connect(chN);
    // ch[i] (nivel) → chOut[i] (mute) → filtro + envíos. Las conexiones se hacen abajo, una
    // vez creados los envíos. El mute vive en chOut (después del nivel que modula la matriz),
    // así silenciar de verdad no requiere desconectar nada.

    // Bus de salida final (post-VCA): suma el sinte seco (vía VCA), los retornos de efectos
    // y la batería seca. Va a la salida y a los analizadores.
    const outBus = new Tone.Gain(1);

    // Compuertas del envío del SINTE a los efectos. Su ganancia la controla fxGateEnv (ruteada
    // por la matriz de gates, destino 'fx') o, si no hay fuente conectada, queda fija en 1
    // (siempre abierta). El cableado lo hace el efecto de params.fxGated. El retorno de los
    // efectos va al outBus SIN compuerta, para que las colas resuenen.
    const synthRevGate = new Tone.Gain(0);
    const synthDelGate = new Tone.Gain(0);
    // Envolvente de la compuerta de FX: forma suave de gate (sostiene 1 mientras la nota está
    // activa; cierra rápido al soltar). No va en la cadena de audio: modula synthRev/DelGate.gain.
    const fxGateEnv = new Tone.Envelope({ attack: 0.005, decay: 0, sustain: 1, release: 0.05 });

    // Envíos por canal del SINTE (post-fader) → compuerta del sinte → efecto. Cada envío
    // recibe su canal a través de su nodo de mute (chOut), abajo.
    // Orden de canales: VCO1, VCO2, VCO3, VCO4-FM, Ruido (el ruido pasa al índice 4).
    const channels = [ch1, ch2, ch3, ch4, chN];
    const reverbSends = channels.map((_, i) => new Tone.Gain(params.reverbSends[i] ?? 0));
    const delaySends = channels.map((_, i) => new Tone.Gain(params.delaySends[i] ?? 0));
    reverbSends.forEach((s) => s.connect(synthRevGate));
    delaySends.forEach((s) => s.connect(synthDelGate));
    synthRevGate.connect(reverb);
    synthDelGate.connect(delay);

    // Nodo de mute por canal: ch (nivel) → chOut (mute) → panner (PAN) → filtro + ambos envíos.
    // Conexiones PERMANENTES; mutear/solo/deshabilitar sólo cambia chOut.gain (0/1). El panner
    // coloca el canal en el estéreo (seco y envíos comparten posición). El efecto de ruteo de
    // canal mantiene el gain de mute. Estado inicial según habilitación/mute/solo de arranque.
    const anySolo0 = params.channelSolo.some(Boolean);
    const panners = channels.map((_, i) => new Tone.Panner(params.channelPan[i] ?? 0));
    const chOut = channels.map((ch, i) => {
      const on = (params.channelEnabled[i] ?? false) && !(anySolo0 && !params.channelSolo[i]);
      const g = new Tone.Gain(on ? 1 : 0);
      ch.connect(g);
      g.connect(panners[i]);
      panners[i].connect(filter);
      panners[i].connect(reverbSends[i]);
      panners[i].connect(delaySends[i]);
      return g;
    });

    // Efectos PROPIOS de la batería (independientes de los del sinte): reverb + delay
    // dedicados, retornando al outBus (wet 1 = envío puro; el nivel lo dan los envíos por voz).
    const drumReverb = new Tone.Reverb({ decay: params.drumReverbDecay, preDelay: 0.01, wet: 1 });
    const drumDelay = new Tone.FeedbackDelay({ delayTime: params.drumDelayTime, feedback: params.drumDelayFeedback, wet: 1 });
    drumReverb.connect(outBus);
    drumDelay.connect(outBus);

    // Batería: 4 voces en paralelo. player → envolvente (decay) → volumen → outBus (seco),
    // y volumen → envío a SUS efectos (transitorio, sin compuerta).
    const drumPlayers = Array.from({ length: DRUM_VOICES }, () => new Tone.Player({ fadeOut: 0.005 }));
    const drumEnvs = Array.from(
      { length: DRUM_VOICES },
      (_, i) => new Tone.AmplitudeEnvelope({ attack: 0.001, decay: params.drumDecay[i] ?? 0.3, sustain: 0, release: 0.02 }),
    );
    const drumVols = Array.from({ length: DRUM_VOICES }, (_, i) => new Tone.Gain(dbToGainMuted(params.drumVol[i] ?? 0)));
    const drumRevSends = Array.from({ length: DRUM_VOICES }, (_, i) => new Tone.Gain(params.drumRevSends[i] ?? 0));
    const drumDelSends = Array.from({ length: DRUM_VOICES }, (_, i) => new Tone.Gain(params.drumDelSends[i] ?? 0));
    drumPlayers.forEach((p, i) => {
      p.playbackRate = params.drumPitch[i] ?? 1;
      p.connect(drumEnvs[i]);
      drumEnvs[i].connect(drumVols[i]);
      drumVols[i].connect(outBus);
      drumVols[i].connect(drumRevSends[i]);
      drumRevSends[i].connect(drumReverb);
      drumVols[i].connect(drumDelSends[i]);
      drumDelSends[i].connect(drumDelay);
    });

    // Cadena de audio: filtro → ganancia maestra/VCA → outBus → analizadores / salida.
    // Los retornos de reverb/delay → outBus los conectan los efectos de habilitación.
    filter.connect(gain);
    gain.connect(outBus);
    outBus.connect(waveform);
    outBus.connect(fft);
    outBus.toDestination();

    // Matriz de modulación (CV): el ADSR y las AD (0..1) y los LFO (-1..1) son fuentes;
    // los AudioParams modulables son destinos. El cableado concreto lo fija el efecto de
    // sincronización de la matriz (desde modPatch). Ver src/audio/cv/.
    const matrix = new ModMatrix();
    matrix.registerSource({ id: 'adsr', output: envelope, range: 'unipolar' });
    matrix.registerSource({ id: 'lfo1', output: lfo, range: 'unipolar' });
    matrix.registerSource({ id: 'lfo2', output: lfo2, range: 'unipolar' });
    matrix.registerSource({ id: 'ad1', output: ad1, range: 'unipolar' });
    matrix.registerSource({ id: 'ad2', output: ad2, range: 'unipolar' });
    matrix.registerSource({ id: 'dahd', output: dahd, range: 'unipolar' });
    matrix.registerSource({ id: 'seqCv', output: seqCv, range: 'unipolar' });
    matrix.registerSource({ id: 'seqCv2', output: seqCv2, range: 'unipolar' });
    matrix.registerSource({ id: 'seqCv3', output: seqCv3, range: 'unipolar' });
    MIDI_CC_SOURCES.forEach((src, i) => {
      matrix.registerSource({ id: src.id, output: ccSignals[i], range: 'unipolar' });
    });
    matrix.registerDest({ id: 'osc1Detune', param: osc1.detune, unitPerAmount: LFO_PITCH_RANGE_CENTS });
    matrix.registerDest({ id: 'osc2Detune', param: osc2.detune, unitPerAmount: LFO_PITCH_RANGE_CENTS });
    matrix.registerDest({ id: 'osc3Detune', param: osc3.detune, unitPerAmount: LFO_PITCH_RANGE_CENTS });
    matrix.registerDest({ id: 'osc4Detune', param: osc4.detune, unitPerAmount: LFO_PITCH_RANGE_CENTS });
    // Timbre del VCO 4 (FM): índice de modulación (brillo) y armonicidad (razón de frecuencias).
    matrix.registerDest({ id: 'fmIndex', param: osc4.modulationIndex, unitPerAmount: 15 });
    matrix.registerDest({ id: 'fmHarmonicity', param: osc4.harmonicity, unitPerAmount: 4 });
    // Cutoff modulado por el DETUNE del filtro (cents) → exponencial/por octavas, como un
    // VCF analógico. La frecuencia base la fija el usuario (filter.frequency, Hz).
    matrix.registerDest({ id: 'filterFreq', param: filter.detune, unitPerAmount: FILTER_MOD_RANGE_CENTS });
    matrix.registerDest({ id: 'filterQ', param: filter.Q, unitPerAmount: 10 });
    // Cutoff del VCF 2 también por su detune (cents) → log/por octavas, como el VCF 1.
    matrix.registerDest({ id: 'vcf2Freq', param: vcf2.detune, unitPerAmount: FILTER_MOD_RANGE_CENTS });
    matrix.registerDest({ id: 'vcaGain', param: gain.gain, unitPerAmount: 1 });
    matrix.registerDest({ id: 'osc1Level', param: ch1.gain, unitPerAmount: 1 });
    matrix.registerDest({ id: 'osc2Level', param: ch2.gain, unitPerAmount: 1 });
    matrix.registerDest({ id: 'osc3Level', param: ch3.gain, unitPerAmount: 1 });
    matrix.registerDest({ id: 'osc4Level', param: ch4.gain, unitPerAmount: 1 });
    matrix.registerDest({ id: 'noiseLevel', param: chN.gain, unitPerAmount: 1 });
    matrix.registerDest({ id: 'noiseFilterFreq', param: noiseFilter.frequency, unitPerAmount: LFO_FILTER_RANGE_HZ });

    // Las fuentes corren en continuo; la envolvente de amplitud las abre/cierra.
    osc1.start();
    osc2.start();
    osc3.start();
    osc4.start();
    noise.start();
    lfo.start();
    lfo2.start();

    osc1Ref.current = osc1;
    osc2Ref.current = osc2;
    osc3Ref.current = osc3;
    osc4Ref.current = osc4;
    noiseRef.current = noise;
    noiseFilterRef.current = noiseFilter;
    ch1Ref.current = ch1;
    ch2Ref.current = ch2;
    ch3Ref.current = ch3;
    ch4Ref.current = ch4;
    chNRef.current = chN;
    chOutRefs.current = chOut;
    pannerRefs.current = panners;
    lfoRef.current = lfo;
    lfo2Ref.current = lfo2;
    matrixRef.current = matrix;
    filterRef.current = filter;
    vcf2Ref.current = vcf2;
    envelopeRef.current = envelope;
    ad1Ref.current = ad1;
    ad2Ref.current = ad2;
    dahdSigRef.current = dahd;
    seqCvRef.current = seqCv;
    seqCv2Ref.current = seqCv2;
    seqCv3Ref.current = seqCv3;
    ccSignalsRef.current = ccSignals;
    gainRef.current = gain;
    reverbRef.current = reverb;
    delayRef.current = delay;
    reverbSendRefs.current = reverbSends;
    delaySendRefs.current = delaySends;
    synthRevGateRef.current = synthRevGate;
    synthDelGateRef.current = synthDelGate;
    fxGateEnvRef.current = fxGateEnv;
    drumReverbRef.current = drumReverb;
    drumDelayRef.current = drumDelay;
    outBusRef.current = outBus;
    drumPlayerRefs.current = drumPlayers;
    drumEnvRefs.current = drumEnvs;
    drumVolRefs.current = drumVols;
    drumRevSendRefs.current = drumRevSends;
    drumDelSendRefs.current = drumDelSends;
    waveformRef.current = waveform;
    fftRef.current = fft;

    return () => {
      osc1.dispose();
      osc2.dispose();
      osc3.dispose();
      osc4.dispose();
      noise.dispose();
      noiseFilter.dispose();
      ch1.dispose();
      ch2.dispose();
      ch3.dispose();
      ch4.dispose();
      chN.dispose();
      chOut.forEach((g) => g.dispose());
      panners.forEach((p) => p.dispose());
      matrix.dispose();
      lfo.dispose();
      lfo2.dispose();
      filter.dispose();
      vcf2.dispose();
      envelope.dispose();
      ad1.dispose();
      ad2.dispose();
      dahd.dispose();
      seqCv.dispose();
      seqCv2.dispose();
      seqCv3.dispose();
      ccSignals.forEach((s) => s.dispose());
      gain.dispose();
      reverb.dispose();
      delay.dispose();
      reverbSends.forEach((g) => g.dispose());
      delaySends.forEach((g) => g.dispose());
      synthRevGate.dispose();
      synthDelGate.dispose();
      fxGateEnv.dispose();
      drumPlayers.forEach((p) => p.dispose());
      drumEnvs.forEach((e) => e.dispose());
      drumVols.forEach((g) => g.dispose());
      drumRevSends.forEach((g) => g.dispose());
      drumDelSends.forEach((g) => g.dispose());
      drumReverb.dispose();
      drumDelay.dispose();
      outBus.dispose();
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

  // Frecuencia base por oscilador (independiente). El ruteo de nota de la matriz MIDI puede
  // sobrescribir el pitch por VCO cuando hay nota; esta es la base en reposo / sin ruteo.
  useEffect(() => {
    osc1Ref.current?.frequency.setValueAtTime(safeFreq(params.frequency, 440), Tone.now());
  }, [params.frequency]);

  // OSC 1: afinado fino (cents). Valor intrínseco de osc.detune; la matriz suma encima.
  useEffect(() => {
    osc1Ref.current?.detune.setValueAtTime(params.osc1Fine, Tone.now());
  }, [params.osc1Fine]);

  // OSC 2: forma de onda + PWM
  useEffect(() => {
    if (osc2Ref.current) applyWaveform(osc2Ref.current, params.osc2Type, params.pwm2);
  }, [params.osc2Type, params.pwm2]);

  useEffect(() => {
    osc2Ref.current?.frequency.setValueAtTime(safeFreq(params.osc2Freq, 440), Tone.now());
  }, [params.osc2Freq]);

  // OSC 2: afinado fino (cents).
  useEffect(() => {
    osc2Ref.current?.detune.setValueAtTime(params.detune, Tone.now());
  }, [params.detune]);

  // OSC 3 (fat): forma de onda + nº de voces (count) + separación (spread).
  useEffect(() => {
    if (osc3Ref.current) applyFatWaveform(osc3Ref.current, params.osc3Type, params.osc3Spread, params.osc3Count);
  }, [params.osc3Type, params.osc3Spread, params.osc3Count]);

  useEffect(() => {
    osc3Ref.current?.frequency.setValueAtTime(safeFreq(params.osc3Freq, 440), Tone.now());
  }, [params.osc3Freq]);

  // OSC 3: afinado fino (cents).
  useEffect(() => {
    osc3Ref.current?.detune.setValueAtTime(params.osc3Detune, Tone.now());
  }, [params.osc3Detune]);

  // OSC 4 (FM): onda portadora.
  useEffect(() => {
    if (osc4Ref.current) osc4Ref.current.type = params.osc4Type;
  }, [params.osc4Type]);

  useEffect(() => {
    osc4Ref.current?.frequency.setValueAtTime(safeFreq(params.osc4Freq, 440), Tone.now());
  }, [params.osc4Freq]);

  // OSC 4: afinado fino (cents). La matriz suma encima vía osc4Detune.
  useEffect(() => {
    osc4Ref.current?.detune.setValueAtTime(params.osc4Fine, Tone.now());
  }, [params.osc4Fine]);

  // OSC 4: armonicidad e índice de modulación FM (base; la matriz suma encima).
  useEffect(() => {
    osc4Ref.current?.harmonicity.setValueAtTime(params.fmHarmonicity, Tone.now());
  }, [params.fmHarmonicity]);

  useEffect(() => {
    osc4Ref.current?.modulationIndex.setValueAtTime(params.fmModIndex, Tone.now());
  }, [params.fmModIndex]);

  // Ruido
  useEffect(() => {
    if (noiseRef.current) noiseRef.current.type = params.noiseType;
  }, [params.noiseType]);

  // Silencio de canales del mixer (on/off por nodo chOut, ganancia 0/1). Un canal suena si su
  // voz está encendida (channelEnabled) y no está excluida por un solo activo en otro canal.
  // Como chOut va DESPUÉS del nivel (lo que modula la matriz CV), poner 0 silencia de verdad
  // —seco y envíos— sin desconectar nodos.
  useEffect(() => {
    const anySolo = params.channelSolo.some(Boolean);
    const now = Tone.now();
    chOutRefs.current.forEach((g, i) => {
      if (!g) return;
      const active = (params.channelEnabled[i] ?? false) && !(anySolo && !params.channelSolo[i]);
      g.gain.setValueAtTime(active ? 1 : 0, now);
    });
  }, [params.channelEnabled, params.channelSolo]);

  // Filtro pasabanda del ruido: conmuta la fuente del canal entre el filtro y el bypass.
  useEffect(() => {
    const noise = noiseRef.current;
    const nf = noiseFilterRef.current;
    const chN = chNRef.current;
    if (!noise || !nf || !chN) return;
    noise.disconnect();
    if (params.noiseFilterEnabled) noise.connect(nf);
    else noise.connect(chN);
  }, [params.noiseFilterEnabled]);

  useEffect(() => {
    noiseFilterRef.current?.frequency.setValueAtTime(params.noiseFilterFreq, Tone.now());
  }, [params.noiseFilterFreq]);

  // Resonancia (Q) del pasabanda del ruido. Control directo (fuera de la matriz).
  useEffect(() => {
    noiseFilterRef.current?.Q.setValueAtTime(params.noiseFilterRes, Tone.now());
  }, [params.noiseFilterRes]);

  // Mixer: nivel base por canal (dB → ganancia). El mute/solo NO se aplica aquí (lo hace el
  // efecto de ruteo de canal, desconectando): la matriz CV puede sumar modulación encima vía
  // los destinos oscNLevel / noiseLevel, así que bajar la ganancia no silenciaría de verdad.
  useEffect(() => {
    const levels = [params.mixOsc1, params.mixOsc2, params.mixOsc3, params.mixOsc4, params.mixNoise];
    const chans = [ch1Ref.current, ch2Ref.current, ch3Ref.current, ch4Ref.current, chNRef.current];
    const now = Tone.now();
    chans.forEach((ch, i) => {
      if (ch) ch.gain.setValueAtTime(dbToGainMuted(levels[i]), now);
    });
  }, [params.mixOsc1, params.mixOsc2, params.mixOsc3, params.mixOsc4, params.mixNoise]);

  // PAN por canal (índice 0..4). El StereoPannerNode es nativo y barato.
  useEffect(() => {
    const now = Tone.now();
    pannerRefs.current.forEach((p, i) => p.pan.setValueAtTime(params.channelPan[i] ?? 0, now));
  }, [params.channelPan]);

  // Envíos por canal hacia cada efecto (post-fader). 0 = sin envío.
  useEffect(() => {
    const now = Tone.now();
    reverbSendRefs.current.forEach((g, i) => g.gain.setValueAtTime(params.reverbSends[i] ?? 0, now));
  }, [params.reverbSends]);

  useEffect(() => {
    const now = Tone.now();
    delaySendRefs.current.forEach((g, i) => g.gain.setValueAtTime(params.delaySends[i] ?? 0, now));
  }, [params.delaySends]);

  // Activar/desactivar el retorno de cada efecto de envío (conecta/desconecta al outBus).
  useEffect(() => {
    const reverb = reverbRef.current;
    const outBus = outBusRef.current;
    if (!reverb || !outBus) return;
    reverb.disconnect();
    if (params.reverbSendEnabled) reverb.connect(outBus);
  }, [params.reverbSendEnabled]);

  useEffect(() => {
    const delay = delayRef.current;
    const outBus = outBusRef.current;
    if (!delay || !outBus) return;
    delay.disconnect();
    if (params.delaySendEnabled) delay.connect(outBus);
  }, [params.delaySendEnabled]);

  // Compuerta de FX: si hay alguna fuente conectada al destino 'fx' (params.fxGated), la abre
  // la envolvente fxGateEnv (base 0, cerrada en reposo). Si no, queda siempre abierta (gain 1).
  useEffect(() => {
    const rev = synthRevGateRef.current;
    const del = synthDelGateRef.current;
    const env = fxGateEnvRef.current;
    if (!rev || !del || !env) return;
    env.disconnect();
    const now = Tone.now();
    if (params.fxGated) {
      rev.gain.setValueAtTime(0, now);
      del.gain.setValueAtTime(0, now);
      env.connect(rev.gain);
      env.connect(del.gain);
    } else {
      rev.gain.setValueAtTime(1, now);
      del.gain.setValueAtTime(1, now);
    }
  }, [params.fxGated]);

  // Filtro
  useEffect(() => {
    const filter = filterRef.current;
    if (!filter) return;
    filter.type = params.filterType;
    filter.frequency.setValueAtTime(safeFreq(params.filterFreq, 20000), Tone.now());
    filter.Q.setValueAtTime(params.filterRes, Tone.now());
  }, [params.filterType, params.filterFreq, params.filterRes]);

  // VCF 2: tipo/frecuencia/resonancia (sin matriz).
  useEffect(() => {
    const f = vcf2Ref.current;
    if (!f) return;
    const now = Tone.now();
    f.type = params.vcf2Type;
    f.frequency.setValueAtTime(params.vcf2Freq, now);
    f.Q.setValueAtTime(params.vcf2Res, now);
  }, [params.vcf2Type, params.vcf2Freq, params.vcf2Res]);

  // VCF 2: routeo de la voz seleccionada. El VCO elegido se desconecta de su canal directo
  // y pasa osc → VCF 2 → canal; los demás van directos. 'none' = todos directos.
  useEffect(() => {
    const oscs = [osc1Ref.current, osc2Ref.current, osc3Ref.current, osc4Ref.current];
    const chs = [ch1Ref.current, ch2Ref.current, ch3Ref.current, ch4Ref.current];
    const vcf2 = vcf2Ref.current;
    if (oscs.some((o) => !o) || chs.some((c) => !c) || !vcf2) return;
    const srcIndex: number = { none: -1, vco1: 0, vco2: 1, vco3: 2, vco4: 3 }[params.vcf2Source];
    vcf2.disconnect();
    oscs.forEach((osc, i) => {
      osc!.disconnect();
      if (i === srcIndex) {
        osc!.connect(vcf2);
        vcf2.connect(chs[i]!);
      } else {
        osc!.connect(chs[i]!);
      }
    });
  }, [params.vcf2Source]);

  // Envolventes AD de modulación (attack/decay). La cantidad (depth) la aplica el efecto
  // de la matriz; aquí sólo se sincroniza la forma de la envolvente.
  useEffect(() => {
    const ad = ad1Ref.current;
    if (!ad) return;
    ad.attack = params.ad1Attack;
    ad.decay = params.ad1Decay;
    ad.attackCurve = params.ad1Curve;
    ad.decayCurve = params.ad1Curve;
    ad.releaseCurve = params.ad1Curve;
  }, [params.ad1Attack, params.ad1Decay, params.ad1Curve]);

  useEffect(() => {
    const ad = ad2Ref.current;
    if (!ad) return;
    ad.attack = params.ad2Attack;
    ad.decay = params.ad2Decay;
    ad.attackCurve = params.ad2Curve;
    ad.decayCurve = params.ad2Curve;
    ad.releaseCurve = params.ad2Curve;
  }, [params.ad2Attack, params.ad2Decay, params.ad2Curve]);

  // DAHD: sólo guarda los tiempos/curva vivos; la forma se aplica al disparar (triggerDahd).
  useEffect(() => {
    dahdShapeRef.current = {
      delay: params.dahdDelay,
      attack: params.dahdAttack,
      hold: params.dahdHold,
      decay: params.dahdDecay,
      curve: params.dahdCurve,
    };
  }, [params.dahdDelay, params.dahdAttack, params.dahdHold, params.dahdDecay, params.dahdCurve]);

  // Envolvente de amplitud
  useEffect(() => {
    const env = envelopeRef.current;
    if (!env) return;
    env.attack = params.attack;
    env.decay = params.decay;
    env.sustain = params.sustain;
    env.release = params.release;
    env.attackCurve = params.adsrCurve;
    env.decayCurve = params.adsrCurve;
    env.releaseCurve = params.adsrCurve;
  }, [params.attack, params.decay, params.sustain, params.release, params.adsrCurve]);

  // (El volumen maestro se aplica en el efecto de la matriz, porque el destino VCA modula
  // esta misma ganancia: sin fuente la base es el volumen; con fuente, el volumen es el pico.)

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
      // Las fuentes traen su propia señal 0..1; el "depth" es la cantidad/AMT con que se
      // escala (p. ej. ADSR→VCA con AMT 1 abre el VCA de 0 a 1).
      adsr: params.adsrDepth,
      lfo1: params.lfoDepth,
      lfo2: params.lfo2Depth,
      ad1: params.ad1Depth,
      ad2: params.ad2Depth,
      dahd: params.dahdDepth,
      seqCv: 1,
      seqCv2: 1,
      seqCv3: 1,
    };
    // Las perillas/CC MIDI traen su valor 0..1 como señal: depth 1 (igual que seqCv).
    for (const src of MIDI_CC_SOURCES) depths[src.id] = 1;
    // El destino VCA modula la ganancia maestra. Su "amount" se escala por el volumen del
    // master, de modo que el pico de la modulación = volumen. El resto de destinos usan su
    // depth tal cual.
    const masterGain = dbToGainMuted(params.volume);
    let vcaModulated = false;
    for (const src of MOD_SOURCES) {
      const depth = depths[src.id] ?? 0;
      for (const dst of MOD_DESTS) {
        const connected = params.modPatch[patchKey(src.id, dst.id)] ?? false;
        if (dst.id === 'vcaGain') {
          matrix.setAmount(src.id, dst.id, connected ? depth * masterGain : 0);
          if (connected) vcaModulated = true;
        } else {
          matrix.setAmount(src.id, dst.id, connected ? depth : 0);
        }
      }
    }
    // Base de la ganancia maestra/VCA: sin ninguna fuente conectada a vcaGain, base = el
    // volumen del master (pasa siempre); con alguna fuente, base 0 (la fuente abre el VCA y
    // el volumen del master es el pico).
    gainRef.current?.gain.setValueAtTime(vcaModulated ? 0 : masterGain, Tone.now());
  }, [
    params.modPatch,
    params.adsrDepth,
    params.lfoDepth,
    params.lfo2Depth,
    params.ad1Depth,
    params.ad2Depth,
    params.dahdDepth,
    params.volume,
  ]);

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

  // Delay (envío)
  useEffect(() => {
    delayRef.current?.delayTime.setValueAtTime(params.delayTime, Tone.now());
  }, [params.delayTime]);

  useEffect(() => {
    delayRef.current?.feedback.setValueAtTime(params.delayFeedback, Tone.now());
  }, [params.delayFeedback]);

  // --- Batería ---
  // Kit por defecto: se sintetiza una vez y se cachea como promesa. NO se auto-carga en los
  // players; la página decide qué carga cada voz (sample del catálogo, subido, o sintetizado
  // vía loadDrumSynth). Esto permite el dropdown de selección por voz.
  useEffect(() => {
    synthKitPromiseRef.current = synthesizeKit();
    synthKitPromiseRef.current.catch(() => {});
  }, []);

  // Pitch (playbackRate) por voz.
  useEffect(() => {
    drumPlayerRefs.current.forEach((p, i) => {
      if (p) p.playbackRate = params.drumPitch[i] ?? 1;
    });
  }, [params.drumPitch]);

  // Decay de la envolvente por voz.
  useEffect(() => {
    drumEnvRefs.current.forEach((e, i) => {
      if (e) e.decay = params.drumDecay[i] ?? 0.3;
    });
  }, [params.drumDecay]);

  // Volumen por voz (silencio real a -40 dB).
  useEffect(() => {
    const now = Tone.now();
    drumVolRefs.current.forEach((g, i) => g.gain.setValueAtTime(dbToGainMuted(params.drumVol[i] ?? 0), now));
  }, [params.drumVol]);

  // Envíos por voz hacia reverb / delay.
  useEffect(() => {
    const now = Tone.now();
    drumRevSendRefs.current.forEach((g, i) => g.gain.setValueAtTime(params.drumRevSends[i] ?? 0, now));
  }, [params.drumRevSends]);

  useEffect(() => {
    const now = Tone.now();
    drumDelSendRefs.current.forEach((g, i) => g.gain.setValueAtTime(params.drumDelSends[i] ?? 0, now));
  }, [params.drumDelSends]);

  // Efectos propios de la batería.
  useEffect(() => {
    const r = drumReverbRef.current;
    if (!r) return;
    r.decay = params.drumReverbDecay;
    r.generate().catch(() => {});
  }, [params.drumReverbDecay]);

  useEffect(() => {
    drumDelayRef.current?.delayTime.setValueAtTime(params.drumDelayTime, Tone.now());
  }, [params.drumDelayTime]);

  useEffect(() => {
    drumDelayRef.current?.feedback.setValueAtTime(params.drumDelayFeedback, Tone.now());
  }, [params.drumDelayFeedback]);

  // --- API imperativa para tocar notas (baja latencia) ---
  // Pitch de UN oscilador (parafónico: la matriz MIDI decide qué VCO sigue a qué fuente).
  const setOscNote = useCallback((oscIndex: 0 | 1 | 2 | 3, note: string, time?: number) => {
    const osc = [osc1Ref, osc2Ref, osc3Ref, osc4Ref][oscIndex].current;
    if (!osc) return;
    osc.frequency.setValueAtTime(Tone.Frequency(note).toFrequency(), time ?? Tone.now());
  }, []);

  // Seguimiento de teclado sobre un filtro: cutoff RELATIVO a la perilla vía detune (cents).
  // C4 (MIDI 60) = neutral. Suma con las conexiones de la matriz CV al mismo param.
  const setFilterKeyTrack = useCallback(
    (dest: 'filter1' | 'vcf2' | 'noiseFilter', note: string, time?: number) => {
      const ref = { filter1: filterRef, vcf2: vcf2Ref, noiseFilter: noiseFilterRef }[dest];
      const filter = ref.current;
      if (!filter) return;
      const cents = (Tone.Frequency(note).toMidi() - 60) * 100;
      filter.detune.setValueAtTime(cents, time ?? Tone.now());
    },
    [],
  );

  // Devuelve la envolvente Tone correspondiente al destino de gate (null para DAHD, que no
  // es Tone.Envelope: se dispara con triggerDahd).
  const envFor = useCallback((dest: GateDestId) => {
    if (dest === 'amp') return envelopeRef.current;
    if (dest === 'ad1') return ad1Ref.current;
    if (dest === 'ad2') return ad2Ref.current;
    if (dest === 'fx') return fxGateEnvRef.current;
    return null;
  }, []);

  // Dispara la envolvente DAHD: 0 durante el retardo, ataque al pico, sostiene el pico
  // durante el hold y decae a 0. `velocity` (0..1) escala el pico.
  const triggerDahd = useCallback((time?: number, velocity = 1) => {
    const sig = dahdSigRef.current;
    if (!sig) return;
    const { delay, attack, hold, decay, curve } = dahdShapeRef.current;
    const t0 = time ?? Tone.now();
    const peak = velocity;
    const aStart = t0 + delay;
    const aEnd = aStart + Math.max(attack, 0.001);
    const hEnd = aEnd + hold;
    const dEnd = hEnd + Math.max(decay, 0.001);
    sig.cancelScheduledValues(t0);
    if (curve === 'exponential') {
      // La rampa exponencial no admite 0; se usa un piso pequeño como inicio/fin de las rampas.
      const floor = 0.0001;
      sig.setValueAtTime(floor, t0);
      sig.setValueAtTime(floor, aStart);
      sig.exponentialRampToValueAtTime(Math.max(peak, floor), aEnd);
      sig.setValueAtTime(peak, hEnd);
      sig.exponentialRampToValueAtTime(floor, dEnd);
      sig.setValueAtTime(0, dEnd);
    } else {
      sig.setValueAtTime(0, t0);
      sig.setValueAtTime(0, aStart);
      sig.linearRampToValueAtTime(peak, aEnd);
      sig.setValueAtTime(peak, hEnd);
      sig.linearRampToValueAtTime(0, dEnd);
    }
  }, []);

  const envAttack = useCallback(
    (dest: GateDestId, time?: number, velocity?: number) => {
      if (Tone.context.state !== 'running') Tone.start();
      if (dest === 'dahd') {
        triggerDahd(time, velocity);
        return;
      }
      envFor(dest)?.triggerAttack(time ?? Tone.now(), velocity);
    },
    [envFor, triggerDahd],
  );

  const envRelease = useCallback(
    (dest: GateDestId, time?: number) => {
      envFor(dest)?.triggerRelease(time ?? Tone.now());
    },
    [envFor],
  );

  const setSeqCv = useCallback((value: number, time?: number) => {
    seqCvRef.current?.setValueAtTime(value, time ?? Tone.now());
  }, []);

  const setSeqCv2 = useCallback((value: number, time?: number) => {
    seqCv2Ref.current?.setValueAtTime(value, time ?? Tone.now());
  }, []);

  const setSeqCv3 = useCallback((value: number, time?: number) => {
    seqCv3Ref.current?.setValueAtTime(value, time ?? Tone.now());
  }, []);

  const setCCValue = useCallback((slot: number, value: number, time?: number) => {
    ccSignalsRef.current[slot]?.setValueAtTime(value, time ?? Tone.now());
  }, []);

  // Dispara una voz de batería: abre su envolvente (decay) y reproduce el sample con su
  // pitch. La envolvente moldea la cola; el sample suele durar poco.
  const triggerDrum = useCallback((voice: number, time?: number, velocity = 1) => {
    if (Tone.context.state !== 'running') Tone.start();
    const player = drumPlayerRefs.current[voice];
    const env = drumEnvRefs.current[voice];
    if (!player || !env || !player.loaded) return;
    const t = time ?? Tone.now();
    env.triggerAttack(t, velocity);
    player.start(t);
  }, []);

  // Carga el sonido sintetizado por defecto (del kit cacheado) en una voz.
  const loadDrumSynth = useCallback(async (voice: number) => {
    const player = drumPlayerRefs.current[voice];
    if (!player || !synthKitPromiseRef.current) return;
    const buffers = await synthKitPromiseRef.current;
    const buf = buffers[voice];
    if (player && buf) player.buffer = buf;
  }, []);

  // Carga un sample (URL del catálogo o File subido por el usuario) en una voz. Si la carga
  // falla (p. ej. URL inexistente), cae al sonido sintetizado para que la voz no quede muda.
  const loadDrumSample = useCallback(
    async (voice: number, src: string | File) => {
      const player = drumPlayerRefs.current[voice];
      if (!player) return;
      const url = typeof src === 'string' ? src : URL.createObjectURL(src);
      try {
        await player.load(url);
      } catch {
        await loadDrumSynth(voice);
      } finally {
        if (typeof src !== 'string') URL.revokeObjectURL(url);
      }
    },
    [loadDrumSynth],
  );

  return useMemo(
    () => ({
      envAttack,
      envRelease,
      setOscNote,
      setFilterKeyTrack,
      setSeqCv,
      setSeqCv2,
      setSeqCv3,
      setCCValue,
      triggerDrum,
      loadDrumSample,
      loadDrumSynth,
      waveformAnalyser: waveformRef,
      fftAnalyser: fftRef,
    }),
    [envAttack, envRelease, setOscNote, setFilterKeyTrack, setSeqCv, setSeqCv2, setSeqCv3, setCCValue, triggerDrum, loadDrumSample, loadDrumSynth],
  );
}
