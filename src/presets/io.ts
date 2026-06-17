import type { Preset } from './types';

// Formato de archivo para exportar/importar presets (con versión para validación).
const FORMAT = 'synth-web-presets';
const VERSION = 1;

interface PresetFile {
  format: string;
  version: number;
  presets: Preset[];
}

/** Serializa el banco de presets a JSON (para exportar). */
export function serializePresets(presets: Preset[]): string {
  const file: PresetFile = { format: FORMAT, version: VERSION, presets };
  return JSON.stringify(file, null, 2);
}

/** Parsea un archivo de presets exportado. Lanza si el formato no es válido. */
export function parsePresets(text: string): Preset[] {
  const data = JSON.parse(text) as Partial<PresetFile>;
  if (data?.format !== FORMAT || !Array.isArray(data.presets)) {
    throw new Error('Archivo de presets no válido');
  }
  return data.presets.filter(
    (p): p is Preset => !!p && typeof p.name === 'string' && typeof p.state === 'object',
  );
}
