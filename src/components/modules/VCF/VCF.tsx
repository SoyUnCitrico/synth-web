import React from 'react';
import Knob from '../../Knob/Knob';
import FrequencyInput from '../../FrequencyInput/FrequencyInput';
import { AUDIO_FREQ_SCALE } from '../../../utils/scale';
import './VCF.css';

// Definir los tipos de filtro que soportamos
type FilterType = 'lowpass' | 'highpass' | 'bandpass' | 'notch' | 'allpass';

interface VCFProps {
  filterType: BiquadFilterType;
  setFilterType: (type: BiquadFilterType) => void;
  frequency: number;
  setFrequency: (freq: number) => void;
  resonance: number;
  setResonance: (res: number) => void;
}

export const VCF: React.FC<VCFProps> = ({
  filterType,
  setFilterType,
  frequency,
  setFrequency,
  resonance,
  setResonance
}) => {
  // Lista de tipos de filtro disponibles
  const filterTypes: FilterType[] = ['lowpass', 'highpass', 'bandpass', 'notch', 'allpass'];
  
  // Manejador para cambiar el tipo de filtro
  const handleFilterTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilterType(e.target.value as BiquadFilterType);
  };
  
  // Función para crear la curva de respuesta del filtro (visualización)
  const createFilterCurve = () => {
    const width = 100;
    const height = 50;
    const margin = 5;
    const availableHeight = height - 2 * margin;
    
    // Puntos para dibujar la respuesta del filtro
    let points: string = '';
    
    // Punto inicial
    points += `${margin},${height - margin} `;
    
    // Generar puntos según el tipo de filtro
    for (let x = 0; x <= width - 2 * margin; x++) {
      const normalizedX = x / (width - 2 * margin); // 0 a 1
      let y = 0;
      
      // Simular diferentes tipos de filtro
      switch (filterType) {
        case 'lowpass':
          // Curva simple para lowpass
          y = availableHeight * (1 - Math.min(1, Math.pow(normalizedX * 1, 8 / resonance)));
          // y = Math.log10(y) + 25;
          break;
        case 'highpass':
          // Invertir la curva para highpass
          y = availableHeight * Math.min(1, Math.pow(normalizedX * 1, resonance / 2));
          break;
        case 'bandpass': {
          // Forma de campana para bandpass
          const centerFilter = 0.5;
          const widthFilter = 0.3 / resonance;
          y = availableHeight * (1 - Math.min(1, Math.pow(Math.abs(normalizedX - centerFilter) / widthFilter, 2)));
          break;
        }
        case 'notch': {
          // Forma de U invertida para notch
          const notchCenter = 0.5;
          const notchWidth = 0.2 / resonance;
          y = availableHeight * Math.min(1, Math.pow(Math.abs(normalizedX - notchCenter) / notchWidth, 1.5));
          break;
        }
        case 'allpass':
          // Línea plana con pequeña fase para allpass
          y = availableHeight * 0.5;
          break;
        default:
          y = availableHeight * (1 - normalizedX);
      }
      
      // Añadir punto a la curva
      points += `${x + margin},${height - margin - y} `;
    }
    
    // Punto final
    points += `${width - margin},${height - margin}`;
    // console.log(points)
    return points;
  };

  // Visualización de la posición del filtro en el espectro (misma escala log que la perilla).
  const filterPosition = AUDIO_FREQ_SCALE.toPosition(frequency) * 100;

  return (
    <div 
      className="module vcf-module"
      data-filter-type={filterType}>
      <div className="module-header">
        <h2>VCF</h2>
      </div>
      <div className="module-controls">
        <div className="control-group">
          <label htmlFor="filter-type">Tipo de Filtro</label>
          <select 
            id="filter-type" 
            value={filterType}
            onChange={handleFilterTypeChange}
            className="control-select"
          >
            {filterTypes.map(type => (
              <option key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
        </div>
        
        <div className="filter-display">
          <div className="filter-curve">
            <svg viewBox="0 0 100 50" className="filter-svg">
              <polyline 
                points={createFilterCurve()}
                fill="none" 
                strokeWidth="2"
              />
              {/* Línea vertical que indica la frecuencia de corte actual */}
              <line 
                x1={filterPosition} 
                y1="5" 
                x2={filterPosition} 
                y2="45" 
                stroke="#f0f0f0" 
                strokeWidth="1"
                strokeDasharray="2,2"
              />
            </svg>
          </div>
        </div>
        
        <div className="control-group">
          <label htmlFor="filter-freq">Frecuencia de corte (log)</label>
          <FrequencyInput
            id="filter-freq"
            value={frequency}
            onChange={setFrequency}
            min={20}
            max={20000}
            defaultValue={20000}
          />
          {/* Perilla con escala logarítmica en el rango auditivo (20 Hz – 20 kHz). */}
          <div style={{ display: 'flex', gap: '4rem', alignItems: 'center', margin: 'auto' }}>
            <Knob
              label="Cutoff"
              value={frequency}
              scale={AUDIO_FREQ_SCALE}
              step={1}
              display={`${frequency.toFixed(0)} Hz`}
              onChange={setFrequency}
            />
            {/* <label htmlFor="filter-res">Resonancia</label> */}
            <Knob
              id="filter-res"
              label="Res"
              value={resonance}
              min={0.1}
              max={20}
              step={0.1}
              display={resonance.toFixed(1)}
              onChange={setResonance}
            />
            </div>
        </div>
      </div>
    </div>
  );
};