import React from 'react';
import { SynthProvider } from '../../context/SynthContext';
import VCO from '../VCO/VCO';
import VCF from '../VCF/VCF';
import ADSR from '../ADSR/ADSR';
import VCA from '../VCA/VCA';
import Oscilloscope from '../Oscilloscope/Oscilloscope';
import SpectrumAnalyzer from '../Spectrum/Spectrum';
import Keyboard from '../Keyboard/Keyboard';
import '../../App.css';

const Synth: React.FC = () => {
  return (
    <SynthProvider>
      <div className="synth-container">
        <Keyboard />        
        <Oscilloscope />
        <SpectrumAnalyzer />
        <div className="synth-modules">
          <VCO />
          <VCO isSecondary />          
          <VCF />
          <ADSR />
          <VCA />
        </div>        
      </div>
    </SynthProvider>
  );
};

export default Synth;