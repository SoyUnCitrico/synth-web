import React, { useEffect, useRef } from 'react';
import { useIsDesktop } from '../../hooks/useIsDesktop';
import './FlowerField.css';

// ════════════════════════════════════════════════════════════════════════
// Fondo generativo de FLORES (tema "5 flor" / Macuilxochitl).
// ─────────────────────────────────────────────────────────────────────────
// Capa Canvas 2D fija a pantalla completa, DETRÁS de todo (z-index: -1, sin
// captura de eventos). Dibuja flores de 5 pétalos que derivan y rotan lento.
//
// Pensado para NO comprometer el audio: el DSP de Web Audio corre en su propio
// hilo; este render es ligero y, además, está GATEADO:
//   · solo en escritorio (useIsDesktop)
//   · respeta prefers-reduced-motion
//   · se pausa cuando la pestaña está oculta (visibilitychange)
//   · limita a ~30 FPS y topa el devicePixelRatio a 2
// ════════════════════════════════════════════════════════════════════════

interface FlowerFieldProps {
  /** `full` = landing About (más flores, más opacidad). `subtle` = detrás del sinte. */
  variant?: 'full' | 'subtle';
}

// Los 5 colores = las 5 flores/voces (paleta del códice mexica de Makwil).
const PETAL_COLORS = ['#FE0000', '#FECE01', '#19A516', '#016DCD', '#FF7A1E'];

interface Flower {
  x: number;
  y: number;
  r: number; // radio de la flor
  rot: number; // rotación actual (rad)
  rotSpeed: number; // rad/s
  vx: number; // deriva px/s
  vy: number;
  color: string;
  alpha: number;
}

const FRAME_INTERVAL = 1000 / 30; // tope ~30 FPS

const FlowerField: React.FC<FlowerFieldProps> = ({ variant = 'subtle' }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDesktop = useIsDesktop();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // No animar en móvil ni con movimiento reducido.
    if (!isDesktop) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const full = variant === 'full';
    const baseAlpha = full ? 0.5 : 0.16;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let flowers: Flower[] = [];

    const rand = (a: number, b: number) => a + Math.random() * (b - a);

    const makeFlower = (seeded = false): Flower => {
      const r = rand(full ? 22 : 16, full ? 64 : 42);
      return {
        x: rand(0, width),
        // Si no está "sembrada" (respawn), entra por abajo.
        y: seeded ? rand(0, height) : height + r,
        r,
        rot: rand(0, Math.PI * 2),
        rotSpeed: rand(-0.25, 0.25),
        vx: rand(-8, 8),
        vy: -rand(6, 22), // sube
        color: PETAL_COLORS[Math.floor(rand(0, PETAL_COLORS.length))],
        alpha: baseAlpha * rand(0.55, 1),
      };
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Densidad ~ área; menos flores en `subtle`.
      const density = full ? 26000 : 60000;
      const count = Math.max(6, Math.round((width * height) / density));
      flowers = Array.from({ length: count }, () => makeFlower(true));
    };

    const drawFlower = (f: Flower) => {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rot);
      ctx.globalAlpha = f.alpha;
      ctx.fillStyle = f.color;
      // 5 pétalos como elipses alrededor del centro.
      for (let i = 0; i < 5; i++) {
        ctx.save();
        ctx.rotate((i * Math.PI * 2) / 5);
        ctx.beginPath();
        ctx.ellipse(0, -f.r * 0.55, f.r * 0.3, f.r * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      // Corazón de la flor.
      ctx.globalAlpha = Math.min(1, f.alpha * 1.6);
      ctx.fillStyle = '#FFE066';
      ctx.beginPath();
      ctx.arc(0, 0, f.r * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    let raf = 0;
    let last = performance.now();
    let acc = 0;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = now - last;
      last = now;
      acc += dt;
      if (acc < FRAME_INTERVAL) return; // tope de FPS
      const step = acc / 1000; // s transcurridos desde el último dibujo
      acc = 0;

      ctx.clearRect(0, 0, width, height);
      for (const f of flowers) {
        f.x += f.vx * step;
        f.y += f.vy * step;
        f.rot += f.rotSpeed * step;
        // Reaparece por abajo al salir por arriba; envuelve en X.
        if (f.y < -f.r * 1.5) Object.assign(f, makeFlower(false));
        if (f.x < -f.r) f.x = width + f.r;
        else if (f.x > width + f.r) f.x = -f.r;
        drawFlower(f);
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf) {
        last = performance.now();
        acc = 0;
        raf = requestAnimationFrame(tick);
      }
    };

    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibility);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [isDesktop, variant]);

  // En móvil/reduced-motion no montamos el canvas (el efecto sale temprano, pero
  // tampoco queremos el elemento si no hay escritorio).
  if (!isDesktop) return null;

  return <canvas ref={canvasRef} className={`flower-field flower-field--${variant}`} aria-hidden="true" />;
};

export default FlowerField;
