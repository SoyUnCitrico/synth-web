import React from 'react';
import { useSynthContext } from '../../context/SynthContext';
import './Keyboard.css';

const Keyboard: React.FC = () => {
  const { keyboardController, keyboardState, isPlaying } = useSynthContext();
  
  const handleNotePress = (note: string) => {
    keyboardController.handleNotePress(note);
  };
  
  const handleNoteRelease = () => {
    keyboardController.handleNoteRelease();
  };
  
  const renderWhiteKeys = () => {
    const whiteNotes = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C', 'D', 'E'];
    const octave = keyboardState.octave;
    
    return whiteNotes.map((note, index) => {
      // Determinar la octava adecuada (las últimas notas están en octava superior)
      const noteOctave = index >= 7 ? octave + 1 : octave;
      const fullNote = `${note}${noteOctave}`;
      
      return (
        <button
          key={`${note}${noteOctave}`}
          className={`play-button ${isPlaying ? 'active' : ''}`}
          onMouseDown={() => handleNotePress(fullNote)}
          onMouseUp={handleNoteRelease}
          onTouchStart={() => handleNotePress(fullNote)}
          onTouchEnd={handleNoteRelease}
        >
          {note}
        </button>
      );
    });
  };
  
  const renderBlackKeys = () => {
    const blackNotes = ['C#', 'D#', null, 'F#', 'G#', 'A#', null, 'C#', 'D#'];
    const octave = keyboardState.octave;
    
    return blackNotes.map((note, index) => {
      if (!note) return <div key={`space-${index}`}></div>;
      
      // Determinar la octava adecuada (las últimas notas están en octava superior)
      const noteOctave = index >= 7 ? octave + 1 : octave;
      const fullNote = `${note}${noteOctave}`;
      
      return (
        <button
          key={`${note}${noteOctave}`}
          className={`play-button ${isPlaying ? 'active' : ''}`}
          onMouseDown={() => handleNotePress(fullNote)}
          onMouseUp={handleNoteRelease}
          onTouchStart={() => handleNotePress(fullNote)}
          onTouchEnd={handleNoteRelease}
        >
          {note}
        </button>
      );
    });
  };
  
  return (
    <div className="keyboard-controls">
      <div className="mt-6 text-sm text-gray-600">
        Notas activas: {Object.values(keyboardState.activeNotes).join(', ') || 'Ninguna'}
      </div>
      
      <div className="keys-container">
        <div className="keys-black">
          {renderBlackKeys()}
        </div>
        <div className="keys-white">
          {renderWhiteKeys()}
        </div>
      </div>
    </div>
  );
};

export default Keyboard;