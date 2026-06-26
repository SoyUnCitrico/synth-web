import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as Tone from 'tone';
import { ModMatrix } from '../cv/ModMatrix';
import type { ModSourceId } from '../cv/types';
import type { GateDestId } from '../cv/gates';
import {
  MAKWIL_MOD_SOURCES,
  MAKWIL_MOD_DESTS,
  patchKey,
  type ModPatch,
} from './cv';
import type { NoiseType, Vcf2Type, Vcf2Source, EnvCurve } from '../useSynthEngine';

export type { NoiseType, Vcf2Type, Vcf2Source, EnvCurve } from '../useSynthEngine';

/** Nº máximo de voces polifónicas del VCO 1 (Fat). */
export const POLY_VOICES = 5;

// Rangos de modulación a profundidad máxima (depth = 1), iguales que en el motor de Modulor.
const LFO_PITCH_RANGE_CENTS = 1200; // ±1 octava (detune de los osciladores)
const FILTER_MOD_RANGE_CENTS = 4800; // ±4 octavas (cutoff del VCF, vía detune)
const LFO_FILTER_RANGE_HZ = 6000; // ±6 kHz (pasabanda del ruido, lineal en Hz)

const VOL_MUTE_DB = -40;
const dbToGainMuted = (db: number): number => (db <= VOL_MUTE_DB ? 0 : Tone.dbToGain(db));
const safeFreq = (v: number, fallback: number): number => (Number.isFinite(v) && v > 0 ? v : fallback);

/**
 * Aplica forma de onda a un OmniOscillator de pulso (PWM en modo cuadrada).
 *
 * `widthBus` (opcional): bus de modulación persistente para el PWM. Como `osc.width` pertenece al
 * PulseOscillator interno (identidad NUEVA en cada transición a pulso, e `undefined` fuera de
 * pulso), el bus se reconecta al `width` vivo SÓLO en la transición a pulso. Así la matriz de
 * modulación apunta a un destino estable (el bus) y la mod sobrevive a los cambios de onda.
 */
function applyWaveform(
  osc: Tone.OmniOscillator<Tone.PulseOscillator>,
  type: Tone.ToneOscillatorType,
  pwm: number,
  widthBus?: Tone.Gain,
) {
  if (type === 'square') {
    if (osc.type !== 'pulse') {
      osc.type = 'pulse';
      if (widthBus && osc.width) widthBus.connect(osc.width); // re-cablear al width recién creado
    }
    osc.width.setValueAtTime(pwm, Tone.now());
  } else if (osc.type !== type) {
    osc.type = type; // se descarta el PulseOscillator (y su width); el bus queda sin destino
  }
}

/**
 * Parámetros de control de MAKWIL. Numeración de VCO:
 *   VCO1 = Fat (POLIFÓNICO, hasta POLY_VOICES voces, auto-envuelto por su ADSR),
 *   VCO2 = FM, VCO3/VCO4 = pulso (PWM). VCO2-4 + ruido son monofónicos (VCA mono por el ADSR).
 */
export interface MakwilParams {
  // VCO 1 (Fat / poli)
  osc1Type: Tone.ToneOscillatorType;
  osc1Freq: number; // base (informativo; el pitch lo fijan las notas)
  osc1Fine: number; // afinado fino (cents) de todas las voces poli
  osc1Spread: number; // separación del unísono fat (cents)
  osc1Count: number; // nº de voces del unísono fat (1..5) por cada voz poli
  // VCO 2 (FM)
  osc2Type: Tone.ToneOscillatorType;
  osc2Freq: number;
  osc2Fine: number;
  fmHarmonicity: number;
  fmModIndex: number;
  // VCO 3 (pulso/PWM)
  osc3Type: Tone.ToneOscillatorType;
  osc3Freq: number;
  osc3Fine: number;
  pwm3: number;
  // VCO 4 (pulso/PWM)
  osc4Type: Tone.ToneOscillatorType;
  osc4Freq: number;
  osc4Fine: number;
  pwm4: number;
  // Ruido
  noiseType: NoiseType;
  noiseFilterEnabled: boolean;
  noiseFilterFreq: number;
  noiseFilterRes: number;
  // Mixer (índice 0..4 = VCO1, VCO2, VCO3, VCO4, Ruido)
  mixOsc1: number;
  mixOsc2: number;
  mixOsc3: number;
  mixOsc4: number;
  mixNoise: number;
  channelEnabled: boolean[];
  channelSolo: boolean[];
  channelPan: number[];
  reverbSends: number[];
  delaySends: number[];
  chorusSends: number[];
  chebySends: number[];
  reverbSendEnabled: boolean;
  delaySendEnabled: boolean;
  chorusSendEnabled: boolean;
  chebySendEnabled: boolean;
  fxGated: boolean;
  // Filtro
  filterType: BiquadFilterType;
  filterFreq: number;
  filterRes: number;
  // VCF 2 (insert por voz; multi-fuente: una instancia por voz seleccionada)
  vcf2Type: Vcf2Type;
  vcf2Freq: number;
  vcf2Res: number;
  vcf2Source: Exclude<Vcf2Source, 'none'>[];
  // VCF 3 (insert por voz; multi-fuente)
  vcf3Type: Vcf2Type;
  vcf3Freq: number;
  vcf3Res: number;
  vcf3Source: Exclude<Vcf2Source, 'none'>[];
  // Envolventes de modulación
  ad1Attack: number;
  ad1Decay: number;
  ad1Depth: number;
  ad1Curve: EnvCurve;
  ad2Attack: number;
  ad2Decay: number;
  ad2Depth: number;
  ad2Curve: EnvCurve;
  ad3Attack: number;
  ad3Decay: number;
  ad3Depth: number;
  ad3Curve: EnvCurve;
  dahdDelay: number;
  dahdAttack: number;
  dahdHold: number;
  dahdDecay: number;
  dahdDepth: number;
  dahdCurve: EnvCurve;
  // ADSR (amplitud: VCA mono + envolvente de cada voz poli; también fuente de la matriz)
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  adsrDepth: number;
  adsrCurve: EnvCurve;
  // Maestro
  volume: number;
  // LFOs
  lfoType: Tone.ToneOscillatorType;
  lfoRate: number;
  lfoDepth: number;
  lfo2Type: Tone.ToneOscillatorType;
  lfo2Rate: number;
  lfo2Depth: number;
  lfo3Type: Tone.ToneOscillatorType;
  lfo3Rate: number;
  lfo3Depth: number;
  // Matriz CV
  modPatch: ModPatch;
  // FX de envío
  reverbDecay: number;
  reverbWet: number;
  delayTime: number;
  delayFeedback: number;
  chorusRate: number;
  chorusDepth: number;
  chorusWet: number;
  chebyOrder: number;
  chebyWet: number;
}

