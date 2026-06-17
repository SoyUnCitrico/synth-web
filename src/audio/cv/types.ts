import * as Tone from 'tone';

/**
 * Tipos de la matriz de modulación (CV).
 *
 * En Web Audio todo "CV" (control voltage) es una señal de audio que se SUMA a un
 * AudioParam. Una fuente emite una señal normalizada; cada conexión la escala a las
 * unidades del destino y se conecta a su param. El navegador suma todas las conexiones
 * encima del valor base del param.
 */

// Fuentes de modulación. Su salida es una señal de control:
//   'bipolar'  -> -1..1   ·   'unipolar' -> 0..1
export type ModSourceId =
  | 'adsr'
  | 'lfo1'
  | 'lfo2'
  | 'ad1'
  | 'ad2'
  | 'dahd'
  | 'seqCv'
  | 'seqCv2'
  | 'seqCv3'
  | 'seqVel'
  | 'random';

// Destinos: cualquier AudioParam modulable del grafo.
export type ModDestId =
  | 'osc1Detune'
  | 'osc2Detune'
  | 'osc3Detune'
  | 'filterFreq'
  | 'filterQ'
  | 'vcf2Freq'
  | 'vcaGain'
  | 'osc1Level'
  | 'osc2Level'
  | 'osc3Level'
  | 'noiseLevel'
  | 'noiseFilterFreq';

export interface ModSource {
  id: ModSourceId;
  /** Nodo cuya salida es la señal de control. */
  output: Tone.ToneAudioNode;
  range: 'bipolar' | 'unipolar';
}

// Destino conectable: el tipo InputNode de Tone (Signal/Param/AudioParam/nodo), extraído
// de la firma de connect para no depender de un import interno de la librería.
export type ModDestParam = Parameters<Tone.ToneAudioNode['connect']>[0];

export interface ModDest {
  id: ModDestId;
  /** AudioParam destino (Signal o Param de Tone). */
  param: ModDestParam;
  /** Valor en unidades del destino (Hz, cents, dB...) cuando amount = 1. */
  unitPerAmount: number;
}
