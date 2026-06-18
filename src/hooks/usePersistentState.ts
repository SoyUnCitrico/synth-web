import { useEffect, useState } from 'react';

/**
 * Como useState, pero persiste el valor en localStorage bajo `key`. Lee el valor inicial
 * de localStorage si existe; si no, usa `initial`. Escribe en cada cambio. Tolera entornos
 * sin localStorage o errores de cuota/serialización (cae al estado en memoria).
 *
 * Las claves llevan versión (ver PERSIST_KEYS) para invalidar datos viejos si cambia el
 * formato de los datos guardados.
 */
export function usePersistentState<T>(
  key: string,
  initial: T | (() => T),
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) return JSON.parse(raw) as T;
    } catch {
      /* localStorage no disponible o JSON inválido: usar el valor inicial */
    }
    return typeof initial === 'function' ? (initial as () => T)() : initial;
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      /* modo privado o cuota excedida: seguimos sólo en memoria */
    }
  }, [key, state]);

  return [state, setState];
}

/** Claves de persistencia (con versión para invalidar formatos antiguos). */
export const PERSIST_KEYS = {
  modPatch: 'synth-web:modPatch:v2',
  gatePatch: 'synth-web:gatePatch:v2',
  notePatch: 'synth-web:notePatch:v1',
  midiMap: 'synth-web:midiMap:v1',
  // --- Parámetros de control (todos los módulos) ---
  osc1Type: 'synth-web:osc1Type:v1',
  osc1Freq: 'synth-web:osc1Freq:v1',
  osc1Pwm: 'synth-web:osc1Pwm:v1',
  osc1Fine: 'synth-web:osc1Fine:v1',
  osc2Type: 'synth-web:osc2Type:v1',
  osc2Freq: 'synth-web:osc2Freq:v1',
  // v2: el detune pasó de grueso (±2400) a afinado fino (±200); resetea valores fuera de rango.
  osc2Detune: 'synth-web:osc2Detune:v2',
  osc2Enabled: 'synth-web:osc2Enabled:v1',
  osc2Pwm: 'synth-web:osc2Pwm:v1',
  osc3Type: 'synth-web:osc3Type:v1',
  osc3Freq: 'synth-web:osc3Freq:v1',
  osc3Detune: 'synth-web:osc3Detune:v2',
  osc3Enabled: 'synth-web:osc3Enabled:v1',
  osc3Pwm: 'synth-web:osc3Pwm:v1',
  noiseType: 'synth-web:noiseType:v1',
  noiseEnabled: 'synth-web:noiseEnabled:v1',
  noiseFilterEnabled: 'synth-web:noiseFilterEnabled:v1',
  noiseFilterFreq: 'synth-web:noiseFilterFreq:v1',
  noiseFilterRes: 'synth-web:noiseFilterRes:v1',
  mixOsc1: 'synth-web:mixOsc1:v1',
  mixOsc2: 'synth-web:mixOsc2:v1',
  mixOsc3: 'synth-web:mixOsc3:v1',
  mixNoise: 'synth-web:mixNoise:v1',
  filterType: 'synth-web:filterType:v1',
  filterFreq: 'synth-web:filterFreq:v1',
  filterRes: 'synth-web:filterRes:v1',
  vcf2Type: 'synth-web:vcf2Type:v1',
  vcf2Freq: 'synth-web:vcf2Freq:v1',
  vcf2Res: 'synth-web:vcf2Res:v1',
  vcf2Source: 'synth-web:vcf2Source:v1',
  ad1Attack: 'synth-web:ad1Attack:v1',
  ad1Decay: 'synth-web:ad1Decay:v1',
  ad1Amount: 'synth-web:ad1Amount:v1',
  ad2Attack: 'synth-web:ad2Attack:v1',
  ad2Decay: 'synth-web:ad2Decay:v1',
  ad2Amount: 'synth-web:ad2Amount:v1',
  dahdDelay: 'synth-web:dahdDelay:v1',
  dahdAttack: 'synth-web:dahdAttack:v1',
  dahdHold: 'synth-web:dahdHold:v1',
  dahdDecay: 'synth-web:dahdDecay:v1',
  dahdAmount: 'synth-web:dahdAmount:v1',
  attack: 'synth-web:attack:v1',
  decay: 'synth-web:decay:v1',
  sustain: 'synth-web:sustain:v1',
  release: 'synth-web:release:v1',
  adsrAmount: 'synth-web:adsrAmount:v1',
  volume: 'synth-web:volume:v1',
  lfoType: 'synth-web:lfoType:v1',
  lfoRate: 'synth-web:lfoRate:v1',
  lfoDepth: 'synth-web:lfoDepth:v1',
  lfo2Type: 'synth-web:lfo2Type:v1',
  lfo2Rate: 'synth-web:lfo2Rate:v1',
  lfo2Depth: 'synth-web:lfo2Depth:v1',
  reverbDecay: 'synth-web:reverbDecay:v1',
  reverbWet: 'synth-web:reverbWet:v2',
  delayTime: 'synth-web:delayTime:v1',
  delayFeedback: 'synth-web:delayFeedback:v1',
  channelMute: 'synth-web:channelMute:v1',
  channelSolo: 'synth-web:channelSolo:v1',
  reverbSends: 'synth-web:reverbSends:v1',
  delaySends: 'synth-web:delaySends:v1',
  reverbSendEnabled: 'synth-web:reverbSendEnabled:v1',
  delaySendEnabled: 'synth-web:delaySendEnabled:v1',
  drumEnabled: 'synth-web:drumEnabled:v1',
  drumSampleSel: 'synth-web:drumSampleSel:v1',
  drumPitch: 'synth-web:drumPitch:v1',
  drumDecay: 'synth-web:drumDecay:v1',
  drumVol: 'synth-web:drumVol:v1',
  drumRevSends: 'synth-web:drumRevSends:v1',
  drumDelSends: 'synth-web:drumDelSends:v1',
  drumConfigs: 'synth-web:drumConfigs:v1',
  drumSteps: 'synth-web:drumSteps:v1',
  drumReverbDecay: 'synth-web:drumReverbDecay:v1',
  drumDelayTime: 'synth-web:drumDelayTime:v1',
  drumDelayFeedback: 'synth-web:drumDelayFeedback:v1',
  seqConfigs: 'synth-web:seqConfigs:v1',
  seqBpm: 'synth-web:seqBpm:v1',
  pitchSteps: 'synth-web:pitchSteps:v2',
  cvSteps: 'synth-web:cvSteps:v1',
  cv2Steps: 'synth-web:cv2Steps:v1',
  cv3Steps: 'synth-web:cv3Steps:v1',
  presets: 'synth-web:presets:v1',
} as const;
