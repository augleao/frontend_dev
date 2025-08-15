import React from 'react';

import { useState } from 'react';
import config from '../../config';

export default function ServicoEntrega({ form, onChange, pedidoId }) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  // Função para salvar entrega
  const salvarEntrega = async () => {
    setSalvando(true);
    setErro('');
    try {
      const token = localStorage.getItem('token');
      const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
      const usuarioNome = usuario.nome || usuario.email || 'Usuário';
      // Preenche data/hora automaticamente se não preenchidos
      const now = new Date();
      const dataEntrega = form.entrega.data || now.toISOString().slice(0, 10);
      const horaEntrega = form.entrega.hora || now.toTimeString().slice(0, 5);
      const body = {
        ...form.entrega,
        data: dataEntrega,
        hora: horaEntrega,
        protocolo: pedidoId,
        usuario: usuarioNome
      };
      const method = form.entrega && form.entrega.id ? 'PUT' : 'POST';
      const url = method === 'PUT'
        ? `${config.apiURL}/entrega-servico/${form.entrega.id}`
        : `${config.apiURL}/entrega-servico`;
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error('Erro ao salvar entrega');
      const data = await res.json();
      if (data && data.entrega && typeof onChange === 'function') {
        // Garante que o id esteja presente para o botão mudar
        onChange('entrega', { ...data.entrega, id: data.entrega.id || data.entregaId });
      } else if (data && data.entregaId && typeof onChange === 'function') {
        onChange('entrega', { ...form.entrega, data: dataEntrega, hora: horaEntrega, id: data.entregaId });
      }
      // Atualiza status para Concluído
      await fetch(`${config.apiURL}/pedidos/${encodeURIComponent(pedidoId)}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: 'Concluído',
          usuario: usuarioNome
        })
      });
    } catch (err) {
      setErro(err.message || 'Erro desconhecido');
    }
    setSalvando(false);
  };

  // Função para cancelar entrega
  const cancelarEntrega = async () => {
    setSalvando(true);
    setErro('');
    try {
      const token = localStorage.getItem('token');
      const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
      const usuarioNome = usuario.nome || usuario.email || 'Usuário';
      // Exclui entrega
      if (form.entrega && form.entrega.id) {
        const res = await fetch(`${config.apiURL}/entrega-servico/${form.entrega.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setErro('Erro ao excluir entrega: ' + (err.error || res.status));
          setSalvando(false);
          return;
        }
      }
      // Atualiza status para Aguardando Entrega
      await fetch(`${config.apiURL}/pedidos/${encodeURIComponent(pedidoId)}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: 'Aguardando Entrega',
          usuario: usuarioNome
        })
      });
      if (typeof onChange === 'function') {
        onChange('entrega', {});
      }
    } catch (err) {
      setErro(err.message || 'Erro desconhecido');
    }
    setSalvando(false);
  };

  return (
    <div style={{ background: '#e8f5e8', padding: '0', borderRadius: '24px', width: '100%', boxSizing: 'border-box' }}>
      <div
        style={{
          width: '100%',
          margin: '0',
          padding: 0,
          borderRadius: '24px',
          border: '3px solid #27ae60',
          boxShadow: '0 6px 32px rgba(39,174,96,0.10)',
          background: '#e8f5e8',
          overflow: 'hidden',
          boxSizing: 'border-box'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 24px 8px 24px',
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <h2 style={{ margin: 0, color: '#1e8449', fontWeight: 700, fontSize: 16 }}>
            Entrega:
          </h2>
        </div>

        {/* Linha única com todos os campos de entrega */}
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          gap: '24px',
          marginBottom: '8px',
          alignItems: 'center',
        }}>
          {/* Responsável */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ color: '#1e8449', fontWeight: 600, fontSize: 13, marginRight: 4 }}>Responsável:</label>
            <span style={{ color: '#1e8449', fontWeight: 600, fontSize: 13 }}>
              {(() => {
                const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
                return usuario.nome || usuario.email || 'Usuário';
              })()}
            </span>
          </div>
          {/* Data da Entrega */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ color: '#1e8449', fontWeight: 600, fontSize: 14, marginRight: 4 }}>Data da entrega:</label>
            {form.entrega && form.entrega.id ? (
              <span style={{ color: '#1e8449', fontWeight: 600, fontSize: 13 }}>
                {form.entrega.data
                  ? (typeof form.entrega.data === 'string' && form.entrega.data.includes('T')
                      ? form.entrega.data.slice(0, 10)
                      : form.entrega.data)
                  : '-'}
              </span>
            ) : (
              <input 
                type="date" 
                value={form.entrega.data} 
                onChange={e => onChange('data', e.target.value)} 
                style={{
                  border: '1.5px solid #a9dfbf',
                  borderRadius: 6,
                  padding: '8px 12px',
                  fontSize: 13,
                  boxSizing: 'border-box',
                }}
              />
            )}
          </div>
          {/* Hora da Entrega */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ color: '#1e8449', fontWeight: 600, fontSize: 13, marginRight: 4 }}>Hora da entrega:</label>
            {form.entrega && form.entrega.id ? (
              <span style={{ color: '#1e8449', fontWeight: 600, fontSize: 13 }}>
                {form.entrega.hora || '-'}
              </span>
            ) : (
              <input 
                type="time" 
                value={form.entrega.hora} 
                onChange={e => onChange('hora', e.target.value)} 
                style={{
                  border: '1.5px solid #a9dfbf',
                  borderRadius: 6,
                  padding: '8px 12px',
                  fontSize: 13,
                  boxSizing: 'border-box',
                }}
              />
            )}
          </div>
          {/* Método de Entrega */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ color: '#1e8449', fontWeight: 600, fontSize: 13, marginRight: 4 }}>Método de Entrega:</label>
            {form.entrega && form.entrega.id ? (
              <span style={{ color: '#1e8449', fontWeight: 600, fontSize: 13 }}>
                {form.entrega.retiradoPor || '-'}
              </span>
            ) : (
              <input 
                type="text" 
                value={form.entrega.retiradoPor} 
                onChange={e => onChange('retiradoPor', e.target.value)} 
                style={{
                  border: '1.5px solid #a9dfbf',
                  borderRadius: 6,
                  padding: '8px 12px',
                  fontSize: 13,
                  boxSizing: 'border-box',
                }}
                placeholder="Adicione aqui a forma de entrega (balcão, correios, CRC, etc.) e o protocolo, se disponível."
              />
            )}
          </div>
        </div>
        {/* Botão de ação ao final */}
        <div style={{ margin: '16px 0 0 0', display: 'flex', gap: 16 }}>
          {form.entrega && form.entrega.id ? (
            <button
              type="button"
              onClick={cancelarEntrega}
              disabled={salvando}
              style={{
                padding: '10px 28px',
                background: '#e74c3c',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: salvando ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 8px rgba(231,76,60,0.2)'
              }}
            >
              Cancelar Entrega
            </button>
          ) : (
            <button
              type="button"
              onClick={salvarEntrega}
              disabled={salvando}
              style={{
                padding: '10px 28px',
                background: '#27ae60',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: salvando ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 8px rgba(39,174,96,0.2)'
              }}
            >
              {salvando ? 'Salvando...' : 'Salvar Entrega'}
            </button>
          )}
          {erro && <span style={{ color: 'red', marginLeft: 16 }}>{erro}</span>}
        </div>
      </div>
    </div>
  );
}