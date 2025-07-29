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
    // Validação: verifica se CPF/CNPJ já existe
    if (!form.cliente.cpf || form.cliente.cpf.trim() === '') {
      alert('CPF/CNPJ é obrigatório para salvar o cliente.');
      return;
    }

    // Verifica se já existe cliente com o mesmo CPF/CNPJ
    try {
      const token = localStorage.getItem('token');
      const checkRes = await fetch(
        `${config.apiURL}/clientes?search=${encodeURIComponent(form.cliente.cpf)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const checkData = await checkRes.json();
      const clientesExistentes = checkData.clientes || [];
      
      // Verifica se existe algum cliente com CPF/CNPJ idêntico
      const cpfExiste = clientesExistentes.some(cliente => 
        cliente.cpf === form.cliente.cpf && cliente.id !== form.clienteId
      );
      
      if (cpfExiste) {
        alert('Já existe um cliente cadastrado com este CPF/CNPJ.');
        return;
      }
    } catch (err) {
      alert('Erro ao verificar CPF/CNPJ. Tente novamente.');
      return;
    }

    // Salva o cliente se passou na validação
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
      alert('Cliente salvo com sucesso!');
    } else {
      const errorData = await res.json();
      alert(errorData.error || 'Erro ao salvar cliente.');
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
        width: '100%',
        margin: '0',
        padding: '32px',
        borderRadius: '24px',
        border: '3px solid #9b59b6',
        boxShadow: '0 6px 32px rgba(155,89,182,0.10)',
        background: '#f5e6fa',
        overflow: 'hidden',
        marginBottom: 32,
        boxSizing: 'border-box'
      }}
    >
      <h2 style={{ 
        margin: '0 0 24px 0', 
        color: '#6c3483', 
        fontWeight: 700, 
        fontSize: 24,
        textAlign: 'center'
      }}>
        👤 Informações do Cliente
      </h2>
      
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      }}>
        <label style={{ color: '#6c3483', fontWeight: 600 }}>Nome:</label>
        <input
          type="text"
          value={form.cliente.nome}
          onChange={handleNomeChange}
          style={{ width: '100%', marginBottom: 8, border: '1.5px solid #d6d6f5', borderRadius: 6, padding: '8px 12px', fontSize: 16, boxSizing: 'border-box' }}
          autoComplete="off"
        />
        <label style={{ color: '#6c3483', fontWeight: 600 }}>CPF/CNPJ:</label>
        <input
          type="text"
          value={form.cliente.cpf}
          onChange={handleCpfChange}
          style={{ width: '100%', marginBottom: 8, border: '1.5px solid #d6d6f5', borderRadius: 6, padding: '8px 12px', fontSize: 16, boxSizing: 'border-box' }}
          autoComplete="off"
        />
        {/* Sugestões aparecem para ambos os campos */}
        {loading && <div style={{ color: '#6c3483', fontStyle: 'italic' }}>Buscando...</div>}
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
            position: 'absolute',
            fontSize: 15
          }}>
            {suggestions.map(c => (
              <li
                key={c.id}
                style={{ padding: '4px 8px', cursor: 'pointer', fontSize: 15 }}
                onClick={() => handleSelectCliente(c)}
              >
                {c.nome} ({c.cpf})
              </li>
            ))}
          </ul>
        )}
        <label style={{ color: '#6c3483', fontWeight: 600 }}>Endereço:</label>
        <input type="text" value={form.cliente.endereco} onChange={e => onClienteChange('endereco', e.target.value)} style={{ width: '100%', marginBottom: 8, border: '1.5px solid #d6d6f5', borderRadius: 6, padding: '8px 12px', fontSize: 16, boxSizing: 'border-box' }} />
        <label style={{ color: '#6c3483', fontWeight: 600 }}>Telefone:</label>
        <input type="text" value={form.cliente.telefone} onChange={e => onClienteChange('telefone', e.target.value)} style={{ width: '100%', marginBottom: 8, border: '1.5px solid #d6d6f5', borderRadius: 6, padding: '8px 12px', fontSize: 16, boxSizing: 'border-box' }} />
        <label style={{ color: '#6c3483', fontWeight: 600 }}>E-mail:</label>
        <input type="email" value={form.cliente.email} onChange={e => onClienteChange('email', e.target.value)} style={{ width: '100%', marginBottom: 8, border: '1.5px solid #d6d6f5', borderRadius: 6, padding: '8px 12px', fontSize: 16, boxSizing: 'border-box' }} />
        <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
          {/* Exibe botão salvar se não existe clienteId */}
          {!form.clienteId && (
            <button
              type="button"
              onClick={handleSalvarCliente}
              style={{
                background: '#27ae60',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '12px 32px',
                fontWeight: 'bold',
                fontSize: 16,
                cursor: 'pointer',
                transition: 'all 0.3s ease'
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
                borderRadius: 8,
                padding: '12px 32px',
                fontWeight: 'bold',
                fontSize: 16,
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
            >
              Excluir Cadastro do Cliente
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
