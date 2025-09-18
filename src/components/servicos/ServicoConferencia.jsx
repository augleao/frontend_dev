
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import config from '../../config';

export default function ServicoConferencia({ protocolo, atosPedido = [], onAvancarEtapa, onVoltarEtapa }) {
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState('');
  const [status, setStatus] = useState('Conferido');
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [conferencias, setConferencias] = useState([]);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    // Recupera usuário logado do localStorage
    const usuarioLogado = JSON.parse(localStorage.getItem('usuario') || '{}');
    setUsuario(usuarioLogado.nome || usuarioLogado.email || 'Usuário');
  }, []);

  useEffect(() => {
    if (protocolo) {
      fetchConferencias();
    }
    // eslint-disable-next-line
  }, [protocolo]);

  async function fetchConferencias() {
    setErro(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${config.apiURL}/conferencias?protocolo=${encodeURIComponent(protocolo)}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }
      );
      if (res.ok) {
        const data = await res.json();
        setConferencias(data.conferencias || []);
      } else {
        setConferencias([]);
      }
    } catch (err) {
      setErro('Erro ao buscar conferências.');
      setConferencias([]);
    }
  }

  async function handleSalvar() {
    setSalvando(true);
    setErro(null);
    try {
      const token = localStorage.getItem('token');
      
      // Verifica se o pedido possui atos pagos (código tributário 01) usando os atos já disponíveis
      
      // Verifica se existe algum ato com código tributário '01' (atos pagos)
      const atosPagos = atosPedido.filter(ato => {
        const codigo = String(ato.codigoTributario).trim();
        return codigo === '01';
      });
      
      const possuiAtosPagos = atosPagos.length > 0;
  // Se não houver ato pago (código 01), status deve ser 'Aguardando Execução', senão 'Aguardando Pagamento'
  const statusProximaEtapa = possuiAtosPagos ? 'Aguardando Pagamento' : 'Aguardando Execução';
      

      const body = JSON.stringify({
        protocolo,
        usuario,
        status,
        observacao
      });
      
      // Salva a conferência normalmente
      const res = await fetch(`${config.apiURL}/conferencias`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body
      });
      
      if (res.ok) {
        // Atualiza o status do pedido na tabela pedido_status com o status determinado pela lógica de atos
        try {
          await fetch(`${config.apiURL}/pedidos/${encodeURIComponent(protocolo)}/status`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: JSON.stringify({ status: statusProximaEtapa, usuario })
          });
        } catch (e) {
          // Não bloqueia o fluxo se falhar, mas pode exibir um aviso se desejar
        }

        setObservacao('');
        setStatus('Conferido'); // Volta para o padrão após salvar
        fetchConferencias();

        // Avança para o componente ServicoPagamento.jsx via prop
        if (typeof onAvancarEtapa === 'function') {
          onAvancarEtapa();
        }
      } else {
        setErro('Erro ao salvar conferência.');
      }
    } catch (err) {
      setErro('Erro ao salvar conferência.');
    }
    setSalvando(false);
  }

  // Função para apagar conferência e verificar se deve voltar status para "Aguardando Conferência"
  async function handleApagarConferencia(conferencia) {
    if (!window.confirm('Deseja realmente apagar esta conferência?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await fetch(`${config.apiURL}/conferencias/${conferencia.id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      
      // Recarrega a lista de conferências
      await fetchConferencias();
      
      // Verifica se não há mais conferências e volta o status para "Aguardando Conferência"
      const conferenciaAtualizada = await fetch(
        `${config.apiURL}/conferencias?protocolo=${encodeURIComponent(protocolo)}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }
      );
      
      if (conferenciaAtualizada.ok) {
        const dataConferencia = await conferenciaAtualizada.json();
        const conferenciasRestantes = dataConferencia.conferencias || [];
        // Se não há mais conferências, volta o status para "Aguardando Conferência"
        if (conferenciasRestantes.length === 0) {
          try {
            await fetch(`${config.apiURL}/pedidos/${encodeURIComponent(protocolo)}/status`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {})
              },
              body: JSON.stringify({ 
                status: 'Aguardando Conferência', 
                usuario: JSON.parse(localStorage.getItem('usuario') || '{}').nome || 'Sistema'
              })
            });
          } catch (e) {}
          // Avança para o componente ServicoEntrada.jsx via prop
          if (typeof onVoltarEtapa === 'function') {
            onVoltarEtapa();
          }
        }
      }
    } catch (err) {
    }
  }

  return (
    <div style={{
      border: '3px solid #f39c12',
      borderRadius: 24,
      background: '#fff8f0',
      padding: 12,
      marginBottom: 18,
      boxShadow: '0 6px 32px rgba(243,156,18,0.10)'
    }}>
      <h3 style={{ color: '#e67e22', fontWeight: 700, fontSize: 20, margin: 0, marginBottom: 12 }}>Conferência</h3>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ color: '#e67e22', fontWeight: 600 }}>Usuário responsável:</label><br />
          <span style={{ fontWeight: 600 }}>{usuario}</span>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ color: '#e67e22', fontWeight: 600 }}>Status da conferência:</label><br />
          <select value={status} onChange={e => setStatus(e.target.value)} style={{ width: '100%', border: '1.5px solid #f9e79f', borderRadius: 6, padding: '8px 12px', fontSize: 16, boxSizing: 'border-box', background: '#fffbe6' }}>
            <option value="Conferido">Conferido</option>
            <option value="Retificado">Retificado</option>
            <option value="Recusado">Recusado</option>
          </select>
        </div>
        <div style={{ flex: 2, minWidth: 200 }}>
          <label style={{ color: '#e67e22', fontWeight: 600 }}>Observações:</label><br />
          <textarea
            value={observacao}
            onChange={e => setObservacao(e.target.value)}
            maxLength={200}
            style={{ width: '100%', border: '1.5px solid #f9e79f', borderRadius: 6, padding: '8px 12px', fontSize: 16, minHeight: 40, boxSizing: 'border-box', background: '#fffbe6' }}
            placeholder="Observações da conferência..."
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', minWidth: 120 }}>
          <button
            type="button"
            onClick={handleSalvar}
            disabled={salvando || !status}
            style={{ background: '#f39c12', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 24px', fontWeight: 'bold', fontSize: 16, cursor: 'pointer', marginTop: 18, boxShadow: '0 2px 8px rgba(243,156,18,0.15)' }}
          >
            {salvando ? 'Salvando...' : 'Salvar Conferência'}
          </button>
        </div>
      </div>
      {erro && <div style={{ color: 'red', marginBottom: 8 }}>{erro}</div>}
      <h4 style={{ color: '#e67e22', fontWeight: 600, fontSize: 16, margin: '12px 0 8px 0' }}>Histórico de Conferências</h4>
      <div style={{ overflowX: 'auto', background: '#fffbe6', borderRadius: 8, border: '2px solid #f39c12', boxShadow: '0 2px 8px rgba(243,156,18,0.06)', padding: '8px 0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, background: 'transparent' }}>
          <thead>
            <tr style={{ background: '#ffe5b4' }}>
              <th style={{ padding: 6, color: '#e67e22', fontWeight: 700, fontSize: 12, textAlign: 'left' }}>Data/Hora</th>
              <th style={{ padding: 6, color: '#e67e22', fontWeight: 700, fontSize: 12, textAlign: 'left' }}>Usuário</th>
              <th style={{ padding: 6, color: '#e67e22', fontWeight: 700, fontSize: 12, textAlign: 'left' }}>Status</th>
              <th style={{ padding: 6, color: '#e67e22', fontWeight: 700, fontSize: 12, textAlign: 'left' }}>Observação</th>
              <th style={{ padding: 6, color: '#e67e22', fontWeight: 700, fontSize: 12, textAlign: 'left' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {conferencias.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: '#aaa', padding: 12 }}>Nenhuma conferência registrada.</td></tr>
            ) : (
              conferencias.map((c, idx) => (
                <tr key={c.id || idx} style={{ background: idx % 2 === 0 ? '#fff3e0' : 'transparent' }}>
                  <td style={{ padding: 6 }}>
                    {c.dataHora
                      ? new Date(c.dataHora).toLocaleString()
                      : c.data_hora
                        ? new Date(c.data_hora).toLocaleString()
                        : '-'}
                  </td>
                  <td style={{ padding: 6 }}>{c.usuario}</td>
                  <td style={{ padding: 6 }}>
                    {c.status === 'Conferido' ? 'Conferido' : c.status === 'Retificado' ? 'Retificado' : c.status === 'Recusado' ? 'Recusado' : c.status}
                  </td>
                  <td style={{ padding: 6 }}>{c.observacao}</td>
                  <td style={{ padding: 6 }}>
                    <button
                      type="button"
                      onClick={() => handleApagarConferencia(c)}
                      style={{ background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', fontWeight: 'bold', fontSize: 13, cursor: 'pointer' }}
                    >
                      Apagar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
