import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import './App.css';
import BasicSynth from './pages/BasicSynth';
import Header from './components/Header/Header';
import { TransportProvider } from './audio/sequencer/transport';

const App : React.FC = () => {
    return (
        <Router>
            <TransportProvider>
                <Header />
                <Routes>
                    <Route path="/" element={<BasicSynth/>}/>
                </Routes>
            </TransportProvider>
        </Router>
    )

}

export default App;
