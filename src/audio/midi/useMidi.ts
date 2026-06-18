import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Entrada MIDI (Web MIDI API) para el sinte.
 *
 * Parsea note on/off y Control Change de TODAS las entradas conectadas y los reenvía a los
 * callbacks del consumidor (BasicSynth). El mapa CC→slot y el slot en "aprendizaje" se leen
 * por ref para no re-suscribir los listeners en cada cambio (mismo patrón que gatePatchRef).
 *
 * Web MIDI sólo existe en contexto seguro (localhost/https) y en navegadores basados en
 * Chromium (Chrome/Edge/Opera) y Firefox reciente; Safari no lo soporta. Si no está
 * disponible, `supported` queda en false y el resto del sinte sigue funcionando.
 */

export interface UseMidiArgs {
  /** Note-on: número de nota MIDI (0..127) y velocidad normalizada (0..1). */
  onNoteOn: (note: number, velocity: number) => void;
  /** Note-off: número de nota MIDI (0..127). */
  onNoteOff: (note: number) => void;
  /** Control Change de un slot mapeado: índice de slot y valor normalizado (0..1). */
  onCC: (slot: number, value: number) => void;
  /** Aprendizaje: se recibió un CC mientras un slot estaba en "learn". */
  onLearned: (slot: number, cc: number) => void;
  /** Mapa actual slot→número de CC (null = sin asignar), leído por ref. */
  midiMapRef: React.RefObject<(number | null)[]>;
  /** Slot en aprendizaje (o null), leído por ref. */
  learningRef: React.RefObject<number | null>;
}

export interface UseMidiResult {
  /** El navegador/contexto soporta Web MIDI. */
  supported: boolean;
  /** El acceso MIDI ya fue concedido y los listeners están activos. */
  enabled: boolean;
  /** Nombres de los dispositivos de entrada conectados. */
  deviceNames: string[];
  /** Contador de actividad (se incrementa con cada mensaje; útil para un LED). */
  activity: number;
  /** Solicita acceso MIDI (requiere gesto del usuario). */
  enable: () => Promise<void>;
}

export function useMidi({
  onNoteOn,
  onNoteOff,
  onCC,
  onLearned,
  midiMapRef,
  learningRef,
}: UseMidiArgs): UseMidiResult {
  const supported = typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function';
  const [enabled, setEnabled] = useState(false);
  const [deviceNames, setDeviceNames] = useState<string[]>([]);
  const [activity, setActivity] = useState(0);

  const accessRef = useRef<MIDIAccess | null>(null);

  // Callbacks por ref para que el handler de mensajes no dependa de su identidad.
  const cbRef = useRef({ onNoteOn, onNoteOff, onCC, onLearned });
  cbRef.current = { onNoteOn, onNoteOff, onCC, onLearned };

  const handleMessage = useCallback(
    (ev: MIDIMessageEvent) => {
      const data = ev.data;
      if (!data) return;
      const [status, data1, data2] = data;
      const command = status & 0xf0;
      const cb = cbRef.current;
      setActivity((a) => a + 1);

      if (command === 0x90 && data2 > 0) {
        cb.onNoteOn(data1, data2 / 127);
      } else if (command === 0x80 || (command === 0x90 && data2 === 0)) {
        cb.onNoteOff(data1);
      } else if (command === 0xb0) {
        const learning = learningRef.current;
        if (learning != null) {
          cb.onLearned(learning, data1);
          return;
        }
        const map = midiMapRef.current;
        for (let slot = 0; slot < map.length; slot++) {
          if (map[slot] === data1) cb.onCC(slot, data2 / 127);
        }
      }
    },
    [midiMapRef, learningRef],
  );

  // (Re)engancha el listener a todas las entradas y refresca la lista de dispositivos.
  const bindInputs = useCallback(
    (access: MIDIAccess) => {
      const names: string[] = [];
      access.inputs.forEach((input) => {
        input.onmidimessage = handleMessage;
        names.push(input.name ?? 'MIDI');
      });
      setDeviceNames(names);
    },
    [handleMessage],
  );

  const enable = useCallback(async () => {
    if (!supported || accessRef.current) return;
    const access = await navigator.requestMIDIAccess!({ sysex: false });
    accessRef.current = access;
    access.onstatechange = () => bindInputs(access);
    bindInputs(access);
    setEnabled(true);
  }, [supported, bindInputs]);

  // Limpieza: suelta los listeners al desmontar.
  useEffect(() => {
    return () => {
      const access = accessRef.current;
      if (!access) return;
      access.inputs.forEach((input) => {
        input.onmidimessage = null;
      });
      access.onstatechange = null;
    };
  }, []);

  return { supported, enabled, deviceNames, activity, enable };
}
