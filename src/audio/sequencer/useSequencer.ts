import { useCallback, useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
import type { GateSourceId } from '../cv/gates';
import { Sequencer } from './Sequencer';
import {
  SEQ_ROOT,
  type SeqChannels,
  type SeqDirection,
  type PitchStep,
  type CvStep,
} from './types';

interface UseSequencerOptions {
  running: boolean;
  bpm: number;
  channels: SeqChannels;
  steps: number;
  direction: SeqDirection;
  pitchSteps: PitchStep[];
  cvSteps: CvStep[];
  cv2Steps: CvStep[];
  /** Ataque de una fuente de gate (nota opcional para fijar pitch; velocity 0..1). */
  fireAttack: (source: GateSourceId, note: string | undefined, time: number, velocity: number) => void;
  /** Libera la compuerta de una fuente de gate (puede agendarse en el futuro). */
  fireRelease: (source: GateSourceId, time: number) => void;
  /** Escribe la fuente de CV del secuenciador (canal 2). */
  setSeqCv: (value: number, time: number) => void;
  /** Escribe la fuente de CV del secuenciador (canal 3). */
  setSeqCv2: (value: number, time: number) => void;
}

interface UseSequencerResult {
  currentStep: number;
  reset: () => void;
}

/**
 * Orquesta el secuenciador y lo conecta al despachador de gates del motor. Canal 1
 * (seq1) fija el pitch y dispara/suelta según el paso; canal 2 (seq2) escribe el CV y
 * dispara su gate. La longitud de gate agenda el release dentro del paso (staccato).
 */
export function useSequencer(opts: UseSequencerOptions): UseSequencerResult {
  const seqRef = useRef<Sequencer | null>(null);
  // Estado vivo leído dentro del callback de cada paso sin reconstruir el secuenciador.
  const dataRef = useRef(opts);
  dataRef.current = opts;

  const [currentStep, setCurrentStep] = useState<number>(-1);

  // Construir una sola vez.
  useEffect(() => {
    const seq = new Sequencer(
      () => dataRef.current.steps,
      () => dataRef.current.direction,
      (index, time) => {
        const { channels, pitchSteps, cvSteps, cv2Steps, fireAttack, fireRelease, setSeqCv, setSeqCv2 } =
          dataRef.current;
        const stepDur = Tone.Time('16n').toSeconds();
        // Fracción del paso que dura la compuerta (tope 0.95 para no solapar con el ataque
        // del siguiente paso).
        const gateOff = (gateLen: number) => time + Math.min(gateLen, 0.95) * stepDur;

        // Canal 1 (seq1): pitch + gate.
        const s1 = pitchSteps[index];
        if (s1) {
          if (s1.gate) {
            const note = Tone.Frequency(SEQ_ROOT).transpose(s1.offset).toNote();
            fireAttack('seq1', note, time, s1.velocity);
            fireRelease('seq1', gateOff(s1.gateLen));
          } else {
            fireRelease('seq1', time);
          }
        }

        // Canal 2 (seq2, con 2 o 3 canales): CV continuo + gate (sin pitch). Sin control de
        // velocidad: la compuerta abre a pico completo.
        if (channels >= 2) {
          const s2 = cvSteps[index];
          if (s2) {
            setSeqCv(s2.value, time);
            if (s2.gate) {
              fireAttack('seq2', undefined, time, 1);
              fireRelease('seq2', gateOff(s2.gateLen));
            } else {
              fireRelease('seq2', time);
            }
          }
        }

        // Canal 3 (seq3, sólo con 3 canales): segundo CV continuo + gate (sin pitch ni vel).
        if (channels === 3) {
          const s3 = cv2Steps[index];
          if (s3) {
            setSeqCv2(s3.value, time);
            if (s3.gate) {
              fireAttack('seq3', undefined, time, 1);
              fireRelease('seq3', gateOff(s3.gateLen));
            } else {
              fireRelease('seq3', time);
            }
          }
        }

        // Resaltado visual sincronizado al tiempo de audio.
        Tone.getDraw().schedule(() => setCurrentStep(index), time);
      },
    );
    seqRef.current = seq;
    return () => seq.dispose();
  }, []);

  // Tempo.
  useEffect(() => {
    seqRef.current?.setBpm(opts.bpm);
  }, [opts.bpm]);

  // Arranque/parada. El clic de Play es el gesto que permite reanudar el AudioContext.
  useEffect(() => {
    const seq = seqRef.current;
    if (!seq) return;
    if (opts.running) {
      Tone.start();
      seq.start();
    } else {
      seq.stop();
      setCurrentStep(-1);
      // Soltar las compuertas que el secuenciador pudiera dejar abiertas (sin esto, la
      // envolvente queda en sustain y el VCA sigue sonando tras parar).
      const now = Tone.now();
      dataRef.current.fireRelease('seq1', now);
      dataRef.current.fireRelease('seq2', now);
      dataRef.current.fireRelease('seq3', now);
    }
  }, [opts.running]);

  const reset = useCallback(() => {
    seqRef.current?.reset();
    setCurrentStep(-1);
  }, []);

  return { currentStep, reset };
}
