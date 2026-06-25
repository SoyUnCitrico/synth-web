/**
 * Cliente para sincronizar el banco de presets con una Google Sheet a través de un
 * Apps Script Web App (ver `presets-sheet/`). La URL es fija de build (env); la *escritura*
 * exige una clave secreta que valida el script.
 *
 * Formato de cable: el mismo archivo de presets que `io.ts` (`{ format, version, presets }`),
 * por lo que el GET se parsea con `parsePresets`. El POST manda `{ key, presets }`.
 */
import type { Preset } from './types';
import { parsePresets } from './io';

/** URL del Web App (Apps Script `/exec`). Vacía = función de nube desactivada. */
export const REMOTE_PRESETS_URL = import.meta.env.VITE_PRESETS_SHEET_URL ?? '';

/** ¿Hay endpoint configurado? Si no, la UI de nube no se muestra y nada hace red. */
export const remotePresetsEnabled = REMOTE_PRESETS_URL !== '';

/** Lee el banco de presets de la hoja (GET). Lanza si la respuesta no es válida. */
export async function fetchRemotePresets<S>(): Promise<Preset<S>[]> {
  const res = await fetch(REMOTE_PRESETS_URL, { method: 'GET' });
  if (!res.ok) throw new Error(`Error al leer de la nube (HTTP ${res.status})`);
  return parsePresets<S>(await res.text());
}

/**
 * Sube el banco completo a la hoja (POST). Usa `text/plain` para que sea una petición
 * "simple" y evitar el preflight CORS que Apps Script no contesta. La clave va en el cuerpo
 * y la valida el script; si no coincide responde `{ ok:false }`.
 */
export async function pushRemotePresets<S>(key: string, presets: Preset<S>[]): Promise<void> {
  const res = await fetch(REMOTE_PRESETS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ key, presets }),
  });
  if (!res.ok) throw new Error(`Error al guardar en la nube (HTTP ${res.status})`);
  // Apps Script siempre responde 200; el resultado real va en el JSON.
  const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (data && data.ok === false) {
    throw new Error(data.error === 'unauthorized' ? 'Clave incorrecta' : data.error || 'Error al guardar en la nube');
  }
}
