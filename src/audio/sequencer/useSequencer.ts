import { useCallback, useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
import type { GateSourceId } from '../cv/gates';
import { Sequencer } from './Sequencer';
import {
  BASE_CLOCK,
  SEQ_COUNT,
  SEQ_ROOT,
  type SeqConfig,
  type PitchStep,
  type CvStep,
} from './types';

interface UseSequencerOptions {
  running: boolean;
  bpm: number;
  /** Configuración (pasos/dirección/reloj) de cada uno de los SEQ_COUNT secuenciadores. */
  configs: SeqConfig[];
  /** Datos de paso: seq 1 = pitch; seq 2-4 = CV. */
  pitchSteps: PitchStep[];
  cvSteps: CvStep[];
  cv2Steps: CvStep[];
  cv3Steps: CvStep[];
  /** Ataque de una fuente de gate (nota opcional para fijar pitch; velocity 0..1). */
  fireAttack: (source: GateSourceId, note: string | undefined, time: number, velocity: number) => void;
  /** Libera la compuerta de una fuente de gate (puede agendarse en el futuro). */
  fireRelease: (source: GateSourceId, time: number) => void;
  /** Escribe las fuentes de CV de los secuenciadores 2, 3 y 4. */
  setSeqCv: (value: number, time: number) => void;
  setSeqCv2: (value: number, time: number) => void;
  setSeqCv3: (value: number, time: number) => void;
  /** Escribe el CV de la velocidad (Vel) del secuenciador 1. */
  setSeqVel: (value: number, time: number) => void;
}

interface UseSequencerResult {
  /** Paso actual de cada secuenciador (-1 = detenido), para el resaltado de la UI. */
  currentSteps: number[];
  reset: () => void;
}

// Fuentes de gate por índice de secuenciador (seq 1..4).
const GATE_SOURCES: GateSourceId[] = ['seq1', 'seq2', 'seq3', 'seq4'];

/**
 * Orquesta los SEQ_COUNT secuenciadores y los conecta al despachador de gates del motor.
 * El secuenciador 1 (base, reloj fijo) fija el pitch; los 2-4 escriben su CV y corren a su
 * divisor/multiplicador de reloj relativo al primero. El hook controla el arranque/parada
 * del transporte una sola vez; cada Sequencer sólo agenda su propio paso.
 */
export function useSequencer(opts: UseSequencerOptions): UseSequencerResult {
  const seqsRef = useRef<Sequencer[]>([]);
  // Estado vivo leído dentro de los callbacks sin reconstruir los secuenciadores.
  const dataRef = useRef(opts);
  dataRef.current = opts;

  const [currentSteps, setCurrentSteps] = useState<number[]>(() =>
    Array.from({ length: SEQ_COUNT }, () => -1),
  );

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
      undefined, // seq 1 = pitch, sin CV
      (v: number, t: number) => dataRef.current.setSeqCv(v, t),
      (v: number, t: number) => dataRef.current.setSeqCv2(v, t),
      (v: number, t: number) => dataRef.current.setSeqCv3(v, t),
    ];
    const stepData = [
      () => dataRef.current.pitchSteps,
      () => dataRef.current.cvSteps,
      () => dataRef.current.cv2Steps,
      () => dataRef.current.cv3Steps,
    ];

    const seqs = Array.from({ length: SEQ_COUNT }, (_, seq) =>
      new Sequencer(
        // El seq 1 usa el reloj base; los demás su subdivisión configurada.
        () => (seq === 0 ? BASE_CLOCK : dataRef.current.configs[seq]?.clock ?? BASE_CLOCK),
        () => dataRef.current.configs[seq]?.steps ?? 0,
        () => dataRef.current.configs[seq]?.direction ?? 'forward',
        (index, time) => {
          const source = GATE_SOURCES[seq];
          const stepDur = Tone.Time('16n').toSeconds();
          const gateOff = (gateLen: number) => time + Math.min(gateLen, 0.95) * stepDur;
          const s = stepData[seq]()[index];
          if (!s) return;

          if (seq === 0) {
            // Pitch + gate. La Vel del paso también sale como CV (fuente de la matriz).
            const ps = s as PitchStep;
            dataRef.current.setSeqVel(ps.velocity, time);
            if (ps.gate) {
              const note = Tone.Frequency(SEQ_ROOT).transpose(ps.offset).toNote();
              dataRef.current.fireAttack(source, note, time, ps.velocity);
              dataRef.current.fireRelease(source, gateOff(ps.gateLen));
            } else {
              dataRef.current.fireRelease(source, time);
            }
          } else {
            // CV continuo + gate (sin pitch ni velocidad: pico completo).
            const cs = s as CvStep;
            cvSetters[seq]!(cs.value, time);
            if (cs.gate) {
              dataRef.current.fireAttack(source, undefined, time, 1);
              dataRef.current.fireRelease(source, gateOff(cs.gateLen));
            } else {
              dataRef.current.fireRelease(source, time);
            }
          }

          // Resaltado visual sincronizado al tiempo de audio.
          Tone.getDraw().schedule(() => setStep(seq, index), time);
        },
      ),
    );
    seqsRef.current = seqs;
    return () => seqs.forEach((s) => s.dispose());
  }, [setStep]);

  // Tempo (compartido por todos los secuenciadores).
  useEffect(() => {
    Tone.getTransport().bpm.value = opts.bpm;
  }, [opts.bpm]);

  // Arranque/parada. El clic de Play es el gesto que permite reanudar el AudioContext.
  useEffect(() => {
    const seqs = seqsRef.current;
    const transport = Tone.getTransport();
    if (opts.running) {
      Tone.start();
      seqs.forEach((s) => s.start());
      if (transport.state !== 'started') transport.start();
    } else {
      transport.stop();
      seqs.forEach((s) => s.stop());
      setCurrentSteps(Array.from({ length: SEQ_COUNT }, () => -1));
      // Soltar las compuertas que pudieran quedar abiertas (si no, la envolvente queda en
      // sustain y el VCA sigue sonando tras parar).
      const now = Tone.now();
      GATE_SOURCES.forEach((src) => dataRef.current.fireRelease(src, now));
    }
  }, [opts.running]);

  // Cambio de reloj en marcha: reagenda los secuenciadores afectados (seq 1 es fijo).
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
    setCurrentSteps(Array.from({ length: SEQ_COUNT }, () => -1));
  }, []);

  return { currentSteps, reset };
}
