import React, { useState } from 'react';
import type { Preset } from '../../presets/types';
import { serializePresets, parsePresets } from '../../presets/io';
import './Presets.css';

interface PresetsProps<S> {
  presets: Preset<S>[];
  onSave: (name: string) => void;
  onLoad: (name: string) => void;
  onDelete: (name: string) => void;
  onImport: (presets: Preset<S>[]) => void;
}

function Presets<S>({ presets, onSave, onLoad, onDelete, onImport }: PresetsProps<S>) {
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
    </div>
  );
}

export default Presets;
