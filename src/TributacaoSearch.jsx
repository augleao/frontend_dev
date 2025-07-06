import React, { useState, useEffect } from 'react';
import { apiURL } from './config';

export default function TributacaoSearch({ tributacaoSelecionada, setTributacaoSelecionada }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!searchTerm) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    fetch(`${apiURL}/codigos-gratuitos?search=${encodeURIComponent(searchTerm)}`)
      .then(res => res.json())
      .then(data => {
        setSuggestions(data.codigos || []);
        setLoading(false);
      })
      .catch(() => setSuggestions([]));
  }, [searchTerm]);

  const handleSelect = (codigo) => {
    setTributacaoSelecionada(codigo);
    setSearchTerm('');
    setSuggestions([]);
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{
        display: 'block',
        marginBottom: '8px',
        fontWeight: '600',
        color: '#2c3e50'
      }}>
        Buscar código tributário:
      </label>
      <div style={{ position: 'relative', width: '100%' }}>
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Digite código ou descrição tributária"
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '8px',
            border: '2px solid #e3f2fd',
            fontSize: '16px',
            boxSizing: 'border-box'
          }}
        />
        {loading && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: '#fff',
            border: '2px solid #e3f2fd',
            borderTop: 'none',
            borderRadius: '0 0 8px 8px',
            zIndex: 1000,
            padding: '12px',
            fontSize: '14px',
            color: '#666'
          }}>
            Carregando sugestões...
          </div>
        )}
        {!loading && suggestions.length > 0 && (
          <ul style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            maxHeight: '300px',
            overflowY: 'auto',
            background: '#fff',
            border: '2px solid #e3f2fd',
            borderTop: 'none',
            borderRadius: '0 0 8px 8px',
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}>
            {suggestions.map((item) => (
              <li
                key={item.codigo}
                onClick={() => handleSelect(item.codigo)}
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #f0f0f0',
                  fontSize: '14px'
                }}
                onMouseEnter={e => e.target.style.backgroundColor = '#f8f9fa'}
                onMouseLeave={e => e.target.style.backgroundColor = 'transparent'}
              >
                <div style={{ fontWeight: '600', color: '#2c3e50', marginBottom: '4px' }}>
                  {item.codigo}
                </div>
                <div style={{ color: '#666', fontSize: '13px' }}>
                  {item.descricao}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {tributacaoSelecionada && (
        <div style={{ marginTop: 8, color: '#27ae60', fontWeight: '600' }}>
          Selecionado: {tributacaoSelecionada}
        </div>
      )}
    </div>
  );
}