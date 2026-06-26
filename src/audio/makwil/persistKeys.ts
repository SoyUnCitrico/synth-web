/**
 * Claves de persistencia (localStorage) de MAKWIL, con namespace propio `synth-web:makwil:*`
 * para que el patch de Makwil sea INDEPENDIENTE del de Modulor (que usa hooks/usePersistentState
 * PERSIST_KEYS). Sin claves de batería (Makwil no la tiene).
 *
 * Numeración de VCO de Makwil: VCO1 = Fat/poli, VCO2 = FM, VCO3/VCO4 = pulso (PWM).
 */
export const MAKWIL_KEYS = {
  // --- Matrices ---
  modPatch: 'synth-web:makwil:modPatch:v1',
  gatePatch: 'synth-web:makwil:gatePatch:v1',
  notePatch: 'synth-web:makwil:notePatch:v1',
  // Asignaciones MIDI directas (paramId → nº de CC). Sustituye al viejo midiMap por slots.
  midiAssignments: 'synth-web:makwil:midiAssignments:v1',
  quantScale: 'synth-web:makwil:quantScale:v1',
  quantRoot: 'synth-web:makwil:quantRoot:v1',
  // --- Glide (portamento) del teclado y del MIDI (independientes entre sí) ---
  kbdGlideEnabled: 'synth-web:makwil:kbdGlideEnabled:v1',
  kbdGlideTime: 'synth-web:makwil:kbdGlideTime:v1',
  midiGlideEnabled: 'synth-web:makwil:midiGlideEnabled:v1',
  midiGlideTime: 'synth-web:makwil:midiGlideTime:v1',
  // --- VCO 1 (Fat / poli) ---
  osc1Type: 'synth-web:makwil:osc1Type:v1',
  osc1Freq: 'synth-web:makwil:osc1Freq:v1',
  osc1Fine: 'synth-web:makwil:osc1Fine:v1',
  osc1Spread: 'synth-web:makwil:osc1Spread:v1',
  osc1Count: 'synth-web:makwil:osc1Count:v1',
  droneEnabled: 'synth-web:makwil:droneEnabled:v1',
  // --- VCO 2 (FM) ---
  osc2Type: 'synth-web:makwil:osc2Type:v1',
  osc2Freq: 'synth-web:makwil:osc2Freq:v1',
  osc2Fine: 'synth-web:makwil:osc2Fine:v1',
  fmHarmonicity: 'synth-web:makwil:fmHarmonicity:v1',
  fmModIndex: 'synth-web:makwil:fmModIndex:v1',
  // --- VCO 3 (pulso/PWM) ---
  osc3Type: 'synth-web:makwil:osc3Type:v1',
  osc3Freq: 'synth-web:makwil:osc3Freq:v1',
  osc3Fine: 'synth-web:makwil:osc3Fine:v1',
  pwm3: 'synth-web:makwil:pwm3:v1',
  // --- VCO 4 (pulso/PWM) ---
  osc4Type: 'synth-web:makwil:osc4Type:v1',
  osc4Freq: 'synth-web:makwil:osc4Freq:v1',
  osc4Fine: 'synth-web:makwil:osc4Fine:v1',
  pwm4: 'synth-web:makwil:pwm4:v1',
  // --- On/off por voz (5 canales: VCO1-4 + Ruido) ---
  channelEnabled: 'synth-web:makwil:channelEnabled:v1',
  // --- Ruido ---
  noiseType: 'synth-web:makwil:noiseType:v1',
  noiseFilterEnabled: 'synth-web:makwil:noiseFilterEnabled:v1',
  noiseFilterFreq: 'synth-web:makwil:noiseFilterFreq:v1',
  noiseFilterRes: 'synth-web:makwil:noiseFilterRes:v1',
  // --- Mixer ---
  mixOsc1: 'synth-web:makwil:mixOsc1:v1',
  mixOsc2: 'synth-web:makwil:mixOsc2:v1',
  mixOsc3: 'synth-web:makwil:mixOsc3:v1',
  mixOsc4: 'synth-web:makwil:mixOsc4:v1',
  mixNoise: 'synth-web:makwil:mixNoise:v1',
  channelSolo: 'synth-web:makwil:channelSolo:v1',
  channelPan: 'synth-web:makwil:channelPan:v1',
  reverbSends: 'synth-web:makwil:reverbSends:v1',
  delaySends: 'synth-web:makwil:delaySends:v1',
  reverbSendEnabled: 'synth-web:makwil:reverbSendEnabled:v1',
  delaySendEnabled: 'synth-web:makwil:delaySendEnabled:v1',
  // --- Filtros ---
  filterType: 'synth-web:makwil:filterType:v1',
  filterFreq: 'synth-web:makwil:filterFreq:v1',
  filterRes: 'synth-web:makwil:filterRes:v1',
  vcf2Type: 'synth-web:makwil:vcf2Type:v1',
  vcf2Freq: 'synth-web:makwil:vcf2Freq:v1',
  vcf2Res: 'synth-web:makwil:vcf2Res:v1',
  vcf2Source: 'synth-web:makwil:vcf2Source:v1',
  vcf3Type: 'synth-web:makwil:vcf3Type:v1',
  vcf3Freq: 'synth-web:makwil:vcf3Freq:v1',
  vcf3Res: 'synth-web:makwil:vcf3Res:v1',
  vcf3Source: 'synth-web:makwil:vcf3Source:v1',
  // --- Envolventes de modulación ---
  ad1Attack: 'synth-web:makwil:ad1Attack:v1',
  ad1Decay: 'synth-web:makwil:ad1Decay:v1',
  ad1Amount: 'synth-web:makwil:ad1Amount:v1',
  ad1Curve: 'synth-web:makwil:ad1Curve:v1',
  ad2Attack: 'synth-web:makwil:ad2Attack:v1',
  ad2Decay: 'synth-web:makwil:ad2Decay:v1',
  ad2Amount: 'synth-web:makwil:ad2Amount:v1',
  ad2Curve: 'synth-web:makwil:ad2Curve:v1',
  ad3Attack: 'synth-web:makwil:ad3Attack:v1',
  ad3Decay: 'synth-web:makwil:ad3Decay:v1',
  ad3Amount: 'synth-web:makwil:ad3Amount:v1',
  ad3Curve: 'synth-web:makwil:ad3Curve:v1',
  dahdDelay: 'synth-web:makwil:dahdDelay:v1',
  dahdAttack: 'synth-web:makwil:dahdAttack:v1',
  dahdHold: 'synth-web:makwil:dahdHold:v1',
  dahdDecay: 'synth-web:makwil:dahdDecay:v1',
  dahdAmount: 'synth-web:makwil:dahdAmount:v1',
  dahdCurve: 'synth-web:makwil:dahdCurve:v1',
  // --- ADSR (amplitud, también de las voces poli) ---
  attack: 'synth-web:makwil:attack:v1',
  decay: 'synth-web:makwil:decay:v1',
  sustain: 'synth-web:makwil:sustain:v1',
  release: 'synth-web:makwil:release:v1',
  adsrAmount: 'synth-web:makwil:adsrAmount:v1',
  adsrCurve: 'synth-web:makwil:adsrCurve:v1',
  volume: 'synth-web:makwil:volume:v1',
  // --- LFO 1 / LFO 2 ---
  lfoType: 'synth-web:makwil:lfoType:v1',
  lfoRate: 'synth-web:makwil:lfoRate:v1',
  lfoDepth: 'synth-web:makwil:lfoDepth:v1',
  lfo2Type: 'synth-web:makwil:lfo2Type:v1',
  lfo2Rate: 'synth-web:makwil:lfo2Rate:v1',
  lfo2Depth: 'synth-web:makwil:lfo2Depth:v1',
  lfo3Type: 'synth-web:makwil:lfo3Type:v1',
  lfo3Rate: 'synth-web:makwil:lfo3Rate:v1',
  lfo3Depth: 'synth-web:makwil:lfo3Depth:v1',
  // --- Reverb / Delay / Chorus / Chebyshev (envíos) ---
  reverbDecay: 'synth-web:makwil:reverbDecay:v1',
  reverbWet: 'synth-web:makwil:reverbWet:v1',
  delayTime: 'synth-web:makwil:delayTime:v1',
  delayFeedback: 'synth-web:makwil:delayFeedback:v1',
  chorusRate: 'synth-web:makwil:chorusRate:v1',
  chorusDepth: 'synth-web:makwil:chorusDepth:v1',
  chorusWet: 'synth-web:makwil:chorusWet:v1',
  chebyOrder: 'synth-web:makwil:chebyOrder:v1',
  chebyWet: 'synth-web:makwil:chebyWet:v1',
  chorusSends: 'synth-web:makwil:chorusSends:v1',
  chebySends: 'synth-web:makwil:chebySends:v1',
  chorusSendEnabled: 'synth-web:makwil:chorusSendEnabled:v1',
  chebySendEnabled: 'synth-web:makwil:chebySendEnabled:v1',
  // --- Secuenciador (5 secuenciadores) ---
  seqConfigs: 'synth-web:makwil:seqConfigs:v1',
  seqBpm: 'synth-web:makwil:seqBpm:v1',
  pitchSteps: 'synth-web:makwil:pitchSteps:v1',
  cvSteps: 'synth-web:makwil:cvSteps:v1',
  cv2Steps: 'synth-web:makwil:cv2Steps:v1',
  cv3Steps: 'synth-web:makwil:cv3Steps:v1',
  cv4Steps: 'synth-web:makwil:cv4Steps:v1',
  // --- Presets ---
  presets: 'synth-web:makwil:presets:v1',
  // Clave secreta de escritura para la sync con Google Sheets (ver presets/remote.ts).
  presetCloudKey: 'synth-web:makwil:presetCloudKey:v1',
  // --- Tema visual (oscuro por default) ---
  theme: 'synth-web:makwil:theme:v1',
} as const;
