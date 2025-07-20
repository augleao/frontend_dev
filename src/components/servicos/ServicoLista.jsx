import React, { useEffect, useState } from 'react';

export default function ServicoLista({ servicos: initialServicos, filtro, setFiltro, tiposServico, statusExecucao, statusPagamento, onVerDetalhes }) {
  const [servicos, setServicos] = useState(initialServicos);

  useEffect(() => {
    async function fetchPedidos() {
      const token = localStorage.getItem('token');
      const res = await fetch(`${config.apiURL}/pedidos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setServicos(data.pedidos || []);
    }
    fetchPedidos();
  }, []);

  return (
    <div>
      <h3>Serviços Registrados</h3>
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <input type="text" placeholder="Filtrar por protocolo" value={filtro.protocolo} onChange={e => setFiltro(f => ({ ...f, protocolo: e.target.value }))} style={{ width: 180 }} />
        <input type="text" placeholder="Filtrar por cliente" value={filtro.cliente} onChange={e => setFiltro(f => ({ ...f, cliente: e.target.value }))} style={{ width: 180 }} />
        <select value={filtro.tipo} onChange={e => setFiltro(f => ({ ...f, tipo: e.target.value }))} style={{ width: 180 }}>
          <option value="">Tipo de serviço</option>
          {tiposServico.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filtro.status} onChange={e => setFiltro(f => ({ ...f, status: e.target.value }))} style={{ width: 180 }}>
          <option value="">Status</option>
          {statusExecucao.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          {statusPagamento.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>
      <div style={{ borderRadius: 12, background: '#f4f6f8', padding: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#e9ecef' }}>
              <th style={{ padding: 8 }}>Protocolo</th>
              <th style={{ padding: 8 }}>Tipo</th>
              <th style={{ padding: 8 }}>Cliente</th>
              <th style={{ padding: 8 }}>Status</th>
              <th style={{ padding: 8 }}>Prazo</th>
              <th style={{ padding: 8 }}>Pagamento</th>
              <th style={{ padding: 8 }}>Entrega</th>
              <th style={{ padding: 8 }}>Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {servicos.map((s, idx) => (
              <tr key={s.protocolo} style={{ background: idx % 2 === 0 ? '#fff' : '#f8f9fa' }}>
                <td style={{ padding: 8 }}>{s.protocolo}</td>
                <td style={{ padding: 8 }}>{s.tipo}</td>
                <td style={{ padding: 8 }}>{s.cliente.nome}</td>
                <td style={{ padding: 8 }}>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: 6,
                    background: statusExecucao.find(st => st.value === s.execucao.status)?.color || '#ccc',
                    color: 'white',
                    fontWeight: '600'
                  }}>
                    {statusExecucao.find(st => st.value === s.execucao.status)?.label || s.execucao.status}
                  </span>
                </td>
                <td style={{ padding: 8 }}>{s.prazo}</td>
                <td style={{ padding: 8 }}>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: 6,
                    background: statusPagamento.find(st => st.value === s.pagamento.status)?.color || '#ccc',
                    color: 'white',
                    fontWeight: '600'
                  }}>
                    {statusPagamento.find(st => st.value === s.pagamento.status)?.label || s.pagamento.status}
                  </span>
                </td>
                <td style={{ padding: 8 }}>{s.entrega.data ? `${s.entrega.data} ${s.entrega.hora}` : '-'}</td>
                <td style={{ padding: 8 }}>
                  <button onClick={() => onVerDetalhes(s)} style={{
                    padding: '4px 12px',
                    borderRadius: 6,
                    background: '#3498db',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer'
                  }}>
                    Ver detalhes
                  </button>
                </td>
              </tr>
            ))}
            {servicos.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 16, color: '#888' }}>Nenhum serviço encontrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}