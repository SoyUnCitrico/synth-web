import type { Preset } from './types';

// Formato de archivo para exportar/importar presets (con versión para validación).
const FORMAT = 'synth-web-presets';
const VERSION = 1;

interface PresetFile<S> {
  format: string;
  version: number;
  presets: Preset<S>[];
}

/** Serializa el banco de presets a JSON (para exportar). */
export function serializePresets<S>(presets: Preset<S>[]): string {
  const file: PresetFile<S> = { format: FORMAT, version: VERSION, presets };
  return JSON.stringify(file, null, 2);
}

/** Parsea un archivo de presets exportado. Lanza si el formato no es válido. */
export function parsePresets<S>(text: string): Preset<S>[] {
  const data = JSON.parse(text) as Partial<PresetFile<S>>;
  if (data?.format !== FORMAT || !Array.isArray(data.presets)) {
    throw new Error('Archivo de presets no válido');
  }
  return data.presets.filter(
    (p): p is Preset<S> => !!p && typeof p.name === 'string' && typeof p.state === 'object',
  );
}
