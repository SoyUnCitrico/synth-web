import SynthModel from '../../models/synth/SynthModel';
import { KeyboardState } from '../../models/synth/types';

// Mapeo de teclas a notas
const KEY_MAP: Record<string, string> = {
  'z': 'C',
  's': 'C#',
  'x': 'D',
  'd': 'D#',
  'c': 'E',
  'v': 'F',
  'g': 'F#',
  'b': 'G',
  'h': 'G#',
  'n': 'A',
  'j': 'A#',
  'm': 'B',
  ',': 'C', // Octava superior
  'l': 'C#',
  '.': 'D',
  'ñ': 'D#',
  '-': 'E',
};

export default class KeyboardController {
  private model: SynthModel;

  constructor(model: SynthModel) {
    this.model = model;
  }

  // Inicializar eventos de teclado
  public setupKeyboardEvents(): () => void {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      
      const key = event.key.toLowerCase();
      const keyboardState = this.model.getKeyboardState();
      const activeNotes = keyboardState.activeNotes;
      const octave = keyboardState.octave;

      // Cambiar octava
      if (key === 'q' && octave > 1) {
        this.model.setKeyboardState({ octave: octave - 1 });
        return;
      }
      
      if (key === 'e' && octave < 7) {
        this.model.setKeyboardState({ octave: octave + 1 });
        return;
      }
      
      // Verificar si la tecla corresponde a una nota
      if (KEY_MAP[key] && !activeNotes[key]) {
        // Determinar la octava adecuada
        const noteOctave = [',', 'l', '.', 'ñ', '-'].includes(key) ? octave + 1 : octave;
        const note = `${KEY_MAP[key]}${noteOctave}`;
        
        // Tocar la nota
        this.model.playNote(note);
        
        // Actualizar el estado de teclas activas
        const newActiveNotes = { ...activeNotes, [key]: note };
        this.model.setKeyboardState({ activeNotes: newActiveNotes });
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const activeNotes = this.model.getKeyboardState().activeNotes;
      
      // Si la tecla liberada corresponde a una nota activa
      if (activeNotes[key]) {
        // Detener la nota si no hay otras teclas activas
        if (Object.keys(activeNotes).length === 1) {
          this.model.stopNote();
        }
        
        // Actualizar el estado de teclas activas
        const newActiveNotes = { ...activeNotes };
        delete newActiveNotes[key];
        this.model.setKeyboardState({ activeNotes: newActiveNotes });
      }
    };

    // Añadir event listeners
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Devolver función de limpieza
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }

  // Controlar el teclado virtual
  public handleNotePress(note: string): void {
    this.model.playNote(note);
  }

  public handleNoteRelease(): void {
    this.model.stopNote();
  }

  // Getters
  public getKeyboardState(): KeyboardState {
    return this.model.getKeyboardState();
  }
}