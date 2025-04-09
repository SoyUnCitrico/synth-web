import React from 'react';
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
  
  // Manejador para cambiar la frecuencia del filtro
  const handleFrequencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFrequency(parseFloat(e.target.value));
  };
  
  // Manejador para cambiar la resonancia del filtro
  const handleResonanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setResonance(parseFloat(e.target.value));
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
        case 'bandpass':
          // Forma de campana para bandpass
          const center = 0.5;
          const width = 0.3 / resonance;
          y = availableHeight * (1 - Math.min(1, Math.pow(Math.abs(normalizedX - center) / width, 2)));
          break;
        case 'notch':
          // Forma de U invertida para notch
          const notchCenter = 0.5;
          const notchWidth = 0.2 / resonance;
          y = availableHeight * Math.min(1, Math.pow(Math.abs(normalizedX - notchCenter) / notchWidth, 1.5));
          break;
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

  // Calcular el valor logarítmico para la visualización de la frecuencia
  const logFrequencyScale = (frequency: number) => {
    const minFreq = Math.log10(20);
    const maxFreq = Math.log10(20000);
    const logFreq = Math.log10(frequency);
    return (logFreq - minFreq) / (maxFreq - minFreq);
  };

  // Visualización de la posición del filtro en el espectro
  const filterPosition = logFrequencyScale(frequency) * 100;

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
          <label htmlFor="filter-freq">Frecuencia: {frequency.toFixed(0)} Hz</label>
          <input 
              type="number"           
              value={frequency}
              onChange={handleFrequencyChange}
              className="control-input"
            />
          <input 
            type="range" 
            id="filter-freq" 
            min="20" 
            max="20000" 
            step="1" 
            value={frequency}
            onChange={handleFrequencyChange}
            className="control-slider"
          />
        </div>
        
        <div className="control-group">
          <label htmlFor="filter-res">Resonancia: {resonance.toFixed(1)}</label>
          <input 
            type="range" 
            id="filter-res" 
            min="0.1" 
            max="20" 
            step="0.1" 
            value={resonance}
            onChange={handleResonanceChange}
            className="control-slider"
          />
        </div>
      </div>
    </div>
  );
};