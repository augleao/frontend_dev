import React from 'react';

import { useState } from 'react';
import config from '../../config';
import './servicos.css';


export default function ServicoEntrega({ form, onChange, pedidoId, onVoltarLista, onStatusChange }) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  // Preenche data/hora atuais se não houver valor ao montar
  React.useEffect(() => {
    if (form && form.entrega && !form.entrega.id) {
      const now = new Date();
      const dataAtual = now.toISOString().slice(0, 10);
      const horaAtual = now.toTimeString().slice(0, 5);
      let atualizou = false;
      if (!form.entrega.data) {
        onChange('data', dataAtual);
        atualizou = true;
      }
      if (!form.entrega.hora) {
        onChange('hora', horaAtual);
        atualizou = true;
      }
      // Não altera retiradoPor, pois pode ser preenchido pelo usuário
    }
    // eslint-disable-next-line
  }, []);

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
      // Atualiza status no componente pai
      if (typeof onStatusChange === 'function') {
        onStatusChange('Concluído');
      }
      // Volta para a lista de serviços após salvar entrega
      if (typeof onVoltarLista === 'function') {
        onVoltarLista();
      }
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
      // Atualiza status no componente pai
      if (typeof onStatusChange === 'function') {
        onStatusChange('Aguardando Entrega');
      }
      if (typeof onChange === 'function') {
        onChange('entrega', {});
      }
    } catch (err) {
      setErro(err.message || 'Erro desconhecido');
    }
    setSalvando(false);
  };

  return (
    <div className="servico-section">
        {/* Header */}
        <div className="servico-header">
          <h2 className="servico-title">Entrega</h2>
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
        <div className="servico-actions" style={{ justifyContent: 'flex-start', marginTop: 8 }}>
          {form.entrega && form.entrega.id ? (
            <button type="button" onClick={cancelarEntrega} disabled={salvando} className="btn btn-danger">
              Cancelar Entrega
            </button>
          ) : (
            <button type="button" onClick={salvarEntrega} disabled={salvando} className="btn btn-success">{salvando ? 'Salvando...' : 'Salvar Entrega'}</button>
          )}
          {erro && <span style={{ color: 'red', marginLeft: 16 }}>{erro}</span>}
        </div>
    </div>
  );
}