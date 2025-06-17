// AtoSearch.jsx
import React from 'react';
import { formatarValor } from './utils';

export default function AtoSearch({ searchTerm, setSearchTerm, suggestions, loadingSuggestions, onSelect }) {
  return (
    <div style={{ marginBottom: 16, position: 'relative', maxWidth: 400, marginLeft: 'auto', marginRight: 'auto' }}>
      <label>Buscar ato por código ou descrição:</label>
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          onSelect(null);
        }}
        placeholder="Digite código ou descrição"
        style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc' }}
      />
      {loadingSuggestions && (
        <div style={{ position: 'absolute', top: '100%', left: 0, background: '#fff', border: '1px solid #ccc', width: '100%', zIndex: 10, padding: 8 }}>
          Carregando...
        </div>
      )}
      {!loadingSuggestions && suggestions.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, position: 'absolute', top: '100%', left: 0, right: 0, maxHeight: 200, overflowY: 'auto', background: '#fff', border: '1px solid #ccc', borderTop: 'none', zIndex: 9999, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          {suggestions.map((ato) => (
            <li
              key={ato.id}
              onClick={() => onSelect(ato)}
              style={{ padding: 8, cursor: 'pointer', borderBottom: '1px solid #eee' }}
            >
              {ato.codigo} - {ato.descricao} - R$ {formatarValor(ato.valor_final)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}