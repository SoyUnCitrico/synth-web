import { useCallback, useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
import type { GateSourceId } from '../cv/gates';
import { DRUM_VOICES } from '../drums/kit';
import { Sequencer } from './Sequencer';
import {
  BASE_CLOCK,
  SEQ_COUNT,
  SEQ_ROOT,
  DEFAULT_PITCH_OFFSET,
  type SeqConfig,
  type PitchStep,
  type CvStep,
  type DrumStep,
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
  // --- Batería: un secuenciador de trigger por voz, sobre el mismo transporte. ---
  drumConfigs: SeqConfig[];
  drumSteps: DrumStep[][]; // [voz][paso]
  triggerDrum: (voice: number, time: number, velocity: number) => void;
}

interface UseSequencerResult {
  /** Paso actual de cada secuenciador melódico (-1 = detenido). */
  currentSteps: number[];
  /** Paso actual de cada voz de batería (-1 = detenido). */
  drumCurrentSteps: number[];
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
  const drumSeqsRef = useRef<Sequencer[]>([]);
  // Estado vivo leído dentro de los callbacks sin reconstruir los secuenciadores.
  const dataRef = useRef(opts);
  dataRef.current = opts;

  const [currentSteps, setCurrentSteps] = useState<number[]>(() =>
    Array.from({ length: SEQ_COUNT }, () => -1),
  );
  const [drumCurrentSteps, setDrumCurrentSteps] = useState<number[]>(() =>
    Array.from({ length: DRUM_VOICES }, () => -1),
  );

  const setStep = useCallback((seq: number, index: number) => {
    setCurrentSteps((prev) => {
      const next = prev.slice();
      next[seq] = index;
      return next;
    });
  }, []);
  const setDrumStep = useCallback((voice: number, index: number) => {
    setDrumCurrentSteps((prev) => {
      const next = prev.slice();
      next[voice] = index;
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
            // Pitch + gate. La Vel del paso escala el pico de la envolvente (no es fuente CV).
            const ps = s as PitchStep;
            if (ps.gate) {
              const note = Tone.Frequency(SEQ_ROOT).transpose(ps.offset).toNote();
              dataRef.current.fireAttack(source, note, time, ps.velocity);
              dataRef.current.fireRelease(source, gateOff(ps.gateLen));
            } else {
              dataRef.current.fireRelease(source, time);
            }
          } else {
            // CV continuo + gate. El seq 2 además emite una NOTA (fuente "Seq 2 MIDI" de la
            // matriz MIDI) desde su offset; los seq 3/4 no tienen pitch (note = undefined).
            // Sin Vel: pico completo (velocity 1).
            const cs = s as CvStep;
            cvSetters[seq]!(cs.value, time);
            const note =
              seq === 1
                ? Tone.Frequency(SEQ_ROOT).transpose(cs.offset ?? DEFAULT_PITCH_OFFSET).toNote()
                : undefined;
            if (cs.gate) {
              dataRef.current.fireAttack(source, note, time, 1);
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

    // Secuenciadores de trigger de batería (uno por voz), sobre el mismo transporte.
    const drumSeqs = Array.from({ length: DRUM_VOICES }, (_, voice) =>
      new Sequencer(
        () => dataRef.current.drumConfigs[voice]?.clock ?? BASE_CLOCK,
        () => dataRef.current.drumConfigs[voice]?.steps ?? 0,
        () => dataRef.current.drumConfigs[voice]?.direction ?? 'forward',
        (index, time) => {
          const step = dataRef.current.drumSteps[voice]?.[index];
          if (step?.gate) dataRef.current.triggerDrum(voice, time, step.velocity);
          Tone.getDraw().schedule(() => setDrumStep(voice, index), time);
        },
      ),
    );
    drumSeqsRef.current = drumSeqs;

    return () => {
      seqs.forEach((s) => s.dispose());
      drumSeqs.forEach((s) => s.dispose());
    };
  }, [setStep, setDrumStep]);

  // Tempo (compartido por todos los secuenciadores).
  useEffect(() => {
    Tone.getTransport().bpm.value = opts.bpm;
  }, [opts.bpm]);

  // Arranque/parada. El clic de Play es el gesto que permite reanudar el AudioContext.
  useEffect(() => {
    const seqs = seqsRef.current;
    const transport = Tone.getTransport();
    if (opts.running) {
      // Tone.start() es ASÍNCRONO: reanuda el AudioContext. Hay que esperar a que el
      // contexto esté corriendo antes de arrancar el transporte; si no, transport.start()
      // marca "started" pero el reloj no avanza (el secuenciador no se mueve).
      let cancelled = false;
      const arrancar = () => {
        if (cancelled) return;
        seqsRef.current.forEach((s) => s.start());
        drumSeqsRef.current.forEach((s) => s.start());
        if (transport.state !== 'started') transport.start();
      };
      if (Tone.getContext().state === 'running') {
        arrancar();
      } else {
        Tone.start().then(arrancar);
      }
      return () => {
        cancelled = true;
      };
    } else {
      transport.stop();
      seqs.forEach((s) => s.stop());
      drumSeqsRef.current.forEach((s) => s.stop());
      setCurrentSteps(Array.from({ length: SEQ_COUNT }, () => -1));
      setDrumCurrentSteps(Array.from({ length: DRUM_VOICES }, () => -1));
      // Soltar las compuertas que pudieran quedar abiertas (si no, la envolvente queda en
      // sustain y el VCA sigue sonando tras parar).
      const now = Tone.now();
      GATE_SOURCES.forEach((src) => dataRef.current.fireRelease(src, now));
    }
  }, [opts.running]);

  // Cambio de reloj en marcha: reagenda los secuenciadores afectados (seq 1 es fijo).
  const clockKey = opts.configs.map((c) => c.clock).join('|');
  const drumClockKey = opts.drumConfigs.map((c) => c.clock).join('|');
  useEffect(() => {
    if (!opts.running) return;
    seqsRef.current.forEach((s, i) => {
      if (i > 0) s.reschedule();
    });
    drumSeqsRef.current.forEach((s) => s.reschedule());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clockKey, drumClockKey]);

  const reset = useCallback(() => {
    seqsRef.current.forEach((s) => s.reset());
    drumSeqsRef.current.forEach((s) => s.reset());
    setCurrentSteps(Array.from({ length: SEQ_COUNT }, () => -1));
    setDrumCurrentSteps(Array.from({ length: DRUM_VOICES }, () => -1));
  }, []);

  return { currentSteps, drumCurrentSteps, reset };
}
