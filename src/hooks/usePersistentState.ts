import { useEffect, useState } from 'react';

/**
 * Como useState, pero persiste el valor en localStorage bajo `key`. Lee el valor inicial
 * de localStorage si existe; si no, usa `initial`. Escribe en cada cambio. Tolera entornos
 * sin localStorage o errores de cuota/serialización (cae al estado en memoria).
 *
 * Las claves llevan versión (ver PERSIST_KEYS) para invalidar datos viejos si cambia el
 * formato de los datos guardados.
 */
export function usePersistentState<T>(
  key: string,
  initial: T | (() => T),
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) return JSON.parse(raw) as T;
    } catch {
      /* localStorage no disponible o JSON inválido: usar el valor inicial */
    }
    return typeof initial === 'function' ? (initial as () => T)() : initial;
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      /* modo privado o cuota excedida: seguimos sólo en memoria */
    }
  }, [key, state]);

  return [state, setState];
}

/** Claves de persistencia (con versión para invalidar formatos antiguos). */
export const PERSIST_KEYS = {
  modPatch: 'synth-web:modPatch:v2',
  gatePatch: 'synth-web:gatePatch:v1',
  seqChannels: 'synth-web:seqChannels:v1',
  seqSteps: 'synth-web:seqSteps:v1',
  seqDirection: 'synth-web:seqDirection:v1',
  seqBpm: 'synth-web:seqBpm:v1',
  pitchSteps: 'synth-web:pitchSteps:v1',
  cvSteps: 'synth-web:cvSteps:v1',
  cv2Steps: 'synth-web:cv2Steps:v1',
  presets: 'synth-web:presets:v1',
} as const;
