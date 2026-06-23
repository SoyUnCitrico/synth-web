/**
 * Layout del teclado: fuente ÚNICA de verdad del mapeo tecla de computadora → nota. Tanto el
 * componente `Keyboard` (render) como `BasicSynth` (manejador del teclado físico) lo usan.
 */

/** Una tecla: `key` = tecla de computadora que la dispara; `octaveOffset` 0 = base, 1 = superior. */
export interface KeyDef {
  key: string;
  note: string;
  octaveOffset: number;
}
export interface BlackKeyDef extends KeyDef {
  /** Índice de la tecla blanca tras la cual se ubica (para posicionar la negra). */
  afterIndex: number;
}

// Teclas blancas (fila inferior) y negras (superpuestas), de izquierda a derecha.
export const WHITE_KEYS: KeyDef[] = [
  { key: 'z', note: 'C', octaveOffset: 0 },
  { key: 'x', note: 'D', octaveOffset: 0 },
  { key: 'c', note: 'E', octaveOffset: 0 },
  { key: 'v', note: 'F', octaveOffset: 0 },
  { key: 'b', note: 'G', octaveOffset: 0 },
  { key: 'n', note: 'A', octaveOffset: 0 },
  { key: 'm', note: 'B', octaveOffset: 0 },
  { key: ',', note: 'C', octaveOffset: 1 },
  { key: '.', note: 'D', octaveOffset: 1 },
  { key: '-', note: 'E', octaveOffset: 1 },
];
export const BLACK_KEYS: BlackKeyDef[] = [
  { key: 's', note: 'C#', octaveOffset: 0, afterIndex: 0 },
  { key: 'd', note: 'D#', octaveOffset: 0, afterIndex: 1 },
  { key: 'g', note: 'F#', octaveOffset: 0, afterIndex: 3 },
  { key: 'h', note: 'G#', octaveOffset: 0, afterIndex: 4 },
  { key: 'j', note: 'A#', octaveOffset: 0, afterIndex: 5 },
  { key: 'l', note: 'C#', octaveOffset: 1, afterIndex: 7 },
  { key: 'ñ', note: 'D#', octaveOffset: 1, afterIndex: 8 },
];
/** Todas las teclas: para construir el mapeo del teclado físico. */
export const ALL_KEYS: KeyDef[] = [...WHITE_KEYS, ...BLACK_KEYS];
