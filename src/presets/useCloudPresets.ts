import { useCallback, useEffect, useRef, useState } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';
import type { Preset } from './types';
import { fetchRemotePresets, pushRemotePresets, remotePresetsEnabled } from './remote';

interface UseCloudPresetsArgs<S> {
  /** Clave de localStorage donde se guarda la clave secreta (distinta por página). */
  keyStorageKey: string;
  /** Banco vivo de presets (de `usePresets`). El auto-guardado sube este banco completo. */
  presets: Preset<S>[];
  /** Fusiona los presets entrantes de la nube en el banco local. */
  importMany: (incoming: Preset<S>[]) => void;
}

export interface CloudPresets {
  /** ¿Hay endpoint configurado? Si no, la página NO debe mostrar la UI de nube. */
  enabled: boolean;
  cloudKey: string;
  setCloudKey: (key: string) => void;
  /** Descarga el banco de la hoja y lo fusiona localmente. */
  loadFromCloud: () => void;
  /** Marca que el banco cambió localmente (guardar/borrar) para disparar el auto-guardado. */
  markLocalChange: () => void;
  busy: boolean;
  status: string | null;
}

/**
 * Sincroniza el banco de presets con la Google Sheet (ver `remote.ts`).
 *
 * Auto-guardado: tras un cambio LOCAL (guardar/borrar) se llama `markLocalChange()`, que arma
 * un `dirtyRef`; el efecto sobre `presets` sube el banco completo si hay clave. Las cargas de
 * nube (`importMany`) NO arman el flag → no hay eco de subida.
 */
export function useCloudPresets<S>({ keyStorageKey, presets, importMany }: UseCloudPresetsArgs<S>): CloudPresets {
  const [cloudKey, setCloudKey] = usePersistentState<string>(keyStorageKey, '');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const dirtyRef = useRef(false);
  // Refs para leer valores vivos dentro del efecto sin re-suscribirlo a cada cambio de clave.
  const cloudKeyRef = useRef(cloudKey);
  cloudKeyRef.current = cloudKey;
  const presetsRef = useRef(presets);
  presetsRef.current = presets;

  const markLocalChange = useCallback(() => {
    dirtyRef.current = true;
  }, []);

  // Auto-guardado: sube el banco completo cuando cambió localmente y hay clave cargada.
  useEffect(() => {
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    const key = cloudKeyRef.current.trim();
    if (!remotePresetsEnabled || !key) return;
    setBusy(true);
    setStatus('Guardando…');
    pushRemotePresets(key, presetsRef.current)
      .then(() => setStatus('Guardado en la nube'))
      .catch((e: Error) => setStatus(e.message))
      .finally(() => setBusy(false));
  }, [presets]);

  const loadFromCloud = useCallback(() => {
    if (!remotePresetsEnabled) return;
    setBusy(true);
    setStatus('Cargando…');
    fetchRemotePresets<S>()
      .then((incoming) => {
        importMany(incoming);
        setStatus(`Cargados ${incoming.length} presets`);
      })
      .catch((e: Error) => setStatus(e.message))
      .finally(() => setBusy(false));
  }, [importMany]);

  return {
    enabled: remotePresetsEnabled,
    cloudKey,
    setCloudKey,
    loadFromCloud,
    markLocalChange,
    busy,
    status,
  };
}
