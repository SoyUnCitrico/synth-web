import { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface SpectrumProps {
    fftAnalyzerRef : any
    specRef : any
}

const SpectrumAnalyzer = ({ fftAnalyzerRef, specRef } : SpectrumProps) => {
    const svgRef = useRef(null);
    const requestRef = useRef<any>(null);
    const [dimensions, setDimensions] = useState({ width: 600, height: 200 });
  
    useEffect(() => {
      if (!fftAnalyzerRef.current) return;
      
      const svg = d3.select(svgRef.current);
      const analyzer = fftAnalyzerRef.current;
      const bufferLength = analyzer.size;
      
      // Configurar elementos SVG para dibujar
      svg.selectAll("*").remove();
      
      const margin = { top: 10, right: 10, bottom: 30, left: 40 };
      const width = dimensions.width - margin.left - margin.right;
      const height = dimensions.height - margin.top - margin.bottom;
      
      const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
      
      // Escala X (frecuencia)
      const x = d3.scaleLog()
        .domain([20, 20000]) // Rango audible en Hz
        .range([0, width]);
      
      // Eje X (frecuencia)
      const xAxis = g.append("g")
        .attr("transform", `translate(0,${height})`)
        // @ts-ignore
        .call(d3.axisBottom(x)
          .tickValues([20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000])
        //   @ts-ignore
          .tickFormat(d => {
            // @ts-ignore
            if (d >= 1000) {
                 // @ts-ignore
              return `${d/1000}k`;
            }
            return d;
          })
        );
      
      // Estilo del eje X
      xAxis.selectAll("text")
        .attr("fill", "#e2e8f0")
        .attr("font-size", "10px");
      
      xAxis.selectAll("line")
        .attr("stroke", "#64748b");
      
      xAxis.select("path")
        .attr("stroke", "#64748b");
      
      // Escala Y (amplitud en dB)
      const y = d3.scaleLinear()
        .domain([-100, 0]) // dB
        .range([height, 0]);
      
      // Eje Y (amplitud)
      const yAxis = g.append("g")
        .call(d3.axisLeft(y)
          .tickValues([-100, -80, -60, -40, -20, 0])
        );
      
      // Estilo del eje Y
      yAxis.selectAll("text")
        .attr("fill", "#e2e8f0")
        .attr("font-size", "10px");
      
      yAxis.selectAll("line")
        .attr("stroke", "#64748b");
      
      yAxis.select("path")
        .attr("stroke", "#64748b");

      // Etiqueta eje Y
      svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 5)
        .attr("x", -height / 2 - 10)
        .attr("fill", "#e2e8f0")
        .attr("font-size", "10px")
        .attr("text-anchor", "middle")
        .text("Amplitud (dB)");
      
      // Crear barras para el espectro
      const barWidth = width / bufferLength; // Más delgado que el total de bins      

      // // Función para calcular el índice de bin FFT de una frecuencia
      // const freqToIndex = (freq : any) => {
      //   return Math.round(freq * bufferLength / analyzer.context.sampleRate);
      // };
      
      // Array de frecuencias para visualizar (escala logarítmica)
      const frequencies : Array<any> = [];
      for (let i = 0; i < 100; i++) {
        const freq = 20 * Math.pow(10, i * 3 / 100);
        if (freq <= 20000) {
          frequencies.push(freq);
        }
      }
      
      // Crear grupo para las barras
      const barsGroup = g.append("g");
      
      // Función para animar la visualización
      const animate = () => {
        requestRef.current = requestAnimationFrame(animate);
        
        // Obtener los datos de espectro actuales
        const fftValues = analyzer.getValue();
        
        // Limpiar barras existentes
        barsGroup.selectAll("rect").remove();
        
        // console.log(fftValues)
        // Crear barras para cada frecuencia
        fftValues.forEach((freq : any, index : number) => {          
            if(freq !== -Infinity && freq < 0) {
              const value = freq;              
              // console.log(value);
              // Crear barra
              barsGroup.append("rect")
                // .attr("transform", "rotate(180)")
                .attr("x", index * barWidth)
                .attr("y", y(value))
                .attr("width", barWidth)
                .attr("height", height - y(value))
                .attr("fill", d3.interpolateInferno(1 + value / 100)); // Color basado en intensidad
                 
              // }
            }
        });
      };
      
      // Iniciar animación
      animate();
      
      // Limpieza
      return () => {
        cancelAnimationFrame(requestRef.current);
      };
    }, [fftAnalyzerRef, dimensions]);
    

    useEffect(() => {
      if(!!specRef) {
          setDimensions({
              width: specRef.current.offsetWidth -50,
              height: 200
          })
      }
    }, [specRef])

    return (
      <div className="module-big">
        <div className="module-header header-big">
            <h2>Espectro</h2>
        </div>
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
        />
      </div>
    );
  }

export default SpectrumAnalyzer;