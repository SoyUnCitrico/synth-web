import React, { useRef, useEffect } from 'react';
import { useSpectrum } from '../../hooks/useSpectrum';
// import './Spectrum.css';

const SpectrumAnalyzer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Asegurar que el canvas tenga el tamaño correcto
  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const parent = canvas.parentElement;
      
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      }
    }
  }, []);
  
  // Usar el hook para dibujar el espectro
  useSpectrum(canvasRef as React.RefObject<HTMLCanvasElement>);
  
  return (
    <div className="spectrum-module">
      <h2>Spectrum Analyzer</h2>
      <div className="spectrum-canvas-container">
        <canvas ref={canvasRef} className="spectrum-canvas" />
      </div>
    </div>
  );
};

export default SpectrumAnalyzer;