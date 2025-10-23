import React, { useEffect, useMemo, useRef, useState } from 'react';
import config from '../../config';
import './servicos.css';
import Toast from '../Toast';

export default function ServicoCliente({ form, onChange, onClienteChange, onAvancarEtapa }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [originalCliente, setOriginalCliente] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const toastTimerRef = useRef(null);

  const showToast = (type, message) => {
    setToastType(type);
    setToastMessage(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage('');
      toastTimerRef.current = null;
    }, 4000);
  };

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
    setOriginalCliente({
      id: cliente.id,
      nome: cliente.nome || '',
      cpf: cliente.cpf || '',
      endereco: cliente.endereco || '',
      telefone: cliente.telefone || '',
      email: cliente.email || '',
    });
    setSearchTerm(cliente.nome);
    setSuggestions([]);
  };

  // Salva novo cliente
  const handleSalvarCliente = async () => {
    // Validação: verifica se CPF/CNPJ já existe
    if (!form.cliente.cpf || form.cliente.cpf.trim() === '') {
      showToast('error', 'CPF/CNPJ é obrigatório para salvar o cliente.');
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
        showToast('error', 'Já existe um cliente cadastrado com este CPF/CNPJ.');
        return;
      }
    } catch (err) {
      showToast('error', 'Erro ao verificar CPF/CNPJ. Tente novamente.');
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
      //alert('Cliente salvo com sucesso!');
      // Avança para a próxima etapa (ServicoEntrada) após salvar cliente
      if (typeof onAvancarEtapa === 'function') {
        onAvancarEtapa();
      }
      showToast('success', 'Cliente salvo com sucesso!');
    } else {
      const errorData = await res.json();
      showToast('error', errorData.error || 'Erro ao salvar cliente.');
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
      setOriginalCliente(null);
      showToast('success', 'Cliente excluído com sucesso!');
    } else {
      try {
        const errText = await res.text();
        showToast('error', errText || 'Erro ao excluir cliente.');
      } catch (_) {
        showToast('error', 'Erro ao excluir cliente.');
      }
    }
  };

  // Seta o cliente "original" quando um cliente existente é carregado pelo formulário
  useEffect(() => {
    if (form?.clienteId) {
      // Captura um snapshot inicial para comparação de alterações
      setOriginalCliente(prev => {
        // Se o id mudou, atualiza baseline; se não existir baseline ainda, cria
        if (!prev || prev.id !== form.clienteId) {
          return {
            id: form.clienteId,
            nome: form.cliente?.nome || '',
            cpf: form.cliente?.cpf || '',
            endereco: form.cliente?.endereco || '',
            telefone: form.cliente?.telefone || '',
            email: form.cliente?.email || '',
          };
        }
        return prev;
      });
    } else {
      // Sem cliente selecionado
      setOriginalCliente(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form?.clienteId]);

  // Determina se houve alterações em relação ao baseline (originalCliente)
  const hasChanges = useMemo(() => {
    if (!form?.clienteId || !originalCliente) return false;
    const curr = form.cliente || {};
    const fields = ['nome', 'cpf', 'endereco', 'telefone', 'email'];
    return fields.some(k => (curr[k] || '') !== (originalCliente[k] || ''));
  }, [form?.clienteId, form?.cliente, originalCliente]);

  const handleAtualizarCliente = async () => {
    if (!form?.clienteId) return;
    // Validação simples
    if (!form?.cliente?.cpf || String(form.cliente.cpf).trim() === '') {
      showToast('error', 'CPF/CNPJ é obrigatório para atualizar o cliente.');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const payload = {
        nome: form.cliente?.nome || '',
        cpf: form.cliente?.cpf || '',
        endereco: form.cliente?.endereco || '',
        telefone: form.cliente?.telefone || '',
        email: form.cliente?.email || '',
      };
      const res = await fetch(`${config.apiURL}/clientes/${encodeURIComponent(form.clienteId)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || 'Erro ao atualizar cliente.');
      }
      // Atualiza baseline para refletir as alterações salvas
      setOriginalCliente({ id: form.clienteId, ...payload });
      showToast('success', 'Cliente atualizado com sucesso!');
    } catch (e) {
      showToast('error', e.message || 'Erro ao atualizar cliente.');
    }
  };

  // Cleanup do timer do toast ao desmontar
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  return (
    <div className="servico-section">
      <div className="servico-header">
        <h2 className="servico-title">👤 Informações do Cliente</h2>
      </div>
      <form autoComplete="off">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, position: 'relative' }}>
        {/* Nome e CPF/CNPJ na mesma linha, input nome maior */}
        <div className="servico-row">
          <label className="servico-label" style={{ minWidth: 50, margin: 0 }}>Nome:</label>
          <input
            type="text"
            value={form.cliente.nome}
            onChange={handleNomeChange}
            className="servico-input"
            style={{ width: 400 }}
            autoComplete="new-password"
            inputMode="text"
            form="no-autofill-form"
          />
          <label className="servico-label" style={{ minWidth: 70, margin: 0, marginLeft: 12 }}>CPF/CNPJ:</label>
          <input
            type="text"
            value={form.cliente.cpf}
            onChange={handleCpfChange}
            className="servico-input"
            style={{ width: 110 }}
            autoComplete="new-password"
            inputMode="text"
            form="no-autofill-form"
          />
        </div>
        {/* Sugestões aparecem para ambos os campos */}
        {loading && <div style={{ color: '#6c3483', fontStyle: 'italic', fontSize: 12 }}>Buscando...</div>}
        {suggestions.length > 0 && (
          <ul style={{
            background: '#fff',
            border: '1px solid #ccc',
            borderRadius: 4,
            margin: '4px 0 0 0',
            padding: '2px 0',
            listStyle: 'none',
            zIndex: 10,
            width: '100%',
            fontSize: 13,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            maxHeight: '150px',
            overflowY: 'auto'
          }}>
            {suggestions.map(c => (
              <li
                key={c.id}
                style={{ 
                  padding: '8px 12px', 
                  cursor: 'pointer', 
                  fontSize: 13,
                  borderBottom: '1px solid #f0f0f0'
                }}
                onClick={() => handleSelectCliente(c)}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#f8f9fa'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                {c.nome} ({c.cpf})
              </li>
            ))}
          </ul>
        )}
        {/* Endereço, Telefone e Email na mesma linha */}
        <div className="servico-row">
          <label className="servico-label" style={{ minWidth: 70, margin: 0 }}>Endereço:</label>
          <input 
            type="text" 
            value={form.cliente.endereco} 
            onChange={e => onClienteChange('endereco', e.target.value)} 
            className="servico-input"
            style={{ width: '45%', minWidth: 120 }} 
            autoComplete="new-password"
            inputMode="text"
            form="no-autofill-form"
          />
          <label className="servico-label" style={{ minWidth: 70, margin: 0, marginLeft: 12 }}>Telefone:</label>
          <input 
            type="text" 
            value={form.cliente.telefone} 
            onChange={e => onClienteChange('telefone', e.target.value)} 
            className="servico-input"
            style={{ width: 110 }} 
            autoComplete="new-password"
            inputMode="text"
            form="no-autofill-form"
          />
          <label className="servico-label" style={{ minWidth: 60, margin: 0, marginLeft: 12 }}>E-mail:</label>
          <input 
            type="email" 
            value={form.cliente.email} 
            onChange={e => onClienteChange('email', e.target.value)} 
            className="servico-input"
            style={{ width: 160 }} 
            autoComplete="new-password"
            inputMode="email"
            form="no-autofill-form"
          />
        </div>
        {/* Botões */}
        <div className="servico-actions" style={{ justifyContent: 'flex-start' }}>
          {/* Exibe botão salvar se não existe clienteId */}
          {!form.clienteId && (
            <button type="button" onClick={handleSalvarCliente} className="btn btn-success">
              Salvar
            </button>
          )}
          {/* Exibe botão excluir se existe clienteId */}
          {form.clienteId && (
            <>
              {/* Botão Atualizar aparece somente quando houver alterações */}
              {hasChanges && (
                <button
                  type="button"
                  onClick={handleAtualizarCliente}
                  className="btn btn-primary"
                  style={{ marginRight: 8 }}
                >
                  Atualizar Cliente
                </button>
              )}
              <button type="button" onClick={handleExcluirCliente} className="btn btn-danger">
                Excluir Cadastro do Cliente
              </button>
            </>
          )}
        </div>
  </div>
  </form>
      {/* Toast de feedback */}
      <Toast
        message={toastMessage}
        type={toastType}
        position="bottom-right"
        onClose={() => setToastMessage('')}
      />
    </div>
  );
}
