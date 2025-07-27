
console.log('Iniciando index.js');
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { BrowserRouter } from 'react-router-dom'; // <--- adicione isso


const root = ReactDOM.createRoot(document.getElementById('root'));
console.log('Renderizando App com BrowserRouter');
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

console.log('Chamando reportWebVitals');
reportWebVitals();