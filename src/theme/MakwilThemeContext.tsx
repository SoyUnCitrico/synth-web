import React, { createContext, useCallback, useContext } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';
import { MAKWIL_KEYS } from '../audio/makwil/persistKeys';

/**
 * Tema visual de Makwil (códice mexica): `dark` (negro obsidiana + módulos de pergamino
 * dorado, DEFAULT) o `light` (pergamino claro + módulos de obsidiana, el aspecto original).
 *
 * Vive por encima del Router —como el TransportProvider— para que el toggle del menú del
 * header y la página Makwil compartan la MISMA instancia. La clase `theme-dark`/`theme-light`
 * la aplica Makwil al body/contenedor (ver Makwil.tsx); aquí solo vive el estado persistido.
 */
export type MakwilTheme = 'dark' | 'light';

interface MakwilThemeContextValue {
  theme: MakwilTheme;
  setTheme: (t: MakwilTheme) => void;
  toggle: () => void;
}

const MakwilThemeContext = createContext<MakwilThemeContextValue | null>(null);

export const MakwilThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = usePersistentState<MakwilTheme>(MAKWIL_KEYS.theme, 'dark');
  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), [setTheme]);

  return (
    <MakwilThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </MakwilThemeContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export function useMakwilTheme(): MakwilThemeContextValue {
  const ctx = useContext(MakwilThemeContext);
  if (!ctx) throw new Error('useMakwilTheme debe usarse dentro de <MakwilThemeProvider>');
  return ctx;
}
