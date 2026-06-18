/**
 * Declaración ambiente mínima de la Web MIDI API (no incluida en lib.dom por defecto).
 * Sólo cubre lo que usa el hook useMidi; no pretende ser completa.
 */

interface MIDIMessageEvent extends Event {
  readonly data: Uint8Array;
}

interface MIDIConnectionEvent extends Event {
  readonly port: MIDIPort;
}

interface MIDIPort {
  readonly id: string;
  readonly name?: string;
  readonly manufacturer?: string;
  readonly type: 'input' | 'output';
  readonly state: 'connected' | 'disconnected';
}

interface MIDIInput extends MIDIPort {
  onmidimessage: ((this: MIDIInput, ev: MIDIMessageEvent) => void) | null;
}

interface MIDIInputMap {
  forEach(callback: (input: MIDIInput, key: string, map: MIDIInputMap) => void): void;
  readonly size: number;
}

interface MIDIAccess extends EventTarget {
  readonly inputs: MIDIInputMap;
  onstatechange: ((this: MIDIAccess, ev: MIDIConnectionEvent) => void) | null;
}

interface MIDIOptions {
  sysex?: boolean;
  software?: boolean;
}

interface Navigator {
  requestMIDIAccess?(options?: MIDIOptions): Promise<MIDIAccess>;
}
