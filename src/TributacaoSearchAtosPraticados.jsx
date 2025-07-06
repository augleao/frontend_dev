import React from 'react';
import { formatarValor } from './utils';

export default function TributacaoSearchAtosPraticados({
  searchTerm,
  setSearchTerm,
  suggestions,
  loadingSuggestions,
  onSelectAto,
}) {
  const handleSelect = (ato) => {
    console.log('[TributacaoSearchAtosPraticados] handleSelect chamado para:', ato); // LOG ADICIONADO
    onSelectAto(ato);
    setSearchTerm(''); // Limpa o campo de busca
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ 
        display: 'block', 
        marginBottom: '8px', 
        fontWeight: '600',
        color: '#2c3e50'
      }}>
        Buscar ato por código ou descrição:
      </label>
      
      {/* Container do input com position relative para dropdown */}
      <div style={{ position: 'relative', width: '100%' }}>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Digite código ou descrição do ato"
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '8px',
            border: '2px solid #e3f2fd',
            fontSize: '16px',
            boxSizing: 'border-box'
          }}
        />

        {loadingSuggestions && (
          <div
            style={{
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
            }}
          >
            Carregando sugestões...
          </div>
        )}

        {!loadingSuggestions && suggestions.length > 0 && (
          <ul
            style={{
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
            }}
          >
            {suggestions.map((ato) => (
              <li
                key={ato.id}
                onClick={() => handleSelect(ato)}
                style={{ 
                  padding: '12px 16px', 
                  cursor: 'pointer', 
                  borderBottom: '1px solid #f0f0f0',
                  fontSize: '14px',
                  transition: 'background-color 0.2s ease',
                  ':hover': {
                    backgroundColor: '#f8f9fa'
                  }
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#f8f9fa'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                <div style={{ fontWeight: '600', color: '#2c3e50', marginBottom: '4px' }}>
                  {ato.codigo} - R$ {formatarValor(ato.valor_final)}
                </div>
                <div style={{ color: '#666', fontSize: '13px' }}>
                  {ato.descricao}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}