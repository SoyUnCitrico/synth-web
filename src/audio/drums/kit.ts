import * as Tone from 'tone';

/** Número de voces de batería. */
export const DRUM_VOICES = 4;
/** Etiquetas/nombres del kit por defecto (una por voz). */
export const DRUM_LABELS = ['Kick', 'Snare', 'Hat', 'Clap'];

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

  // Clap: ruido pasabanda con cola algo más larga.
  const clap = await render(0.3, (ctx) => {
    const g = ampEnv(ctx, 0.14);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1200;
    bp.Q.value = 1;
    bp.connect(g);
    const noise = noiseSource(ctx, 0.3);
    noise.connect(bp);
    noise.start(0);
    noise.stop(0.25);
  });

  return [kick, snare, hat, clap];
}
