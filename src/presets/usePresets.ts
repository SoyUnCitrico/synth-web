import { useCallback } from 'react';
import { usePersistentState, PERSIST_KEYS } from '../hooks/usePersistentState';
import type { Preset, PresetState } from './types';

const byName = <S,>(a: Preset<S>, b: Preset<S>) => a.name.localeCompare(b.name);

/**
 * Banco de presets con nombre, persistido en localStorage. Guardar con un nombre ya
 * existente lo sobrescribe. Independiente del estado "vivo" auto-persistido: cargar un
 * preset aplica su estado al estado vivo (que a su vez se vuelve a persistir).
 */
export function usePresets<S = PresetState>(storageKey: string = PERSIST_KEYS.presets) {
  const [presets, setPresets] = usePersistentState<Preset<S>[]>(storageKey, []);

  const save = useCallback(
    (name: string, state: S) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      setPresets((prev) => [...prev.filter((p) => p.name !== trimmed), { name: trimmed, state }].sort(byName));
    },
    [setPresets],
  );

  const remove = useCallback(
    (name: string) => setPresets((prev) => prev.filter((p) => p.name !== name)),
    [setPresets],
  );

  const get = useCallback(
    (name: string) => presets.find((p) => p.name === name)?.state,
    [presets],
  );

  // Importa fusionando por nombre (los entrantes sobrescriben los existentes).
  const importMany = useCallback(
    (incoming: Preset<S>[]) =>
      setPresets((prev) => {
        const map = new Map(prev.map((p) => [p.name, p] as const));
        for (const p of incoming) map.set(p.name, p);
        return [...map.values()].sort(byName);
      }),
    [setPresets],
  );

  return { presets, save, remove, get, importMany };
}
