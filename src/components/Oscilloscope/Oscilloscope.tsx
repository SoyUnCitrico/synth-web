import { useState, useEffect, useRef, RefObject } from 'react';
import * as d3 from 'd3';
import * as Tone from 'tone';


interface OscilloscopePros {  
    analyzerRef : React.RefObject<HTMLDivElement | HTMLElement | undefined | null> | RefObject<Tone.Analyser | null> | HTMLDivElement | null
    containerRef : React.Ref<HTMLDivElement> | undefined | null
}
// Componente para el osciloscopio
const Oscilloscope = ({analyzerRef, containerRef} : OscilloscopePros) => {
  const svgRef = useRef(null);
  const requestRef = useRef<number | null>(null);
  // const oscRef = useRef(containerRef);
  const [dimensions, setDimensions] = useState({ width: 200, height: 200 });

  useEffect(() => {
    if(analyzerRef !== null) {
      // @ts-expect-error No detecta current en HTMLElement
      if (!analyzerRef.current) return;
    }
    const svg = d3.select(svgRef.current);
    // @ts-expect-error No detecta current en HTMLElement
    const analyzer = analyzerRef?.current;
    const bufferLength = analyzer.size;
    const dataArray : Float32Array = new Float32Array(bufferLength);
    
    // Configurar elementos SVG para dibujar
    svg.selectAll("*").remove();
    
    const margin = { top: 10, right: 10, bottom: 10, left: 10 };
    const width = dimensions.width - margin.left - margin.right;
    const height = dimensions.height - margin.top - margin.bottom;
    
    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
    
    // Escala X (tiempo)
    const x = d3.scaleLinear()
      .domain([0, bufferLength - 1])
      .range([0, width]);
    
    // Escala Y (amplitud)
    const y = d3.scaleLinear()
      .domain([-1, 1])
      .range([height, 0]);
    
    // Línea de la forma de onda
    const line = d3.line()
      // @ts-expect-error Verificar elementos en d3.line
      .x((d,i) => x(i))
        // @ts-expect-error Verificar elementos en d3.line
      .y((d) => y(d))
      .curve(d3.curveLinear);
    
    // Crear elemento de línea
    const path = g.append("path")
      .attr("class", "waveform")
      .attr("fill", "none")
      .attr("stroke", "#18860e") // #18860e
      .attr("stroke-width", 2);
    
    // Línea del centro (0)
    g.append("line")
      .attr("x1", 0)
      .attr("y1", y(0))
      .attr("x2", width)
      .attr("y2", y(0))
      .attr("stroke", "#94a3b8") // gris
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "4,4");
    
    // Función para animar la visualización
    const animate = () => {
      requestRef.current = requestAnimationFrame(animate);      
      // Obtener los datos de audio actuales
      analyzer.getValue().forEach((value: number, i : number) => {
        dataArray[i] = value;
      });
      
      // Actualizar la forma de onda
      // @ts-expect-error Verificar d3.line
      path.attr("d", line(dataArray));
    };
    
    // Iniciar animación
    animate();
    
    // Limpieza
    return () => {
      if(requestRef.current !== null) {
        cancelAnimationFrame(requestRef.current);        
      }
    };
  }, [analyzerRef, dimensions]);

  useEffect(() => {
    if(containerRef) {      
        setDimensions({
            // @ts-expect-error Offset width existe en HTMLDivElement de donde se toma referencia
            width: containerRef.current.offsetWidth - 50,
            height: 200
        })
    }
  }, [containerRef])
  
  return (
    
    <div ref={containerRef} className="module-big">
        <div className="module-header">
            <h2>Osciloscopio</h2>
        </div>
        <svg
            ref={svgRef}
            width={dimensions.width}
            height={dimensions.height}
        />
    </div>
  );
}

export default Oscilloscope;