import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as Tone from 'tone';
import { ModMatrix } from './cv/ModMatrix';
import { MOD_SOURCES, MOD_DESTS, patchKey, type ModPatch } from './cv/patch';
import type { ModSourceId } from './cv/types';
import type { GateDestId } from './cv/gates';
import { DRUM_VOICES, synthesizeKit } from './drums/kit';

export type NoiseType = 'white' | 'pink' | 'brown';
// VCF 2: filtro insertable en serie sobre una sola voz (su propio routeo, fuera de la
// matriz). Sólo 3 tipos, todos de 2 polos (-12 dB/oct).
export type Vcf2Type = 'lowpass' | 'highpass' | 'bandpass';
export type Vcf2Source = 'none' | 'vco1' | 'vco2' | 'vco3';

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
  noiseFilterEnabled: boolean; // filtro pasabanda a la salida del ruido
  noiseFilterFreq: number; // Hz (centro del pasabanda)
  // Mixer: nivel por canal en dB
  mixOsc1: number;
  mixOsc2: number;
  mixOsc3: number;
  mixNoise: number;
  // Mute/solo por canal (índice 0..3 = VCO1, VCO2, VCO3, Ruido).
  channelMute: boolean[];
  channelSolo: boolean[];
  // Envíos por canal hacia los efectos (0..1), índice 0..3 como arriba.
  reverbSends: number[];
  delaySends: number[];
  reverbSendEnabled: boolean;
  delaySendEnabled: boolean;
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
  // Envolvente AD 2 (fuente de modulación de la matriz)
  ad2Attack: number;
  ad2Decay: number;
  ad2Depth: number; // -1 a 1 (cantidad de la fuente ad2 en la matriz)
  // Envolvente DAHD (Delay-Attack-Hold-Decay; fuente de modulación de la matriz)
  dahdDelay: number; // s (retardo antes del ataque)
  dahdAttack: number; // s
  dahdHold: number; // s (sostiene el pico antes del decay)
  dahdDecay: number; // s
  dahdDepth: number; // -1 a 1 (cantidad de la fuente dahd en la matriz)
  // Envolvente de amplitud (ADSR). También es fuente de la matriz con su propia cantidad.
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  adsrDepth: number; // -1 a 1 (cantidad/AMT de la fuente adsr en la matriz)
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
  /** Cambia el pitch de los osciladores sin re-disparar la envolvente (legato). */
  setNote: (note: string, time?: number) => void;
  /** Fija el valor de la fuente de CV del secuenciador canal 2 (0..1). */
  setSeqCv: (value: number, time?: number) => void;
  /** Fija el valor de la fuente de CV del secuenciador canal 3 (0..1). */
  setSeqCv2: (value: number, time?: number) => void;
  /** Fija el valor de la fuente de CV del secuenciador canal 4 (0..1). */
  setSeqCv3: (value: number, time?: number) => void;
  /** Fija el CV de la velocidad (Vel) del secuenciador 1 (0..1). */
  setSeqVel: (value: number, time?: number) => void;
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
  const osc3Ref = useRef<Tone.OmniOscillator<Tone.PulseOscillator> | null>(null);
  const noiseRef = useRef<Tone.Noise | null>(null);
  const noiseFilterRef = useRef<Tone.Filter | null>(null);
  // Mixer: una ganancia por canal.
  const ch1Ref = useRef<Tone.Gain | null>(null);
  const ch2Ref = useRef<Tone.Gain | null>(null);
  const ch3Ref = useRef<Tone.Gain | null>(null);
  const chNRef = useRef<Tone.Gain | null>(null);
  const lfoRef = useRef<Tone.LFO | null>(null);
  const lfo2Ref = useRef<Tone.LFO | null>(null);
  const seqCvRef = useRef<Tone.Signal<'number'> | null>(null);
  const seqCv2Ref = useRef<Tone.Signal<'number'> | null>(null);
  const seqCv3Ref = useRef<Tone.Signal<'number'> | null>(null);
  // CV de la velocidad (Vel) del secuenciador 1: fuente de la matriz.
  const seqVelRef = useRef<Tone.Signal<'number'> | null>(null);
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
  const dahdShapeRef = useRef({ delay: 0, attack: 0.01, hold: 0.1, decay: 0.3 });
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
  // Compuertas del envío del SINTE a los efectos: gateadas por la ADSR para que los efectos
  // (compartidos con la batería) no zumben con los osciladores continuos. La batería entra a
  // los efectos sin compuerta (es transitoria).
  const synthRevGateRef = useRef<Tone.Gain | null>(null);
  const synthDelGateRef = useRef<Tone.Gain | null>(null);
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
    const osc1 = new Tone.OmniOscillator<Tone.PulseOscillator>(params.frequency, 'sine');
    applyWaveform(osc1, params.oscType, params.pwm);
    const osc2 = new Tone.OmniOscillator<Tone.PulseOscillator>(params.frequency, 'sine');
    applyWaveform(osc2, params.osc2Type, params.pwm2);
    osc2.detune.value = params.detune;
    const osc3 = new Tone.OmniOscillator<Tone.PulseOscillator>(params.frequency, 'sine');
    applyWaveform(osc3, params.osc3Type, params.pwm3);
    osc3.detune.value = params.osc3Detune;
    const noise = new Tone.Noise(params.noiseType);
    // Filtro pasabanda opcional a la salida del ruido (activable por checkbox).
    const noiseFilter = new Tone.Filter({
      type: 'bandpass',
      frequency: params.noiseFilterFreq,
      Q: 2,
    });

    const ch1 = new Tone.Gain(Tone.dbToGain(params.mixOsc1));
    const ch2 = new Tone.Gain(Tone.dbToGain(params.mixOsc2));
    const ch3 = new Tone.Gain(Tone.dbToGain(params.mixOsc3));
    const chN = new Tone.Gain(Tone.dbToGain(params.mixNoise));

    const filter = new Tone.Filter({
      type: params.filterType,
      frequency: params.filterFreq,
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
    });
    const ad2 = new Tone.Envelope({
      attack: params.ad2Attack,
      decay: params.ad2Decay,
      sustain: 0,
      release: 0.05,
    });

    // DAHD: señal de control (0..pico) disparada por automatización manual. Es una fuente
    // de la matriz como las AD, pero con etapas de retardo y sostenido (hold).
    const dahd = new Tone.Signal(0);
    dahdShapeRef.current = {
      delay: params.dahdDelay,
      attack: params.dahdAttack,
      hold: params.dahdHold,
      decay: params.dahdDecay,
    };

    // Señales de CV del secuenciador (canales 2 y 3). El secuenciador las actualiza por
    // paso; la matriz las rutea a cualquier destino.
    const seqCv = new Tone.Signal(0);
    const seqCv2 = new Tone.Signal(0);
    const seqCv3 = new Tone.Signal(0);
    // CV de la Vel del seq 1 (cada paso escribe su velocidad como señal 0..1).
    const seqVel = new Tone.Signal(0);

    // Ruteo osc → canal del mixer: lo gestiona el efecto de routeo del VCF 2 (que corre al
    // montar), porque el VCO seleccionado pasa por el VCF 2 antes de su canal.
    // El ruido va a su canal directo (bypass) o pasando por el filtro pasabanda según el
    // checkbox; el efecto de noiseFilterEnabled hace la conmutación. El filtro siempre
    // tiene su salida en chN.
    noiseFilter.connect(chN);
    noise.connect(chN);
    ch1.connect(filter);

    // Bus de salida final (post-VCA): suma el sinte seco (vía VCA), los retornos de efectos
    // y la batería seca. Va a la salida y a los analizadores.
    const outBus = new Tone.Gain(1);

    // Compuertas del envío del SINTE a los efectos, gateadas por la ADSR. Así los efectos
    // (cuyo retorno va al outBus SIN compuerta, para que las colas resuenen y la batería las
    // use) no zumban con los osciladores continuos del sinte.
    const synthRevGate = new Tone.Gain(0);
    const synthDelGate = new Tone.Gain(0);
    envelope.connect(synthRevGate.gain);
    envelope.connect(synthDelGate.gain);

    // Envíos por canal del SINTE (post-fader) → compuerta del sinte → efecto.
    const channels = [ch1, ch2, ch3, chN];
    const reverbSends = channels.map((_, i) => new Tone.Gain(params.reverbSends[i] ?? 0));
    const delaySends = channels.map((_, i) => new Tone.Gain(params.delaySends[i] ?? 0));
    channels.forEach((ch, i) => {
      ch.connect(reverbSends[i]);
      reverbSends[i].connect(synthRevGate);
      ch.connect(delaySends[i]);
      delaySends[i].connect(synthDelGate);
    });
    synthRevGate.connect(reverb);
    synthDelGate.connect(delay);

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
    matrix.registerSource({ id: 'seqVel', output: seqVel, range: 'unipolar' });
    matrix.registerDest({ id: 'osc1Detune', param: osc1.detune, unitPerAmount: LFO_PITCH_RANGE_CENTS });
    matrix.registerDest({ id: 'osc2Detune', param: osc2.detune, unitPerAmount: LFO_PITCH_RANGE_CENTS });
    matrix.registerDest({ id: 'osc3Detune', param: osc3.detune, unitPerAmount: LFO_PITCH_RANGE_CENTS });
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
    matrix.registerDest({ id: 'noiseLevel', param: chN.gain, unitPerAmount: 1 });
    matrix.registerDest({ id: 'noiseFilterFreq', param: noiseFilter.frequency, unitPerAmount: LFO_FILTER_RANGE_HZ });

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
    noiseFilterRef.current = noiseFilter;
    ch1Ref.current = ch1;
    ch2Ref.current = ch2;
    ch3Ref.current = ch3;
    chNRef.current = chN;
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
    seqVelRef.current = seqVel;
    gainRef.current = gain;
    reverbRef.current = reverb;
    delayRef.current = delay;
    reverbSendRefs.current = reverbSends;
    delaySendRefs.current = delaySends;
    synthRevGateRef.current = synthRevGate;
    synthDelGateRef.current = synthDelGate;
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
      noise.dispose();
      noiseFilter.dispose();
      ch1.dispose();
      ch2.dispose();
      ch3.dispose();
      chN.dispose();
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
      seqVel.dispose();
      gain.dispose();
      reverb.dispose();
      delay.dispose();
      reverbSends.forEach((g) => g.dispose());
      delaySends.forEach((g) => g.dispose());
      synthRevGate.dispose();
      synthDelGate.dispose();
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

  // Mixer: nivel base por canal con mute/solo. Si hay algún solo activo, sólo suenan los
  // canales en solo; el mute fuerza silencio. (La matriz puede sumar modulación encima vía
  // los destinos oscNLevel / noiseLevel.) Se recalculan los 4 juntos porque el solo es
  // cruzado entre canales.
  useEffect(() => {
    const levels = [params.mixOsc1, params.mixOsc2, params.mixOsc3, params.mixNoise];
    const chans = [ch1Ref.current, ch2Ref.current, ch3Ref.current, chNRef.current];
    const anySolo = params.channelSolo.some(Boolean);
    const now = Tone.now();
    chans.forEach((ch, i) => {
      if (!ch) return;
      const silenced = params.channelMute[i] || (anySolo && !params.channelSolo[i]);
      ch.gain.setValueAtTime(silenced ? 0 : dbToGainMuted(levels[i]), now);
    });
  }, [
    params.mixOsc1,
    params.mixOsc2,
    params.mixOsc3,
    params.mixNoise,
    params.channelMute,
    params.channelSolo,
  ]);

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

  // Filtro
  useEffect(() => {
    const filter = filterRef.current;
    if (!filter) return;
    filter.type = params.filterType;
    filter.frequency.setValueAtTime(params.filterFreq, Tone.now());
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
    const oscs = [osc1Ref.current, osc2Ref.current, osc3Ref.current];
    const chs = [ch1Ref.current, ch2Ref.current, ch3Ref.current];
    const vcf2 = vcf2Ref.current;
    if (oscs.some((o) => !o) || chs.some((c) => !c) || !vcf2) return;
    const srcIndex: number = { none: -1, vco1: 0, vco2: 1, vco3: 2 }[params.vcf2Source];
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
  }, [params.ad1Attack, params.ad1Decay]);

  useEffect(() => {
    const ad = ad2Ref.current;
    if (!ad) return;
    ad.attack = params.ad2Attack;
    ad.decay = params.ad2Decay;
  }, [params.ad2Attack, params.ad2Decay]);

  // DAHD: sólo guarda los tiempos vivos; la forma se aplica al disparar (triggerDahd).
  useEffect(() => {
    dahdShapeRef.current = {
      delay: params.dahdDelay,
      attack: params.dahdAttack,
      hold: params.dahdHold,
      decay: params.dahdDecay,
    };
  }, [params.dahdDelay, params.dahdAttack, params.dahdHold, params.dahdDecay]);

  // Envolvente de amplitud
  useEffect(() => {
    const env = envelopeRef.current;
    if (!env) return;
    env.attack = params.attack;
    env.decay = params.decay;
    env.sustain = params.sustain;
    env.release = params.release;
  }, [params.attack, params.decay, params.sustain, params.release]);

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
      seqVel: 1,
    };
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
  const setNote = useCallback((note: string, time?: number) => {
    const freq = Tone.Frequency(note).toFrequency();
    const t = time ?? Tone.now();
    osc1Ref.current?.frequency.setValueAtTime(freq, t);
    osc2Ref.current?.frequency.setValueAtTime(freq, t);
    osc3Ref.current?.frequency.setValueAtTime(freq, t);
  }, []);

  // Devuelve la envolvente Tone correspondiente al destino de gate (null para DAHD, que no
  // es Tone.Envelope: se dispara con triggerDahd).
  const envFor = useCallback((dest: GateDestId) => {
    if (dest === 'amp') return envelopeRef.current;
    if (dest === 'ad1') return ad1Ref.current;
    if (dest === 'ad2') return ad2Ref.current;
    return null;
  }, []);

  // Dispara la envolvente DAHD: 0 durante el retardo, ataque al pico, sostiene el pico
  // durante el hold y decae a 0. `velocity` (0..1) escala el pico.
  const triggerDahd = useCallback((time?: number, velocity = 1) => {
    const sig = dahdSigRef.current;
    if (!sig) return;
    const { delay, attack, hold, decay } = dahdShapeRef.current;
    const t0 = time ?? Tone.now();
    const peak = velocity;
    const aStart = t0 + delay;
    const aEnd = aStart + Math.max(attack, 0.001);
    const hEnd = aEnd + hold;
    const dEnd = hEnd + Math.max(decay, 0.001);
    sig.cancelScheduledValues(t0);
    sig.setValueAtTime(0, t0);
    sig.setValueAtTime(0, aStart);
    sig.linearRampToValueAtTime(peak, aEnd);
    sig.setValueAtTime(peak, hEnd);
    sig.linearRampToValueAtTime(0, dEnd);
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

  const setSeqVel = useCallback((value: number, time?: number) => {
    seqVelRef.current?.setValueAtTime(value, time ?? Tone.now());
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
      setNote,
      setSeqCv,
      setSeqCv2,
      setSeqCv3,
      setSeqVel,
      triggerDrum,
      loadDrumSample,
      loadDrumSynth,
      waveformAnalyser: waveformRef,
      fftAnalyser: fftRef,
    }),
    [envAttack, envRelease, setNote, setSeqCv, setSeqCv2, setSeqCv3, setSeqVel, triggerDrum, loadDrumSample, loadDrumSynth],
  );
}
