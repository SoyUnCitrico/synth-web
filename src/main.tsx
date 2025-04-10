import React from 'react';
import ReactDOM from 'react-dom/client';
// import AnalogSynth from './AnalogSynth';
import App from './App';
import './index.css';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    {/* <AnalogSynth /> */}
    <App />
  </React.StrictMode>
);