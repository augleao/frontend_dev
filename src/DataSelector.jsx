// DataSelector.jsx
import React from 'react';

export default function DataSelector({ dataSelecionada, onChange }) {
  return (
    <div style={{ marginBottom: 24, textAlign: 'center' }}>
      <label htmlFor="dataSelecionada" style={{ marginRight: 8, fontWeight: 'bold' }}>
        Selecione a data:
      </label>
      <input
        id="dataSelecionada"
        type="date"
        value={dataSelecionada}
        onChange={onChange}
        max={new Date().toISOString().slice(0, 10)}
      />
    </div>
  );
}