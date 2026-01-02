import React, { useEffect, useState } from 'react';
import { initTracker } from '../utils/tracker';

const COOKIE_KEY = 'biblio_consent';

function setLocalConsent(value) {
  try {
    localStorage.setItem(COOKIE_KEY, value ? 'true' : 'false');
  } catch (e) {
    // ignore
  }
}

function getLocalConsent() {
  try {
    return localStorage.getItem(COOKIE_KEY) === 'true';
  } catch (e) {
    return false;
  }
}

export default function CookieConsent() {
  const [consentGiven, setConsentGiven] = useState(() => {
    const c = getLocalConsent();
    return c ? true : null;
  });

  useEffect(() => {
    if (consentGiven === true) {
      initTracker();
    }
  }, [consentGiven]);

  if (consentGiven !== null) return null;

  return (
    <div style={{
      position: 'fixed',
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.85)',
      color: 'white',
      padding: '16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      zIndex: 2000
    }}>
      <div style={{maxWidth: '80%'}}>
        Esse site usa cookies para melhorar a experiência e coletar eventos anônimos de uso. Você pode aceitar ou recusar. Os dados são pseudonimizados e podem ser excluídos a qualquer tempo.
      </div>
      <div style={{display: 'flex', gap: 8}}>
        <button
          onClick={() => {
            setLocalConsent(false);
            setConsentGiven(false);
          }}
          style={{background: '#666', color: 'white', border: 'none', padding: '8px 12px', borderRadius: 4}}
        >Recusar</button>
        <button
          onClick={() => {
            setLocalConsent(true);
            setConsentGiven(true);
          }}
          style={{background: '#0a84ff', color: 'white', border: 'none', padding: '8px 12px', borderRadius: 4}}
        >Aceitar</button>
      </div>
    </div>
  );
}
