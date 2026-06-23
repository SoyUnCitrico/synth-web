import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import './App.css';
import Makwil from './pages/Makwil';
import Modulor from './pages/Modulor';
import Header from './components/Header/Header';
import { TransportProvider } from './audio/sequencer/transport';

const App : React.FC = () => {
    return (
        <Router>
            <TransportProvider>
                <Header
                    label={window.location.pathname === '/makwil' ? 'MAKWIL' : 'MODULOR'}
                />
                <Routes>
                    <Route path="/" element={<Modulor/>}/>
                    <Route path="/makwil" element={<Makwil/>}/>
                </Routes>
                {/* BottomNav vive dentro de Makwil (es position:fixed) para acceder al
                    estado de mute/encendido del mixer; sigue dentro de TransportProvider. */}
            </TransportProvider>
        </Router>
    )

}

export default App;
