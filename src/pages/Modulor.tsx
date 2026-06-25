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
import Sequencer from '../components/modules/Sequencer/Sequencer';
import Drums from '../components/modules/Drums/Drums';
import Midi from '../components/modules/Midi/Midi';
import { useMidi } from '../audio/midi/useMidi';
import Keyboard from '../components/modules/Keyboard/Keyboard';
import { ALL_KEYS } from '../components/modules/Keyboard/layout';
import { DRUM_VOICES, DEFAULT_SAMPLES } from '../audio/drums/kit';
import { useSynthEngine, type NoiseType, type Vcf2Type, type Vcf2Source, type EnvCurve } from '../audio/useSynthEngine';
import { scaleIntervals, quantizeNote } from '../audio/scales';
import {
  createPatch,
  MOD_SOURCES,
  MIDI_CC_SLOTS,
  type ModPatch,
  type PatchSource,
} from '../audio/cv/patch';
import {
  createGatePatch,
  GATE_DESTS,
  GATE_SOURCES,
  gateKey,
  type GatePatch,
  type GateSourceId,
} from '../audio/cv/gates';
import {
  createNotePatch,
  NOTE_DESTS,
  noteKey,
  type NotePatch,
  type NoteSourceId,
} from '../audio/cv/notes';
import { useSequencer } from '../audio/sequencer/useSequencer';
import { useTransport } from '../audio/sequencer/transport';
import {
  MAX_STEPS,
  SEQ_COUNT,
  BASE_CLOCK,
  DEFAULT_PITCH_OFFSET,
  type SeqConfig,
  type PitchStep,
  type CvStep,
  type DrumStep,
} from '../audio/sequencer/types';
import { usePersistentState, PERSIST_KEYS } from '../hooks/usePersistentState';
import Presets from '../components/Presets/Presets';
import { MODULE_SECTIONS, KEYBOARD_SECTION_ID } from '../components/BottomNav/sections';
import BottomNav from '../components/BottomNav/BottomNav';
import { usePresets } from '../presets/usePresets';
import { useCloudPresets } from '../presets/useCloudPresets';
import type { PresetState } from '../presets/types';
import '../App.css';
// import Oscilloscope from '../components/Oscilloscope/Oscilloscope';
// import SpectrumAnalyzer from '../components/Spectrum/Spectrum';

// Mapeo tecla de computadora → nota y teclas de octava superior, derivados del layout del
// teclado en pantalla (ALL_KEYS) para tener una sola fuente de verdad.
const keyMap: Record<string, string> = Object.fromEntries(ALL_KEYS.map((k) => [k.key, k.note]));
const UPPER_OCTAVE_KEYS = ALL_KEYS.filter((k) => k.octaveOffset === 1).map((k) => k.key);

// Saneadores de frecuencia persistida: reemplazan valores corruptos (null/NaN/0/negativos, p. ej.
// un input dejado vacío que quedó como `null` en localStorage) por su default, antes del primer
// render, para que la página no se cuelgue al cargar. El default es la "posición default" del control.
const safeOscFreq = (v: number): number => (Number.isFinite(v) && v > 0 ? v : 440);
const safeFilterFreq = (v: number): number => (Number.isFinite(v) && v > 0 ? v : 20000);

