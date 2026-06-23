import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import * as Tone from 'tone';
import VCO from '../components/modules/VCO/VCO';
import { VCF } from '../components/modules/VCF/VCF';
import { VCF2 } from '../components/modules/VCF2/VCF2';
import { ADSR } from '../components/modules/ADSR/ADSR';
import { VCA } from '../components/modules/VCA/VCA';
import Noise from '../components/modules/Noise/Noise';
import LFO from '../components/modules/LFO/LFO';
import { FilterEnv } from '../components/modules/FilterEnv/FilterEnv';
import { DAHD } from '../components/modules/DAHD/DAHD';
import Reverb from '../components/modules/Reverb/Reverb';
import Delay from '../components/modules/Delay/Delay';
import PatchMatrix from '../components/modules/PatchMatrix/PatchMatrix';
import MakwilSequencer from '../components/modules/Sequencer/MakwilSequencer';
import Midi from '../components/modules/Midi/Midi';
import { useMidi } from '../audio/midi/useMidi';
import Keyboard from '../components/modules/Keyboard/Keyboard';
import { ALL_KEYS } from '../components/modules/Keyboard/layout';
import { useMakwilEngine } from '../audio/makwil/useMakwilEngine';
import { scaleIntervals, quantizeNote } from '../audio/scales';
import {
  MAKWIL_MOD_SOURCES,
  MAKWIL_MOD_DESTS,
  MAKWIL_GATE_SOURCES,
  MAKWIL_GATE_DESTS,
  MAKWIL_NOTE_SOURCES,
  MAKWIL_NOTE_DESTS,
  MIDI_CC_SLOTS,
  createPatch,
  createGatePatch,
  createNotePatch,
  gateKey,
  noteKey,
  type ModPatch,
  type GatePatch,
  type NotePatch,
  type GateSourceId,
  type NoteSourceId,
  type PatchSource,
} from '../audio/makwil/cv';
import { useMakwilSequencer } from '../audio/makwil/useMakwilSequencer';
import { useTransport } from '../audio/sequencer/transport';
import {
  MAX_STEPS,
  SEQ_COUNT,
  BASE_CLOCK,
  DEFAULT_PITCH_OFFSET,
  type SeqConfig,
  type PitchStep,
  type CvStep,
} from '../audio/makwil/sequencerTypes';
import type { NoiseType, Vcf2Type, Vcf2Source, EnvCurve } from '../audio/useSynthEngine';
import { usePersistentState } from '../hooks/usePersistentState';
import { MAKWIL_KEYS } from '../audio/makwil/persistKeys';
import Presets from '../components/Presets/Presets';
import { MAKWIL_MODULE_SECTIONS, KEYBOARD_SECTION_ID } from '../components/BottomNav/makwilSections';
import BottomNav from '../components/BottomNav/BottomNav';
import { usePresets } from '../presets/usePresets';
import type { MakwilPresetState } from '../audio/makwil/presets';
import '../App.css';

// Mapeo tecla de computadora → nota, derivado del layout del teclado en pantalla (única
// fuente de verdad).
const keyMap: Record<string, string> = Object.fromEntries(ALL_KEYS.map((k) => [k.key, k.note]));
const UPPER_OCTAVE_KEYS = ALL_KEYS.filter((k) => k.octaveOffset === 1).map((k) => k.key);

// Saneadores de frecuencia persistida (reemplazan null/NaN/0 por su default antes del render).
const safeOscFreq = (v: number): number => (Number.isFinite(v) && v > 0 ? v : 440);
const safeFilterFreq = (v: number): number => (Number.isFinite(v) && v > 0 ? v : 20000);

// Fábricas de pasos por defecto (32 = MAX_STEPS).
const makePitchSteps = (): PitchStep[] =>
  Array.from({ length: MAX_STEPS }, (_, i) => ({
    offset: DEFAULT_PITCH_OFFSET, // C2
    gate: i % 4 === 0 && i < 16, // pasos 1, 5, 9 y 13
    velocity: 1,
    gateLen: 0.5,
  }));
const makeCvSteps = (): CvStep[] =>
  Array.from({ length: MAX_STEPS }, () => ({ value: 0, offset: DEFAULT_PITCH_OFFSET, gate: false, velocity: 1, gateLen: 0.5 }));
const makeSeqConfigs = (): SeqConfig[] =>
  Array.from({ length: SEQ_COUNT }, (_, i) => ({
    steps: i === 0 ? 16 : 0,
    direction: 'forward' as const,
    clock: BASE_CLOCK,
    octave: 0,
  }));

