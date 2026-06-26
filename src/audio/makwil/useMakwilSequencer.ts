import { useCallback, useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
import type { GateSourceId } from '../cv/gates';
import { Sequencer } from '../sequencer/Sequencer';
import {
  BASE_CLOCK,
  SEQ_COUNT,
  SEQ_ROOT,
  DEFAULT_PITCH_OFFSET,
  GLIDE_DEFAULT,
  type SeqConfig,
  type PitchStep,
  type CvStep,
} from './sequencerTypes';

/** Opciones de glide/ligado pasadas al despacho de cada paso. */
interface StepAttackOpts {
  glide: boolean;
  glideTime: number;
  /** El paso anterior dejó la compuerta sostenida (gate al máximo): cambia el pitch sin re-atacar. */
  legato: boolean;
}

interface UseMakwilSequencerOptions {
  running: boolean;
  bpm: number;
  /** Configuración de cada uno de los SEQ_COUNT secuenciadores. */
  configs: SeqConfig[];
  /** Datos de paso: seq1 = pitch; seq2..seq5 = CV (seq2/seq3 además con nota). */
  pitchSteps: PitchStep[];
  cvSteps: CvStep[];
  cv2Steps: CvStep[];
  cv3Steps: CvStep[];
  cv4Steps: CvStep[];
  /**
   * Rutea la NOTA (pitch) de un paso de un secuenciador de pitch, en CADA paso e
   * independientemente del gate (como el CV). Actualiza los VCO mono / key-track y, en modo
   * drone, el pitch de la VCO1. NO dispara envolventes.
   */
  fireNote: (source: GateSourceId, note: string, time: number, opts: { glide: boolean; glideTime: number }) => void;
  /** Ataque de una fuente de gate (nota opcional para fijar pitch; velocity 0..1; glide/ligado). */
  fireAttack: (source: GateSourceId, note: string | undefined, time: number, velocity: number, opts: StepAttackOpts) => void;
  /** Libera la compuerta de una fuente de gate. */
  fireRelease: (source: GateSourceId, time: number) => void;
  /** Escribe las fuentes de CV de los secuenciadores 2..5. */
  setSeqCv: (value: number, time: number) => void;
  setSeqCv2: (value: number, time: number) => void;
  setSeqCv3: (value: number, time: number) => void;
  setSeqCv4: (value: number, time: number) => void;
}

interface UseMakwilSequencerResult {
  /** Paso actual de cada secuenciador (-1 = detenido). */
  currentSteps: number[];
  reset: () => void;
}

// Fuentes de gate por índice de secuenciador (seq1..seq5).
const GATE_SOURCES: GateSourceId[] = ['seq1', 'seq2', 'seq3', 'seq4', 'seq5'];

// Secuenciadores que emiten NOTA (pitch) por la matriz MIDI: seq1 (pitch base), seq2 y seq3.
const PITCH_SEQS = new Set([0, 1, 2]);

/** Nota resultante de un paso considerando el offset del slider y el desplazamiento de octava. */
const stepNote = (offset: number, octave: number): string =>
  Tone.Frequency(SEQ_ROOT).transpose(offset + octave * 12).toNote();

/**
 * Orquesta los 5 secuenciadores de MAKWIL sobre el transporte compartido. seq1 (base, reloj
 * fijo) y seq2/seq3 (Nota + CV) emiten nota; seq4/seq5 sólo CV. El offset de octava de cada
 * secuenciador de pitch desplaza la nota de sus pasos.
 */
export function useMakwilSequencer(opts: UseMakwilSequencerOptions): UseMakwilSequencerResult {
  const seqsRef = useRef<Sequencer[]>([]);
  const dataRef = useRef(opts);
  dataRef.current = opts;

  // Por secuenciador: la compuerta quedó abierta por un paso con gate al máximo (tie). El
  // siguiente paso disparado se trata como ligado (cambia el pitch sin re-atacar la envolvente).
  const heldRef = useRef<boolean[]>(Array.from({ length: SEQ_COUNT }, () => false));

  const [currentSteps, setCurrentSteps] = useState<number[]>(() => Array.from({ length: SEQ_COUNT }, () => -1));

  const setStep = useCallback((seq: number, index: number) => {
    setCurrentSteps((prev) => {
      const next = prev.slice();
      next[seq] = index;
      return next;
    });
  }, []);

  // Construir los secuenciadores una sola vez.
  useEffect(() => {
    const cvSetters = [
      undefined, // seq1 = pitch, sin CV
      (v: number, t: number) => dataRef.current.setSeqCv(v, t),
      (v: number, t: number) => dataRef.current.setSeqCv2(v, t),
      (v: number, t: number) => dataRef.current.setSeqCv3(v, t),
      (v: number, t: number) => dataRef.current.setSeqCv4(v, t),
    ];
    const stepData = [
      () => dataRef.current.pitchSteps,
      () => dataRef.current.cvSteps,
      () => dataRef.current.cv2Steps,
      () => dataRef.current.cv3Steps,
      () => dataRef.current.cv4Steps,
    ];

    const seqs = Array.from({ length: SEQ_COUNT }, (_, seq) =>
      new Sequencer(
        () => (seq === 0 ? BASE_CLOCK : dataRef.current.configs[seq]?.clock ?? BASE_CLOCK),
        () => dataRef.current.configs[seq]?.steps ?? 0,
        () => dataRef.current.configs[seq]?.direction ?? 'forward',
        (index, time) => {
          const source = GATE_SOURCES[seq];
          const cfg = dataRef.current.configs[seq];
          const stepDur = Tone.Time('16n').toSeconds();
          const gateOff = (gateLen: number) => time + Math.min(gateLen, 0.95) * stepDur;
          const octave = cfg?.octave ?? 0;
          // Glide sólo en los secuenciadores de pitch (0,1,2).
          const glide = PITCH_SEQS.has(seq) ? (cfg?.glide ?? false) : false;
          const glideTime = cfg?.glideTime ?? GLIDE_DEFAULT;
          const s = stepData[seq]()[index];
          if (!s) return;

          // Dispara un paso con gate aplicando la lógica de tie (gate continuo al máximo).
          const fireGatedStep = (note: string | undefined, velocity: number, gateLen: number) => {
            const legato = heldRef.current[seq]; // ligado si el paso previo dejó la compuerta sostenida
            dataRef.current.fireAttack(source, note, time, velocity, { glide, glideTime, legato });
            if (gateLen >= 0.999) {
              // Gate al máximo: NO programar release; la compuerta queda abierta hasta el próximo paso.
              heldRef.current[seq] = true;
            } else {
              dataRef.current.fireRelease(source, gateOff(gateLen));
              heldRef.current[seq] = false;
            }
          };
          const releaseStep = () => {
            dataRef.current.fireRelease(source, time); // cierra cualquier tie sostenido
            heldRef.current[seq] = false;
          };

          if (seq === 0) {
            const ps = s as PitchStep;
            const note = stepNote(ps.offset, octave);
            // Pitch SIEMPRE (con o sin gate), igual que el CV; el gate sólo decide la envolvente.
            dataRef.current.fireNote(source, note, time, { glide, glideTime });
            if (ps.gate) fireGatedStep(note, ps.velocity, ps.gateLen);
            else releaseStep();
          } else {
            // CV continuo + gate. seq2/seq3 además emiten nota desde su offset.
            const cs = s as CvStep;
            cvSetters[seq]!(cs.value, time);
            if (PITCH_SEQS.has(seq)) {
              const note = stepNote(cs.offset ?? DEFAULT_PITCH_OFFSET, octave);
              // Pitch SIEMPRE (con o sin gate); el gate sólo decide la envolvente.
              dataRef.current.fireNote(source, note, time, { glide, glideTime });
              if (cs.gate) fireGatedStep(note, 1, cs.gateLen);
              else releaseStep();
            } else {
              // seq4/seq5: sólo CV + gate, sin nota.
              if (cs.gate) fireGatedStep(undefined, 1, cs.gateLen);
              else releaseStep();
            }
          }

          Tone.getDraw().schedule(() => setStep(seq, index), time);
        },
      ),
    );
    seqsRef.current = seqs;

    return () => {
      seqs.forEach((s) => s.dispose());
    };
  }, [setStep]);

  // Tempo compartido.
  useEffect(() => {
    Tone.getTransport().bpm.value = opts.bpm;
  }, [opts.bpm]);

  // Arranque/parada.
  useEffect(() => {
    const seqs = seqsRef.current;
    const transport = Tone.getTransport();
    if (opts.running) {
      let cancelled = false;
      const arrancar = () => {
        if (cancelled) return;
        seqsRef.current.forEach((s) => s.start());
        if (transport.state !== 'started') transport.start();
      };
      if (Tone.getContext().state === 'running') arrancar();
      else Tone.start().then(arrancar);
      return () => {
        cancelled = true;
      };
    } else {
      transport.stop();
      seqs.forEach((s) => s.stop());
      setCurrentSteps(Array.from({ length: SEQ_COUNT }, () => -1));
      heldRef.current.fill(false); // que un tie sostenido no se filtre al reanudar
      const now = Tone.now();
      GATE_SOURCES.forEach((src) => dataRef.current.fireRelease(src, now));
    }
  }, [opts.running]);

  // Cambio de reloj en marcha: reagenda los secuenciadores afectados (seq1 es fijo).
  const clockKey = opts.configs.map((c) => c.clock).join('|');
  useEffect(() => {
    if (!opts.running) return;
    seqsRef.current.forEach((s, i) => {
      if (i > 0) s.reschedule();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clockKey]);

  const reset = useCallback(() => {
    seqsRef.current.forEach((s) => s.reset());
    heldRef.current.fill(false);
    setCurrentSteps(Array.from({ length: SEQ_COUNT }, () => -1));
  }, []);

  return { currentSteps, reset };
}
