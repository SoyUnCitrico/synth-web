import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { usePersistentState, PERSIST_KEYS } from '../../hooks/usePersistentState';

/**
 * Estado de transporte del secuenciador compartido por toda la app. Vive por encima del
 * Router para que tanto el Header como la página puedan controlar la MISMA instancia del
 * secuenciador (play/stop, reset y BPM). La página registra su función de reset (que vive
 * en useSequencer) vía `registerReset`; el resto es estado simple.
 */
interface TransportContextValue {
  running: boolean;
  setRunning: React.Dispatch<React.SetStateAction<boolean>>;
  bpm: number;
  setBpm: React.Dispatch<React.SetStateAction<number>>;
  /** Reinicia la secuencia (delega en la función registrada por la página). */
  reset: () => void;
  /** La página registra aquí el reset real del secuenciador. */
  registerReset: (fn: () => void) => void;
  /** Restablece todos los controles a sus valores por defecto (delegado en la página). */
  resetAll: () => void;
  /** La página registra aquí el reset global de parámetros. */
  registerResetAll: (fn: () => void) => void;
}

const TransportContext = createContext<TransportContextValue | null>(null);

export const TransportProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [running, setRunning] = useState<boolean>(false);
  // BPM persistente (compartido por el slider del módulo y el del header).
  const [bpm, setBpm] = usePersistentState<number>(PERSIST_KEYS.seqBpm, 120);
  const resetRef = useRef<() => void>(() => {});
  const reset = useCallback(() => resetRef.current(), []);
  const registerReset = useCallback((fn: () => void) => {
    resetRef.current = fn;
  }, []);

  const resetAllRef = useRef<() => void>(() => {});
  const resetAll = useCallback(() => resetAllRef.current(), []);
  const registerResetAll = useCallback((fn: () => void) => {
    resetAllRef.current = fn;
  }, []);

  return (
    <TransportContext.Provider
      value={{ running, setRunning, bpm, setBpm, reset, registerReset, resetAll, registerResetAll }}
    >
      {children}
    </TransportContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export function useTransport(): TransportContextValue {
  const ctx = useContext(TransportContext);
  if (!ctx) throw new Error('useTransport debe usarse dentro de <TransportProvider>');
  return ctx;
}
