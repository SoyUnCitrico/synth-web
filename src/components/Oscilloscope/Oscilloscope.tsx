import React, { useRef, useEffect } from 'react';
import { useOscilloscope } from '../../hooks/useOscilloscope';
// import './Oscilloscope.css';

const Oscilloscope: React.FC = () => {
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
  
  // Usar el hook para dibujar la forma de onda
  useOscilloscope(canvasRef as React.RefObject<HTMLCanvasElement>);
  
  return (
    <div className="oscilloscope-module">
      <h2>Oscilloscope</h2>
      <div className="oscilloscope-canvas-container">
        <canvas ref={canvasRef} className="oscilloscope-canvas" />
      </div>
    </div>
  );
};

export default Oscilloscope;