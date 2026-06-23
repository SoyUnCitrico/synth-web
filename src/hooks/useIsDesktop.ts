import { useEffect, useState } from 'react';

/**
 * Devuelve `true` en viewports de escritorio (≥ 769px, el mismo umbral que el breakpoint
 * móvil de App.css). Se suscribe a los cambios de tamaño vía matchMedia. Tolera entornos
 * sin matchMedia (SSR/tests): cae a `false`.
 *
 * Pensado para gatear trabajo de render costoso (p. ej. el fondo generativo) y no gastar
 * batería/CPU en móvil.
 */
export function useIsDesktop(minWidth = 769): boolean {
  const query = `(min-width: ${minWidth}px)`;
  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    setIsDesktop(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);

  return isDesktop;
}
