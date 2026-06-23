import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { usePersistentState } from '../../hooks/usePersistentState';

/**
 * MIDI-learn DIRECTO: en vez de slots/CC como fuentes de la matriz, cada perilla/slider puede
 * asignarse a un número de CC. Flujo (modo Learn global): activar el modo, hacer clic en un
 * control para ARMARLO, mover un control físico → queda asignado; en adelante ese CC mueve el
 * control en vivo (mapeado por POSICIÓN 0..1, respetando escalas logarítmicas).
 *
 * Los controles (Knob/Fader) se registran con un `apply(norm)` y leen el contexto vía
 * `useMidiLearn()`. Fuera de un provider (p. ej. Modulor) el hook devuelve una API no-op, así
 * que los componentes compartidos siguen funcionando sin cambios.
 */
export interface MidiLearnApi {
  /** ¿Hay un provider activo? (false en páginas sin MIDI-learn directo, p. ej. Modulor.) */
  active: boolean;
  /** Modo aprendizaje encendido. */
  learnMode: boolean;
  /** paramId armado a la espera de un CC (o null). */
  armedId: string | null;
  /** Mapa paramId → nº de CC. */
  assignments: Record<string, number>;
  toggleLearnMode: () => void;
  /** Arma/desarma un control (solo tiene efecto en modo aprendizaje). */
  arm: (id: string) => void;
  /** Borra la asignación de un control. */
  clearAssignment: (id: string) => void;
  /** Registra el aplicador de un control (norm 0..1). Devuelve la función de de-registro. */
  register: (id: string, apply: (norm: number) => void) => () => void;
  /** nº de CC asignado a un control (o null). */
  ccFor: (id: string) => number | null;
  /** Procesa un CC entrante crudo (nº de CC + valor 0..1). Conéctalo a useMidi.onControlChange. */
  handleCC: (cc: number, value: number) => void;
}

const NOOP: MidiLearnApi = {
  active: false,
  learnMode: false,
  armedId: null,
  assignments: {},
  toggleLearnMode: () => {},
  arm: () => {},
  clearAssignment: () => {},
  register: () => () => {},
  ccFor: () => null,
  handleCC: () => {},
};

/** Context del MIDI-learn. Úsalo directamente como `<MidiLearnContext.Provider value={...}>`. */
export const MidiLearnContext = createContext<MidiLearnApi | null>(null);

/** Consumido por Knob/Fader y el panel MIDI. Devuelve API no-op si no hay provider. */
export function useMidiLearn(): MidiLearnApi {
  return useContext(MidiLearnContext) ?? NOOP;
}

/**
 * Estado del MIDI-learn directo. La página (Makwil) lo crea con esta función, conecta
 * `handleCC` a `useMidi`, y lo pasa como `value` a `<MidiLearnProvider>`.
 */
export function useMidiLearnState(persistKey: string): MidiLearnApi {
  const [learnMode, setLearnMode] = useState(false);
  const [armedId, setArmedId] = useState<string | null>(null);
  const [assignments, setAssignments] = usePersistentState<Record<string, number>>(persistKey, {});

  // Registro de aplicadores y refs vivos para el handler de CC.
  const registryRef = useRef<Map<string, (norm: number) => void>>(new Map());
  const assignmentsRef = useRef(assignments);
  assignmentsRef.current = assignments;
  const armedRef = useRef(armedId);
  armedRef.current = armedId;

  const toggleLearnMode = useCallback(() => {
    setLearnMode((m) => {
      if (m) setArmedId(null); // al apagar, desarmar
      return !m;
    });
  }, []);

  const arm = useCallback((id: string) => {
    setArmedId((cur) => (cur === id ? null : id));
  }, []);

  const clearAssignment = useCallback((id: string) => {
    setAssignments((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, [setAssignments]);

  const register = useCallback((id: string, apply: (norm: number) => void) => {
    registryRef.current.set(id, apply);
    return () => {
      registryRef.current.delete(id);
    };
  }, []);

  const ccFor = useCallback((id: string) => assignments[id] ?? null, [assignments]);

  const handleCC = useCallback((cc: number, value: number) => {
    const armed = armedRef.current;
    if (armed != null) {
      // Asigna el CC al control armado (un mismo CC se reasigna a un solo control).
      setAssignments((prev) => {
        const next: Record<string, number> = {};
        for (const [id, n] of Object.entries(prev)) if (n !== cc) next[id] = n;
        next[armed] = cc;
        return next;
      });
      setArmedId(null);
      return;
    }
    // Aplica a los controles asignados a este CC.
    for (const [id, n] of Object.entries(assignmentsRef.current)) {
      if (n === cc) registryRef.current.get(id)?.(value);
    }
  }, [setAssignments]);

  return useMemo(
    () => ({
      active: true,
      learnMode,
      armedId,
      assignments,
      toggleLearnMode,
      arm,
      clearAssignment,
      register,
      ccFor,
      handleCC,
    }),
    [learnMode, armedId, assignments, toggleLearnMode, arm, clearAssignment, register, ccFor, handleCC],
  );
}
