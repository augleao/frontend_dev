import React from 'react';

export default function ServicoCliente({ form, clientes, onChange, onClienteChange }) {
  return (
    <div>
      <h3>Informações do Cliente</h3>
      <label>Cliente:</label>
      <select
        value={form.clienteId}
        onChange={e => onChange('clienteId', e.target.value)}
        style={{ width: '100%', marginBottom: 8 }}
        disabled={form.novoCliente}
      >
        <option value="">Selecione...</option>
        {clientes.map(c => <option key={c.id} value={c.id}>{c.nome} ({c.cpf})</option>)}
      </select>
      <label>
        <input type="checkbox" checked={form.novoCliente} onChange={e => onChange('novoCliente', e.target.checked)} />
        Cadastrar novo cliente
      </label>
      {form.novoCliente && (
        <div style={{ marginTop: 8 }}>
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
        </div>
      )}
    </div>
  );
}