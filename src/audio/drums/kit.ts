import * as Tone from 'tone';

/** Número de voces de batería. */
export const DRUM_VOICES = 4;
/** Etiquetas/nombres del kit por defecto (una por voz). */
export const DRUM_LABELS = ['Kick', 'Snare', 'Hat', 'Open Hat'];

/**
 * Catálogo de samples por defecto alojados en un bucket S3. Cada voz tiene un array de
 * samples (puede estar vacío: en ese caso la voz cae al sonido sintetizado). El usuario
 * puede añadir los suyos en runtime; esos se agregan al final de la lista de la voz.
 *
 * TODO: reemplazar SAMPLE_BASE_URL por la URL real del bucket y los nombres de archivo de
 * cada voz por los reales. El bucket debe permitir GET por CORS desde el origen de la app.
 */
export const SAMPLE_BASE_URL = 'https://amazons3-images-micel10.s3.us-east-2.amazonaws.com/sounds/DrumsModulor/';

export interface DrumSample {
  name: string; // nombre mostrado en el dropdown
  url: string; // URL completa del sample
}

// Un array por voz (índice = voz: 0 Kick, 1 Snare, 2 Hat, 3 Open Hat).
export const DEFAULT_SAMPLES: DrumSample[][] = [
  [
    { name: 'Kick A', url: SAMPLE_BASE_URL + 'Kick/Kick_01.wav' },
    { name: 'Kick B', url: SAMPLE_BASE_URL + 'Kick/Kick_02.wav' },
    { name: 'Kick C', url: SAMPLE_BASE_URL + 'Kick/Kick_03.wav' },
    { name: 'Kick D', url: SAMPLE_BASE_URL + 'Kick/Kick_04.wav' },
    { name: 'Kick E', url: SAMPLE_BASE_URL + 'Kick/Kick_05.wav' },
    { name: 'Kick F', url: SAMPLE_BASE_URL + 'Kick/Kick_06.wav' },
    { name: '808 A', url: SAMPLE_BASE_URL + 'Kick/Bass808_01.wav' },
    { name: '808 B', url: SAMPLE_BASE_URL + 'Kick/Bass808_02.wav' },
  ],
  [
    { name: 'Snare A', url: SAMPLE_BASE_URL + 'Snare/Snare_01.wav' },
    { name: 'Snare B', url: SAMPLE_BASE_URL + 'Snare/Snare_02.wav' },
    { name: 'Snare C', url: SAMPLE_BASE_URL + 'Snare/Snare_03.wav' },
    { name: 'Snare D', url: SAMPLE_BASE_URL + 'Snare/Snare_04.wav' },
    { name: 'Clap A', url: SAMPLE_BASE_URL + 'Snare/Clap_01.wav' },
    { name: 'Clap B', url: SAMPLE_BASE_URL + 'Snare/Clap_02.wav' },
    { name: 'Clap C', url: SAMPLE_BASE_URL + 'Snare/Clap_03.wav' },
    { name: 'Clap D', url: SAMPLE_BASE_URL + 'Snare/Clap_04.wav' },
  ],
  [
    { name: 'HiHat A', url: SAMPLE_BASE_URL + 'HiHat/HiHat_01.wav' },
    { name: 'HiHat B', url: SAMPLE_BASE_URL + 'HiHat/HiHat_02.wav' },
    { name: 'HiHat C', url: SAMPLE_BASE_URL + 'HiHat/HiHat_03.wav' },
    { name: 'HiHat D', url: SAMPLE_BASE_URL + 'HiHat/HiHat_04.wav' },
    { name: 'HiHat E', url: SAMPLE_BASE_URL + 'HiHat/HiHat_05.wav' },
    { name: 'Shaker A', url: SAMPLE_BASE_URL + 'HiHat/Shaker_01.wav' },
  ],
  [
    { name: 'OpenHat A', url: SAMPLE_BASE_URL + 'OpenHat/OpenHat_01.wav' },
    { name: 'OpenHat B', url: SAMPLE_BASE_URL + 'OpenHat/OpenHat_02.wav' },
    { name: 'Cymbal A', url: SAMPLE_BASE_URL + 'OpenHat/Cymbal_01.wav' },
    { name: 'Cymbal B', url: SAMPLE_BASE_URL + 'OpenHat/Cymbal_02.wav' },
    { name: 'Tom A', url: SAMPLE_BASE_URL + 'OpenHat/Tom_01.wav' },
    { name: 'Up A', url: SAMPLE_BASE_URL + 'OpenHat/Up_01.wav' },
  ],
];

