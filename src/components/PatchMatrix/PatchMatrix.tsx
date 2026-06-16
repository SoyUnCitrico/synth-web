import React from 'react';
import { MOD_SOURCES, MOD_DESTS, patchKey, type ModPatch } from '../../audio/cv/patch';
import type { ModSourceId, ModDestId } from '../../audio/cv/types';
import './PatchMatrix.css';

interface PatchMatrixProps {
  patch: ModPatch;
  setPatch: React.Dispatch<React.SetStateAction<ModPatch>>;
}

/**
 * Matriz de patcheo estilo EMS VCS3. Las filas son fuentes de modulación y las columnas
 * destinos; cada intersección es un checkbox que conecta fuente→destino. Las filas y
 * columnas se definen en src/audio/cv/patch.ts (MOD_SOURCES / MOD_DESTS).
 */
const PatchMatrix: React.FC<PatchMatrixProps> = ({ patch, setPatch }) => {
  const toggle = (src: ModSourceId, dst: ModDestId) => {
    const key = patchKey(src, dst);
    setPatch((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="module patch-module">
      <div className="module-header">
        <h2>Matriz de modulación</h2>
      </div>
      <div className="module-controls">
        <table className="patch-matrix">
          <thead>
            <tr>
              <th className="patch-corner" aria-hidden="true" />
              {MOD_DESTS.map((dest) => (
                <th key={dest.id} className="patch-dest-label" scope="col">
                  <span>{dest.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MOD_SOURCES.map((src) => (
              <tr key={src.id}>
                <th className="patch-src-label" scope="row">
                  {src.label}
                </th>
                {MOD_DESTS.map((dest) => {
                  const connected = !!patch[patchKey(src.id, dest.id)];
                  return (
                    <td key={dest.id} className="patch-cell">
                      <label className="patch-pin">
                        <input
                          type="checkbox"
                          checked={connected}
                          onChange={() => toggle(src.id, dest.id)}
                          aria-label={`${src.label} → ${dest.label}`}
                        />
                        <span className="patch-pin-dot" />
                      </label>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PatchMatrix;
