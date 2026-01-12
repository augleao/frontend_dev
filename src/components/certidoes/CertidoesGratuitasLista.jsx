import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import config from '../../config';

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  if (/^\d{8,}/.test(dateStr)) {
    const ano = dateStr.slice(0, 4);
    const mes = dateStr.slice(4, 6);
    const dia = dateStr.slice(6, 8);
    const hora = dateStr.slice(8, 10) || '00';
    const min = dateStr.slice(10, 12) || '00';
    const seg = dateStr.slice(12, 14) || '00';
    return `${dia}/${mes}/${ano} às ${hora}:${min}:${seg}`;
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  const hora = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const seg = String(d.getSeconds()).padStart(2, '0');
  return `${dia}/${mes}/${ano} às ${hora}:${min}:${seg}`;
}

export default function CertidoesGratuitasLista() {
  const [registros, setRegistros] = useState([]);
  const [filtrados, setFiltrados] = useState([]);
  const [dataInicial, setDataInicial] = useState('');
  const [dataFinal, setDataFinal] = useState('');
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchCertidoes() {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        // Busca certidões gratuitas já filtradas por serventia no backend
        const res = await fetch(`${config.apiURL}/certidoes-gratuitas`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Falha ao carregar certidões gratuitas');
        const data = await res.json();
        const lista = data.certidoes || data.items || data || [];
        setRegistros(lista);
        setFiltrados(lista);
      } catch (e) {
        setRegistros([]);
        setFiltrados([]);
      }
      setLoading(false);
    }
    fetchCertidoes();
  }, []);

  // Aplicar filtros
  useEffect(() => {
    let tmp = [...registros];

    if (busca.trim()) {
      const q = busca.trim().toLowerCase();
      tmp = tmp.filter(c => {
        const protocolo = (c.protocolo || c.numero || '').toString().toLowerCase();
        const requerente = (c.requerente?.nome || c.requerente || '').toString().toLowerCase();
        const tipo = (c.tipo || c.tipo_certidao || '').toString().toLowerCase();
        return protocolo.includes(q) || requerente.includes(q) || tipo.includes(q);
      });
    }

    if (dataInicial || dataFinal) {
      tmp = tmp.filter(c => {
        const raw = c.criado_em || c.created_at || c.data || null;
        if (!raw) return false;
        const d = new Date(raw);
        if (isNaN(d.getTime())) return false;
        const start = dataInicial ? new Date(`${dataInicial}T00:00:00`) : null;
        const end = dataFinal ? new Date(`${dataFinal}T23:59:59`) : null;
        if (start && d < start) return false;
        if (end && d > end) return false;
        return true;
      });
    }

    setFiltrados(tmp);
  }, [busca, dataInicial, dataFinal, registros]);

  return (
    <div>
      {/* Barra de ações e filtros (layout inspirado em ServicoLista) */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 12,
        padding: '8px 12px',
        background: '#ffffff',
        borderRadius: 12,
        boxShadow: '0 2px 8px rgba(44,62,80,0.12)'
      }}>
        <button
          onClick={() => navigate('/certidoes-gratuitas/nova')}
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
          + NOVA CERTIDÃO GRATUITA
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Busca texto */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#2c3e50' }}>Buscar</label>
            <input
              type="text"
              placeholder="Protocolo, requerente ou tipo..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              style={{
                border: '1.5px solid #bdc3c7',
                borderRadius: 6,
                padding: '8px 12px',
                fontSize: 14,
                minWidth: 220,
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Data inicial */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#2c3e50' }}>Data Inicial</label>
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

          {/* Data final */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#2c3e50' }}>Data Final</label>
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

          <button
            onClick={() => { setDataInicial(''); setDataFinal(''); setBusca(''); setFiltrados(registros); }}
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

      {/* Tabela */}
      <div style={{ marginTop: 12, borderRadius: 12, background: '#f4f6f8', padding: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'center' }}>
          <thead>
            <tr style={{ background: '#e9ecef' }}>
              <th style={{ padding: 8, textAlign: 'center' }}>Criado em</th>
              <th style={{ padding: 8, textAlign: 'center' }}>Protocolo</th>
              <th style={{ padding: 8, textAlign: 'center' }}>Requerente</th>
              <th style={{ padding: 8, textAlign: 'center' }}>Tipo</th>
              <th style={{ padding: 8, textAlign: 'center' }}>Status</th>
              <th style={{ padding: 8, textAlign: 'center' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((c, idx) => {
              const protocolo = c.protocolo || c.numero || c.id || '-';
              const requerente = c.requerente?.nome || c.requerente || '-';
              const tipo = c.tipo || c.tipo_certidao || '-';
              const status = c.status || c.situacao || '-';
              const criadoEm = c.criado_em || c.created_at || c.data || null;
              return (
                <tr key={`${protocolo}-${idx}`} style={{ background: idx % 2 === 0 ? '#fff' : '#f8f9fa' }}>
                  <td style={{ padding: 8, textAlign: 'center' }}>{formatDateTime(criadoEm)}</td>
                  <td style={{ padding: 8, textAlign: 'center' }}>{protocolo}</td>
                  <td style={{ padding: 8, textAlign: 'center' }}>{requerente}</td>
                  <td style={{ padding: 8, textAlign: 'center' }}>{tipo}</td>
                  <td style={{ padding: 8, fontWeight: 700, color: '#2c3e50', textAlign: 'center' }}>{status}</td>
                  <td style={{ padding: 8, display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button
                      style={{
                        background: '#3498db', color: '#fff', border: 'none', borderRadius: 6,
                        padding: '6px 16px', fontWeight: 'bold', fontSize: 14, cursor: 'pointer'
                      }}
                      onClick={() => navigate(`/certidoes-gratuitas/${encodeURIComponent(protocolo)}/editar`)}
                    >
                      EDITAR
                    </button>
                    <button
                      style={{
                        background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 6,
                        padding: '6px 16px', fontWeight: 'bold', fontSize: 14, cursor: 'pointer'
                      }}
                      onClick={async () => {
                        if (!protocolo || protocolo === '-') return;
                        if (window.confirm(`Apagar certidão ${protocolo}?`)) {
                          try {
                            const token = localStorage.getItem('token');
                            const del = await fetch(`${config.apiURL}/certidoes-gratuitas/${encodeURIComponent(protocolo)}`, {
                              method: 'DELETE',
                              headers: { Authorization: `Bearer ${token}` }
                            });
                            if (del.ok) {
                              setRegistros(prev => prev.filter(x => (x.protocolo || x.numero || x.id) !== protocolo));
                            } else {
                              alert('Erro ao apagar certidão.');
                            }
                          } catch (e) {
                            alert('Erro ao apagar certidão.');
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
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 16, color: '#888' }}>
                  Carregando certidões...
                </td>
              </tr>
            ) : filtrados.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 16, color: '#888' }}>
                  {registros.length === 0 ? 'Nenhuma certidão encontrada.' : 'Nenhuma certidão encontrada para os filtros aplicados.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