/**
 * Kit de batería por defecto SINTETIZADO (sin assets binarios): se renderiza cada golpe a un
 * `ToneAudioBuffer` que luego cargan los `Tone.Player`. El usuario puede reemplazar cualquier
 * voz subiendo su propio sample.
 *
 * IMPORTANTE: se usa un `OfflineAudioContext` NATIVO y aislado (no `Tone.Offline`). `Tone.Offline`
 * intercambia el contexto GLOBAL de Tone mientras renderiza; con el doble montaje de React
 * StrictMode esas llamadas se entrelazan y dejan el contexto global apuntando a un contexto
 * offline ya cerrado (rompiendo todo el audio). Renderizando con un contexto nativo propio el
 * contexto global del sinte nunca se toca.
 */

/** Crea una fuente de ruido blanco (buffer aleatorio) en el contexto dado. */
function noiseSource(ctx: OfflineAudioContext, duration: number): AudioBufferSourceNode {
  const len = Math.ceil(duration * ctx.sampleRate);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  return src;
}

/** Envolvente de amplitud (ataque rápido + caída exponencial) sobre un GainNode conectado al destino. */
function ampEnv(ctx: OfflineAudioContext, decay: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, 0);
  g.gain.exponentialRampToValueAtTime(1, 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, 0.002 + decay);
  g.connect(ctx.destination);
  return g;
}

/** Renderiza `build` en un contexto offline propio y devuelve el buffer como ToneAudioBuffer. */
async function render(
  duration: number,
  build: (ctx: OfflineAudioContext) => void,
): Promise<Tone.ToneAudioBuffer> {
  // Mismo sample rate que el contexto en vivo para que el sample suene a su tono correcto.
  const sampleRate = Tone.getContext().sampleRate;
  const ctx = new OfflineAudioContext(1, Math.ceil(duration * sampleRate), sampleRate);
  build(ctx);
  const rendered = await ctx.startRendering();
  return new Tone.ToneAudioBuffer(rendered);
}

export async function synthesizeKit(): Promise<Tone.ToneAudioBuffer[]> {
  // Bombo: seno con caída de tono (120→45 Hz) + envolvente corta.
  const kick = await render(0.5, (ctx) => {
    const g = ampEnv(ctx, 0.28);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, 0);
    osc.frequency.exponentialRampToValueAtTime(45, 0.1);
    osc.connect(g);
    osc.start(0);
    osc.stop(0.45);
  });

  // Caja: ruido + cuerpo tonal breve.
  const snare = await render(0.4, (ctx) => {
    const g = ampEnv(ctx, 0.2);
    const noise = noiseSource(ctx, 0.4);
    noise.connect(g);
    const body = ctx.createOscillator();
    body.type = 'triangle';
    body.frequency.value = 190;
    body.connect(g);
    noise.start(0);
    noise.stop(0.3);
    body.start(0);
    body.stop(0.18);
  });

  // Hi-hat: ruido pasaaltos muy corto.
  const hat = await render(0.2, (ctx) => {
    const g = ampEnv(ctx, 0.05);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    hp.connect(g);
    const noise = noiseSource(ctx, 0.2);
    noise.connect(hp);
    noise.start(0);
    noise.stop(0.12);
  });

  // Open hat: como el hi-hat (ruido pasaaltos) pero con cola larga y "sizzly".
  const openHat = await render(0.5, (ctx) => {
    const g = ampEnv(ctx, 0.35);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 6000;
    hp.connect(g);
    const noise = noiseSource(ctx, 0.5);
    noise.connect(hp);
    noise.start(0);
    noise.stop(0.45);
  });

  return [kick, snare, hat, openHat];
}
