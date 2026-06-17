import React from 'react';
import { MOD_SOURCES, MOD_DESTS, type ModPatch } from '../../audio/cv/patch';
import { GATE_SOURCES, GATE_DESTS, type GatePatch } from '../../audio/cv/gates';
import './PatchMatrix.css';

interface MatrixRow {
  id: string;
  label: string;
}
interface MatrixCol {
  id: string;
  label: string;
  sub?: string; // subtítulo opcional (p. ej. "gate" / "trig")
}

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
              <span>{col.label}</span>
              {col.sub && <span className="patch-dest-sub">{col.sub}</span>}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <th className="patch-src-label" scope="row">
              {row.label}
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
}

/**
 * Matriz de modulación estilo EMS VCS3. Dos secciones:
 *   - CV: fuentes continuas (LFO/AD/Seq CV) → AudioParams (detune/cutoff/…).
 *   - Gates/Triggers: fuentes de disparo (teclado/secuenciador) → envolventes. Hacia el
 *     ADSR el pin actúa como gate; hacia AD 1/AD 2 como trigger.
 * Las filas/columnas se definen en src/audio/cv/patch.ts y gates.ts.
 */
const PatchMatrix: React.FC<PatchMatrixProps> = ({ patch, setPatch, gatePatch, setGatePatch }) => {
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
          rows={MOD_SOURCES}
          cols={MOD_DESTS}
          isOn={(s, d) => !!patch[`${s}>${d}`]}
          onToggle={toggle(setPatch)}
        />
        <MatrixTable
          title="Gates / Triggers"
          rows={GATE_SOURCES}
          cols={GATE_DESTS.map((d) => ({ id: d.id, label: d.label, sub: d.mode === 'gate' ? 'gate' : 'trig' }))}
          isOn={(s, d) => !!gatePatch[`${s}>${d}`]}
          onToggle={toggle(setGatePatch)}
        />
      </div>
    </div>
  );
};

export default PatchMatrix;
