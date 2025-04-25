import React from 'react';
import { SynthProvider } from '../../context/SynthContext';
import VCO from '../VCO/VCO';
import VCF from '../VCF/VCF';
import ADSR from '../ADSR/ADSR';
import VCA from '../VCA/VCA';
import Oscilloscope from '../Oscilloscope/Oscilloscope';
import SpectrumAnalyzer from '../Spectrum/Spectrum';
import Keyboard from '../Keyboard/Keyboard';
import './Synth.css';

const Synth: React.FC = () => {
  return (
    <SynthProvider>
      <div className="synth-container">
        <h1 className="synthTitle">Synth Básico</h1>
        
        <div className="synth-modules">
          <Oscilloscope />
          <SpectrumAnalyzer />
          
          <VCO isSecondary={false} />
          <VCO isSecondary={true} />
          
          <VCF />
          <ADSR />
          <VCA />
        </div>
        
        <Keyboard />
      </div>
    </SynthProvider>
  );
};

export default Synth;