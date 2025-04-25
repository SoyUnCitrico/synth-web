import { useRef, useEffect } from 'react';
import { useSynthContext } from '../context/SynthContext';

export function useOscilloscope(canvasRef: React.RefObject<HTMLCanvasElement>) {
  const { synthController } = useSynthContext();
  const animationFrameRef = useRef<number | null>(null);
  
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const drawWaveform = () => {
      const data = synthController.getWaveformData();
      
      // Limpiar canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Configurar estilo
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#00ff00';
      ctx.beginPath();
      
      // Dibujar forma de onda
      const sliceWidth = canvas.width / data.length;
      let x = 0;
      
      for (let i = 0; i < data.length; i++) {
        const y = (data[i] * 0.5 + 0.5) * canvas.height;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        
        x += sliceWidth;
      }
      
      ctx.stroke();
      
      // Continuar animación
      animationFrameRef.current = requestAnimationFrame(drawWaveform);
    };
    
    // Iniciar animación
    drawWaveform();
    
    // Limpiar al desmontar
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [canvasRef, synthController]);
}