export interface MakwilEngine {
  /**
   * Ataque de una voz polifónica del VCO 1 (por nota). Cada nota toma una voz libre.
   * `glideTime` (s) aplica portamento *best-effort* (el PolySynth no desliza entre pasos: cada
   * nota cae en una voz nueva); 0 = sin portamento.
   */
  polyAttack: (note: string, time?: number, velocity?: number, glideTime?: number) => void;
  /** Release de una voz polifónica del VCO 1 (por nota). */
  polyRelease: (note: string, time?: number) => void;
  /** Suelta todas las voces poli (al parar el transporte / pánico). */
  polyReleaseAll: () => void;
  /**
   * Modo DRONE de la VCO1: fija el `sustain` de las voces poli a 1 (sostenido indefinido) para
   * que una voz suene de forma continua aunque no se libere. Al desactivar, restaura el `sustain`
   * real del ADSR y suelta todas las voces colgadas.
   */
  setDroneHold: (enabled: boolean) => void;
  /** Ataque de una envolvente mono (amp/ad1/ad2/dahd/fx) ruteada por la matriz de gates. */
  envAttack: (dest: GateDestId, time?: number, velocity?: number) => void;
  /** Release de una envolvente mono (destinos tipo gate, p. ej. el ADSR). */
  envRelease: (dest: GateDestId, time?: number) => void;
  /**
   * Fija el pitch de un VCO MONO (VCO2/VCO3/VCO4) sin re-disparar la envolvente.
   * `glideTime` (s) > 0 desliza la frecuencia (portamento) en vez de saltar.
   */
  setOscNote: (target: 'osc2' | 'osc3' | 'osc4', note: string, time?: number, glideTime?: number) => void;
  /**
   * Seguimiento de teclado sobre un filtro (cutoff relativo vía detune, C4 = neutral).
   * `glideTime` (s) > 0 desliza el detune (portamento) en vez de saltar.
   */
  setFilterKeyTrack: (dest: 'filter1' | 'vcf2' | 'vcf3' | 'noiseFilter', note: string, time?: number, glideTime?: number) => void;
  /** Fuentes de CV de los secuenciadores 2..5 (0..1). */
  setSeqCv: (value: number, time?: number) => void;
  setSeqCv2: (value: number, time?: number) => void;
  setSeqCv3: (value: number, time?: number) => void;
  setSeqCv4: (value: number, time?: number) => void;
  waveformAnalyser: React.RefObject<Tone.Analyser | null>;
  fftAnalyser: React.RefObject<Tone.Analyser | null>;
  /** Inicia la grabación de la salida maestra (arranca el contexto si hace falta). */
  startRecording: () => Promise<void>;
  /** Detiene la grabación y devuelve el audio capturado como Blob (audio/webm). */
  stopRecording: () => Promise<Blob>;
}

/**
 * Motor de audio de MAKWIL.
 *
 * Cadena de señal:
 *   VCO1 poli ─> ch1 ─┐ (poli: auto-envuelto por su ADSR; BYPASEA el VCA mono)
 *   VCO2 (FM) ─> ch2 ─┤
 *   VCO3      ─> ch3 ─┼─ chOut(mute) ─ panner ─┬─> monoVCA(ADSR) ─┐   (sólo VCO2-4 + ruido)
 *   VCO4      ─> ch4 ─┤                          └ ch1 (poli) ─────┤
 *   ruido     ─> chN ─┘                                            └─> VCF1 ─> masterVol ─> outBus
 *   (los envíos salen de los panners → compuerta FX → reverb/delay → outBus)
 *
 * El grafo se construye una sola vez; los cambios mutan nodos existentes (baja latencia).
 */
