import React from 'react';
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import './App.css';
import Makwil from './pages/Makwil';
import Modulor from './pages/Modulor';
import About from './pages/About';
import Header from './components/Header/Header';
import FlowerField from './components/FlowerField/FlowerField';
import { TransportProvider } from './audio/sequencer/transport';

// Etiqueta del header por ruta.
const LABELS: Record<string, string> = {
    '/': 'MAKWIL',
    '/modulor': 'MODULOR',
    '/about': 'ABOUT',
};

// Cáscara que vive DENTRO del Router para poder leer la ruta con useLocation:
// el label del header y la intensidad del fondo generativo dependen de ella.
const AppShell: React.FC = () => {
    const { pathname } = useLocation();
    const label = LABELS[pathname] ?? 'MAKWIL';
    // Fondo pleno en el landing About; sutil detrás del sinte.
    const flowerVariant = pathname === '/about' ? 'full' : 'subtle';
    return (
        <>
            <FlowerField variant={flowerVariant} />
            <Header label={label} />
            <Routes>
                <Route path="/modulor" element={<Modulor/>}/>
                <Route path="/about" element={<About/>}/>
                <Route path="/" element={<Makwil/>}/>
            </Routes>
            {/* BottomNav vive dentro de Makwil (es position:fixed) para acceder al
                estado de mute/encendido del mixer; sigue dentro de TransportProvider. */}
        </>
    );
};

const App : React.FC = () => {
    return (
        <Router>
            <TransportProvider>
                <AppShell />
            </TransportProvider>
        </Router>
    )

}

export default App;