const Modulor: React.FC = () => {
  // Todos los controles persisten en localStorage (usePersistentState) para recuperar el
  // patch completo al recargar.

  // Parámetros del oscilador 1
  const [oscType, setOscType] = usePersistentState<Tone.ToneOscillatorType>(PERSIST_KEYS.osc1Type, 'sawtooth');
  const [frequency, setFrequency] = usePersistentState<number>(PERSIST_KEYS.osc1Freq, 440, safeOscFreq);
  const [osc1Fine, setOsc1Fine] = usePersistentState<number>(PERSIST_KEYS.osc1Fine, 0);
  const [pwm1, setPwm1] = usePersistentState<number>(PERSIST_KEYS.osc1Pwm, 0);

  // Parámetros del oscilador 2 (frecuencia base propia + afinado fino en cents)
  const [osc2Type, setOsc2Type] = usePersistentState<Tone.ToneOscillatorType>(PERSIST_KEYS.osc2Type, 'sawtooth');
  const [osc2Freq, setOsc2Freq] = usePersistentState<number>(PERSIST_KEYS.osc2Freq, 440, safeOscFreq);
  const [detune, setDetune] = usePersistentState<number>(PERSIST_KEYS.osc2Detune, 0);
  const [pwm2, setPwm2] = usePersistentState<number>(PERSIST_KEYS.osc2Pwm, 0);

  // Parámetros del oscilador 3 (FatOscillator: unísono/súper-saw, sin PWM)
  const [osc3Type, setOsc3Type] = usePersistentState<Tone.ToneOscillatorType>(PERSIST_KEYS.osc3Type, 'sawtooth');
  const [osc3Freq, setOsc3Freq] = usePersistentState<number>(PERSIST_KEYS.osc3Freq, 440, safeOscFreq);
  const [osc3Detune, setOsc3Detune] = usePersistentState<number>(PERSIST_KEYS.osc3Detune, 0);
  const [osc3Spread, setOsc3Spread] = usePersistentState<number>(PERSIST_KEYS.osc3Spread, 20);
  const [osc3Count, setOsc3Count] = usePersistentState<number>(PERSIST_KEYS.osc3Count, 1);

  // Parámetros del oscilador 4 (FM): 5ª voz. Portadora + moduladora internas.
  const [osc4Type, setOsc4Type] = usePersistentState<Tone.ToneOscillatorType>(PERSIST_KEYS.osc4Type, 'sine');
  const [osc4Freq, setOsc4Freq] = usePersistentState<number>(PERSIST_KEYS.osc4Freq, 440, safeOscFreq);
  const [osc4Fine, setOsc4Fine] = usePersistentState<number>(PERSIST_KEYS.osc4Fine, 0);
  const [fmHarmonicity, setFmHarmonicity] = usePersistentState<number>(PERSIST_KEYS.fmHarmonicity, 1);
  const [fmModIndex, setFmModIndex] = usePersistentState<number>(PERSIST_KEYS.fmModIndex, 2);

  // On/off por voz (índice 0..4 = VCO1, VCO2, VCO3, VCO4-FM, Ruido). Fuente única de verdad
  // para el switch del VCO/Ruido, el botón "M" del mixer y los chips del BottomNav.
  const [channelEnabled, setChannelEnabled] = usePersistentState<boolean[]>(PERSIST_KEYS.channelEnabled, () => [true, false, false, false, false]);

  // Cuantizador de escala para las fuentes MIDI (raíz + tipo). Se aplica a la fuente conectada
  // a "Cuant" en la matriz MIDI.
  const [quantScale, setQuantScale] = usePersistentState<string>(PERSIST_KEYS.quantScale, 'major');
  const [quantRoot, setQuantRoot] = usePersistentState<number>(PERSIST_KEYS.quantRoot, 0);

  // Generador de ruido
  const [noiseType, setNoiseType] = usePersistentState<NoiseType>(PERSIST_KEYS.noiseType, 'white');
  const [noiseFilterEnabled, setNoiseFilterEnabled] = usePersistentState<boolean>(PERSIST_KEYS.noiseFilterEnabled, false);
  const [noiseFilterFreq, setNoiseFilterFreq] = usePersistentState<number>(PERSIST_KEYS.noiseFilterFreq, 1000);
  const [noiseFilterRes, setNoiseFilterRes] = usePersistentState<number>(PERSIST_KEYS.noiseFilterRes, 2);

  // Mixer: nivel por canal (dB)
  const [mixOsc1, setMixOsc1] = usePersistentState<number>(PERSIST_KEYS.mixOsc1, 0);
  const [mixOsc2, setMixOsc2] = usePersistentState<number>(PERSIST_KEYS.mixOsc2, 0);
  const [mixOsc3, setMixOsc3] = usePersistentState<number>(PERSIST_KEYS.mixOsc3, 0);
  const [mixOsc4, setMixOsc4] = usePersistentState<number>(PERSIST_KEYS.mixOsc4, 0);
  const [mixNoise, setMixNoise] = usePersistentState<number>(PERSIST_KEYS.mixNoise, -10);

  // Parámetros del filtro
  const [filterType, setFilterType] = usePersistentState<BiquadFilterType>(PERSIST_KEYS.filterType, 'lowpass');
  const [filterFreq, setFilterFreq] = usePersistentState<number>(PERSIST_KEYS.filterFreq, 20000, safeFilterFreq);
  const [filterRes, setFilterRes] = usePersistentState<number>(PERSIST_KEYS.filterRes, 1);

  // VCF 2 (insert por voz, fuera de la matriz)
  const [vcf2Type, setVcf2Type] = usePersistentState<Vcf2Type>(PERSIST_KEYS.vcf2Type, 'lowpass');
  const [vcf2Freq, setVcf2Freq] = usePersistentState<number>(PERSIST_KEYS.vcf2Freq, 2000);
  const [vcf2Res, setVcf2Res] = usePersistentState<number>(PERSIST_KEYS.vcf2Res, 1);
  const [vcf2Source, setVcf2Source] = usePersistentState<Vcf2Source>(PERSIST_KEYS.vcf2Source, 'none');

  // Envolvente AD 1 (fuente de modulación; antes ligada al filtro, ahora va por la matriz)
  const [ad1Attack, setAd1Attack] = usePersistentState<number>(PERSIST_KEYS.ad1Attack, 0.05);
  const [ad1Decay, setAd1Decay] = usePersistentState<number>(PERSIST_KEYS.ad1Decay, 0.3);
  const [ad1Amount, setAd1Amount] = usePersistentState<number>(PERSIST_KEYS.ad1Amount, 0);
  const [ad1Curve, setAd1Curve] = usePersistentState<EnvCurve>(PERSIST_KEYS.ad1Curve, 'linear');

  // Envolvente AD 2 (fuente de modulación)
  const [ad2Attack, setAd2Attack] = usePersistentState<number>(PERSIST_KEYS.ad2Attack, 0.05);
  const [ad2Decay, setAd2Decay] = usePersistentState<number>(PERSIST_KEYS.ad2Decay, 0.3);
  const [ad2Amount, setAd2Amount] = usePersistentState<number>(PERSIST_KEYS.ad2Amount, 0);
  const [ad2Curve, setAd2Curve] = usePersistentState<EnvCurve>(PERSIST_KEYS.ad2Curve, 'linear');

  // Envolvente DAHD (Delay-Attack-Hold-Decay; fuente de modulación)
  const [dahdDelay, setDahdDelay] = usePersistentState<number>(PERSIST_KEYS.dahdDelay, 0);
  const [dahdAttack, setDahdAttack] = usePersistentState<number>(PERSIST_KEYS.dahdAttack, 0.05);
  const [dahdHold, setDahdHold] = usePersistentState<number>(PERSIST_KEYS.dahdHold, 0.1);
  const [dahdDecay, setDahdDecay] = usePersistentState<number>(PERSIST_KEYS.dahdDecay, 0.3);
  const [dahdAmount, setDahdAmount] = usePersistentState<number>(PERSIST_KEYS.dahdAmount, 0);
  const [dahdCurve, setDahdCurve] = usePersistentState<EnvCurve>(PERSIST_KEYS.dahdCurve, 'linear');

  // Parámetros ADSR (con cantidad/AMT como fuente de la matriz)
  const [attack, setAttack] = usePersistentState<number>(PERSIST_KEYS.attack, 0.1);
  const [decay, setDecay] = usePersistentState<number>(PERSIST_KEYS.decay, 0.2);
  const [sustain, setSustain] = usePersistentState<number>(PERSIST_KEYS.sustain, 0.5);
  const [release, setRelease] = usePersistentState<number>(PERSIST_KEYS.release, 1);
  const [adsrAmount, setAdsrAmount] = usePersistentState<number>(PERSIST_KEYS.adsrAmount, 1);
  const [adsrCurve, setAdsrCurve] = usePersistentState<EnvCurve>(PERSIST_KEYS.adsrCurve, 'linear');

  // Volumen (dB)
  const [volume, setVolume] = usePersistentState<number>(PERSIST_KEYS.volume, -6);

  // Parámetros del LFO 1
  const [lfoType, setLfoType] = usePersistentState<Tone.ToneOscillatorType>(PERSIST_KEYS.lfoType, 'sine');
  const [lfoRate, setLfoRate] = usePersistentState<number>(PERSIST_KEYS.lfoRate, 5);
  const [lfoDepth, setLfoDepth] = usePersistentState<number>(PERSIST_KEYS.lfoDepth, 0.3);

  // Parámetros del LFO 2
  const [lfo2Type, setLfo2Type] = usePersistentState<Tone.ToneOscillatorType>(PERSIST_KEYS.lfo2Type, 'triangle');
  const [lfo2Rate, setLfo2Rate] = usePersistentState<number>(PERSIST_KEYS.lfo2Rate, 2);
  const [lfo2Depth, setLfo2Depth] = usePersistentState<number>(PERSIST_KEYS.lfo2Depth, 0.3);

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
      { source: 'midi', dest: 'amp' },
      { source: 'seq1', dest: 'amp' },
      // La compuerta de FX gateada por la nota (como el comportamiento previo a su ruteo).
      { source: 'keyboard', dest: 'fx' },
      { source: 'midi', dest: 'fx' },
      { source: 'seq1', dest: 'fx' },
    ]),
  );

  // Matriz MIDI (fuentes de nota → pitch de VCO / seguimiento de cutoff). Por defecto sólo el
  // teclado y el seq 1 van a VCO 1 (parafónico: rutear a más VCO los hace sonar a la vez).
  const [notePatch, setNotePatch] = usePersistentState<NotePatch>(PERSIST_KEYS.notePatch, () =>
    createNotePatch([
      { source: 'keyboard', dest: 'osc1' },
      { source: 'seq1', dest: 'osc1' },
    ]),
  );

  // Mapeo de perillas/CC MIDI: slot → número de CC (null = sin asignar). Las 4 primeras
  // vienen pre-cableadas a CC 20–23 (el controlador del usuario). Es config del dispositivo
  // (no entra en presets); el ruteo a destinos vive en modPatch (la matriz).
  const [midiMap, setMidiMap] = usePersistentState<(number | null)[]>(PERSIST_KEYS.midiMap, () => {
    const m: (number | null)[] = Array(MIDI_CC_SLOTS).fill(null);
    [20, 21, 22, 23].forEach((cc, i) => (m[i] = cc));
    return m;
  });
  const [learningSlot, setLearningSlot] = useState<number | null>(null);

  // Parámetros del reverb (efecto de envío)
  const [reverbDecay, setReverbDecay] = usePersistentState<number>(PERSIST_KEYS.reverbDecay, 2);
  const [reverbWet, setReverbWet] = usePersistentState<number>(PERSIST_KEYS.reverbWet, 1);

  // Parámetros del delay (efecto de envío)
  const [delayTime, setDelayTime] = usePersistentState<number>(PERSIST_KEYS.delayTime, 0.25);
  const [delayFeedback, setDelayFeedback] = usePersistentState<number>(PERSIST_KEYS.delayFeedback, 0.3);

  // Mixer: solo, pan y envíos por canal (índice 0..4 = VCO1, VCO2, VCO3, VCO4-FM, Ruido).
  // El on/off por canal vive en channelEnabled (arriba).
  const [channelSolo, setChannelSolo] = usePersistentState<boolean[]>(PERSIST_KEYS.channelSolo, () => [false, false, false, false, false]);
  const [channelPan, setChannelPan] = usePersistentState<number[]>(PERSIST_KEYS.channelPan, () => [0, 0, 0, 0, 0]);
  const [reverbSends, setReverbSends] = usePersistentState<number[]>(PERSIST_KEYS.reverbSends, () => [0, 0, 0, 0, 0]);
  const [delaySends, setDelaySends] = usePersistentState<number[]>(PERSIST_KEYS.delaySends, () => [0, 0, 0, 0, 0]);
  const [reverbSendEnabled, setReverbSendEnabled] = usePersistentState<boolean>(PERSIST_KEYS.reverbSendEnabled, true);
  const [delaySendEnabled, setDelaySendEnabled] = usePersistentState<boolean>(PERSIST_KEYS.delaySendEnabled, true);

  // Handlers por índice para los arrays del mixer (identidad estable).
  // On/off de voz: el toggle (botón "M" del mixer / chip del BottomNav) y el setter directo
  // (switch del VCO/Ruido) escriben el mismo channelEnabled.
  const onToggleChannel = useCallback((i: number) => setChannelEnabled((p) => p.map((v, idx) => (idx === i ? !v : v))), [setChannelEnabled]);
  const setChannelEnabledAt = useCallback((i: number, v: boolean) => setChannelEnabled((p) => p.map((x, idx) => (idx === i ? v : x))), [setChannelEnabled]);
  const onToggleSolo = useCallback((i: number) => setChannelSolo((p) => p.map((v, idx) => (idx === i ? !v : v))), [setChannelSolo]);
  const onPan = useCallback((i: number, val: number) => setChannelPan((p) => p.map((v, idx) => (idx === i ? val : v))), [setChannelPan]);
  const onReverbSend = useCallback((i: number, val: number) => setReverbSends((p) => p.map((v, idx) => (idx === i ? val : v))), [setReverbSends]);
  const onDelaySend = useCallback((i: number, val: number) => setDelaySends((p) => p.map((v, idx) => (idx === i ? val : v))), [setDelaySends]);
  const onToggleReverbSend = useCallback(() => setReverbSendEnabled((v) => !v), [setReverbSendEnabled]);
  const onToggleDelaySend = useCallback(() => setDelaySendEnabled((v) => !v), [setDelaySendEnabled]);

  // Secuenciador: 4 secuenciadores independientes. Transporte (play/stop/bpm) compartido
  // con el header vía contexto; el seq 1 es la base de reloj y los demás corren a su
  // divisor/multiplicador relativo. Por defecto sólo el seq 1 tiene pasos.
  const {
    running: seqRunning,
    setRunning: setSeqRunning,
    bpm: seqBpm,
    setBpm: setSeqBpm,
    registerReset,
    registerResetAll,
  } = useTransport();
  const [seqConfigs, setSeqConfigs] = usePersistentState<SeqConfig[]>(PERSIST_KEYS.seqConfigs, () =>
    Array.from({ length: SEQ_COUNT }, (_, i) => ({
      steps: i === 0 ? 16 : 0,
      direction: 'forward' as const,
      clock: BASE_CLOCK,
    })),
  );
  const [pitchSteps, setPitchSteps] = usePersistentState<PitchStep[]>(PERSIST_KEYS.pitchSteps, () =>
    Array.from({ length: MAX_STEPS }, (_, i) => ({
      offset: DEFAULT_PITCH_OFFSET, // C3
      gate: i % 4 === 0 && i < 16, // sólo pasos 1, 5, 9 y 13
      velocity: 1,
      gateLen: 0.5, // gates a la mitad
    })),
  );
  const [cvSteps, setCvSteps] = usePersistentState<CvStep[]>(PERSIST_KEYS.cvSteps, () =>
    Array.from({ length: MAX_STEPS }, () => ({ value: 0, offset: DEFAULT_PITCH_OFFSET, gate: false, velocity: 1, gateLen: 0.5 })),
  );
  const [cv2Steps, setCv2Steps] = usePersistentState<CvStep[]>(PERSIST_KEYS.cv2Steps, () =>
    Array.from({ length: MAX_STEPS }, () => ({ value: 0, offset: DEFAULT_PITCH_OFFSET, gate: false, velocity: 1, gateLen: 0.5 })),
  );
  const [cv3Steps, setCv3Steps] = usePersistentState<CvStep[]>(PERSIST_KEYS.cv3Steps, () =>
    Array.from({ length: MAX_STEPS }, () => ({ value: 0, offset: DEFAULT_PITCH_OFFSET, gate: false, velocity: 1, gateLen: 0.5 })),
  );

  // Batería: 4 voces de sample, cada una con pitch/decay/volumen/envíos y su secuenciador
  // de triggers (config + pasos por voz). Comparte transporte/BPM con los demás.
  const [drumEnabled, setDrumEnabled] = usePersistentState<boolean[]>(PERSIST_KEYS.drumEnabled, () => Array(DRUM_VOICES).fill(true));
  // Selección de sample por voz (persistida por id). 'synth' = sonido sintetizado; en otro
  // caso es la URL del catálogo o 'upload:<nombre>' de un archivo subido. Por defecto el
  // primer sample del catálogo de la voz (o 'synth' si no tiene).
  const [drumSampleSel, setDrumSampleSel] = usePersistentState<string[]>(PERSIST_KEYS.drumSampleSel, () =>
    Array.from({ length: DRUM_VOICES }, (_, v) => DEFAULT_SAMPLES[v]?.[0]?.url ?? 'synth'),
  );
  // Samples subidos por el usuario en runtime (blobs; no se persisten).
  const [userSamples, setUserSamples] = useState<{ name: string; file: File }[][]>(() =>
    Array.from({ length: DRUM_VOICES }, () => []),
  );
  const [drumPitch, setDrumPitch] = usePersistentState<number[]>(PERSIST_KEYS.drumPitch, () => Array(DRUM_VOICES).fill(1));
  const [drumDecay, setDrumDecay] = usePersistentState<number[]>(PERSIST_KEYS.drumDecay, () => Array(DRUM_VOICES).fill(0.3));
  const [drumVol, setDrumVol] = usePersistentState<number[]>(PERSIST_KEYS.drumVol, () => Array(DRUM_VOICES).fill(0));
  const [drumRevSends, setDrumRevSends] = usePersistentState<number[]>(PERSIST_KEYS.drumRevSends, () => Array(DRUM_VOICES).fill(0));
  const [drumDelSends, setDrumDelSends] = usePersistentState<number[]>(PERSIST_KEYS.drumDelSends, () => Array(DRUM_VOICES).fill(0));
  const [drumConfigs, setDrumConfigs] = usePersistentState<SeqConfig[]>(PERSIST_KEYS.drumConfigs, () =>
    Array.from({ length: DRUM_VOICES }, () => ({ steps: 16, direction: 'forward' as const, clock: BASE_CLOCK })),
  );
  const [drumSteps, setDrumSteps] = usePersistentState<DrumStep[][]>(PERSIST_KEYS.drumSteps, () =>
    Array.from({ length: DRUM_VOICES }, () =>
      Array.from({ length: MAX_STEPS }, () => ({ gate: false, velocity: 1 })),
    ),
  );
  // Efectos propios de la batería (independientes de los del sinte).
  const [drumReverbDecay, setDrumReverbDecay] = usePersistentState<number>(PERSIST_KEYS.drumReverbDecay, 1.5);
  const [drumDelayTime, setDrumDelayTime] = usePersistentState<number>(PERSIST_KEYS.drumDelayTime, 0.2);
  const [drumDelayFeedback, setDrumDelayFeedback] = usePersistentState<number>(PERSIST_KEYS.drumDelayFeedback, 0.3);

  // Handlers por índice/voz (identidad estable; los setters de usePersistentState lo son).
  const toggleDrumEnabled = useCallback((i: number) => setDrumEnabled((p) => p.map((v, idx) => (idx === i ? !v : v))), [setDrumEnabled]);
  const setDrumPitchAt = useCallback((i: number, v: number) => setDrumPitch((p) => p.map((x, idx) => (idx === i ? v : x))), [setDrumPitch]);
  const setDrumDecayAt = useCallback((i: number, v: number) => setDrumDecay((p) => p.map((x, idx) => (idx === i ? v : x))), [setDrumDecay]);
  const setDrumVolAt = useCallback((i: number, v: number) => setDrumVol((p) => p.map((x, idx) => (idx === i ? v : x))), [setDrumVol]);
  const setDrumRevSendAt = useCallback((i: number, v: number) => setDrumRevSends((p) => p.map((x, idx) => (idx === i ? v : x))), [setDrumRevSends]);
  const setDrumDelSendAt = useCallback((i: number, v: number) => setDrumDelSends((p) => p.map((x, idx) => (idx === i ? v : x))), [setDrumDelSends]);
  const setDrumConfigAt = useCallback(
    (i: number, patch: Partial<SeqConfig>) => setDrumConfigs((p) => p.map((c, idx) => (idx === i ? { ...c, ...patch } : c))),
    [setDrumConfigs],
  );
  const toggleDrumStep = useCallback(
    (voice: number, step: number) =>
      setDrumSteps((prev) =>
        prev.map((lane, v) => (v === voice ? lane.map((s, i) => (i === step ? { ...s, gate: !s.gate } : s)) : lane)),
      ),
    [setDrumSteps],
  );

  // Motor de audio: construye el grafo de Tone.js una sola vez y sincroniza
  // estos parámetros con sus nodos sin reconstruirlo.
  const engine = useSynthEngine({
    oscType, frequency, osc1Fine, pwm: pwm1,
    osc2Type, osc2Freq, detune, pwm2,
    osc3Type, osc3Freq, osc3Detune, osc3Spread, osc3Count,
    osc4Type, osc4Freq, osc4Fine, fmHarmonicity, fmModIndex,
    noiseType, noiseFilterEnabled, noiseFilterFreq, noiseFilterRes,
    mixOsc1, mixOsc2, mixOsc3, mixOsc4, mixNoise,
    channelEnabled, channelSolo, channelPan,
    reverbSends, delaySends, reverbSendEnabled, delaySendEnabled,
    fxGated: GATE_SOURCES.some((s) => !!gatePatch[gateKey(s.id, 'fx')]),
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
    reverbDecay, reverbWet,
    delayTime, delayFeedback,
    drumPitch, drumDecay, drumVol, drumRevSends, drumDelSends,
    drumReverbDecay, drumDelayTime, drumDelayFeedback,
  });

  // Despachador de gates: dado un evento de una fuente, dispara las envolventes conectadas
  // en la matriz de gates. Se lee gatePatch por ref para no recrear los callbacks.
  const gatePatchRef = useRef(gatePatch);
  gatePatchRef.current = gatePatch;

  // Ruteo de nota según la matriz MIDI: lleva la nota de `source` a los VCO conectados
  // (pitch) y a los filtros conectados (seguimiento de cutoff). Se lee notePatch por ref para
  // no recrear los callbacks. Para fuentes sin filas (seq3/seq4) no hay claves → no hace nada.
  const notePatchRef = useRef(notePatch);
  notePatchRef.current = notePatch;
  // Ajustes del cuantizador leídos por ref para no recrear routeNote en cada cambio.
  const quantRef = useRef({ scale: quantScale, root: quantRoot });
  quantRef.current = { scale: quantScale, root: quantRoot };
  const routeNote = useCallback(
    (source: GateSourceId, note: string, time?: number) => {
      const src = source as NoteSourceId;
      // Si la fuente está conectada a "Cuant", ajusta la nota a la escala antes de rutearla.
      let outNote = note;
      if (notePatchRef.current[noteKey(src, 'quant')]) {
        const { scale, root } = quantRef.current;
        outNote = quantizeNote(note, root, scaleIntervals(scale));
      }
      for (const dest of NOTE_DESTS) {
        if (dest.id === 'quant') continue; // modificador, no destino de pitch
        if (!notePatchRef.current[noteKey(src, dest.id)]) continue;
        if (dest.id === 'osc1') engine.setOscNote(0, outNote, time);
        else if (dest.id === 'osc2') engine.setOscNote(1, outNote, time);
        else if (dest.id === 'osc3') engine.setOscNote(2, outNote, time);
        else if (dest.id === 'osc4') engine.setOscNote(3, outNote, time);
        // 'vcf3' existe en el tipo NoteDestId (compartido con Makwil) pero no en las NOTE_DESTS
        // de Modulor; el cast acota al conjunto que su motor soporta.
        else engine.setFilterKeyTrack(dest.id as 'filter1' | 'vcf2' | 'noiseFilter', outNote, time);
      }
    },
    [engine],
  );

  const fireGateAttack = useCallback(
    (source: GateSourceId, note: string | undefined, time?: number, velocity = 1) => {
      if (note) routeNote(source, note, time);
      for (const dest of GATE_DESTS) {
        if (gatePatchRef.current[gateKey(source, dest.id)]) engine.envAttack(dest.id, time, velocity);
      }
    },
    [engine, routeNote],
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

  // Disparo de batería filtrado por el encendido/apagado de cada voz (checkbox del mixer).
  // Se lee por ref para no recrear el callback en cada cambio de estado.
  const drumEnabledRef = useRef(drumEnabled);
  drumEnabledRef.current = drumEnabled;
  const triggerDrum = useCallback(
    (voice: number, time?: number, velocity = 1) => {
      if (!drumEnabledRef.current[voice]) return;
      engine.triggerDrum(voice, time, velocity);
    },
    [engine],
  );

  // Opciones de sample por voz: 'Sintetizado' siempre primero, luego el catálogo S3 y al
  // final los subidos por el usuario en esta sesión.
  const sampleOptions = useMemo(
    () =>
      Array.from({ length: DRUM_VOICES }, (_, v) => [
        { id: 'synth', name: 'Sintetizado' },
        ...(DEFAULT_SAMPLES[v] ?? []).map((s) => ({ id: s.url, name: s.name })),
        ...userSamples[v].map((s) => ({ id: `upload:${s.name}`, name: s.name })),
      ]),
    [userSamples],
  );

  // Carga en el motor el sample seleccionado de cada voz. Sólo recarga la voz cuyo id cambió
  // (loadedSampleRef) para no re-descargar URLs en cada subida. Si el id ya no existe (p. ej.
  // un subido perdido tras recargar) cae a la primera opción.
  const userSamplesRef = useRef(userSamples);
  userSamplesRef.current = userSamples;
  const loadedSampleRef = useRef<string[]>([]);
  useEffect(() => {
    drumSampleSel.forEach((sel, v) => {
      const opts = sampleOptions[v];
      const id = opts.some((o) => o.id === sel) ? sel : opts[0].id;
      if (loadedSampleRef.current[v] === id) return; // ya cargado en esta voz
      loadedSampleRef.current[v] = id;
      if (id === 'synth') {
        void engine.loadDrumSynth(v);
      } else if (id.startsWith('upload:')) {
        const name = id.slice('upload:'.length);
        const up = userSamplesRef.current[v].find((s) => s.name === name);
        if (up) void engine.loadDrumSample(v, up.file);
      } else {
        void engine.loadDrumSample(v, id); // URL del catálogo
      }
    });
  }, [drumSampleSel, sampleOptions, engine]);

  const onSelectSample = useCallback(
    (voice: number, id: string) => setDrumSampleSel((p) => p.map((s, i) => (i === voice ? id : s))),
    [setDrumSampleSel],
  );

  // Subida de sample del usuario: lo agrega al final de la voz y lo deja seleccionado.
  const onLoadSample = useCallback(
    (voice: number, file: File) => {
      setUserSamples((prev) =>
        prev.map((lane, i) => (i === voice ? [...lane, { name: file.name, file }] : lane)),
      );
      setDrumSampleSel((p) => p.map((s, i) => (i === voice ? `upload:${file.name}` : s)));
    },
    [setDrumSampleSel],
  );

  // Orquestación de los 4 secuenciadores (disparan a través del despachador de gates).
  const { currentSteps, drumCurrentSteps, reset: resetSequencer } = useSequencer({
    running: seqRunning,
    bpm: seqBpm,
    configs: seqConfigs,
    pitchSteps,
    cvSteps,
    cv2Steps,
    cv3Steps,
    fireAttack: fireGateAttack,
    fireRelease: fireGateRelease,
    setSeqCv: engine.setSeqCv,
    setSeqCv2: engine.setSeqCv2,
    setSeqCv3: engine.setSeqCv3,
    drumConfigs,
    drumSteps,
    triggerDrum,
  });

  // El reset del secuenciador vive aquí; lo registramos en el transporte para que el botón
  // del header controle esta misma instancia.
  useEffect(() => {
    registerReset(resetSequencer);
  }, [registerReset, resetSequencer]);

  // --- Presets con nombre ---
  // captureState/applyState son el ÚNICO punto a tocar para extender los presets a más
  // parámetros: añade el campo en PresetState y una línea en cada uno (mismo patrón).
  const { presets, save: savePreset, remove: removePreset, get: getPreset, importMany } =
    usePresets();
  // Sync con Google Sheets (clave + carga manual + auto-guardado del banco completo).
  const cloud = useCloudPresets<PresetState>({ keyStorageKey: PERSIST_KEYS.presetCloudKey, presets, importMany });

  const captureState = useCallback(
    (): PresetState => ({
      oscType, frequency, osc1Fine, pwm1,
      osc2Type, osc2Freq, detune, pwm2,
      osc3Type, osc3Freq, osc3Detune, osc3Spread, osc3Count,
      osc4Type, osc4Freq, osc4Fine, fmHarmonicity, fmModIndex,
      noiseType, noiseFilterEnabled, noiseFilterFreq, noiseFilterRes,
      mixOsc1, mixOsc2, mixOsc3, mixOsc4, mixNoise,
      channelEnabled, channelSolo, channelPan, reverbSends, delaySends, reverbSendEnabled, delaySendEnabled,
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
      modPatch, gatePatch, notePatch, quantScale, quantRoot,
      seqConfigs, seqBpm, pitchSteps, cvSteps, cv2Steps, cv3Steps,
      drumEnabled, drumSampleSel, drumPitch, drumDecay, drumVol, drumRevSends, drumDelSends, drumConfigs, drumSteps,
      drumReverbDecay, drumDelayTime, drumDelayFeedback,
    }),
    [
      oscType, frequency, osc1Fine, pwm1,
      osc2Type, osc2Freq, detune, pwm2,
      osc3Type, osc3Freq, osc3Detune, osc3Spread, osc3Count,
      osc4Type, osc4Freq, osc4Fine, fmHarmonicity, fmModIndex,
      noiseType, noiseFilterEnabled, noiseFilterFreq, noiseFilterRes,
      mixOsc1, mixOsc2, mixOsc3, mixOsc4, mixNoise,
      channelEnabled, channelSolo, channelPan, reverbSends, delaySends, reverbSendEnabled, delaySendEnabled,
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
      modPatch, gatePatch, notePatch, quantScale, quantRoot,
      seqConfigs, seqBpm, pitchSteps, cvSteps, cv2Steps, cv3Steps,
      drumEnabled, drumSampleSel, drumPitch, drumDecay, drumVol, drumRevSends, drumDelSends, drumConfigs, drumSteps,
      drumReverbDecay, drumDelayTime, drumDelayFeedback,
    ],
  );

  // Aplica un preset. Usa `!== undefined` para no descartar valores válidos 0/false.
  const applyState = useCallback(
    (s: Partial<PresetState>) => {
      if (s.oscType !== undefined) setOscType(s.oscType);
      if (s.frequency !== undefined) setFrequency(s.frequency);
      if (s.osc1Fine !== undefined) setOsc1Fine(s.osc1Fine);
      if (s.pwm1 !== undefined) setPwm1(s.pwm1);
      if (s.osc2Type !== undefined) setOsc2Type(s.osc2Type);
      if (s.osc2Freq !== undefined) setOsc2Freq(s.osc2Freq);
      if (s.detune !== undefined) setDetune(s.detune);
      if (s.pwm2 !== undefined) setPwm2(s.pwm2);
      if (s.osc3Type !== undefined) setOsc3Type(s.osc3Type);
      if (s.osc3Freq !== undefined) setOsc3Freq(s.osc3Freq);
      if (s.osc3Detune !== undefined) setOsc3Detune(s.osc3Detune);
      if (s.osc3Spread !== undefined) setOsc3Spread(s.osc3Spread);
      if (s.osc3Count !== undefined) setOsc3Count(s.osc3Count);
      if (s.osc4Type !== undefined) setOsc4Type(s.osc4Type);
      if (s.osc4Freq !== undefined) setOsc4Freq(s.osc4Freq);
      if (s.osc4Fine !== undefined) setOsc4Fine(s.osc4Fine);
      if (s.fmHarmonicity !== undefined) setFmHarmonicity(s.fmHarmonicity);
      if (s.fmModIndex !== undefined) setFmModIndex(s.fmModIndex);
      if (s.noiseType !== undefined) setNoiseType(s.noiseType);
      if (s.noiseFilterEnabled !== undefined) setNoiseFilterEnabled(s.noiseFilterEnabled);
      if (s.noiseFilterFreq !== undefined) setNoiseFilterFreq(s.noiseFilterFreq);
      if (s.noiseFilterRes !== undefined) setNoiseFilterRes(s.noiseFilterRes);
      if (s.mixOsc1 !== undefined) setMixOsc1(s.mixOsc1);
      if (s.mixOsc2 !== undefined) setMixOsc2(s.mixOsc2);
      if (s.mixOsc3 !== undefined) setMixOsc3(s.mixOsc3);
      if (s.mixOsc4 !== undefined) setMixOsc4(s.mixOsc4);
      if (s.mixNoise !== undefined) setMixNoise(s.mixNoise);
      if (s.channelEnabled) setChannelEnabled(s.channelEnabled);
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
      if (s.quantScale !== undefined) setQuantScale(s.quantScale);
      if (s.quantRoot !== undefined) setQuantRoot(s.quantRoot);
      if (s.seqConfigs) setSeqConfigs(s.seqConfigs);
      if (s.seqBpm !== undefined) setSeqBpm(s.seqBpm);
      if (s.pitchSteps) setPitchSteps(s.pitchSteps);
      if (s.cvSteps) setCvSteps(s.cvSteps);
      if (s.cv2Steps) setCv2Steps(s.cv2Steps);
      if (s.cv3Steps) setCv3Steps(s.cv3Steps);
      if (s.drumEnabled) setDrumEnabled(s.drumEnabled);
      if (s.drumSampleSel) setDrumSampleSel(s.drumSampleSel);
      if (s.drumPitch) setDrumPitch(s.drumPitch);
      if (s.drumDecay) setDrumDecay(s.drumDecay);
      if (s.drumVol) setDrumVol(s.drumVol);
      if (s.drumRevSends) setDrumRevSends(s.drumRevSends);
      if (s.drumDelSends) setDrumDelSends(s.drumDelSends);
      if (s.drumConfigs) setDrumConfigs(s.drumConfigs);
      if (s.drumSteps) setDrumSteps(s.drumSteps);
      if (s.drumReverbDecay !== undefined) setDrumReverbDecay(s.drumReverbDecay);
      if (s.drumDelayTime !== undefined) setDrumDelayTime(s.drumDelayTime);
      if (s.drumDelayFeedback !== undefined) setDrumDelayFeedback(s.drumDelayFeedback);
    },
    // Los setters de useState/usePersistentState tienen identidad estable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Al guardar/borrar marcamos el cambio local para que la nube suba el banco (si hay clave).
  const handleSavePreset = useCallback(
    (name: string) => {
      savePreset(name, captureState());
      cloud.markLocalChange();
    },
    [savePreset, captureState, cloud],
  );
  const handleDeletePreset = useCallback(
    (name: string) => {
      removePreset(name);
      cloud.markLocalChange();
    },
    [removePreset, cloud],
  );
  const handleLoadPreset = useCallback(
    (name: string) => {
      const state = getPreset(name);
      if (state) applyState(state);
    },
    [getPreset, applyState],
  );

  // Reset global de parámetros (botón "DEF" del header). Restablece los controles indicados
  // a sus valores por defecto y deja "lo demás como está" (no incluido = sin cambios). Usa
  // applyState, así reutiliza la misma lógica de aplicación que los presets.
  const resetAll = useCallback(() => {
    applyState({
      // Sólo VCO 1 suena (índices 0..4 = VCO1, VCO2, VCO3, VCO4-FM, Ruido).
      channelEnabled: [true, false, false, false, false],
      // VCO 1/2: afinado fino a 0; VCO 2 a 440 Hz y PWM a 0.
      osc1Fine: 0,
      osc2Freq: 440,
      detune: 0,
      pwm2: 0,
      // VCO 3 (fat): 440 Hz, sin detune, 1 voz y spread base.
      osc3Freq: 440,
      osc3Detune: 0,
      osc3Spread: 20,
      osc3Count: 1,
      // VCO 4 (FM): 440 Hz, afinado 0, armonicidad 1 e índice 2.
      osc4Freq: 440,
      osc4Fine: 0,
      fmHarmonicity: 1,
      fmModIndex: 2,
      // Ruido: resonancia del pasabanda a su valor base.
      noiseFilterRes: 2,
      // Mixer: VCO 1 a 0 dB, el resto al mínimo (-40 = silencio); pan centrado.
      mixOsc1: 0,
      mixOsc2: -40,
      mixOsc3: -40,
      mixOsc4: -40,
      mixNoise: -40,
      channelPan: [0, 0, 0, 0, 0],
      // Master a 0 dB; lo controla el ADSR (ADSR → VCA, limpia el resto de rutas de CV).
      volume: 0,
      modPatch: createPatch([{ source: 'adsr', dest: 'vcaGain' }]),
      // Triggers: teclado, MIDI y secuenciador 1 → ADSR y compuerta de FX.
      gatePatch: createGatePatch([
        { source: 'keyboard', dest: 'amp' },
        { source: 'midi', dest: 'amp' },
        { source: 'seq1', dest: 'amp' },
        { source: 'keyboard', dest: 'fx' },
        { source: 'midi', dest: 'fx' },
        { source: 'seq1', dest: 'fx' },
      ]),
      // Matriz MIDI: teclado y seq 1 → VCO 1 (sólo VCO 1 sigue la nota por defecto).
      notePatch: createNotePatch([
        { source: 'keyboard', dest: 'osc1' },
        { source: 'seq1', dest: 'osc1' },
      ]),
      // Cuantizador: escala mayor, raíz C (sin fuentes conectadas a "Cuant" por defecto).
      quantScale: 'major',
      quantRoot: 0,
      // ADSR: el AMT es el único al 100% (1); las envolventes AD/DAHD a 0.
      attack: 0.01,
      decay: 0.5,
      sustain: 0.5,
      release: 0.2,
      adsrAmount: 1,
      ad1Amount: 0.75,
      ad2Amount: 0.75,
      dahdAmount: 0.75,
      // Curvas de envolvente: lineales por defecto.
      adsrCurve: 'linear',
      ad1Curve: 'linear',
      ad2Curve: 'linear',
      dahdCurve: 'linear',
      // LFOs: profundidad 0 y rate 1 Hz.
      lfoDepth: 0,
      lfoRate: 1,
      lfo2Depth: 0,
      lfo2Rate: 1,
      // VCF 1: cutoff 20 kHz, resonancia 1.
      filterFreq: 20000,
      filterRes: 1,
      // VCF 2: sin fuente, resonancia 1, frecuencia 2 kHz.
      vcf2Source: 'none',
      vcf2Res: 1,
      vcf2Freq: 2000,
      // FX y envíos a 0.
      reverbDecay: 1,
      reverbWet: 0,
      delayFeedback: 0,
      reverbSends: [0, 0, 0, 0, 0],
      delaySends: [0, 0, 0, 0, 0],
      // Secuenciador: un solo canal, 16 pasos, 128 BPM, adelante; pasos 1, 5, 9 y 13.
      seqBpm: 128,
      seqConfigs: Array.from({ length: SEQ_COUNT }, (_, i) => ({
        steps: i === 0 ? 16 : 0,
        direction: 'forward' as const,
        clock: BASE_CLOCK,
      })),
      // Nota C3 en todos los sliders; gates a la mitad; sólo 1, 5, 9 y 13 encendidos.
      pitchSteps: Array.from({ length: MAX_STEPS }, (_, i) => ({
        offset: DEFAULT_PITCH_OFFSET,
        gate: i % 4 === 0 && i < 16,
        velocity: 1,
        gateLen: 0.5,
      })),
      cvSteps: Array.from({ length: MAX_STEPS }, () => ({ value: 0, offset: DEFAULT_PITCH_OFFSET, gate: false, velocity: 1, gateLen: 0.5 })),
      cv2Steps: Array.from({ length: MAX_STEPS }, () => ({ value: 0, offset: DEFAULT_PITCH_OFFSET, gate: false, velocity: 1, gateLen: 0.5 })),
      cv3Steps: Array.from({ length: MAX_STEPS }, () => ({ value: 0, offset: DEFAULT_PITCH_OFFSET, gate: false, velocity: 1, gateLen: 0.5 })),
      // Batería: todas las voces apagadas; pitch ×1, decay 300 ms, vol/rev/del a 0.
      drumEnabled: Array(DRUM_VOICES).fill(false),
      drumPitch: Array(DRUM_VOICES).fill(1),
      drumDecay: Array(DRUM_VOICES).fill(0.3),
      drumVol: Array(DRUM_VOICES).fill(0),
      drumRevSends: Array(DRUM_VOICES).fill(0),
      drumDelSends: Array(DRUM_VOICES).fill(0),
      // Secuenciadores de batería: 16 pasos, ×1, adelante; todos los triggers apagados.
      drumConfigs: Array.from({ length: DRUM_VOICES }, () => ({
        steps: 16,
        direction: 'forward' as const,
        clock: BASE_CLOCK,
      })),
      drumSteps: Array.from({ length: DRUM_VOICES }, () =>
        Array.from({ length: MAX_STEPS }, () => ({ gate: false, velocity: 1 })),
      ),
      // FX de batería: reverb decay 200 ms, delay 20 ms, feedback 0.
      drumReverbDecay: 0.2,
      drumDelayTime: 0.02,
      drumDelayFeedback: 0,
    });
  }, [applyState]);

  useEffect(() => {
    registerResetAll(resetAll);
  }, [registerResetAll, resetAll]);

  // Estado de interacción (notas activas por id de tecla, para el resaltado del teclado).
  const [activeNotes, setActiveNotes] = useState<Record<string, string>>({});
  const [octave, setOctave] = useState(4);

  const oscRef = useRef<HTMLDivElement | null>(null);

  // Anclas de scroll para el nav inferior: asigna a cada .module (en orden DOM) su id de
  // MODULE_SECTIONS y al teclado el suyo. INVARIANTE: el orden de render de los módulos debe
  // coincidir con MODULE_SECTIONS (sin la última entrada, que es el teclado, fuera del grid).
  useLayoutEffect(() => {
    const moduleSections = MODULE_SECTIONS.filter((s) => s.id !== KEYBOARD_SECTION_ID);
    const mods = document.querySelectorAll<HTMLElement>('.synth-modules .module');
    if (mods.length !== moduleSections.length) {
      console.warn(
        `[BottomNav] módulos (${mods.length}) ≠ MODULE_SECTIONS (${moduleSections.length}); revisa el orden.`,
      );
    }
    moduleSections.forEach((s, i) => {
      if (mods[i]) mods[i].id = s.id;
    });
    const kbd = document.querySelector<HTMLElement>('.keyboard');
    if (kbd) kbd.id = KEYBOARD_SECTION_ID;
  }, []);

  // Octava actual accesible desde el manejador de teclado sin re-registrar listeners.
  const octaveRef = useRef(octave);
  octaveRef.current = octave;

  // Pila de notas mantenidas (prioridad a la última nota, monofónico estilo MiniMoog).
  // Guarda la fuente de gate de cada nota para soltar la envolvente correcta.
  const heldNotesRef = useRef<{ key: string; note: string; source: GateSourceId }[]>([]);

  // API monofónica compartida por el teclado físico/pantalla y el MIDI. `id` identifica el
  // origen (tecla) para deduplicar y soltar la nota correcta; `source` elige la fuente de
  // gate (teclado/MIDI) y `velocity` (0..1) escala el ataque. Mezclar teclado y MIDI a la
  // vez es un caso límite aceptable (motor monofónico, una sola envolvente).
  const noteOn = useCallback(
    (id: string, note: string, source: GateSourceId = 'keyboard', velocity = 1) => {
      if (heldNotesRef.current.some((h) => h.key === id)) return; // ya sonando
      const wasIdle = heldNotesRef.current.length === 0;
      heldNotesRef.current.push({ key: id, note, source });
      if (wasIdle) fireGateAttack(source, note, undefined, velocity);
      else routeNote(source, note); // legato: cambia el pitch sin re-disparar
      setActiveNotes((prev) => ({ ...prev, [id]: note }));
    },
    [routeNote, fireGateAttack],
  );

  const noteOff = useCallback(
    (id: string) => {
      const idx = heldNotesRef.current.findIndex((h) => h.key === id);
      if (idx === -1) return;
      const [removed] = heldNotesRef.current.splice(idx, 1);
      if (heldNotesRef.current.length === 0) fireGateRelease(removed.source);
      else {
        const prev = heldNotesRef.current[heldNotesRef.current.length - 1];
        routeNote(prev.source, prev.note); // legato: vuelve a la nota anterior por su fuente
      }
      setActiveNotes((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    [routeNote, fireGateRelease],
  );

  // --- MIDI (Web MIDI API) ---
  // El mapa CC→slot y el slot en aprendizaje se leen por ref dentro de useMidi para no
  // re-suscribir los listeners en cada cambio.
  const midiMapRef = useRef(midiMap);
  midiMapRef.current = midiMap;
  const learningRef = useRef(learningSlot);
  learningRef.current = learningSlot;

  const midi = useMidi({
    midiMapRef,
    learningRef,
    onNoteOn: useCallback(
      (note: number, velocity: number) =>
        noteOn(`midi:${note}`, Tone.Frequency(note, 'midi').toNote(), 'midi', velocity),
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

  // Filas de la matriz CV: oculta los slots CC MIDI sin asignar y reetiqueta los asignados
  // con su número de CC real (p. ej. "CC 20").
  const modSources = useMemo<PatchSource[]>(
    () =>
      MOD_SOURCES.flatMap((src) => {
        const m = /^midiCC(\d+)$/.exec(src.id);
        if (!m) return [src];
        const cc = midiMap[parseInt(m[1], 10) - 1];
        return cc == null ? [] : [{ ...src, label: `CC ${cc}`, short: `${cc}` }];
      }),
    [midiMap],
  );

  const octaveDown = useCallback(() => setOctave((o) => Math.max(1, o - 1)), []);
  const octaveUp = useCallback(() => setOctave((o) => Math.min(7, o + 1)), []);

  // Tocar con el teclado de la computadora. Los listeners se registran una sola vez; la
  // octava viva se lee desde el ref. Reusa noteOn/noteOff (mismos ids que el teclado UI).
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
      <h1 className={"synthTitle"}>MODULOR</h1>

      <Presets
        presets={presets}
        onSave={handleSavePreset}
        onLoad={handleLoadPreset}
        onDelete={handleDeletePreset}
        onImport={importMany}
        cloud={cloud.enabled ? {
          key: cloud.cloudKey,
          onKeyChange: cloud.setCloudKey,
          onLoad: cloud.loadFromCloud,
          busy: cloud.busy,
          status: cloud.status,
        } : undefined}
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
          fine={osc1Fine}
          setFine={setOsc1Fine}
          isSecondary={false}
          enabled={channelEnabled[0]}
          setEnabled={(v) => setChannelEnabledAt(0, v)}
          pwm={pwm1}
          setPwm={setPwm1}
          oscRef={oscRef}
        />

        <VCO
          oscType={osc2Type}
          setOscType={setOsc2Type}
          frequency={osc2Freq}
          setFrequency={setOsc2Freq}
          fine={detune}
          setFine={setDetune}
          isSecondary={true}
          enabled={channelEnabled[1]}
          setEnabled={(v) => setChannelEnabledAt(1, v)}
          pwm={pwm2}
          setPwm={setPwm2}
        />

        <VCO
          oscType={osc3Type}
          setOscType={setOsc3Type}
          frequency={osc3Freq}
          setFrequency={setOsc3Freq}
          fine={osc3Detune}
          setFine={setOsc3Detune}
          isSecondary={true}
          enabled={channelEnabled[2]}
          setEnabled={(v) => setChannelEnabledAt(2, v)}
          label="VCO 3"
          index={3}
          fat
          spread={osc3Spread}
          setSpread={setOsc3Spread}
          count={osc3Count}
          setCount={setOsc3Count}
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
          label="VCO 4 (FM)"
          index={4}
          fm
          harmonicity={fmHarmonicity}
          setHarmonicity={setFmHarmonicity}
          modIndex={fmModIndex}
          setModIndex={setFmModIndex}
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
          drumEnabled={drumEnabled}
          onToggleDrumEnabled={toggleDrumEnabled}
        />

        {/* Generadores de envolvente en una sola fila del grid (ver .envelope-row). */}
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
        {/* LFOs + FX en otra fila (ver .lfo-row). */}
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

            <Reverb
              decay={reverbDecay}
              setDecay={setReverbDecay}
              wet={reverbWet}
              setWet={setReverbWet}
            />

            <Delay
              time={delayTime}
              setTime={setDelayTime}
              feedback={delayFeedback}
              setFeedback={setDelayFeedback}
            />
        </div>

        {/* Matriz de modulación (2/3) + control MIDI (1/3) comparten una fila del grid. */}
        <div className="matrix-row">
          <PatchMatrix
            patch={modPatch}
            setPatch={setModPatch}
            gatePatch={gatePatch}
            setGatePatch={setGatePatch}
            notePatch={notePatch}
            setNotePatch={setNotePatch}
            modSources={modSources}
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

        <Sequencer
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
          currentSteps={currentSteps}
        />

        <Drums
          running={seqRunning}
          setRunning={setSeqRunning}
          onReset={resetSequencer}
          pitch={drumPitch}
          setPitch={setDrumPitchAt}
          decay={drumDecay}
          setDecay={setDrumDecayAt}
          vol={drumVol}
          setVol={setDrumVolAt}
          revSends={drumRevSends}
          setRevSend={setDrumRevSendAt}
          delSends={drumDelSends}
          setDelSend={setDrumDelSendAt}
          configs={drumConfigs}
          setConfig={setDrumConfigAt}
          steps={drumSteps}
          toggleStep={toggleDrumStep}
          currentSteps={drumCurrentSteps}
          onLoadSample={onLoadSample}
          sampleOptions={sampleOptions}
          selectedSample={drumSampleSel}
          onSelectSample={onSelectSample}
          reverbDecay={drumReverbDecay}
          setReverbDecay={setDrumReverbDecay}
          delayTime={drumDelayTime}
          setDelayTime={setDrumDelayTime}
          delayFeedback={drumDelayFeedback}
          setDelayFeedback={setDrumDelayFeedback}
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
        drumEnabled={drumEnabled}
        onToggleDrumEnabled={toggleDrumEnabled}
      />

    </div>
  );
};

export default Modulor;