export function useMakwilEngine(params: MakwilParams): MakwilEngine {
  const polySynthRef = useRef<Tone.PolySynth<Tone.Synth> | null>(null);
  // Modo drone activo: cuando es true, las voces poli usan sustain=1 (sostenido indefinido).
  const droneHoldRef = useRef(false);
  // Último sustain del ADSR (para restaurarlo al salir de drone sin recrear setDroneHold).
  const sustainRef = useRef(params.sustain);
  sustainRef.current = params.sustain;
  const osc2Ref = useRef<Tone.FMOscillator | null>(null);
  const osc3Ref = useRef<Tone.OmniOscillator<Tone.PulseOscillator> | null>(null);
  const osc4Ref = useRef<Tone.OmniOscillator<Tone.PulseOscillator> | null>(null);
  const noiseRef = useRef<Tone.Noise | null>(null);
  const noiseFilterRef = useRef<Tone.Filter | null>(null);
  const ch1Ref = useRef<Tone.Gain | null>(null);
  const ch2Ref = useRef<Tone.Gain | null>(null);
  const ch3Ref = useRef<Tone.Gain | null>(null);
  const ch4Ref = useRef<Tone.Gain | null>(null);
  const chNRef = useRef<Tone.Gain | null>(null);
  const pannerRefs = useRef<Tone.Panner[]>([]);
  const chOutRefs = useRef<Tone.Gain[]>([]);
  // VCA mono (gateado por el ADSR vía matriz). Sólo las voces mono pasan por él.
  const monoVcaRef = useRef<Tone.Gain | null>(null);
  // Volumen maestro (estático; post-filtro). Lo comparten poli y mono.
  const masterVolRef = useRef<Tone.Gain | null>(null);
  const lfoRef = useRef<Tone.LFO | null>(null);
  const lfo2Ref = useRef<Tone.LFO | null>(null);
  const lfo3Ref = useRef<Tone.LFO | null>(null);
  const seqCvRef = useRef<Tone.Signal<'number'> | null>(null);
  const seqCv2Ref = useRef<Tone.Signal<'number'> | null>(null);
  const seqCv3Ref = useRef<Tone.Signal<'number'> | null>(null);
  const seqCv4Ref = useRef<Tone.Signal<'number'> | null>(null);
  const matrixRef = useRef<ModMatrix | null>(null);
  // Buses persistentes de modulación del PWM (VCO3/VCO4): destino estable de la matriz, se
  // reconectan al `width` vivo en cada transición a pulso (ver applyWaveform).
  const osc3WidthBusRef = useRef<Tone.Gain | null>(null);
  const osc4WidthBusRef = useRef<Tone.Gain | null>(null);
  const filterRef = useRef<Tone.Filter | null>(null);
  // Multi-fuente: una instancia de filtro por voz (índices vco1/poly=0, vco2=1, vco3=2, vco4=3).
  const vcf2Ref = useRef<Tone.Filter[]>([]);
  const vcf3Ref = useRef<Tone.Filter[]>([]);
  // Bus de detune por filtro: recibe la modulación de cutoff de la matriz y la reparte a las 4
  // instancias (la matriz registra UN solo destino).
  const vcf2DetuneBusRef = useRef<Tone.Signal<'number'> | null>(null);
  const vcf3DetuneBusRef = useRef<Tone.Signal<'number'> | null>(null);
  // Envolvente ADSR mono (fuente de la matriz; abre el VCA mono).
  const envelopeRef = useRef<Tone.Envelope | null>(null);
  const ad1Ref = useRef<Tone.Envelope | null>(null);
  const ad2Ref = useRef<Tone.Envelope | null>(null);
  const ad3Ref = useRef<Tone.Envelope | null>(null);
  const dahdSigRef = useRef<Tone.Signal<'number'> | null>(null);
  const dahdShapeRef = useRef<{ delay: number; attack: number; hold: number; decay: number; curve: EnvCurve }>(
    { delay: 0, attack: 0.01, hold: 0.1, decay: 0.3, curve: 'linear' },
  );
  const reverbRef = useRef<Tone.Reverb | null>(null);
  const delayRef = useRef<Tone.FeedbackDelay | null>(null);
  const chorusRef = useRef<Tone.Chorus | null>(null);
  const chebyRef = useRef<Tone.Chebyshev | null>(null);
  const reverbSendRefs = useRef<Tone.Gain[]>([]);
  const delaySendRefs = useRef<Tone.Gain[]>([]);
  const chorusSendRefs = useRef<Tone.Gain[]>([]);
  const chebySendRefs = useRef<Tone.Gain[]>([]);
  const synthRevGateRef = useRef<Tone.Gain | null>(null);
  const synthDelGateRef = useRef<Tone.Gain | null>(null);
  const synthChorusGateRef = useRef<Tone.Gain | null>(null);
  const synthChebyGateRef = useRef<Tone.Gain | null>(null);
  const fxGateEnvRef = useRef<Tone.Envelope | null>(null);
  const outBusRef = useRef<Tone.Gain | null>(null);
  const recorderRef = useRef<Tone.Recorder | null>(null);
  const waveformRef = useRef<Tone.Analyser | null>(null);
  const fftRef = useRef<Tone.Analyser | null>(null);

  // --- Construcción del grafo (una sola vez) ---
  useEffect(() => {
    // VCO 1: PolySynth de voces Fat, auto-envueltas por el ADSR.
    const polySynth = new Tone.PolySynth(Tone.Synth);
    polySynth.maxPolyphony = POLY_VOICES;
    polySynth.set({
      oscillator: { type: `fat${params.osc1Type}` as Tone.ToneOscillatorType, count: params.osc1Count, spread: params.osc1Spread } as unknown as Tone.SynthOptions['oscillator'],
      envelope: {
        attack: params.attack,
        decay: params.decay,
        sustain: params.sustain,
        release: params.release,
        attackCurve: params.adsrCurve,
        decayCurve: params.adsrCurve,
        releaseCurve: params.adsrCurve,
      },
      detune: params.osc1Fine,
    });

    // VCO 2: FM. VCO 3/4: pulso (PWM).
    const osc2 = new Tone.FMOscillator(safeFreq(params.osc2Freq, 440), params.osc2Type);
    osc2.harmonicity.value = params.fmHarmonicity;
    osc2.modulationIndex.value = params.fmModIndex;
    osc2.detune.value = params.osc2Fine;
    // Buses de modulación de PWM (creados antes de los osc para pasarlos a applyWaveform).
    const osc3WidthBus = new Tone.Gain(1);
    const osc4WidthBus = new Tone.Gain(1);
    const osc3 = new Tone.OmniOscillator<Tone.PulseOscillator>(safeFreq(params.osc3Freq, 440), 'sine');
    applyWaveform(osc3, params.osc3Type, params.pwm3, osc3WidthBus);
    osc3.detune.value = params.osc3Fine;
    const osc4 = new Tone.OmniOscillator<Tone.PulseOscillator>(safeFreq(params.osc4Freq, 440), 'sine');
    applyWaveform(osc4, params.osc4Type, params.pwm4, osc4WidthBus);
    osc4.detune.value = params.osc4Fine;
    const noise = new Tone.Noise(params.noiseType);
    const noiseFilter = new Tone.Filter({ type: 'bandpass', frequency: params.noiseFilterFreq, Q: params.noiseFilterRes });

    const ch1 = new Tone.Gain(Tone.dbToGain(params.mixOsc1));
    const ch2 = new Tone.Gain(Tone.dbToGain(params.mixOsc2));
    const ch3 = new Tone.Gain(Tone.dbToGain(params.mixOsc3));
    const ch4 = new Tone.Gain(Tone.dbToGain(params.mixOsc4));
    const chN = new Tone.Gain(Tone.dbToGain(params.mixNoise));

    const filter = new Tone.Filter({ type: params.filterType, frequency: safeFreq(params.filterFreq, 20000), Q: params.filterRes });
    // 4 instancias por filtro (una por voz), parámetros sincronizados. Cada bus de detune
    // fan-out a las 4 instancias del filtro correspondiente.
    const vcf2 = Array.from({ length: 4 }, () =>
      new Tone.Filter({ type: params.vcf2Type, frequency: params.vcf2Freq, Q: params.vcf2Res, rolloff: -12 }));
    const vcf3 = Array.from({ length: 4 }, () =>
      new Tone.Filter({ type: params.vcf3Type, frequency: params.vcf3Freq, Q: params.vcf3Res, rolloff: -12 }));
    const vcf2DetuneBus = new Tone.Signal(0);
    const vcf3DetuneBus = new Tone.Signal(0);
    vcf2.forEach((f) => vcf2DetuneBus.connect(f.detune));
    vcf3.forEach((f) => vcf3DetuneBus.connect(f.detune));

    // ADSR mono (control; abre el VCA mono). Las voces poli usan su propia copia interna.
    const envelope = new Tone.Envelope({
      attack: params.attack, decay: params.decay, sustain: params.sustain, release: params.release,
      attackCurve: params.adsrCurve, decayCurve: params.adsrCurve, releaseCurve: params.adsrCurve,
    });
    // VCA mono y volumen maestro separados (ver cabecera).
    const monoVca = new Tone.Gain(1);
    const masterVol = new Tone.Gain(dbToGainMuted(params.volume));

    const reverb = new Tone.Reverb({ decay: params.reverbDecay, preDelay: 0.01, wet: params.reverbWet });
    const delay = new Tone.FeedbackDelay({ delayTime: params.delayTime, feedback: params.delayFeedback, wet: 1 });
    const chorus = new Tone.Chorus({ frequency: params.chorusRate, delayTime: 3.5, depth: params.chorusDepth, feedback: 0.1, wet: params.chorusWet }).start();
    const cheby = new Tone.Chebyshev({ order: Math.max(1, Math.round(params.chebyOrder)), wet: params.chebyWet });

    const waveform = new Tone.Analyser({ type: 'waveform', size: 512, smoothing: 0.8 });
    const fft = new Tone.Analyser({ type: 'fft', size: 512, smoothing: 0.8 });

    const lfo = new Tone.LFO({ frequency: params.lfoRate, type: params.lfoType, min: 0, max: 1 });
    const lfo2 = new Tone.LFO({ frequency: params.lfo2Rate, type: params.lfo2Type, min: 0, max: 1 });
    const lfo3 = new Tone.LFO({ frequency: params.lfo3Rate, type: params.lfo3Type, min: 0, max: 1 });

    const ad1 = new Tone.Envelope({ attack: params.ad1Attack, decay: params.ad1Decay, sustain: 0, release: 0.05, attackCurve: params.ad1Curve, decayCurve: params.ad1Curve, releaseCurve: params.ad1Curve });
    const ad2 = new Tone.Envelope({ attack: params.ad2Attack, decay: params.ad2Decay, sustain: 0, release: 0.05, attackCurve: params.ad2Curve, decayCurve: params.ad2Curve, releaseCurve: params.ad2Curve });
    const ad3 = new Tone.Envelope({ attack: params.ad3Attack, decay: params.ad3Decay, sustain: 0, release: 0.05, attackCurve: params.ad3Curve, decayCurve: params.ad3Curve, releaseCurve: params.ad3Curve });

    const dahd = new Tone.Signal(0);
    dahdShapeRef.current = { delay: params.dahdDelay, attack: params.dahdAttack, hold: params.dahdHold, decay: params.dahdDecay, curve: params.dahdCurve };

    const seqCv = new Tone.Signal(0);
    const seqCv2 = new Tone.Signal(0);
    const seqCv3 = new Tone.Signal(0);
    const seqCv4 = new Tone.Signal(0);

    // Ruido → su canal (directo o por el pasabanda según el checkbox).
    noiseFilter.connect(chN);
    noise.connect(chN);

    const outBus = new Tone.Gain(1);

    // Compuertas del envío del sinte a los FX (gateadas por fxGateEnv, ver efecto fxGated).
    const synthRevGate = new Tone.Gain(0);
    const synthDelGate = new Tone.Gain(0);
    const synthChorusGate = new Tone.Gain(0);
    const synthChebyGate = new Tone.Gain(0);
    const fxGateEnv = new Tone.Envelope({ attack: 0.005, decay: 0, sustain: 1, release: 0.05 });

    const channels = [ch1, ch2, ch3, ch4, chN];
    const reverbSends = channels.map((_, i) => new Tone.Gain(params.reverbSends[i] ?? 0));
    const delaySends = channels.map((_, i) => new Tone.Gain(params.delaySends[i] ?? 0));
    const chorusSends = channels.map((_, i) => new Tone.Gain(params.chorusSends[i] ?? 0));
    const chebySends = channels.map((_, i) => new Tone.Gain(params.chebySends[i] ?? 0));
    reverbSends.forEach((s) => s.connect(synthRevGate));
    delaySends.forEach((s) => s.connect(synthDelGate));
    chorusSends.forEach((s) => s.connect(synthChorusGate));
    chebySends.forEach((s) => s.connect(synthChebyGate));
    synthRevGate.connect(reverb);
    synthDelGate.connect(delay);
    synthChorusGate.connect(chorus);
    synthChebyGate.connect(cheby);

    // VCA mono → VCF1. Las voces mono pasan por él; el poli va directo al VCF1.
    monoVca.connect(filter);

    const anySolo0 = params.channelSolo.some(Boolean);
    const panners = channels.map((_, i) => new Tone.Panner(params.channelPan[i] ?? 0));
    const chOut = channels.map((ch, i) => {
      const on = (params.channelEnabled[i] ?? false) && !(anySolo0 && !params.channelSolo[i]);
      const g = new Tone.Gain(on ? 1 : 0);
      ch.connect(g);
      g.connect(panners[i]);
      // Canal 0 (VCO1 poli) BYPASEA el VCA mono (ya viene auto-envuelto); el resto pasa por él.
      if (i === 0) panners[i].connect(filter);
      else panners[i].connect(monoVca);
      panners[i].connect(reverbSends[i]);
      panners[i].connect(delaySends[i]);
      panners[i].connect(chorusSends[i]);
      panners[i].connect(chebySends[i]);
      return g;
    });

    // VCF1 → volumen maestro → bus de salida → analizadores / destino.
    filter.connect(masterVol);
    masterVol.connect(outBus);
    outBus.connect(waveform);
    outBus.connect(fft);
    outBus.toDestination();
    // Grabador de la salida maestra (envuelve MediaRecorder; sin backend).
    const recorder = new Tone.Recorder();
    outBus.connect(recorder);

    // Matriz de modulación.
    const matrix = new ModMatrix();
    matrix.registerSource({ id: 'adsr', output: envelope, range: 'unipolar' });
    matrix.registerSource({ id: 'lfo1', output: lfo, range: 'unipolar' });
    matrix.registerSource({ id: 'lfo2', output: lfo2, range: 'unipolar' });
    matrix.registerSource({ id: 'lfo3', output: lfo3, range: 'unipolar' });
    matrix.registerSource({ id: 'ad1', output: ad1, range: 'unipolar' });
    matrix.registerSource({ id: 'ad2', output: ad2, range: 'unipolar' });
    matrix.registerSource({ id: 'ad3', output: ad3, range: 'unipolar' });
    matrix.registerSource({ id: 'dahd', output: dahd, range: 'unipolar' });
    matrix.registerSource({ id: 'seqCv', output: seqCv, range: 'unipolar' });
    matrix.registerSource({ id: 'seqCv2', output: seqCv2, range: 'unipolar' });
    matrix.registerSource({ id: 'seqCv3', output: seqCv3, range: 'unipolar' });
    matrix.registerSource({ id: 'seqCv4', output: seqCv4, range: 'unipolar' });
    // VCO1 (poli) no se registra como destino de detune (PolySynth no lo expone modulable).
    matrix.registerDest({ id: 'osc2Detune', param: osc2.detune, unitPerAmount: LFO_PITCH_RANGE_CENTS });
    matrix.registerDest({ id: 'osc3Detune', param: osc3.detune, unitPerAmount: LFO_PITCH_RANGE_CENTS });
    matrix.registerDest({ id: 'osc4Detune', param: osc4.detune, unitPerAmount: LFO_PITCH_RANGE_CENTS });
    // PWM: el destino estable es el bus persistente (no osc.width, que cambia de identidad).
    matrix.registerDest({ id: 'osc3Width', param: osc3WidthBus, unitPerAmount: 0.95 });
    matrix.registerDest({ id: 'osc4Width', param: osc4WidthBus, unitPerAmount: 0.95 });
    matrix.registerDest({ id: 'fmIndex', param: osc2.modulationIndex, unitPerAmount: 15 });
    matrix.registerDest({ id: 'fmHarmonicity', param: osc2.harmonicity, unitPerAmount: 4 });
    matrix.registerDest({ id: 'filterFreq', param: filter.detune, unitPerAmount: FILTER_MOD_RANGE_CENTS });
    matrix.registerDest({ id: 'filterQ', param: filter.Q, unitPerAmount: 10 });
    matrix.registerDest({ id: 'vcf2Freq', param: vcf2DetuneBus, unitPerAmount: FILTER_MOD_RANGE_CENTS });
    matrix.registerDest({ id: 'vcf3Freq', param: vcf3DetuneBus, unitPerAmount: FILTER_MOD_RANGE_CENTS });
    matrix.registerDest({ id: 'vcaGain', param: monoVca.gain, unitPerAmount: 1 });
    matrix.registerDest({ id: 'osc1Level', param: ch1.gain, unitPerAmount: 1 });
    matrix.registerDest({ id: 'osc2Level', param: ch2.gain, unitPerAmount: 1 });
    matrix.registerDest({ id: 'osc3Level', param: ch3.gain, unitPerAmount: 1 });
    matrix.registerDest({ id: 'osc4Level', param: ch4.gain, unitPerAmount: 1 });
    matrix.registerDest({ id: 'noiseLevel', param: chN.gain, unitPerAmount: 1 });
    matrix.registerDest({ id: 'noiseFilterFreq', param: noiseFilter.frequency, unitPerAmount: LFO_FILTER_RANGE_HZ });

    // Fuentes continuas siempre corriendo (las gatea su envolvente / el VCA).
    osc2.start();
    osc3.start();
    osc4.start();
    noise.start();
    lfo.start();
    lfo2.start();
    lfo3.start();

    polySynthRef.current = polySynth;
    osc2Ref.current = osc2;
    osc3Ref.current = osc3;
    osc4Ref.current = osc4;
    osc3WidthBusRef.current = osc3WidthBus;
    osc4WidthBusRef.current = osc4WidthBus;
    noiseRef.current = noise;
    noiseFilterRef.current = noiseFilter;
    ch1Ref.current = ch1;
    ch2Ref.current = ch2;
    ch3Ref.current = ch3;
    ch4Ref.current = ch4;
    chNRef.current = chN;
    chOutRefs.current = chOut;
    pannerRefs.current = panners;
    monoVcaRef.current = monoVca;
    masterVolRef.current = masterVol;
    lfoRef.current = lfo;
    lfo2Ref.current = lfo2;
    lfo3Ref.current = lfo3;
    matrixRef.current = matrix;
    filterRef.current = filter;
    vcf2Ref.current = vcf2;
    vcf3Ref.current = vcf3;
    vcf2DetuneBusRef.current = vcf2DetuneBus;
    vcf3DetuneBusRef.current = vcf3DetuneBus;
    envelopeRef.current = envelope;
    ad1Ref.current = ad1;
    ad2Ref.current = ad2;
    ad3Ref.current = ad3;
    dahdSigRef.current = dahd;
    seqCvRef.current = seqCv;
    seqCv2Ref.current = seqCv2;
    seqCv3Ref.current = seqCv3;
    seqCv4Ref.current = seqCv4;
    reverbRef.current = reverb;
    delayRef.current = delay;
    chorusRef.current = chorus;
    chebyRef.current = cheby;
    reverbSendRefs.current = reverbSends;
    delaySendRefs.current = delaySends;
    chorusSendRefs.current = chorusSends;
    chebySendRefs.current = chebySends;
    synthRevGateRef.current = synthRevGate;
    synthDelGateRef.current = synthDelGate;
    synthChorusGateRef.current = synthChorusGate;
    synthChebyGateRef.current = synthChebyGate;
    fxGateEnvRef.current = fxGateEnv;
    outBusRef.current = outBus;
    recorderRef.current = recorder;
    waveformRef.current = waveform;
    fftRef.current = fft;

    return () => {
      polySynth.dispose();
      osc2.dispose();
      osc3.dispose();
      osc4.dispose();
      osc3WidthBus.dispose();
      osc4WidthBus.dispose();
      noise.dispose();
      noiseFilter.dispose();
      ch1.dispose();
      ch2.dispose();
      ch3.dispose();
      ch4.dispose();
      chN.dispose();
      chOut.forEach((g) => g.dispose());
      panners.forEach((p) => p.dispose());
      monoVca.dispose();
      masterVol.dispose();
      matrix.dispose();
      lfo.dispose();
      lfo2.dispose();
      lfo3.dispose();
      filter.dispose();
      vcf2.forEach((f) => f.dispose());
      vcf3.forEach((f) => f.dispose());
      vcf2DetuneBus.dispose();
      vcf3DetuneBus.dispose();
      envelope.dispose();
      ad1.dispose();
      ad2.dispose();
      ad3.dispose();
      dahd.dispose();
      seqCv.dispose();
      seqCv2.dispose();
      seqCv3.dispose();
      seqCv4.dispose();
      reverb.dispose();
      delay.dispose();
      chorus.dispose();
      cheby.dispose();
      reverbSends.forEach((g) => g.dispose());
      delaySends.forEach((g) => g.dispose());
      chorusSends.forEach((g) => g.dispose());
      chebySends.forEach((g) => g.dispose());
      synthRevGate.dispose();
      synthDelGate.dispose();
      synthChorusGate.dispose();
      synthChebyGate.dispose();
      fxGateEnv.dispose();
      outBus.dispose();
      recorder.dispose();
      waveform.dispose();
      fft.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Sincronización granular ---

  // VCO 1 (poli): forma de onda fat + spread. NI `type` NI `spread` reconstruyen los osciladores
  // internos del FatOscillator (solo ajustan baseType/detune), así que se aplican de inmediato.
  useEffect(() => {
    polySynthRef.current?.set({
      oscillator: { type: `fat${params.osc1Type}` as Tone.ToneOscillatorType, spread: params.osc1Spread } as unknown as Tone.SynthOptions['oscillator'],
    });
  }, [params.osc1Type, params.osc1Spread]);

  // VCO 1 (poli): nº de voces de unísono (DEBOUNCEADO). El setter `count` del FatOscillator
  // DESTRUYE y reconstruye todos sus osciladores; hacerlo en ráfaga (arrastre rápido de la perilla
  // VOCES) solapa reconstrucciones y deja la voz silenciada de forma permanente. El debounce
  // coalesce el arrastre en una sola reconstrucción al soltar (el setter ya es no-op si no cambia).
  useEffect(() => {
    const id = setTimeout(() => {
      polySynthRef.current?.set({
        oscillator: { count: params.osc1Count } as unknown as Tone.SynthOptions['oscillator'],
      });
    }, 150);
    return () => clearTimeout(id);
  }, [params.osc1Count]);

  // VCO 1: afinado fino (cents) de todas las voces.
  useEffect(() => {
    polySynthRef.current?.set({ detune: params.osc1Fine });
  }, [params.osc1Fine]);

  // VCO 2 (FM)
  useEffect(() => {
    if (osc2Ref.current) osc2Ref.current.type = params.osc2Type;
  }, [params.osc2Type]);
  useEffect(() => {
    osc2Ref.current?.frequency.setValueAtTime(safeFreq(params.osc2Freq, 440), Tone.now());
  }, [params.osc2Freq]);
  useEffect(() => {
    osc2Ref.current?.detune.setValueAtTime(params.osc2Fine, Tone.now());
  }, [params.osc2Fine]);
  useEffect(() => {
    osc2Ref.current?.harmonicity.setValueAtTime(params.fmHarmonicity, Tone.now());
  }, [params.fmHarmonicity]);
  useEffect(() => {
    osc2Ref.current?.modulationIndex.setValueAtTime(params.fmModIndex, Tone.now());
  }, [params.fmModIndex]);

  // VCO 3 (pulso)
  useEffect(() => {
    if (osc3Ref.current) applyWaveform(osc3Ref.current, params.osc3Type, params.pwm3, osc3WidthBusRef.current ?? undefined);
  }, [params.osc3Type, params.pwm3]);
  useEffect(() => {
    osc3Ref.current?.frequency.setValueAtTime(safeFreq(params.osc3Freq, 440), Tone.now());
  }, [params.osc3Freq]);
  useEffect(() => {
    osc3Ref.current?.detune.setValueAtTime(params.osc3Fine, Tone.now());
  }, [params.osc3Fine]);

  // VCO 4 (pulso)
  useEffect(() => {
    if (osc4Ref.current) applyWaveform(osc4Ref.current, params.osc4Type, params.pwm4, osc4WidthBusRef.current ?? undefined);
  }, [params.osc4Type, params.pwm4]);
  useEffect(() => {
    osc4Ref.current?.frequency.setValueAtTime(safeFreq(params.osc4Freq, 440), Tone.now());
  }, [params.osc4Freq]);
  useEffect(() => {
    osc4Ref.current?.detune.setValueAtTime(params.osc4Fine, Tone.now());
  }, [params.osc4Fine]);

  // Ruido
  useEffect(() => {
    if (noiseRef.current) noiseRef.current.type = params.noiseType;
  }, [params.noiseType]);

  // Mute/solo por canal (chOut 0/1).
  useEffect(() => {
    const anySolo = params.channelSolo.some(Boolean);
    const now = Tone.now();
    chOutRefs.current.forEach((g, i) => {
      if (!g) return;
      const active = (params.channelEnabled[i] ?? false) && !(anySolo && !params.channelSolo[i]);
      g.gain.setValueAtTime(active ? 1 : 0, now);
    });
  }, [params.channelEnabled, params.channelSolo]);

  // Pasabanda del ruido: conmuta fuente del canal entre filtro y bypass.
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
  useEffect(() => {
    noiseFilterRef.current?.Q.setValueAtTime(params.noiseFilterRes, Tone.now());
  }, [params.noiseFilterRes]);

  // Mixer: nivel base por canal (dB → ganancia).
  useEffect(() => {
    const levels = [params.mixOsc1, params.mixOsc2, params.mixOsc3, params.mixOsc4, params.mixNoise];
    const chans = [ch1Ref.current, ch2Ref.current, ch3Ref.current, ch4Ref.current, chNRef.current];
    const now = Tone.now();
    chans.forEach((ch, i) => {
      if (ch) ch.gain.setValueAtTime(dbToGainMuted(levels[i]), now);
    });
  }, [params.mixOsc1, params.mixOsc2, params.mixOsc3, params.mixOsc4, params.mixNoise]);

  // PAN por canal.
  useEffect(() => {
    const now = Tone.now();
    pannerRefs.current.forEach((p, i) => p.pan.setValueAtTime(params.channelPan[i] ?? 0, now));
  }, [params.channelPan]);

  // Envíos por canal.
  useEffect(() => {
    const now = Tone.now();
    reverbSendRefs.current.forEach((g, i) => g.gain.setValueAtTime(params.reverbSends[i] ?? 0, now));
  }, [params.reverbSends]);
  useEffect(() => {
    const now = Tone.now();
    delaySendRefs.current.forEach((g, i) => g.gain.setValueAtTime(params.delaySends[i] ?? 0, now));
  }, [params.delaySends]);
  useEffect(() => {
    const now = Tone.now();
    chorusSendRefs.current.forEach((g, i) => g.gain.setValueAtTime(params.chorusSends[i] ?? 0, now));
  }, [params.chorusSends]);
  useEffect(() => {
    const now = Tone.now();
    chebySendRefs.current.forEach((g, i) => g.gain.setValueAtTime(params.chebySends[i] ?? 0, now));
  }, [params.chebySends]);

  // Retorno de cada efecto de envío.
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
  useEffect(() => {
    const chorus = chorusRef.current;
    const outBus = outBusRef.current;
    if (!chorus || !outBus) return;
    chorus.disconnect();
    if (params.chorusSendEnabled) chorus.connect(outBus);
  }, [params.chorusSendEnabled]);
  useEffect(() => {
    const cheby = chebyRef.current;
    const outBus = outBusRef.current;
    if (!cheby || !outBus) return;
    cheby.disconnect();
    if (params.chebySendEnabled) cheby.connect(outBus);
  }, [params.chebySendEnabled]);

  // Compuerta de FX (gateada por la nota si hay fuente conectada a 'fx').
  useEffect(() => {
    const gates = [synthRevGateRef.current, synthDelGateRef.current, synthChorusGateRef.current, synthChebyGateRef.current];
    const env = fxGateEnvRef.current;
    if (gates.some((g) => !g) || !env) return;
    env.disconnect();
    const now = Tone.now();
    for (const g of gates) {
      g!.gain.setValueAtTime(params.fxGated ? 0 : 1, now);
      if (params.fxGated) env.connect(g!.gain);
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

  // VCF 2 (sincroniza las 4 instancias por voz con los mismos parámetros).
  useEffect(() => {
    const now = Tone.now();
    vcf2Ref.current.forEach((f) => {
      f.type = params.vcf2Type;
      f.frequency.setValueAtTime(params.vcf2Freq, now);
      f.Q.setValueAtTime(params.vcf2Res, now);
    });
  }, [params.vcf2Type, params.vcf2Freq, params.vcf2Res]);

  // VCF 3 (sincroniza las 4 instancias por voz).
  useEffect(() => {
    const now = Tone.now();
    vcf3Ref.current.forEach((f) => {
      f.type = params.vcf3Type;
      f.frequency.setValueAtTime(params.vcf3Freq, now);
      f.Q.setValueAtTime(params.vcf3Res, now);
    });
  }, [params.vcf3Type, params.vcf3Freq, params.vcf3Res]);

  // VCF 2 + VCF 3: routeo de los inserts por voz (VCO1 poli incluido como índice 0). Multi-fuente:
  // cada voz seleccionada pasa por SU PROPIA instancia del filtro, conservando su canal del mixer.
  // Si una voz va por ambos filtros se encadena vcf2 → vcf3. También fija el cableado inicial.
  useEffect(() => {
    const srcs: (Tone.ToneAudioNode | null)[] = [polySynthRef.current, osc2Ref.current, osc3Ref.current, osc4Ref.current];
    const chs = [ch1Ref.current, ch2Ref.current, ch3Ref.current, ch4Ref.current];
    const vcf2 = vcf2Ref.current;
    const vcf3 = vcf3Ref.current;
    if (srcs.some((o) => !o) || chs.some((c) => !c) || vcf2.length < 4 || vcf3.length < 4) return;
    const VOICES: Exclude<Vcf2Source, 'none'>[] = ['vco1', 'vco2', 'vco3', 'vco4'];
    const has = (arr: Exclude<Vcf2Source, 'none'>[], i: number) => arr.includes(VOICES[i]);
    vcf2.forEach((f) => f.disconnect());
    vcf3.forEach((f) => f.disconnect());
    srcs.forEach((osc, i) => {
      osc!.disconnect();
      // Cadena de inserts para esta voz, en orden vcf2 → vcf3 (instancia i de cada filtro).
      let node: Tone.ToneAudioNode = osc!;
      if (has(params.vcf2Source, i)) { node.connect(vcf2[i]); node = vcf2[i]; }
      if (has(params.vcf3Source, i)) { node.connect(vcf3[i]); node = vcf3[i]; }
      node.connect(chs[i]!);
    });
  }, [params.vcf2Source, params.vcf3Source]);

  // Envolventes AD
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
  useEffect(() => {
    const ad = ad3Ref.current;
    if (!ad) return;
    ad.attack = params.ad3Attack;
    ad.decay = params.ad3Decay;
    ad.attackCurve = params.ad3Curve;
    ad.decayCurve = params.ad3Curve;
    ad.releaseCurve = params.ad3Curve;
  }, [params.ad3Attack, params.ad3Decay, params.ad3Curve]);

  // DAHD: guarda los tiempos vivos (se aplican al disparar).
  useEffect(() => {
    dahdShapeRef.current = { delay: params.dahdDelay, attack: params.dahdAttack, hold: params.dahdHold, decay: params.dahdDecay, curve: params.dahdCurve };
  }, [params.dahdDelay, params.dahdAttack, params.dahdHold, params.dahdDecay, params.dahdCurve]);

  // ADSR: actualiza la envolvente mono Y la envolvente de las voces poli.
  useEffect(() => {
    const env = envelopeRef.current;
    if (env) {
      env.attack = params.attack;
      env.decay = params.decay;
      env.sustain = params.sustain;
      env.release = params.release;
      env.attackCurve = params.adsrCurve;
      env.decayCurve = params.adsrCurve;
      env.releaseCurve = params.adsrCurve;
    }
    polySynthRef.current?.set({
      envelope: {
        attack: params.attack, decay: params.decay,
        // En modo drone el sustain se fuerza a 1 (no pisar el sostenido del drone con el ADSR).
        sustain: droneHoldRef.current ? 1 : params.sustain, release: params.release,
        attackCurve: params.adsrCurve, decayCurve: params.adsrCurve, releaseCurve: params.adsrCurve,
      },
    });
  }, [params.attack, params.decay, params.sustain, params.release, params.adsrCurve]);

  // Volumen maestro (estático, post-filtro).
  useEffect(() => {
    masterVolRef.current?.gain.setValueAtTime(dbToGainMuted(params.volume), Tone.now());
  }, [params.volume]);

  // LFOs
  useEffect(() => {
    if (lfoRef.current) lfoRef.current.type = params.lfoType;
  }, [params.lfoType]);
  useEffect(() => {
    lfoRef.current?.frequency.setValueAtTime(params.lfoRate, Tone.now());
  }, [params.lfoRate]);
  useEffect(() => {
    if (lfo2Ref.current) lfo2Ref.current.type = params.lfo2Type;
  }, [params.lfo2Type]);
  useEffect(() => {
    lfo2Ref.current?.frequency.setValueAtTime(params.lfo2Rate, Tone.now());
  }, [params.lfo2Rate]);
  useEffect(() => {
    if (lfo3Ref.current) lfo3Ref.current.type = params.lfo3Type;
  }, [params.lfo3Type]);
  useEffect(() => {
    lfo3Ref.current?.frequency.setValueAtTime(params.lfo3Rate, Tone.now());
  }, [params.lfo3Rate]);

  // Matriz: amounts por intersección + base del VCA mono.
  useEffect(() => {
    const matrix = matrixRef.current;
    if (!matrix) return;
    const depths: Partial<Record<ModSourceId, number>> = {
      adsr: params.adsrDepth,
      lfo1: params.lfoDepth,
      lfo2: params.lfo2Depth,
      lfo3: params.lfo3Depth,
      ad1: params.ad1Depth,
      ad2: params.ad2Depth,
      ad3: params.ad3Depth,
      dahd: params.dahdDepth,
      seqCv: 1,
      seqCv2: 1,
      seqCv3: 1,
      seqCv4: 1,
    };
    let vcaModulated = false;
    for (const src of MAKWIL_MOD_SOURCES) {
      const depth = depths[src.id] ?? 0;
      for (const dst of MAKWIL_MOD_DESTS) {
        const connected = params.modPatch[patchKey(src.id, dst.id)] ?? false;
        matrix.setAmount(src.id, dst.id, connected ? depth : 0);
        if (dst.id === 'vcaGain' && connected) vcaModulated = true;
      }
    }
    // VCA mono: si hay fuente conectada a 'vcaGain', base 0 (la fuente lo abre); si no, base 1
    // (las voces mono pasan; el volumen lo pone masterVol).
    monoVcaRef.current?.gain.setValueAtTime(vcaModulated ? 0 : 1, Tone.now());
  }, [
    params.modPatch,
    params.adsrDepth,
    params.lfoDepth,
    params.lfo2Depth,
    params.lfo3Depth,
    params.ad1Depth,
    params.ad2Depth,
    params.ad3Depth,
    params.dahdDepth,
  ]);

  // Reverb
  useEffect(() => {
    reverbRef.current?.wet.setValueAtTime(params.reverbWet, Tone.now());
  }, [params.reverbWet]);
  useEffect(() => {
    const reverb = reverbRef.current;
    if (!reverb) return;
    reverb.decay = params.reverbDecay;
    reverb.generate().catch(() => {});
  }, [params.reverbDecay]);

  // Delay
  useEffect(() => {
    delayRef.current?.delayTime.setValueAtTime(params.delayTime, Tone.now());
  }, [params.delayTime]);
  useEffect(() => {
    delayRef.current?.feedback.setValueAtTime(params.delayFeedback, Tone.now());
  }, [params.delayFeedback]);

  // Chorus
  useEffect(() => {
    chorusRef.current?.frequency.setValueAtTime(params.chorusRate, Tone.now());
  }, [params.chorusRate]);
  useEffect(() => {
    if (chorusRef.current) chorusRef.current.depth = params.chorusDepth;
  }, [params.chorusDepth]);
  useEffect(() => {
    chorusRef.current?.wet.setValueAtTime(params.chorusWet, Tone.now());
  }, [params.chorusWet]);

  // Chebyshev (el orden es entero; se reconstruye la curva al cambiarlo).
  useEffect(() => {
    if (chebyRef.current) chebyRef.current.order = Math.max(1, Math.round(params.chebyOrder));
  }, [params.chebyOrder]);
  useEffect(() => {
    chebyRef.current?.wet.setValueAtTime(params.chebyWet, Tone.now());
  }, [params.chebyWet]);

  // --- API imperativa ---
  const polyAttack = useCallback((note: string, time?: number, velocity = 1, glideTime = 0) => {
    if (Tone.context.state !== 'running') Tone.start();
    // Portamento best-effort: el PolySynth no desliza entre pasos (voz nueva por nota), pero
    // mantener el ajuste sincronizado evita un glide residual al apagar el botón.
    polySynthRef.current?.set({ portamento: glideTime > 0 ? glideTime : 0 });
    polySynthRef.current?.triggerAttack(note, time ?? Tone.now(), velocity);
  }, []);
  const polyRelease = useCallback((note: string, time?: number) => {
    polySynthRef.current?.triggerRelease(note, time ?? Tone.now());
  }, []);
  const polyReleaseAll = useCallback(() => {
    polySynthRef.current?.releaseAll();
  }, []);
  const setDroneHold = useCallback((enabled: boolean) => {
    droneHoldRef.current = enabled;
    // Fuerza sustain=1 mientras dura el drone; al apagar, restaura el ADSR real y corta todo.
    polySynthRef.current?.set({ envelope: { sustain: enabled ? 1 : sustainRef.current } });
    if (!enabled) polySynthRef.current?.releaseAll();
  }, []);

  const setOscNote = useCallback((target: 'osc2' | 'osc3' | 'osc4', note: string, time?: number, glideTime = 0) => {
    const osc = { osc2: osc2Ref, osc3: osc3Ref, osc4: osc4Ref }[target].current;
    if (!osc) return;
    const freq = Tone.Frequency(note).toFrequency();
    const t = time ?? Tone.now();
    if (glideTime > 0) osc.frequency.rampTo(freq, glideTime, t); // portamento
    else osc.frequency.setValueAtTime(freq, t);
  }, []);

  const setFilterKeyTrack = useCallback((dest: 'filter1' | 'vcf2' | 'vcf3' | 'noiseFilter', note: string, time?: number, glideTime = 0) => {
    const cents = (Tone.Frequency(note).toMidi() - 60) * 100;
    const t = time ?? Tone.now();
    // vcf2/vcf3 son arrays de instancias por voz; filter1/noiseFilter son nodos únicos.
    const filters: Tone.Filter[] =
      dest === 'vcf2' ? vcf2Ref.current
        : dest === 'vcf3' ? vcf3Ref.current
        : [(dest === 'filter1' ? filterRef : noiseFilterRef).current].filter((f): f is Tone.Filter => !!f);
    filters.forEach((filter) => {
      if (glideTime > 0) filter.detune.rampTo(cents, glideTime, t); // portamento del cutoff
      else filter.detune.setValueAtTime(cents, t);
    });
  }, []);

  const envFor = useCallback((dest: GateDestId) => {
    if (dest === 'amp') return envelopeRef.current;
    if (dest === 'ad1') return ad1Ref.current;
    if (dest === 'ad2') return ad2Ref.current;
    if (dest === 'ad3') return ad3Ref.current;
    if (dest === 'fx') return fxGateEnvRef.current;
    return null;
  }, []);

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
  const setSeqCv4 = useCallback((value: number, time?: number) => {
    seqCv4Ref.current?.setValueAtTime(value, time ?? Tone.now());
  }, []);

  const startRecording = useCallback(async () => {
    if (Tone.context.state !== 'running') await Tone.start();
    recorderRef.current?.start();
  }, []);
  const stopRecording = useCallback(async (): Promise<Blob> => {
    const rec = recorderRef.current;
    if (!rec) return new Blob();
    return rec.stop();
  }, []);

  return useMemo(
    () => ({
      polyAttack,
      polyRelease,
      polyReleaseAll,
      setDroneHold,
      envAttack,
      envRelease,
      setOscNote,
      setFilterKeyTrack,
      setSeqCv,
      setSeqCv2,
      setSeqCv3,
      setSeqCv4,
      waveformAnalyser: waveformRef,
      fftAnalyser: fftRef,
      startRecording,
      stopRecording,
    }),
    [polyAttack, polyRelease, polyReleaseAll, setDroneHold, envAttack, envRelease, setOscNote, setFilterKeyTrack, setSeqCv, setSeqCv2, setSeqCv3, setSeqCv4, startRecording, stopRecording],
  );
}
