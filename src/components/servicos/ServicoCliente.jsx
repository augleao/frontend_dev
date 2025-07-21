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

  // Ao digitar no campo Nome
  const handleNomeChange = (e) => {
    const value = e.target.value;
    onClienteChange('nome', value);
    setSearchTerm(value);
    if (value.length >= 2) buscarClientes(value);
    else setSuggestions([]);
  };

  // Ao digitar no campo CPF/CNPJ
  const handleCpfChange = (e) => {
    const value = e.target.value;
    onClienteChange('cpf', value);
    setSearchTerm(value);
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

  // Função para excluir cliente
  const handleExcluirCliente = async () => {
    if (!form.clienteId) return;
    if (!window.confirm('Deseja realmente excluir este cliente?')) return;
    const token = localStorage.getItem('token');
    const res = await fetch(`${config.apiURL}/clientes/${form.clienteId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      // Limpa os campos do cliente após exclusão
      onChange('clienteId', null);
      onClienteChange('nome', '');
      onClienteChange('cpf', '');
      onClienteChange('endereco', '');
      onClienteChange('telefone', '');
      onClienteChange('email', '');
      setSearchTerm('');
      setSuggestions([]);
    }
  };

  return (
    <div
      style={{
        background: '#f8fafc',
        borderRadius: 16,
        padding: 28,
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
        marginBottom: 24,
        border: '1px solid #e2e8f0'
      }}
    >
      <h3 style={{
        color: '#2d3748',
        fontSize: '20px',
        fontWeight: '700',
        marginBottom: 20,
        borderBottom: '2px solid #667eea',
        paddingBottom: 8
      }}>Dados do Cliente</h3>
      
      <div style={{ marginBottom: 16 }}>
        <label style={{ 
          fontWeight: '600', 
          color: '#4a5568',
          fontSize: '14px',
          display: 'block',
          marginBottom: 6
        }}>Nome:</label>
        <input
          type="text"
          value={form.cliente.nome}
          onChange={handleNomeChange}
          style={{ 
            width: '100%', 
            padding: '12px 16px',
            borderRadius: 8,
            border: '1px solid #cbd5e0',
            fontSize: '14px',
            backgroundColor: 'white',
            transition: 'border-color 0.2s ease'
          }}
          autoComplete="off"
        />
      <label>CPF/CNPJ:</label>
      <input
        type="text"
        value={form.cliente.cpf}
        onChange={handleCpfChange}
        style={{ width: '100%', marginBottom: 8 }}
        autoComplete="off"
      />
      {/* Sugestões aparecem para ambos os campos */}
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

      {/* Exibe botão excluir se existe clienteId */}
      {form.clienteId && (
        <button
          type="button"
          onClick={handleExcluirCliente}
          style={{
            background: '#e74c3c',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '8px 24px',
            fontWeight: 'bold',
            fontSize: 16,
            cursor: 'pointer',
            marginTop: 8,
            marginLeft: 12
          }}
        >
          Excluir Cadastro do Cliente
        </button>
      )}
    </div>
  );
}