const Makwil: React.FC = () => {
  // --- VCO 1 (Fat / POLIFÓNICO) ---
  const [osc1Type, setOsc1Type] = usePersistentState<Tone.ToneOscillatorType>(MAKWIL_KEYS.osc1Type, 'sawtooth');
  const [osc1Freq, setOsc1Freq] = usePersistentState<number>(MAKWIL_KEYS.osc1Freq, 440, safeOscFreq);
  const [osc1Fine, setOsc1Fine] = usePersistentState<number>(MAKWIL_KEYS.osc1Fine, 0);
  const [osc1Spread, setOsc1Spread] = usePersistentState<number>(MAKWIL_KEYS.osc1Spread, 20);
  const [osc1Count, setOsc1Count] = usePersistentState<number>(MAKWIL_KEYS.osc1Count, 1);

  // --- VCO 2 (FM) ---
  const [osc2Type, setOsc2Type] = usePersistentState<Tone.ToneOscillatorType>(MAKWIL_KEYS.osc2Type, 'sine');
  const [osc2Freq, setOsc2Freq] = usePersistentState<number>(MAKWIL_KEYS.osc2Freq, 440, safeOscFreq);
  const [osc2Fine, setOsc2Fine] = usePersistentState<number>(MAKWIL_KEYS.osc2Fine, 0);
  const [fmHarmonicity, setFmHarmonicity] = usePersistentState<number>(MAKWIL_KEYS.fmHarmonicity, 1);
  const [fmModIndex, setFmModIndex] = usePersistentState<number>(MAKWIL_KEYS.fmModIndex, 2);

  // --- VCO 3 (pulso/PWM) ---
  const [osc3Type, setOsc3Type] = usePersistentState<Tone.ToneOscillatorType>(MAKWIL_KEYS.osc3Type, 'sawtooth');
  const [osc3Freq, setOsc3Freq] = usePersistentState<number>(MAKWIL_KEYS.osc3Freq, 440, safeOscFreq);
  const [osc3Fine, setOsc3Fine] = usePersistentState<number>(MAKWIL_KEYS.osc3Fine, 0);
  const [pwm3, setPwm3] = usePersistentState<number>(MAKWIL_KEYS.pwm3, 0);

  // --- VCO 4 (pulso/PWM) ---
  const [osc4Type, setOsc4Type] = usePersistentState<Tone.ToneOscillatorType>(MAKWIL_KEYS.osc4Type, 'sawtooth');
  const [osc4Freq, setOsc4Freq] = usePersistentState<number>(MAKWIL_KEYS.osc4Freq, 440, safeOscFreq);
  const [osc4Fine, setOsc4Fine] = usePersistentState<number>(MAKWIL_KEYS.osc4Fine, 0);
  const [pwm4, setPwm4] = usePersistentState<number>(MAKWIL_KEYS.pwm4, 0);

  // On/off por voz (índice 0..4 = VCO1, VCO2, VCO3, VCO4, Ruido).
  const [channelEnabled, setChannelEnabled] = usePersistentState<boolean[]>(MAKWIL_KEYS.channelEnabled, () => [true, false, false, false, false]);

  // Cuantizador de escala para las fuentes MIDI.
  const [quantScale, setQuantScale] = usePersistentState<string>(MAKWIL_KEYS.quantScale, 'major');
  const [quantRoot, setQuantRoot] = usePersistentState<number>(MAKWIL_KEYS.quantRoot, 0);

  // Ruido.
  const [noiseType, setNoiseType] = usePersistentState<NoiseType>(MAKWIL_KEYS.noiseType, 'white');
  const [noiseFilterEnabled, setNoiseFilterEnabled] = usePersistentState<boolean>(MAKWIL_KEYS.noiseFilterEnabled, false);
  const [noiseFilterFreq, setNoiseFilterFreq] = usePersistentState<number>(MAKWIL_KEYS.noiseFilterFreq, 1000);
  const [noiseFilterRes, setNoiseFilterRes] = usePersistentState<number>(MAKWIL_KEYS.noiseFilterRes, 2);

  // Mixer: nivel por canal (dB).
  const [mixOsc1, setMixOsc1] = usePersistentState<number>(MAKWIL_KEYS.mixOsc1, 0);
  const [mixOsc2, setMixOsc2] = usePersistentState<number>(MAKWIL_KEYS.mixOsc2, 0);
  const [mixOsc3, setMixOsc3] = usePersistentState<number>(MAKWIL_KEYS.mixOsc3, 0);
  const [mixOsc4, setMixOsc4] = usePersistentState<number>(MAKWIL_KEYS.mixOsc4, 0);
  const [mixNoise, setMixNoise] = usePersistentState<number>(MAKWIL_KEYS.mixNoise, -10);

  // Filtro.
  const [filterType, setFilterType] = usePersistentState<BiquadFilterType>(MAKWIL_KEYS.filterType, 'lowpass');
  const [filterFreq, setFilterFreq] = usePersistentState<number>(MAKWIL_KEYS.filterFreq, 20000, safeFilterFreq);
  const [filterRes, setFilterRes] = usePersistentState<number>(MAKWIL_KEYS.filterRes, 1);

  // VCF 2 (insert por voz).
  const [vcf2Type, setVcf2Type] = usePersistentState<Vcf2Type>(MAKWIL_KEYS.vcf2Type, 'lowpass');
  const [vcf2Freq, setVcf2Freq] = usePersistentState<number>(MAKWIL_KEYS.vcf2Freq, 2000);
  const [vcf2Res, setVcf2Res] = usePersistentState<number>(MAKWIL_KEYS.vcf2Res, 1);
  const [vcf2Source, setVcf2Source] = usePersistentState<Vcf2Source>(MAKWIL_KEYS.vcf2Source, 'none');

  // Envolventes de modulación.
  const [ad1Attack, setAd1Attack] = usePersistentState<number>(MAKWIL_KEYS.ad1Attack, 0.05);
  const [ad1Decay, setAd1Decay] = usePersistentState<number>(MAKWIL_KEYS.ad1Decay, 0.3);
  const [ad1Amount, setAd1Amount] = usePersistentState<number>(MAKWIL_KEYS.ad1Amount, 0);
  const [ad1Curve, setAd1Curve] = usePersistentState<EnvCurve>(MAKWIL_KEYS.ad1Curve, 'linear');
  const [ad2Attack, setAd2Attack] = usePersistentState<number>(MAKWIL_KEYS.ad2Attack, 0.05);
  const [ad2Decay, setAd2Decay] = usePersistentState<number>(MAKWIL_KEYS.ad2Decay, 0.3);
  const [ad2Amount, setAd2Amount] = usePersistentState<number>(MAKWIL_KEYS.ad2Amount, 0);
  const [ad2Curve, setAd2Curve] = usePersistentState<EnvCurve>(MAKWIL_KEYS.ad2Curve, 'linear');
  const [dahdDelay, setDahdDelay] = usePersistentState<number>(MAKWIL_KEYS.dahdDelay, 0);
  const [dahdAttack, setDahdAttack] = usePersistentState<number>(MAKWIL_KEYS.dahdAttack, 0.05);
  const [dahdHold, setDahdHold] = usePersistentState<number>(MAKWIL_KEYS.dahdHold, 0.1);
  const [dahdDecay, setDahdDecay] = usePersistentState<number>(MAKWIL_KEYS.dahdDecay, 0.3);
  const [dahdAmount, setDahdAmount] = usePersistentState<number>(MAKWIL_KEYS.dahdAmount, 0);
  const [dahdCurve, setDahdCurve] = usePersistentState<EnvCurve>(MAKWIL_KEYS.dahdCurve, 'linear');

  // ADSR (amplitud; también de las voces poli).
  const [attack, setAttack] = usePersistentState<number>(MAKWIL_KEYS.attack, 0.1);
  const [decay, setDecay] = usePersistentState<number>(MAKWIL_KEYS.decay, 0.2);
  const [sustain, setSustain] = usePersistentState<number>(MAKWIL_KEYS.sustain, 0.5);
  const [release, setRelease] = usePersistentState<number>(MAKWIL_KEYS.release, 1);
  const [adsrAmount, setAdsrAmount] = usePersistentState<number>(MAKWIL_KEYS.adsrAmount, 1);
  const [adsrCurve, setAdsrCurve] = usePersistentState<EnvCurve>(MAKWIL_KEYS.adsrCurve, 'linear');

  const [volume, setVolume] = usePersistentState<number>(MAKWIL_KEYS.volume, -6);

  // LFOs.
  const [lfoType, setLfoType] = usePersistentState<Tone.ToneOscillatorType>(MAKWIL_KEYS.lfoType, 'sine');
  const [lfoRate, setLfoRate] = usePersistentState<number>(MAKWIL_KEYS.lfoRate, 5);
  const [lfoDepth, setLfoDepth] = usePersistentState<number>(MAKWIL_KEYS.lfoDepth, 0.3);
  const [lfo2Type, setLfo2Type] = usePersistentState<Tone.ToneOscillatorType>(MAKWIL_KEYS.lfo2Type, 'triangle');
  const [lfo2Rate, setLfo2Rate] = usePersistentState<number>(MAKWIL_KEYS.lfo2Rate, 2);
  const [lfo2Depth, setLfo2Depth] = usePersistentState<number>(MAKWIL_KEYS.lfo2Depth, 0.3);

  // Matriz de modulación (CV). Por defecto el ADSR modula el VCA mono.
  const [modPatch, setModPatch] = usePersistentState<ModPatch>(MAKWIL_KEYS.modPatch, () =>
    createPatch([{ source: 'adsr', dest: 'vcaGain' }]),
  );

  // Matriz de gates: teclado/MIDI/seq1 abren el ADSR y la compuerta de FX.
  const [gatePatch, setGatePatch] = usePersistentState<GatePatch>(MAKWIL_KEYS.gatePatch, () =>
    createGatePatch([
      { source: 'keyboard', dest: 'amp' },
      { source: 'midi', dest: 'amp' },
      { source: 'seq1', dest: 'amp' },
      { source: 'keyboard', dest: 'fx' },
      { source: 'midi', dest: 'fx' },
      { source: 'seq1', dest: 'fx' },
    ]),
  );

  // Matriz MIDI: teclado, MIDI y seq1 → VCO1 (poli) por defecto.
  const [notePatch, setNotePatch] = usePersistentState<NotePatch>(MAKWIL_KEYS.notePatch, () =>
    createNotePatch([
      { source: 'keyboard', dest: 'osc1' },
      { source: 'midi', dest: 'osc1' },
      { source: 'seq1', dest: 'osc1' },
    ]),
  );

  // Mapeo de perillas/CC MIDI (4 primeras pre-cableadas a CC 20-23).
  const [midiMap, setMidiMap] = usePersistentState<(number | null)[]>(MAKWIL_KEYS.midiMap, () => {
    const m: (number | null)[] = Array(MIDI_CC_SLOTS).fill(null);
    [20, 21, 22, 23].forEach((cc, i) => (m[i] = cc));
    return m;
  });
  const [learningSlot, setLearningSlot] = useState<number | null>(null);

  // FX de envío.
  const [reverbDecay, setReverbDecay] = usePersistentState<number>(MAKWIL_KEYS.reverbDecay, 2);
  const [reverbWet, setReverbWet] = usePersistentState<number>(MAKWIL_KEYS.reverbWet, 1);
  const [delayTime, setDelayTime] = usePersistentState<number>(MAKWIL_KEYS.delayTime, 0.25);
  const [delayFeedback, setDelayFeedback] = usePersistentState<number>(MAKWIL_KEYS.delayFeedback, 0.3);

  // Mixer: solo, pan y envíos por canal (índice 0..4).
  const [channelSolo, setChannelSolo] = usePersistentState<boolean[]>(MAKWIL_KEYS.channelSolo, () => [false, false, false, false, false]);
  const [channelPan, setChannelPan] = usePersistentState<number[]>(MAKWIL_KEYS.channelPan, () => [0, 0, 0, 0, 0]);
  const [reverbSends, setReverbSends] = usePersistentState<number[]>(MAKWIL_KEYS.reverbSends, () => [0, 0, 0, 0, 0]);
  const [delaySends, setDelaySends] = usePersistentState<number[]>(MAKWIL_KEYS.delaySends, () => [0, 0, 0, 0, 0]);
  const [reverbSendEnabled, setReverbSendEnabled] = usePersistentState<boolean>(MAKWIL_KEYS.reverbSendEnabled, true);
  const [delaySendEnabled, setDelaySendEnabled] = usePersistentState<boolean>(MAKWIL_KEYS.delaySendEnabled, true);

  // Handlers por índice del mixer.
  const onToggleChannel = useCallback((i: number) => setChannelEnabled((p) => p.map((v, idx) => (idx === i ? !v : v))), [setChannelEnabled]);
  const setChannelEnabledAt = useCallback((i: number, v: boolean) => setChannelEnabled((p) => p.map((x, idx) => (idx === i ? v : x))), [setChannelEnabled]);
  const onToggleSolo = useCallback((i: number) => setChannelSolo((p) => p.map((v, idx) => (idx === i ? !v : v))), [setChannelSolo]);
  const onPan = useCallback((i: number, val: number) => setChannelPan((p) => p.map((v, idx) => (idx === i ? val : v))), [setChannelPan]);
  const onReverbSend = useCallback((i: number, val: number) => setReverbSends((p) => p.map((v, idx) => (idx === i ? val : v))), [setReverbSends]);
  const onDelaySend = useCallback((i: number, val: number) => setDelaySends((p) => p.map((v, idx) => (idx === i ? val : v))), [setDelaySends]);
  const onToggleReverbSend = useCallback(() => setReverbSendEnabled((v) => !v), [setReverbSendEnabled]);
  const onToggleDelaySend = useCallback(() => setDelaySendEnabled((v) => !v), [setDelaySendEnabled]);

  // Transporte compartido con el header.
  const { running: seqRunning, setRunning: setSeqRunning, bpm: seqBpm, setBpm: setSeqBpm, registerReset, registerResetAll } = useTransport();

  // Secuenciador: 5 secuenciadores. seq1 = pitch base; seq2/seq3 = Nota + CV; seq4/seq5 = CV.
  const [seqConfigs, setSeqConfigs] = usePersistentState<SeqConfig[]>(MAKWIL_KEYS.seqConfigs, makeSeqConfigs);
  const [pitchSteps, setPitchSteps] = usePersistentState<PitchStep[]>(MAKWIL_KEYS.pitchSteps, makePitchSteps);
  const [cvSteps, setCvSteps] = usePersistentState<CvStep[]>(MAKWIL_KEYS.cvSteps, makeCvSteps);
  const [cv2Steps, setCv2Steps] = usePersistentState<CvStep[]>(MAKWIL_KEYS.cv2Steps, makeCvSteps);
  const [cv3Steps, setCv3Steps] = usePersistentState<CvStep[]>(MAKWIL_KEYS.cv3Steps, makeCvSteps);
  const [cv4Steps, setCv4Steps] = usePersistentState<CvStep[]>(MAKWIL_KEYS.cv4Steps, makeCvSteps);

  // ¿La compuerta de FX está gateada por la nota? (alguna fuente conectada al destino 'fx').
  const fxGated = useMemo(
    () => MAKWIL_GATE_SOURCES.some((s) => !!gatePatch[gateKey(s.id, 'fx')]),
    [gatePatch],
  );

  // Motor de audio.
  const engine = useMakwilEngine({
    osc1Type, osc1Freq, osc1Fine, osc1Spread, osc1Count,
    osc2Type, osc2Freq, osc2Fine, fmHarmonicity, fmModIndex,
    osc3Type, osc3Freq, osc3Fine, pwm3,
    osc4Type, osc4Freq, osc4Fine, pwm4,
    noiseType, noiseFilterEnabled, noiseFilterFreq, noiseFilterRes,
    mixOsc1, mixOsc2, mixOsc3, mixOsc4, mixNoise,
    channelEnabled, channelSolo, channelPan,
    reverbSends, delaySends, reverbSendEnabled, delaySendEnabled, fxGated,
    filterType, filterFreq, filterRes,
    vcf2Type, vcf2Freq, vcf2Res, vcf2Source,
    ad1Attack, ad1Decay, ad1Depth: ad1Amount, ad1Curve,
    ad2Attack, ad2Decay, ad2Depth: ad2Amount, ad2Curve,
    dahdDelay, dahdAttack, dahdHold, dahdDecay, dahdDepth: dahdAmount, dahdCurve,
    attack, decay, sustain, release, adsrDepth: adsrAmount, adsrCurve,
    volume,
    lfoType, lfoRate, lfoDepth,
    lfo2Type, lfo2Rate, lfo2Depth,
    modPatch,
    reverbDecay, reverbWet, delayTime, delayFeedback,
  });

  // Refs vivos leídos dentro de los callbacks sin recrearlos.
  const gatePatchRef = useRef(gatePatch);
  gatePatchRef.current = gatePatch;
  const notePatchRef = useRef(notePatch);
  notePatchRef.current = notePatch;
  const quantRef = useRef({ scale: quantScale, root: quantRoot });
  quantRef.current = { scale: quantScale, root: quantRoot };

  // Aplica el cuantizador de escala si la fuente está conectada a "Cuant".
  const applyQuant = useCallback((source: NoteSourceId, note: string): string => {
    if (notePatchRef.current[noteKey(source, 'quant')]) {
      const { scale, root } = quantRef.current;
      return quantizeNote(note, root, scaleIntervals(scale));
    }
    return note;
  }, []);

  // ¿La fuente está ruteada a la VCO1 (poli)?
  const polyConnected = useCallback((source: NoteSourceId): boolean => !!notePatchRef.current[noteKey(source, 'osc1')], []);

  // Ruteo de nota a los VCO MONO (VCO2/3/4) y al seguimiento de cutoff de los filtros.
  const routeNoteMono = useCallback(
    (source: NoteSourceId, note: string, time?: number) => {
      const outNote = applyQuant(source, note);
      for (const dest of MAKWIL_NOTE_DESTS) {
        if (dest.id === 'quant' || dest.id === 'osc1') continue; // 'osc1' es poli (aparte)
        if (!notePatchRef.current[noteKey(source, dest.id)]) continue;
        if (dest.id === 'osc2' || dest.id === 'osc3' || dest.id === 'osc4') engine.setOscNote(dest.id, outNote, time);
        else engine.setFilterKeyTrack(dest.id as 'filter1' | 'vcf2' | 'noiseFilter', outNote, time);
      }
    },
    [engine, applyQuant],
  );

  const fireGateAttack = useCallback(
    (source: GateSourceId, note: string | undefined, time?: number, velocity = 1) => {
      if (note) routeNoteMono(source as NoteSourceId, note, time);
      for (const dest of MAKWIL_GATE_DESTS) {
        if (gatePatchRef.current[gateKey(source, dest.id)]) engine.envAttack(dest.id, time, velocity);
      }
    },
    [engine, routeNoteMono],
  );

  const fireGateRelease = useCallback(
    (source: GateSourceId, time?: number) => {
      for (const dest of MAKWIL_GATE_DESTS) {
        if (dest.mode === 'gate' && gatePatchRef.current[gateKey(source, dest.id)]) engine.envRelease(dest.id, time);
      }
    },
    [engine],
  );

  // --- Despacho de notas del SECUENCIADOR (poli por fuente + mono). ---
  const lastSeqPolyRef = useRef<Partial<Record<string, string>>>({});
  const seqFireAttack = useCallback(
    (source: GateSourceId, note: string | undefined, time: number, velocity: number) => {
      if (note && polyConnected(source as NoteSourceId)) {
        const q = applyQuant(source as NoteSourceId, note);
        engine.polyAttack(q, time, velocity);
        lastSeqPolyRef.current[source] = q;
      }
      fireGateAttack(source, note, time, velocity);
    },
    [engine, polyConnected, applyQuant, fireGateAttack],
  );
  const seqFireRelease = useCallback(
    (source: GateSourceId, time: number) => {
      const last = lastSeqPolyRef.current[source];
      if (last) {
        engine.polyRelease(last, time);
        lastSeqPolyRef.current[source] = undefined;
      }
      fireGateRelease(source, time);
    },
    [engine, fireGateRelease],
  );

  const { currentSteps, reset: resetSequencer } = useMakwilSequencer({
    running: seqRunning,
    bpm: seqBpm,
    configs: seqConfigs,
    pitchSteps,
    cvSteps,
    cv2Steps,
    cv3Steps,
    cv4Steps,
    fireAttack: seqFireAttack,
    fireRelease: seqFireRelease,
    setSeqCv: engine.setSeqCv,
    setSeqCv2: engine.setSeqCv2,
    setSeqCv3: engine.setSeqCv3,
    setSeqCv4: engine.setSeqCv4,
  });

  useEffect(() => {
    registerReset(resetSequencer);
  }, [registerReset, resetSequencer]);

  // --- Presets ---
  const { presets, save: savePreset, remove: removePreset, get: getPreset, importMany } = usePresets<MakwilPresetState>(MAKWIL_KEYS.presets);

  const captureState = useCallback(
    (): MakwilPresetState => ({
      osc1Type, osc1Freq, osc1Fine, osc1Spread, osc1Count,
      osc2Type, osc2Freq, osc2Fine, fmHarmonicity, fmModIndex,
      osc3Type, osc3Freq, osc3Fine, pwm3,
      osc4Type, osc4Freq, osc4Fine, pwm4,
      channelEnabled, quantScale, quantRoot,
      noiseType, noiseFilterEnabled, noiseFilterFreq, noiseFilterRes,
      mixOsc1, mixOsc2, mixOsc3, mixOsc4, mixNoise,
      channelSolo, channelPan, reverbSends, delaySends, reverbSendEnabled, delaySendEnabled,
      filterType, filterFreq, filterRes,
      vcf2Type, vcf2Freq, vcf2Res, vcf2Source,
      ad1Attack, ad1Decay, ad1Amount, ad1Curve,
      ad2Attack, ad2Decay, ad2Amount, ad2Curve,
      dahdDelay, dahdAttack, dahdHold, dahdDecay, dahdAmount, dahdCurve,
      attack, decay, sustain, release, adsrAmount, adsrCurve,
      volume,
      lfoType, lfoRate, lfoDepth,
      lfo2Type, lfo2Rate, lfo2Depth,
      reverbDecay, reverbWet, delayTime, delayFeedback,
      modPatch, gatePatch, notePatch,
      seqConfigs, seqBpm, pitchSteps, cvSteps, cv2Steps, cv3Steps, cv4Steps,
    }),
    [
      osc1Type, osc1Freq, osc1Fine, osc1Spread, osc1Count,
      osc2Type, osc2Freq, osc2Fine, fmHarmonicity, fmModIndex,
      osc3Type, osc3Freq, osc3Fine, pwm3,
      osc4Type, osc4Freq, osc4Fine, pwm4,
      channelEnabled, quantScale, quantRoot,
      noiseType, noiseFilterEnabled, noiseFilterFreq, noiseFilterRes,
      mixOsc1, mixOsc2, mixOsc3, mixOsc4, mixNoise,
      channelSolo, channelPan, reverbSends, delaySends, reverbSendEnabled, delaySendEnabled,
      filterType, filterFreq, filterRes,
      vcf2Type, vcf2Freq, vcf2Res, vcf2Source,
      ad1Attack, ad1Decay, ad1Amount, ad1Curve,
      ad2Attack, ad2Decay, ad2Amount, ad2Curve,
      dahdDelay, dahdAttack, dahdHold, dahdDecay, dahdAmount, dahdCurve,
      attack, decay, sustain, release, adsrAmount, adsrCurve,
      volume,
      lfoType, lfoRate, lfoDepth,
      lfo2Type, lfo2Rate, lfo2Depth,
      reverbDecay, reverbWet, delayTime, delayFeedback,
      modPatch, gatePatch, notePatch,
      seqConfigs, seqBpm, pitchSteps, cvSteps, cv2Steps, cv3Steps, cv4Steps,
    ],
  );

  const applyState = useCallback(
    (s: Partial<MakwilPresetState>) => {
      if (s.osc1Type !== undefined) setOsc1Type(s.osc1Type);
      if (s.osc1Freq !== undefined) setOsc1Freq(s.osc1Freq);
      if (s.osc1Fine !== undefined) setOsc1Fine(s.osc1Fine);
      if (s.osc1Spread !== undefined) setOsc1Spread(s.osc1Spread);
      if (s.osc1Count !== undefined) setOsc1Count(s.osc1Count);
      if (s.osc2Type !== undefined) setOsc2Type(s.osc2Type);
      if (s.osc2Freq !== undefined) setOsc2Freq(s.osc2Freq);
      if (s.osc2Fine !== undefined) setOsc2Fine(s.osc2Fine);
      if (s.fmHarmonicity !== undefined) setFmHarmonicity(s.fmHarmonicity);
      if (s.fmModIndex !== undefined) setFmModIndex(s.fmModIndex);
      if (s.osc3Type !== undefined) setOsc3Type(s.osc3Type);
      if (s.osc3Freq !== undefined) setOsc3Freq(s.osc3Freq);
      if (s.osc3Fine !== undefined) setOsc3Fine(s.osc3Fine);
      if (s.pwm3 !== undefined) setPwm3(s.pwm3);
      if (s.osc4Type !== undefined) setOsc4Type(s.osc4Type);
      if (s.osc4Freq !== undefined) setOsc4Freq(s.osc4Freq);
      if (s.osc4Fine !== undefined) setOsc4Fine(s.osc4Fine);
      if (s.pwm4 !== undefined) setPwm4(s.pwm4);
      if (s.channelEnabled) setChannelEnabled(s.channelEnabled);
      if (s.quantScale !== undefined) setQuantScale(s.quantScale);
      if (s.quantRoot !== undefined) setQuantRoot(s.quantRoot);
      if (s.noiseType !== undefined) setNoiseType(s.noiseType);
      if (s.noiseFilterEnabled !== undefined) setNoiseFilterEnabled(s.noiseFilterEnabled);
      if (s.noiseFilterFreq !== undefined) setNoiseFilterFreq(s.noiseFilterFreq);
      if (s.noiseFilterRes !== undefined) setNoiseFilterRes(s.noiseFilterRes);
      if (s.mixOsc1 !== undefined) setMixOsc1(s.mixOsc1);
      if (s.mixOsc2 !== undefined) setMixOsc2(s.mixOsc2);
      if (s.mixOsc3 !== undefined) setMixOsc3(s.mixOsc3);
      if (s.mixOsc4 !== undefined) setMixOsc4(s.mixOsc4);
      if (s.mixNoise !== undefined) setMixNoise(s.mixNoise);
      if (s.channelSolo) setChannelSolo(s.channelSolo);
      if (s.channelPan) setChannelPan(s.channelPan);
      if (s.reverbSends) setReverbSends(s.reverbSends);
      if (s.delaySends) setDelaySends(s.delaySends);
      if (s.reverbSendEnabled !== undefined) setReverbSendEnabled(s.reverbSendEnabled);
      if (s.delaySendEnabled !== undefined) setDelaySendEnabled(s.delaySendEnabled);
      if (s.filterType !== undefined) setFilterType(s.filterType);
      if (s.filterFreq !== undefined) setFilterFreq(s.filterFreq);
      if (s.filterRes !== undefined) setFilterRes(s.filterRes);
      if (s.vcf2Type !== undefined) setVcf2Type(s.vcf2Type);
      if (s.vcf2Freq !== undefined) setVcf2Freq(s.vcf2Freq);
      if (s.vcf2Res !== undefined) setVcf2Res(s.vcf2Res);
      if (s.vcf2Source !== undefined) setVcf2Source(s.vcf2Source);
      if (s.ad1Attack !== undefined) setAd1Attack(s.ad1Attack);
      if (s.ad1Decay !== undefined) setAd1Decay(s.ad1Decay);
      if (s.ad1Amount !== undefined) setAd1Amount(s.ad1Amount);
      if (s.ad1Curve !== undefined) setAd1Curve(s.ad1Curve);
      if (s.ad2Attack !== undefined) setAd2Attack(s.ad2Attack);
      if (s.ad2Decay !== undefined) setAd2Decay(s.ad2Decay);
      if (s.ad2Amount !== undefined) setAd2Amount(s.ad2Amount);
      if (s.ad2Curve !== undefined) setAd2Curve(s.ad2Curve);
      if (s.dahdDelay !== undefined) setDahdDelay(s.dahdDelay);
      if (s.dahdAttack !== undefined) setDahdAttack(s.dahdAttack);
      if (s.dahdHold !== undefined) setDahdHold(s.dahdHold);
      if (s.dahdDecay !== undefined) setDahdDecay(s.dahdDecay);
      if (s.dahdAmount !== undefined) setDahdAmount(s.dahdAmount);
      if (s.dahdCurve !== undefined) setDahdCurve(s.dahdCurve);
      if (s.attack !== undefined) setAttack(s.attack);
      if (s.decay !== undefined) setDecay(s.decay);
      if (s.sustain !== undefined) setSustain(s.sustain);
      if (s.release !== undefined) setRelease(s.release);
      if (s.adsrAmount !== undefined) setAdsrAmount(s.adsrAmount);
      if (s.adsrCurve !== undefined) setAdsrCurve(s.adsrCurve);
      if (s.volume !== undefined) setVolume(s.volume);
      if (s.lfoType !== undefined) setLfoType(s.lfoType);
      if (s.lfoRate !== undefined) setLfoRate(s.lfoRate);
      if (s.lfoDepth !== undefined) setLfoDepth(s.lfoDepth);
      if (s.lfo2Type !== undefined) setLfo2Type(s.lfo2Type);
      if (s.lfo2Rate !== undefined) setLfo2Rate(s.lfo2Rate);
      if (s.lfo2Depth !== undefined) setLfo2Depth(s.lfo2Depth);
      if (s.reverbDecay !== undefined) setReverbDecay(s.reverbDecay);
      if (s.reverbWet !== undefined) setReverbWet(s.reverbWet);
      if (s.delayTime !== undefined) setDelayTime(s.delayTime);
      if (s.delayFeedback !== undefined) setDelayFeedback(s.delayFeedback);
      if (s.modPatch) setModPatch(s.modPatch);
      if (s.gatePatch) setGatePatch(s.gatePatch);
      if (s.notePatch) setNotePatch(s.notePatch);
      if (s.seqConfigs) setSeqConfigs(s.seqConfigs);
      if (s.seqBpm !== undefined) setSeqBpm(s.seqBpm);
      if (s.pitchSteps) setPitchSteps(s.pitchSteps);
      if (s.cvSteps) setCvSteps(s.cvSteps);
      if (s.cv2Steps) setCv2Steps(s.cv2Steps);
      if (s.cv3Steps) setCv3Steps(s.cv3Steps);
      if (s.cv4Steps) setCv4Steps(s.cv4Steps);
    },
    // Los setters de useState/usePersistentState tienen identidad estable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handleSavePreset = useCallback((name: string) => savePreset(name, captureState()), [savePreset, captureState]);
  const handleLoadPreset = useCallback(
    (name: string) => {
      const state = getPreset(name);
      if (state) applyState(state);
    },
    [getPreset, applyState],
  );

  // Reset global (botón "DEF" del header).
  const resetAll = useCallback(() => {
    applyState({
      channelEnabled: [true, false, false, false, false],
      osc1Fine: 0, osc1Spread: 20, osc1Count: 1,
      osc2Freq: 440, osc2Fine: 0, fmHarmonicity: 1, fmModIndex: 2,
      osc3Freq: 440, osc3Fine: 0, pwm3: 0,
      osc4Freq: 440, osc4Fine: 0, pwm4: 0,
      noiseFilterRes: 2,
      mixOsc1: 0, mixOsc2: -40, mixOsc3: -40, mixOsc4: -40, mixNoise: -40,
      channelPan: [0, 0, 0, 0, 0],
      volume: 0,
      modPatch: createPatch([{ source: 'adsr', dest: 'vcaGain' }]),
      gatePatch: createGatePatch([
        { source: 'keyboard', dest: 'amp' },
        { source: 'midi', dest: 'amp' },
        { source: 'seq1', dest: 'amp' },
        { source: 'keyboard', dest: 'fx' },
        { source: 'midi', dest: 'fx' },
        { source: 'seq1', dest: 'fx' },
      ]),
      notePatch: createNotePatch([
        { source: 'keyboard', dest: 'osc1' },
        { source: 'midi', dest: 'osc1' },
        { source: 'seq1', dest: 'osc1' },
      ]),
      quantScale: 'major', quantRoot: 0,
      attack: 0.01, decay: 0.5, sustain: 0.5, release: 0.2, adsrAmount: 1,
      ad1Amount: 0, ad2Amount: 0, dahdAmount: 0,
      adsrCurve: 'linear', ad1Curve: 'linear', ad2Curve: 'linear', dahdCurve: 'linear',
      lfoDepth: 0, lfoRate: 1, lfo2Depth: 0, lfo2Rate: 1,
      filterFreq: 20000, filterRes: 1,
      vcf2Source: 'none', vcf2Res: 1, vcf2Freq: 2000,
      reverbDecay: 1, reverbWet: 0, delayFeedback: 0,
      reverbSends: [0, 0, 0, 0, 0], delaySends: [0, 0, 0, 0, 0],
      seqBpm: 128,
      seqConfigs: makeSeqConfigs(),
      pitchSteps: makePitchSteps(),
      cvSteps: makeCvSteps(), cv2Steps: makeCvSteps(), cv3Steps: makeCvSteps(), cv4Steps: makeCvSteps(),
    });
  }, [applyState]);

  useEffect(() => {
    registerResetAll(resetAll);
  }, [registerResetAll, resetAll]);

  // Estado de interacción (notas activas para el resaltado) y octava del teclado.
  const [activeNotes, setActiveNotes] = useState<Record<string, string>>({});
  const [octave, setOctave] = useState(4);
  const oscRef = useRef<HTMLDivElement | null>(null);

  // Anclas de scroll para el nav inferior (orden de render = MAKWIL_MODULE_SECTIONS sin teclado).
  useLayoutEffect(() => {
    const moduleSections = MAKWIL_MODULE_SECTIONS.filter((s) => s.id !== KEYBOARD_SECTION_ID);
    const mods = document.querySelectorAll<HTMLElement>('.synth-modules .module');
    if (mods.length !== moduleSections.length) {
      console.warn(`[BottomNav] módulos (${mods.length}) ≠ secciones (${moduleSections.length}); revisa el orden.`);
    }
    moduleSections.forEach((s, i) => {
      if (mods[i]) mods[i].id = s.id;
    });
    const kbd = document.querySelector<HTMLElement>('.keyboard');
    if (kbd) kbd.id = KEYBOARD_SECTION_ID;
  }, []);

  const octaveRef = useRef(octave);
  octaveRef.current = octave;

  // --- Despacho de notas del TECLADO / MIDI (poli en VCO1 + mono en VCO2-4). ---
  // Pila mono (última nota gana) + voces poli por id de tecla.
  const heldMonoRef = useRef<{ key: string; note: string; source: GateSourceId }[]>([]);
  const heldPolyRef = useRef<Map<string, string>>(new Map());

  const noteOn = useCallback(
    (id: string, note: string, source: GateSourceId = 'keyboard', velocity = 1) => {
      if (heldMonoRef.current.some((h) => h.key === id)) return; // ya sonando
      // Poli (VCO1): cada nota toma una voz.
      if (polyConnected(source as NoteSourceId)) {
        const q = applyQuant(source as NoteSourceId, note);
        engine.polyAttack(q, undefined, velocity);
        heldPolyRef.current.set(id, q);
      }
      // Mono (VCO2-4 + envolventes): última nota / legato.
      const wasIdle = heldMonoRef.current.length === 0;
      heldMonoRef.current.push({ key: id, note, source });
      if (wasIdle) fireGateAttack(source, note, undefined, velocity);
      else routeNoteMono(source as NoteSourceId, note);
      setActiveNotes((prev) => ({ ...prev, [id]: note }));
    },
    [engine, polyConnected, applyQuant, fireGateAttack, routeNoteMono],
  );

  const noteOff = useCallback(
    (id: string) => {
      const pNote = heldPolyRef.current.get(id);
      if (pNote !== undefined) {
        engine.polyRelease(pNote);
        heldPolyRef.current.delete(id);
      }
      const idx = heldMonoRef.current.findIndex((h) => h.key === id);
      if (idx !== -1) {
        const [removed] = heldMonoRef.current.splice(idx, 1);
        if (heldMonoRef.current.length === 0) fireGateRelease(removed.source);
        else {
          const prev = heldMonoRef.current[heldMonoRef.current.length - 1];
          routeNoteMono(prev.source as NoteSourceId, prev.note);
        }
      }
      setActiveNotes((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    [engine, fireGateRelease, routeNoteMono],
  );

  // --- MIDI ---
  const midiMapRef = useRef(midiMap);
  midiMapRef.current = midiMap;
  const learningRef = useRef(learningSlot);
  learningRef.current = learningSlot;

  const midi = useMidi({
    midiMapRef,
    learningRef,
    onNoteOn: useCallback(
      (note: number, velocity: number) => noteOn(`midi:${note}`, Tone.Frequency(note, 'midi').toNote(), 'midi', velocity),
      [noteOn],
    ),
    onNoteOff: useCallback((note: number) => noteOff(`midi:${note}`), [noteOff]),
    onCC: useCallback((slot: number, value: number) => engine.setCCValue(slot, value), [engine]),
    onLearned: useCallback((slot: number, cc: number) => {
      setMidiMap((prev) => {
        const next = [...prev];
        next[slot] = cc;
        return next;
      });
      setLearningSlot(null);
    }, [setMidiMap]),
  });

  const onMidiLearn = useCallback((slot: number) => setLearningSlot((s) => (s === slot ? null : slot)), []);
  const onMidiClear = useCallback(
    (slot: number) => {
      setMidiMap((prev) => {
        const next = [...prev];
        next[slot] = null;
        return next;
      });
      setLearningSlot((s) => (s === slot ? null : s));
    },
    [setMidiMap],
  );

  // Filas de la matriz CV: oculta los slots CC MIDI sin asignar y reetiqueta los asignados.
  const modSources = useMemo<PatchSource[]>(
    () =>
      MAKWIL_MOD_SOURCES.flatMap((src) => {
        const m = /^midiCC(\d+)$/.exec(src.id);
        if (!m) return [src];
        const cc = midiMap[parseInt(m[1], 10) - 1];
        return cc == null ? [] : [{ ...src, label: `CC ${cc}`, short: `${cc}` }];
      }),
    [midiMap],
  );

  const octaveDown = useCallback(() => setOctave((o) => Math.max(1, o - 1)), []);
  const octaveUp = useCallback(() => setOctave((o) => Math.min(7, o + 1)), []);

  // Teclado de computadora (listeners una sola vez; octava viva por ref).
  useEffect(() => {
    const handleKeyDown = (ev: KeyboardEvent) => {
      if (ev.repeat) return;
      const key = ev.key.toLowerCase();
      if (key === 'q') return octaveDown();
      if (key === 'e') return octaveUp();
      const noteName = keyMap[key];
      if (!noteName) return;
      const noteOctave = UPPER_OCTAVE_KEYS.includes(key) ? octaveRef.current + 1 : octaveRef.current;
      noteOn(key, `${noteName}${noteOctave}`);
    };
    const handleKeyUp = (ev: KeyboardEvent) => noteOff(ev.key.toLowerCase());
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [noteOn, noteOff, octaveDown, octaveUp]);

  return (
    <div className="synth-container">
      <h1 className={'synthTitle'}>MAKWIL</h1>

      <Presets
        presets={presets}
        onSave={handleSavePreset}
        onLoad={handleLoadPreset}
        onDelete={removePreset}
        onImport={importMany}
      />

      <div className="synth-modules" ref={oscRef}>
        <VCO
          oscType={osc1Type}
          setOscType={setOsc1Type}
          frequency={osc1Freq}
          setFrequency={setOsc1Freq}
          fine={osc1Fine}
          setFine={setOsc1Fine}
          isSecondary={false}
          enabled={channelEnabled[0]}
          setEnabled={(v) => setChannelEnabledAt(0, v)}
          label="VCO 1 (Poli)"
          index={1}
          fat
          spread={osc1Spread}
          setSpread={setOsc1Spread}
          count={osc1Count}
          setCount={setOsc1Count}
          oscRef={oscRef}
        />

        <VCO
          oscType={osc2Type}
          setOscType={setOsc2Type}
          frequency={osc2Freq}
          setFrequency={setOsc2Freq}
          fine={osc2Fine}
          setFine={setOsc2Fine}
          isSecondary={true}
          enabled={channelEnabled[1]}
          setEnabled={(v) => setChannelEnabledAt(1, v)}
          label="VCO 2 (FM)"
          index={2}
          fm
          harmonicity={fmHarmonicity}
          setHarmonicity={setFmHarmonicity}
          modIndex={fmModIndex}
          setModIndex={setFmModIndex}
        />

        <VCO
          oscType={osc3Type}
          setOscType={setOsc3Type}
          frequency={osc3Freq}
          setFrequency={setOsc3Freq}
          fine={osc3Fine}
          setFine={setOsc3Fine}
          isSecondary={true}
          enabled={channelEnabled[2]}
          setEnabled={(v) => setChannelEnabledAt(2, v)}
          label="VCO 3"
          index={3}
          pwm={pwm3}
          setPwm={setPwm3}
        />

        <VCO
          oscType={osc4Type}
          setOscType={setOsc4Type}
          frequency={osc4Freq}
          setFrequency={setOsc4Freq}
          fine={osc4Fine}
          setFine={setOsc4Fine}
          isSecondary={true}
          enabled={channelEnabled[3]}
          setEnabled={(v) => setChannelEnabledAt(3, v)}
          label="VCO 4"
          index={4}
          pwm={pwm4}
          setPwm={setPwm4}
        />

        <VCF
          filterType={filterType}
          setFilterType={setFilterType}
          frequency={filterFreq}
          setFrequency={setFilterFreq}
          resonance={filterRes}
          setResonance={setFilterRes}
        />

        <VCF2
          type={vcf2Type}
          setType={setVcf2Type}
          freq={vcf2Freq}
          setFreq={setVcf2Freq}
          res={vcf2Res}
          setRes={setVcf2Res}
          source={vcf2Source}
          setSource={setVcf2Source}
        />

        <Noise
          noiseType={noiseType}
          setNoiseType={setNoiseType}
          enabled={channelEnabled[4]}
          setEnabled={(v) => setChannelEnabledAt(4, v)}
          filterEnabled={noiseFilterEnabled}
          setFilterEnabled={setNoiseFilterEnabled}
          filterFreq={noiseFilterFreq}
          setFilterFreq={setNoiseFilterFreq}
          filterRes={noiseFilterRes}
          setFilterRes={setNoiseFilterRes}
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
          mixOsc4={mixOsc4}
          setMixOsc4={setMixOsc4}
          mixNoise={mixNoise}
          setMixNoise={setMixNoise}
          enabled={channelEnabled}
          onToggleEnabled={onToggleChannel}
          solos={channelSolo}
          onToggleSolo={onToggleSolo}
          pans={channelPan}
          onPan={onPan}
          reverbSends={reverbSends}
          onReverbSend={onReverbSend}
          reverbSendEnabled={reverbSendEnabled}
          onToggleReverbSend={onToggleReverbSend}
          delaySends={delaySends}
          onDelaySend={onDelaySend}
          delaySendEnabled={delaySendEnabled}
          onToggleDelaySend={onToggleDelaySend}
          channelLabels={['VCO 1', 'VCO 2', 'VCO 3', 'VCO 4', 'Ruido']}
        />

        <div className="envelope-row">
          <ADSR
            attack={attack}
            setAttack={setAttack}
            decay={decay}
            setDecay={setDecay}
            sustain={sustain}
            setSustain={setSustain}
            release={release}
            setRelease={setRelease}
            amount={adsrAmount}
            setAmount={setAdsrAmount}
            curve={adsrCurve}
            setCurve={setAdsrCurve}
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
            curve={ad1Curve}
            setCurve={setAd1Curve}
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
            curve={ad2Curve}
            setCurve={setAd2Curve}
          />
          <DAHD
            delay={dahdDelay}
            setDelay={setDahdDelay}
            attack={dahdAttack}
            setAttack={setDahdAttack}
            hold={dahdHold}
            setHold={setDahdHold}
            decay={dahdDecay}
            setDecay={setDahdDecay}
            amount={dahdAmount}
            setAmount={setDahdAmount}
            curve={dahdCurve}
            setCurve={setDahdCurve}
          />
        </div>

        <div className="lfo-row">
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
          <Reverb decay={reverbDecay} setDecay={setReverbDecay} wet={reverbWet} setWet={setReverbWet} />
          <Delay time={delayTime} setTime={setDelayTime} feedback={delayFeedback} setFeedback={setDelayFeedback} />
        </div>

        <div className="matrix-row">
          <PatchMatrix
            patch={modPatch}
            setPatch={setModPatch}
            gatePatch={gatePatch}
            setGatePatch={setGatePatch}
            notePatch={notePatch}
            setNotePatch={setNotePatch}
            modSources={modSources}
            modDests={MAKWIL_MOD_DESTS}
            gateSources={MAKWIL_GATE_SOURCES}
            gateDests={MAKWIL_GATE_DESTS}
            noteSources={MAKWIL_NOTE_SOURCES}
            noteDests={MAKWIL_NOTE_DESTS}
          />

          <Midi
            supported={midi.supported}
            enabled={midi.enabled}
            deviceNames={midi.deviceNames}
            activity={midi.activity}
            midiMap={midiMap}
            learningSlot={learningSlot}
            onEnable={midi.enable}
            onLearn={onMidiLearn}
            onClear={onMidiClear}
            quantScale={quantScale}
            setQuantScale={setQuantScale}
            quantRoot={quantRoot}
            setQuantRoot={setQuantRoot}
          />
        </div>

        <MakwilSequencer
          configs={seqConfigs}
          setConfigs={setSeqConfigs}
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
          cv3Steps={cv3Steps}
          setCv3Steps={setCv3Steps}
          cv4Steps={cv4Steps}
          setCv4Steps={setCv4Steps}
          currentSteps={currentSteps}
        />
      </div>

      <Keyboard
        octave={octave}
        onOctaveDown={octaveDown}
        onOctaveUp={octaveUp}
        noteOn={noteOn}
        noteOff={noteOff}
        activeNotes={activeNotes}
      />

      <BottomNav
        channelEnabled={channelEnabled}
        onToggleChannel={onToggleChannel}
        sections={MAKWIL_MODULE_SECTIONS}
        voiceLabels={['V1', 'V2', 'V3', 'V4', 'N']}
      />
    </div>
  );
};

export default Makwil;
