import React from 'react';
import { formatarValor } from './utils';

export default function AtoSearch({
  searchTerm,
  setSearchTerm,
  suggestions,
  loadingSuggestions,
  onSelect,
  quantidade,
  onQuantidadeChange,
}) {
  const handleSelect = (ato) => {
    onSelect(ato);
    setSearchTerm(''); // Limpa o campo de busca
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <div
        style={{
          backgroundColor: '#f0f0f0',
          borderRadius: 8,
          padding: 12,
          minWidth: 600,
          position: 'relative',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <label
          htmlFor="searchInput"
          style={{
            fontWeight: 'bold',
            fontSize: 16,
            color: '#1976d2',
            whiteSpace: 'nowrap',
            userSelect: 'none',
          }}
        >
          Buscar ato por código ou descrição:
        </label>

        <input
          id="searchInput"
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Digite código ou descrição"
          style={{
            flexGrow: 1,
            padding: 8,
            borderRadius: 4,
            border: '1px solid #ccc',
            fontSize: 14,
          }}
        />

        <label
          htmlFor="quantidadeInput"
          style={{
            fontWeight: 'bold',
            fontSize: 16,
            color: '#1976d2',
            whiteSpace: 'nowrap',
            userSelect: 'none',
          }}
        >
          Quantidade:
        </label>

        <input
          id="quantidadeInput"
          type="number"
          value={quantidade}
          onChange={(e) => onQuantidadeChange(e.target.value)}
          style={{
            width: 60,
            padding: 4,
            borderRadius: 4,
            border: '1px solid #ccc',
            fontSize: 14,
          }}
          min={1}
        />
      </div>

      {loadingSuggestions && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            background: '#fff',
            border: '1px solid #ccc',
            width: '100%',
            zIndex: 10,
            padding: 8,
          }}
        >
          Carregando...
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
            maxHeight: 200,
            overflowY: 'auto',
            background: '#fff',
            border: '1px solid #ccc',
            borderTop: 'none',
            zIndex: 9999,
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          }}
        >
          {suggestions.map((ato) => (
            <li
              key={ato.id}
              onClick={() => handleSelect(ato)}
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