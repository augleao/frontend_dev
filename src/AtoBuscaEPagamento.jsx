import React, { useState, useEffect, useRef } from 'react';
import { formasPagamento } from './utils';
import AtoSearch from './AtoSearch';
import FormasPagamento from './FormasPagamento';
import { apiURL } from './config';

export default function AtoBuscaEPagamento({ dataSelecionada, atos, setAtos, nomeUsuario }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedAto, setSelectedAto] = useState(null);
  const [pagamentos, setPagamentos] = useState(
    formasPagamento.reduce((acc, fp) => {
      acc[fp.key] = { quantidade: 0, valor: 0, manual: false };
      return acc;
    }, {})
  );
  const [quantidade, setQuantidade] = useState(1);
  const debounceTimeout = useRef(null);

  // Funções para busca, pagamentos, adicionar ato, etc.
  // Copie e adapte as funções do seu código original aqui

  // Exemplo simplificado para handleSelectAto
  const handleSelectAto = (ato) => {
    setSelectedAto(ato);
    setSearchTerm('');
  };

  // Exemplo simplificado para adicionarAto
  const adicionarAto = async () => {
    // lógica para adicionar ato, usando selectedAto, pagamentos, quantidade, etc.
  };

  // useEffect para buscar sugestões com debounce
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setSuggestions([]);
      return;
    }
    setLoadingSuggestions(true);
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = setTimeout(async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(
          `${process.env.REACT_APP_API_URL || apiURL}/api/atos?search=${encodeURIComponent(
            searchTerm
          )}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const data = await res.json();
        if (res.ok) {
          setSuggestions(data.atos || []);
        } else {
          setSuggestions([]);
        }
      } catch (e) {
        console.error('Erro ao buscar atos:', e);
        setSuggestions([]);
      }
      setLoadingSuggestions(false);
    }, 300);
    return () => clearTimeout(debounceTimeout.current);
  }, [searchTerm]);

  return (
    <div
      style={{
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
        padding: 16,
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        position: 'relative',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 24,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: '1 1 350px', minWidth: 350 }}>
          <AtoSearch
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            suggestions={suggestions}
            loadingSuggestions={loadingSuggestions}
            onSelect={handleSelectAto}
            quantidade={quantidade}
            onQuantidadeChange={setQuantidade}
          />
        </div>
      </div>

      <FormasPagamento
        formasPagamento={formasPagamento}
        pagamentos={pagamentos}
        onQuantidadeChange={(key, qtd) => {
          // lógica para atualizar pagamentos quantidade
        }}
        onValorChange={(key, valor) => {
          // lógica para atualizar pagamentos valor
        }}
        corFundoPagamentos={() => '#fff'} // ajuste conforme necessário
        selectedAto={selectedAto}
      />

      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <button
          style={{
            padding: '10px 24px',
            background: '#388e3c',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
          onClick={adicionarAto}
          disabled={!selectedAto}
        >
          Adicionar Ato
        </button>
      </div>
    </div>
  );
}