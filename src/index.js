import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './buttonGradients.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { BrowserRouter } from 'react-router-dom';

// Silencia globalmente logs no console apenas se a flag `SILENCE_ATOS` estiver explicitamente setada
try {
  const shouldSilence = typeof localStorage !== 'undefined' && localStorage.getItem('SILENCE_ATOS') === 'true';
  if (shouldSilence) {
    console.log = () => {};
    console.warn = () => {};
    console.error = () => {};
  }
} catch (e) {
  // Em ambientes não-browser ou que bloqueiem localStorage, não silenciar
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

reportWebVitals();