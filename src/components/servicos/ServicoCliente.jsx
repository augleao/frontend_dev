import React, { useState } from 'react';
import config from '../../config';

export default function ServicoCliente({ form, onChange, onClienteChange }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Busca clientes conforme digita
  const buscarClientes = async (term) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${config.apiURL}/clientes?search=${encodeURIComponent(term)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      setSuggestions(data.clientes || []);
    } catch (err) {
      setSuggestions([]);
    }
    setLoading(false);
  };

  // Ao digitar no campo de busca
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    onClienteChange('nome', value);
    if (value.length >= 2) buscarClientes(value);
    else setSuggestions([]);
  };

  // Seleciona cliente da sugestão
  const handleSelectCliente = (cliente) => {
    onChange('clienteId', cliente.id);
    onClienteChange('nome', cliente.nome);
    onClienteChange('cpf', cliente.cpf);
    onClienteChange('endereco', cliente.endereco);
    onClienteChange('telefone', cliente.telefone);
    onClienteChange('email', cliente.email);
    setSearchTerm(cliente.nome);
    setSuggestions([]);
  };

  // Salva novo cliente
  const handleSalvarCliente = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${config.apiURL}/clientes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(form.cliente),
    });
    if (res.ok) {
      const novoCliente = await res.json();
      onChange('clienteId', novoCliente.id);
      setSearchTerm(novoCliente.nome);
      setSuggestions([]);
    }
  };

  return (
    <div>
      <h3>Informações do Cliente</h3>
      <label>Nome ou CPF/CNPJ:</label>
      <input
        type="text"
        value={searchTerm}
        onChange={handleSearchChange}
        style={{ width: '100%', marginBottom: 8 }}
        autoComplete="off"
      />
      {loading && <div>Buscando...</div>}
      {suggestions.length > 0 && (
        <ul style={{
          background: '#fff',
          border: '1px solid #ccc',
          borderRadius: 4,
          margin: 0,
          padding: '4px 0',
          listStyle: 'none',
          zIndex: 10,
          width: '100%',
          position: 'absolute'
        }}>
          {suggestions.map(c => (
            <li
              key={c.id}
              style={{ padding: '4px 8px', cursor: 'pointer' }}
              onClick={() => handleSelectCliente(c)}
            >
              {c.nome} ({c.cpf})
            </li>
          ))}
        </ul>
      )}
      <label>Nome:</label>
      <input type="text" value={form.cliente.nome} onChange={e => onClienteChange('nome', e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
      <label>CPF/CNPJ:</label>
      <input type="text" value={form.cliente.cpf} onChange={e => onClienteChange('cpf', e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
      <label>Endereço:</label>
      <input type="text" value={form.cliente.endereco} onChange={e => onClienteChange('endereco', e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
      <label>Telefone:</label>
      <input type="text" value={form.cliente.telefone} onChange={e => onClienteChange('telefone', e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
      <label>E-mail:</label>
      <input type="email" value={form.cliente.email} onChange={e => onClienteChange('email', e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
      {/* Exibe botão salvar se não existe clienteId */}
      {!form.clienteId && (
        <button
          type="button"
          onClick={handleSalvarCliente}
          style={{
            background: '#27ae60',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '8px 24px',
            fontWeight: 'bold',
            fontSize: 16,
            cursor: 'pointer',
            marginTop: 8
          }}
        >
          Salvar
        </button>
      )}
    </div>
  );
}