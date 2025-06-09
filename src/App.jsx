import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './Home';
import Conciliacao from './components/Conciliacao';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="./components/conciliacao" element={<Conciliacao />} />
      </Routes>
    </Router>
  );
}

export default App;