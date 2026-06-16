import { useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
import type { SynthEngine } from '../useSynthEngine';
import { Sequencer } from './Sequencer';
import { stepCount, SEQ_ROOT, type SeqMode, type PitchStep, type CvStep } from './types';

interface UseSequencerOptions {
  engine: SynthEngine;
  running: boolean;
  bpm: number;
  mode: SeqMode;
  pitchSteps: PitchStep[];
  cvSteps: CvStep[];
}

/**
 * Orquesta el secuenciador: crea la instancia una sola vez y la conecta a la API
 * imperativa del motor. Canal de pitch: dispara/silencia la nota por paso. Canal de CV
 * (sólo dual16): actualiza la fuente `seqCv` de la matriz. Devuelve el paso actual para
 * resaltarlo en la UI.
 */
export function useSequencer(opts: UseSequencerOptions): number {
  const seqRef = useRef<Sequencer | null>(null);
  // Estado vivo leído dentro del callback de cada paso sin reconstruir el secuenciador.
  const dataRef = useRef(opts);
  dataRef.current = opts;

  const [currentStep, setCurrentStep] = useState<number>(-1);

  // Construir una sola vez.
  useEffect(() => {
    const seq = new Sequencer(
      () => stepCount(dataRef.current.mode),
      (index, time) => {
        const { engine, mode, pitchSteps, cvSteps } = dataRef.current;

        // Canal de pitch: paso con compuerta dispara la nota; sin compuerta, silencio.
        const step = pitchSteps[index];
        if (step) {
          if (step.gate) {
            const note = Tone.Frequency(SEQ_ROOT).transpose(step.offset).toNote();
            engine.triggerAttack(note, time);
          } else {
            engine.triggerRelease(time);
          }
        }

        // Canal de CV (sólo dual16).
        if (mode === 'dual16') {
          const cv = cvSteps[index];
          if (cv) engine.setSeqCv(cv.value, time);
        }

        // Resaltado visual sincronizado al tiempo de audio.
        Tone.getDraw().schedule(() => setCurrentStep(index), time);
      },
    );
    seqRef.current = seq;
    return () => seq.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tempo.
  useEffect(() => {
    seqRef.current?.setBpm(opts.bpm);
  }, [opts.bpm]);

  // Arranque/parada.
  useEffect(() => {
    const seq = seqRef.current;
    if (!seq) return;
    if (opts.running) {
      seq.start();
    } else {
      seq.stop();
      setCurrentStep(-1);
    }
  }, [opts.running]);

  return currentStep;
}
