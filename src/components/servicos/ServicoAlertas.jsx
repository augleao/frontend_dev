import React from 'react';
import '../../buttonGradients.css';

export default function ServicoAlertas({ alertas }) {
  if (!alertas.length) return null;
  return (
    <div style={{ background: '#f8d7da', color: '#721c24', padding: 12, borderRadius: 8, marginBottom: 16 }}>
      {alertas.map((a, i) => <div key={i}>{a}</div>)}
    </div>
  );
}