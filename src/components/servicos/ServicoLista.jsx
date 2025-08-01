import { useNavigate } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import config from '../../config';


function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  // Se vier sem separadores, tenta formatar manualmente
  if (/^\d{8,}/.test(dateStr)) {
    // Exemplo: 20250720220810
    const ano = dateStr.slice(0, 4);
    const mes = dateStr.slice(4, 6);
    const dia = dateStr.slice(6, 8);
    const hora = dateStr.slice(8, 10) || '00';
    const min = dateStr.slice(10, 12) || '00';
    const seg = dateStr.slice(12, 14) || '00';
    return `${dia}/${mes}/${ano} às ${hora}:${min}:${seg}`;
  }
  // Padrão ISO
  const d = new Date(dateStr);
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  const hora = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const seg = String(d.getSeconds()).padStart(2, '0');
  return `${dia}/${mes}/${ano} às ${hora}:${min}:${seg}`;
}

export default function ListaServicos() {
  const [pedidos, setPedidos] = useState([]);
  const [pedidosFiltrados, setPedidosFiltrados] = useState([]);
  const [statusPedidos, setStatusPedidos] = useState({});
  const [dataInicial, setDataInicial] = useState('');
  const [dataFinal, setDataFinal] = useState('');
  const [statusSelecionados, setStatusSelecionados] = useState({
    'aguardando conferência': true,
    'aguardando pagamento': true,
    'aguardando execução': true,
    'aguardando entrega': true,
    'concluído': false
  });
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchPedidos() {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${config.apiURL}/pedidos`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        setPedidos(data.pedidos || []);
        setPedidosFiltrados(data.pedidos || []); // Inicializa os pedidos filtrados
        // Buscar status de todos os pedidos
        if (data.pedidos && data.pedidos.length > 0) {
          const statusMap = {};
          await Promise.all(data.pedidos.map(async (pedido) => {
            try {
              const resStatus = await fetch(`${config.apiURL}/pedidos/${encodeURIComponent(pedido.protocolo)}/status/ultimo`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              if (resStatus.ok) {
                const dataStatus = await resStatus.json();
                statusMap[pedido.protocolo] = dataStatus.status || '-';
              } else {
                statusMap[pedido.protocolo] = '-';
              }
            } catch {
              statusMap[pedido.protocolo] = '-';
            }
          }));
          setStatusPedidos(statusMap);
        }
      } catch (err) {
        console.error('Erro ao buscar pedidos:', err);
      }
    }
    fetchPedidos();
  }, []);

  // Função para aplicar filtros de data e status
  const aplicarFiltros = () => {
    let pedidosFiltradosTemp = [...pedidos];

    // Filtro por data
    if (dataInicial || dataFinal) {
      pedidosFiltradosTemp = pedidosFiltradosTemp.filter(pedido => {
        if (!pedido.criado_em) return false;
        
        const dataPedido = new Date(pedido.criado_em);
        
        // Se só tem data inicial, filtra de data inicial até hoje
        if (dataInicial && !dataFinal) {
          const dataInicialObj = new Date(dataInicial);
          dataInicialObj.setHours(0, 0, 0, 0); // Início do dia selecionado
          const hoje = new Date();
          hoje.setHours(23, 59, 59, 999); // Final do dia de hoje
          return dataPedido >= dataInicialObj && dataPedido <= hoje;
        }
        
        // Se só tem data final, filtra desde o início até data final
        if (!dataInicial && dataFinal) {
          const dataFinalObj = new Date(dataFinal);
          dataFinalObj.setHours(23, 59, 59, 999); // Final do dia selecionado
          return dataPedido <= dataFinalObj;
        }
        
        // Se tem ambas as datas
        if (dataInicial && dataFinal) {
          const dataInicialObj = new Date(dataInicial);
          dataInicialObj.setHours(0, 0, 0, 0); // Início do dia inicial
          const dataFinalObj = new Date(dataFinal);
          dataFinalObj.setHours(23, 59, 59, 999); // Final do dia final
          return dataPedido >= dataInicialObj && dataPedido <= dataFinalObj;
        }
        
        return true;
      });
    }

    // Filtro por status
    const statusMarcados = Object.keys(statusSelecionados).filter(status => statusSelecionados[status]);
    if (statusMarcados.length > 0) {
      pedidosFiltradosTemp = pedidosFiltradosTemp.filter(pedido => {
        const statusPedido = statusPedidos[pedido.protocolo];
        if (!statusPedido || statusPedido === '-') return false;
        
        // Normaliza o status para comparação (minúsculo e sem acentos)
        const statusNormalizado = statusPedido.toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        
        return statusMarcados.some(statusMarcado => {
          const statusMarcadoNormalizado = statusMarcado.toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
          return statusNormalizado.includes(statusMarcadoNormalizado) || 
                 statusMarcadoNormalizado.includes(statusNormalizado);
        });
      });
    }

    setPedidosFiltrados(pedidosFiltradosTemp);
  };

  // Função para limpar filtros
  const limparFiltros = () => {
    setDataInicial('');
    setDataFinal('');
    setStatusSelecionados({
      'aguardando conferência': true,
      'aguardando pagamento': true,
      'aguardando execução': true,
      'aguardando entrega': true,
      'concluído': false
    });
    setPedidosFiltrados(pedidos);
  };

  // Função para alterar status selecionado
  const handleStatusChange = (status, checked) => {
    setStatusSelecionados(prev => ({
      ...prev,
      [status]: checked
    }));
  };

  // Aplicar filtros sempre que as datas, status ou pedidos mudarem
  useEffect(() => {
    aplicarFiltros();
  }, [dataInicial, dataFinal, statusSelecionados, pedidos, statusPedidos]);

  return (
    <div style={{ /* ...estilos... */ }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 24,
        padding: '16px 24px',
        background: '#ffffff',
        borderRadius: 12,
        boxShadow: '0 2px 8px rgba(44,62,80,0.12)'
      }}>
        <button
          onClick={() => navigate('/manutencao-servicos')}
          style={{
            background: '#27ae60',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            padding: '12px 32px',
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(44,62,80,0.12)'
          }}
        >
          + NOVO PEDIDO
        </button>

        {/* Filtros de Data */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#2c3e50' }}>Data Inicial:</label>
            <input
              type="date"
              value={dataInicial}
              onChange={e => setDataInicial(e.target.value)}
              style={{
                border: '1.5px solid #bdc3c7',
                borderRadius: 6,
                padding: '8px 12px',
                fontSize: 14,
                minWidth: 140,
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#2c3e50' }}>Data Final:</label>
            <input
              type="date"
              value={dataFinal}
              onChange={e => setDataFinal(e.target.value)}
              style={{
                border: '1.5px solid #bdc3c7',
                borderRadius: 6,
                padding: '8px 12px',
                fontSize: 14,
                minWidth: 140,
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Filtros de Status */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#2c3e50' }}>Status do Pedido:</label>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              padding: '8px 12px',
              border: '1.5px solid #bdc3c7',
              borderRadius: 6,
              background: '#ffffff',
              minWidth: 280,
              maxWidth: 320
            }}>
              {Object.keys(statusSelecionados).map(status => (
                <label key={status} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer',
                  fontSize: 12,
                  color: '#2c3e50',
                  whiteSpace: 'nowrap'
                }}>
                  <input
                    type="checkbox"
                    checked={statusSelecionados[status]}
                    onChange={e => handleStatusChange(status, e.target.checked)}
                    style={{ margin: 0 }}
                  />
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={limparFiltros}
            style={{
              background: '#95a5a6',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              marginTop: 16,
              boxShadow: '0 2px 4px rgba(44,62,80,0.12)'
            }}
          >
            Limpar Filtros
          </button>
        </div>
      </div>

      {/* Linha divisória */}
      <div style={{
        height: '1px',
        background: 'linear-gradient(to right, transparent, #bdc3c7, transparent)',
        margin: '0 24px 16px 24px'
      }}></div>

      {/* Informação dos resultados */}
      <div style={{
        padding: '8px 16px',
        background: '#ecf0f1',
        borderRadius: 8,
        marginBottom: 16,
        fontSize: 14,
        color: '#2c3e50',
        fontWeight: 600
      }}>
        {(() => {
          const statusMarcados = Object.keys(statusSelecionados).filter(status => statusSelecionados[status]);
          const temFiltroData = dataInicial || dataFinal;
          const temFiltroStatus = statusMarcados.length > 0;
          
          if (temFiltroData || temFiltroStatus) {
            return (
              <>
                Exibindo <strong>{pedidosFiltrados.length}</strong> de <strong>{pedidos.length}</strong> pedidos
                {temFiltroData && (
                  <>
                    {dataInicial && dataFinal && ` (período: ${new Date(dataInicial).toLocaleDateString('pt-BR')} até ${new Date(dataFinal).toLocaleDateString('pt-BR')})`}
                    {dataInicial && !dataFinal && ` (a partir de ${new Date(dataInicial).toLocaleDateString('pt-BR')})`}
                    {!dataInicial && dataFinal && ` (até ${new Date(dataFinal).toLocaleDateString('pt-BR')})`}
                  </>
                )}
                {temFiltroStatus && (
                  <> - Status: <strong>{statusMarcados.join(', ')}</strong></>
                )}
              </>
            );
          } else {
            return <>Total de <strong>{pedidos.length}</strong> pedidos</>;
          }
        })()}
      </div>
      
      {/* Tabela de pedidos */}
      <div style={{ marginTop: 24, borderRadius: 12, background: '#f4f6f8', padding: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#e9ecef' }}>
              <th style={{ padding: 8 }}>Criado em</th>
              <th style={{ padding: 8 }}>Protocolo</th>
              <th style={{ padding: 8 }}>Cliente</th>
              <th style={{ padding: 8 }}>Descrição</th>
              <th style={{ padding: 8 }}>Status</th>
              <th style={{ padding: 8 }}>Prazo</th>
              <th style={{ padding: 8 }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {pedidosFiltrados.map((p, idx) => {
              return (
                <tr key={p.protocolo} style={{ background: idx % 2 === 0 ? '#fff' : '#f8f9fa' }}>
                  <td style={{ padding: 8 }}>{formatDateTime(p.criado_em)}</td>
                  <td style={{ padding: 8 }}>{p.protocolo}</td>
                  <td style={{ padding: 8 }}>{p.cliente?.nome || '-'}</td>
                  <td style={{ padding: 8 }}>{p.descricao || '-'}</td>
                  <td style={{ padding: 8 }}>{statusPedidos[p.protocolo] || '-'}</td>
                  <td style={{ padding: 8 }}>{formatDate(p.prazo)}</td>
                  <td style={{ padding: 8, display: 'flex', gap: 8 }}>
                    <button
                      style={{
                        background: '#3498db',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        padding: '6px 16px',
                        fontWeight: 'bold',
                        fontSize: 14,
                        cursor: 'pointer'
                      }}
                      onClick={() => navigate(`/manutencao-servicos?protocolo=${encodeURIComponent(p.protocolo)}`)}
                    >
                      EDITAR
                    </button>
                    <button
                      style={{
                        background: '#e67e22',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        padding: '6px 16px',
                        fontWeight: 'bold',
                        fontSize: 14,
                        cursor: 'pointer'
                      }}
                      onClick={() => navigate(`/recibo/${encodeURIComponent(p.protocolo)}`)}
                    >
                      RECIBO
                    </button>
                    <button
                      style={{
                        background: '#e74c3c',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        padding: '6px 16px',
                        fontWeight: 'bold',
                        fontSize: 14,
                        cursor: 'pointer'
                      }}
                      onClick={async () => {
                        if (window.confirm(`Tem certeza que deseja apagar o pedido ${p.protocolo}?`)) {
                          try {
                            const token = localStorage.getItem('token');
                            const res = await fetch(`${config.apiURL}/pedidos/${encodeURIComponent(p.protocolo)}`, {
                              method: 'DELETE',
                              headers: { Authorization: `Bearer ${token}` }
                            });
                            if (res.ok) {
                              setPedidos(pedidos => pedidos.filter(x => x.protocolo !== p.protocolo));
                            } else {
                              alert('Erro ao apagar pedido.');
                            }
                          } catch (err) {
                            alert('Erro ao apagar pedido.');
                          }
                        }
                      }}
                    >
                      APAGAR
                    </button>
                  </td>
                </tr>
              );
            })}
            {pedidosFiltrados.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 16, color: '#888' }}>
                  {pedidos.length === 0 ? 'Nenhum pedido encontrado.' : 'Nenhum pedido encontrado para o período selecionado.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}