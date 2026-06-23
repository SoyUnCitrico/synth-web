import React from 'react';
import { MOD_SOURCES, MOD_DESTS, type ModPatch, type PatchSource, type PatchDest } from '../../../audio/cv/patch';
import { GATE_SOURCES, GATE_DESTS, type GatePatch, type GateSourceCfg, type GateDestCfg } from '../../../audio/cv/gates';
import { NOTE_SOURCES, NOTE_DESTS, type NotePatch, type NoteSourceCfg, type NoteDestCfg } from '../../../audio/cv/notes';
import './PatchMatrix.css';

interface MatrixRow {
  id: string;
  label: string;
  short?: string; // etiqueta abreviada para móvil
}
interface MatrixCol {
  id: string;
  label: string;
  short?: string; // etiqueta abreviada para móvil
  sub?: string; // subtítulo opcional (p. ej. "gate" / "trig")
}

// Renderiza la etiqueta completa y la abreviada; el CSS muestra una u otra según el ancho.
const Label: React.FC<{ full: string; short?: string }> = ({ full, short }) => (
  <>
    <span className="patch-label-full">{full}</span>
    <span className="patch-label-short">{short ?? full}</span>
  </>
);

// Tabla genérica de patcheo: filas × columnas con un checkbox (pin) por intersección.
// La clave de conexión es `${fila}>${columna}` (coincide con patchKey y gateKey).
const MatrixTable: React.FC<{
  title: string;
  rows: MatrixRow[];
  cols: MatrixCol[];
  isOn: (rowId: string, colId: string) => boolean;
  onToggle: (rowId: string, colId: string) => void;
}> = ({ title, rows, cols, isOn, onToggle }) => (
  <div className="patch-section">
    <h3 className="patch-title">{title}</h3>
    <table className="patch-matrix">
      <thead>
        <tr>
          <th className="patch-corner" aria-hidden="true" />
          {cols.map((col) => (
            <th key={col.id} className="patch-dest-label" scope="col">
              <Label full={col.label} short={col.short} />
              {col.sub && <span className="patch-dest-sub">{col.sub}</span>}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <th className="patch-src-label" scope="row">
              <Label full={row.label} short={row.short} />
            </th>
            {cols.map((col) => (
              <td key={col.id} className="patch-cell">
                <label className="patch-pin">
                  <input
                    type="checkbox"
                    checked={isOn(row.id, col.id)}
                    onChange={() => onToggle(row.id, col.id)}
                    aria-label={`${row.label} → ${col.label}`}
                  />
                  <span className="patch-pin-dot" />
                </label>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

interface PatchMatrixProps {
  patch: ModPatch;
  setPatch: React.Dispatch<React.SetStateAction<ModPatch>>;
  gatePatch: GatePatch;
  setGatePatch: React.Dispatch<React.SetStateAction<GatePatch>>;
  /** Matriz MIDI: fuentes de nota → pitch de VCO / seguimiento de cutoff. */
  notePatch: NotePatch;
  setNotePatch: React.Dispatch<React.SetStateAction<NotePatch>>;
  /** Filas de la sección CV. Por defecto MOD_SOURCES; la página la sobreescribe para
   *  filtrar/reetiquetar los slots CC MIDI según el mapeo activo. */
  modSources?: PatchSource[];
  /** Columnas de la sección CV. Por defecto MOD_DESTS. */
  modDests?: PatchDest[];
  /** Fuentes/destinos de las matrices de gates y MIDI (por defecto las de Modulor). */
  gateSources?: GateSourceCfg[];
  gateDests?: GateDestCfg[];
  noteSources?: NoteSourceCfg[];
  noteDests?: NoteDestCfg[];
}

/**
 * Matriz de modulación estilo EMS VCS3. Tres secciones:
 *   - CV: fuentes continuas (LFO/AD/Seq CV) → AudioParams (detune/cutoff/…).
 *   - Gates/Triggers: fuentes de disparo (teclado/secuenciador) → envolventes. Hacia el
 *     ADSR el pin actúa como gate; hacia AD 1/AD 2 como trigger.
 *   - MIDI: fuentes de nota (teclado/MIDI/Seq 1/Seq 2) → pitch de VCO y seguimiento de
 *     cutoff de los filtros (parafónico).
 * Las filas/columnas se definen en src/audio/cv/patch.ts, gates.ts y notes.ts.
 */
const PatchMatrix: React.FC<PatchMatrixProps> = ({
  patch,
  setPatch,
  gatePatch,
  setGatePatch,
  notePatch,
  setNotePatch,
  modSources = MOD_SOURCES,
  modDests = MOD_DESTS,
  gateSources = GATE_SOURCES,
  gateDests = GATE_DESTS,
  noteSources = NOTE_SOURCES,
  noteDests = NOTE_DESTS,
}) => {
  const toggle =
    <T extends Partial<Record<string, boolean>>>(setter: React.Dispatch<React.SetStateAction<T>>) =>
    (rowId: string, colId: string) => {
      const key = `${rowId}>${colId}`;
      setter((prev) => ({ ...prev, [key]: !prev[key] }));
    };

  return (
    <div className="module patch-module">
      <div className="module-header">
        <h2>Matriz de modulación</h2>
      </div>
      <div className="module-controls">
        <MatrixTable
          title="CV"
          rows={modSources}
          cols={modDests}
          isOn={(s, d) => !!patch[`${s}>${d}`]}
          onToggle={toggle(setPatch)}
        />
        <MatrixTable
          title="Gates / Triggers"
          rows={gateSources}
          cols={gateDests.map((d) => ({ id: d.id, label: d.label, short: d.short, sub: d.mode === 'gate' ? 'gate' : 'trig' }))}
          isOn={(s, d) => !!gatePatch[`${s}>${d}`]}
          onToggle={toggle(setGatePatch)}
        />
        <MatrixTable
          title="MIDI"
          rows={noteSources}
          cols={noteDests}
          isOn={(s, d) => !!notePatch[`${s}>${d}`]}
          onToggle={toggle(setNotePatch)}
        />
      </div>
    </div>
  );
};

export default PatchMatrix;
