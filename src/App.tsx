import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import './App.css';
import BasicSynth from './pages/BasicSynth';
import Header from './components/Header/Header';

const App : React.FC = () => {
    return (
        <Router>
            <Header />
            <Routes>
                <Route path="/" element={<BasicSynth/>}/>
            </Routes>
        </Router>
    )

}

export default App;