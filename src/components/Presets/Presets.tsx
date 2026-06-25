import React, { useState } from 'react';
import type { Preset } from '../../presets/types';
import { serializePresets, parsePresets } from '../../presets/io';
import './Presets.css';

/** Controles opcionales de sincronización con la nube (Google Sheet). */
interface CloudProps {
  /** Clave secreta de escritura (input). */
  key: string;
  onKeyChange: (key: string) => void;
  /** Descarga el banco de la hoja. */
  onLoad: () => void;
  busy?: boolean;
  status?: string | null;
}

interface PresetsProps<S> {
  presets: Preset<S>[];
  onSave: (name: string) => void;
  onLoad: (name: string) => void;
  onDelete: (name: string) => void;
  onImport: (presets: Preset<S>[]) => void;
  /** Si viene, se muestra la fila de sincronización con la nube. */
  cloud?: CloudProps;
}

function Presets<S>({ presets, onSave, onLoad, onDelete, onImport, cloud }: PresetsProps<S>) {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState('');

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(name);
    setSelected(name.trim());
  };

  const handleExport = () => {
    const blob = new Blob([serializePresets(presets)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'synth-presets.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite reimportar el mismo archivo
    if (!file) return;
    file
      .text()
      .then((text) => onImport(parsePresets(text)))
      .catch(() => alert('Archivo de presets no válido'));
  };

  return (
    <div className="preset-bar">
      <span className="preset-bar-title">Presets</span>

      <div className="preset-group">
        <input
          type="text"
          className="control-input preset-name"
          placeholder="Nombre…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        />
        <button className="preset-btn" onClick={handleSave} disabled={!name.trim()}>
          Guardar
        </button>
      </div>

      <div className="preset-group">
        <select
          className="control-select"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">— Presets ({presets.length}) —</option>
          {presets.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>
        <button className="preset-btn" onClick={() => selected && onLoad(selected)} disabled={!selected}>
          Cargar
        </button>
        <button className="preset-btn danger" onClick={() => selected && onDelete(selected)} disabled={!selected}>
          Borrar
        </button>
      </div>

      <div className="preset-group">
        <button className="preset-btn" onClick={handleExport} disabled={presets.length === 0}>
          Exportar
        </button>
        <label className="preset-btn preset-import">
          Importar
          <input type="file" accept="application/json,.json" onChange={handleImport} hidden />
        </label>
      </div>

      {cloud && (
        <div className="preset-group">
          <input
            type="password"
            className="control-input preset-cloud-key"
            placeholder="Clave nube…"
            value={cloud.key}
            onChange={(e) => cloud.onKeyChange(e.target.value)}
            autoComplete="off"
          />
          <button className="preset-btn" onClick={cloud.onLoad} disabled={cloud.busy}>
            Cargar nube
          </button>
          {cloud.status && <span className="preset-cloud-status">{cloud.status}</span>}
        </div>
      )}
    </div>
  );
}

export default Presets;
