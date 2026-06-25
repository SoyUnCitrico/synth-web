import React from 'react';
import Knob from '../../Knob/Knob';
import { AUDIO_FREQ_SCALE } from '../../../utils/scale';
import type { Vcf2Type, Vcf2Source } from '../../../audio/useSynthEngine';
import './VCF2.css';

interface VCF2Props {
  type: Vcf2Type;
  setType: (t: Vcf2Type) => void;
  freq: number;
  setFreq: (f: number) => void;
  res: number;
  setRes: (r: number) => void;
  /** Selección única (Modulor). Omitir si se usa multi-fuente. */
  source?: Vcf2Source;
  setSource?: (s: Vcf2Source) => void;
  /**
   * Multi-fuente (Makwil): si se pasan, el patch admite VARIAS voces a la vez por el filtro.
   * Tienen prioridad sobre `source`/`setSource` (que se mantienen para Modulor, selección única).
   */
  sources?: Exclude<Vcf2Source, 'none'>[];
  setSources?: (s: Exclude<Vcf2Source, 'none'>[]) => void;
  /** Título del módulo (por defecto "VCF 2"). Permite reusar el componente como VCF 3. */
  title?: string;
  /** Prefijo de ids estables (por defecto "vcf2"); usado para inputs y MIDI-learn. */
  idPrefix?: string;
}

const TYPES: { value: Vcf2Type; label: string }[] = [
  { value: 'lowpass', label: 'LPF' },
  { value: 'highpass', label: 'HPF' },
  { value: 'bandpass', label: 'BPF' },
];

const SOURCES: { value: Exclude<Vcf2Source, 'none'>; label: string }[] = [
  { value: 'vco1', label: 'VCO 1' },
  { value: 'vco2', label: 'VCO 2' },
  { value: 'vco3', label: 'VCO 3' },
  { value: 'vco4', label: 'VCO 4' },
];

// Segundo VCF: insert de 2 polos (LPF/HPF/BPF) sobre UNA voz, con su propio routeo (fuera de
// la matriz de modulación). En vez de display de onda, muestra el "patch": 3 checkboxes de
// selección única (o ninguna) que eligen el VCO que pasa por este filtro.
export const VCF2: React.FC<VCF2Props> = ({
  type,
  setType,
  freq,
  setFreq,
  res,
  setRes,
  source = 'none',
  setSource,
  sources,
  setSources,
  title = 'VCF 2',
  idPrefix = 'vcf2',
}) => {
  // Multi-fuente activa si se proveen sources/setSources (Makwil); si no, selección única (Modulor).
  const multi = !!setSources;
  const isOn = (v: Exclude<Vcf2Source, 'none'>) => (multi ? (sources ?? []).includes(v) : source === v);
  const toggle = (v: Exclude<Vcf2Source, 'none'>) => {
    if (multi) {
      const cur = sources ?? [];
      setSources!(cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]);
    } else {
      setSource?.(source === v ? 'none' : v);
    }
  };
  return (
    <div className="module vcf2-module" data-filter-type={type}>
      <div className="module-header">
        <h2>{title}</h2>
      </div>
      <div className="module-controls">
        <div className="control-group">
          <label htmlFor={`${idPrefix}-type`}>Tipo (2 polos)</label>
          <select
            id={`${idPrefix}-type`}
            className="control-select"
            value={type}
            onChange={(e) => setType(e.target.value as Vcf2Type)}
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="vcf2-knobs">
          <Knob
            label="Freq"
            value={freq}
            scale={AUDIO_FREQ_SCALE}
            step={1}
            display={`${freq.toFixed(0)} Hz`}
            onChange={setFreq}
            midiId={`${idPrefix}-freq`}
          />
          <Knob
            label="Reson."
            value={res}
            min={0.1}
            max={20}
            step={0.1}
            display={res.toFixed(1)}
            onChange={setRes}
            midiId={`${idPrefix}-res`}
          />
        </div>

        {/* Patch de routeo: selecciona la(s) voz(ces) fuente. En Makwil admite varias a la vez. */}
        <div className="control-group">
          <label>Fuente (patch)</label>
          <div className="checkbox-group vcf2-patch">
            {SOURCES.map((s) => (
              <label key={s.value} className="checkbox-option" title={`Enrutar ${s.label} por ${title}`}>
                <input
                  type="checkbox"
                  checked={isOn(s.value)}
                  onChange={() => toggle(s.value)}
                />
                {s.label}
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
