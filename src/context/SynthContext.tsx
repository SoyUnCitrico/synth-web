import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import SynthModel from '../models/synth/SynthModel';
import SynthController from '../controllers/synth/SynthController';
import KeyboardController from '../controllers/synth/KeyboardController';
import { SynthParams, KeyboardState } from '../models/synth/types';

interface SynthContextValue {
  // Controladores
  synthController: SynthController;
  keyboardController: KeyboardController;
  
  // Estado
  params: SynthParams;
  keyboardState: KeyboardState;
  isPlaying: boolean;
  
  // Métodos para actualizar
  setParams: (params: Partial<SynthParams>) => void;
}

const SynthContext = createContext<SynthContextValue | null>(null);

export const SynthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Crear modelo y controladores
  const model = useMemo(() => new SynthModel(), []);
  const synthController = useMemo(() => new SynthController(model), [model]);
  const keyboardController = useMemo(() => new KeyboardController(model), [model]);
  
  // Estado local para forzar re-renders
  const [params, setParamsState] = useState<SynthParams>(model.getParams());
  const [keyboardState, setKeyboardState] = useState<KeyboardState>(model.getKeyboardState());
  const [isPlaying, setIsPlaying] = useState<boolean>(model.isPlaying());
  
  // Inicializar al montar
  useEffect(() => {
    synthController.initialize();
    const cleanupKeyboard = keyboardController.setupKeyboardEvents();
    
    // Limpiar al desmontar
    return () => {
      cleanupKeyboard();
      synthController.cleanup();
    };
  }, [synthController, keyboardController]);
  
  // Actualizar estado local cuando cambian los parámetros
  const setParams = (newParams: Partial<SynthParams>) => {
    synthController.updateParams(newParams);
    setParamsState(synthController.getParams());
  };
  
  // Poll para actualizar el estado desde el modelo
  useEffect(() => {
    const intervalId = setInterval(() => {
      setKeyboardState(model.getKeyboardState());
      setIsPlaying(model.isPlaying());
    }, 100);
    
    return () => clearInterval(intervalId);
  }, [model]);
  
  const contextValue = useMemo<SynthContextValue>(
    () => ({
      synthController,
      keyboardController,
      params,
      keyboardState,
      isPlaying,
      setParams
    }),
    [synthController, keyboardController, params, keyboardState, isPlaying]
  );
  
  return (
    <SynthContext.Provider value={contextValue}>
      {children}
    </SynthContext.Provider>
  );
};

export const useSynthContext = () => {
  const context = useContext(SynthContext);
  if (!context) {
    throw new Error('useSynthContext must be used within a SynthProvider');
  }
  return context;
};
