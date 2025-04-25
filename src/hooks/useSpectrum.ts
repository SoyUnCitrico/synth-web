import { useRef, useEffect } from 'react';
import { useSynthContext } from '../context/SynthContext';

export function useSpectrum(canvasRef: React.RefObject<HTMLCanvasElement>) {
  const { synthController } = useSynthContext();
  const animationFrameRef = useRef<number | null>(null);
  
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const drawSpectrum = () => {
      const data = synthController.getSpectrumData();
      
      // Limpiar canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Configurar estilo
      ctx.fillStyle = '#ff0000';
      
      // Dibujar espectro
      const barWidth = canvas.width / data.length;
      let x = 0;
      
      for (let i = 0; i < data.length; i++) {
        // Convertir a escala logarítmica para visualización
        const barHeight = Math.max(0, (data[i] + 140) * canvas.height / 140);
        
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth;
      }
      
      // Continuar animación
      animationFrameRef.current = requestAnimationFrame(drawSpectrum);
    };
    
    // Iniciar animación
    drawSpectrum();
    
    // Limpiar al desmontar
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [canvasRef, synthController]);
}