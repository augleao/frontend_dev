import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { BrowserRouter } from 'react-router-dom';

// Preserve original console and allow conditional silencing via localStorage.DEBUG_CONSOLE
const __origConsole = { log: console.log.bind(console), warn: console.warn.bind(console), error: console.error.bind(console) };
try {
  const debugFlag = localStorage.getItem('DEBUG_CONSOLE');
  const debug = debugFlag === 'true';
  if (!debug) {
    console.log = () => {};
    console.warn = () => {};
    console.error = () => {};
  } else {
    // restore originals just in case
    console.log = __origConsole.log;
    console.warn = __origConsole.warn;
    console.error = __origConsole.error;
  }
} catch (e) {
  // If localStorage access fails, keep originals
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