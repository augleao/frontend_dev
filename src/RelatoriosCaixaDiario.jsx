import React, { useEffect, useState } from 'react';
import { apiURL } from './config';
import { getUsuariosMap } from './utilsUsuarios';

function MeusFechamentos() {
  const [fechamentos, setFechamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [usuariosServentia, setUsuariosServentia] = useState([]);
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  const nomeUsuario = usuario?.nome || '';

  useEffect(() => {
    async function fetchFechamentosEUsuarios() {
      setLoading(true);
      setErro('');
      try {
        console.log('[MeusFechamentos] Usuário logado:', usuario);
        // Buscar usuários da mesma serventia
        const usuariosMap = await getUsuariosMap();
        const usuariosDaServentia = Array.from(usuariosMap.values()).filter(u => u.serventia === usuario.serventia);
        console.log('[MeusFechamentos] Usuários da mesma serventia encontrados:', usuariosDaServentia);
        setUsuariosServentia(usuariosDaServentia);
        // Montar a query string se houver usuários da serventia
        let url = `${apiURL}/meus-fechamentos`;
        if (usuariosDaServentia.length > 0) {
          const nomes = usuariosDaServentia.map(u => u.nome).join(',');
          url += `?usuarios=${encodeURIComponent(nomes)}`;
          console.log('[MeusFechamentos] Enviando lista de usuários na query:', nomes);
        }
        const token = localStorage.getItem('token');
        const res = await fetch(
          url,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        console.log('[MeusFechamentos] Fechamentos recebidos:', data.fechamentos);
        setFechamentos(data.fechamentos || []);
      } catch (e) {
        setErro(e.message);
        console.error('[MeusFechamentos] Erro ao buscar usuários/fechamentos:', e);
      }
      setLoading(false);
    }
    fetchFechamentosEUsuarios();
  }, [nomeUsuario, usuario?.serventia]);

  console.log('Usuários da mesma serventia:', usuariosServentia);
  console.log('Fechamentos:', fechamentos);

  return (
    <div style={{
      background: 'white',
      borderRadius: 12,
      padding: 24,
      margin: '32px auto',
      maxWidth: 900,
      boxShadow: '0 4px 16px rgba(0,0,0,0.08)'
    }}>
      <h2 style={{ marginBottom: 18, color: '#2c3e50' }}>🗂️ Meus Fechamentos de Caixa</h2>
      <div style={{ marginBottom: 18 }}>
        <strong>Usuários da mesma serventia:</strong>
        <ul>
          {usuariosServentia.map(u => (
            <li key={u.id}>{u.nome} ({u.email})</li>
          ))}
        </ul>
      </div>
      {loading && <div>Carregando...</div>}
      {erro && <div style={{ color: 'red' }}>{erro}</div>}
      {/* A tabela de fechamentos permanece igual por enquanto */}
      {!loading && fechamentos.length === 0 && <div>Nenhum fechamento encontrado.</div>}
      {!loading && fechamentos.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
          <thead>
            <tr style={{ background: '#f8f9fa' }}>
              <th style={{ padding: 8, borderBottom: '1px solid #ddd', textAlign: 'center' }}>Data</th>
              <th style={{ padding: 8, borderBottom: '1px solid #ddd', textAlign: 'center' }}>Hora</th>
              <th style={{ padding: 8, borderBottom: '1px solid #ddd', textAlign: 'center' }}>Valor Inicial</th>
              <th style={{ padding: 8, borderBottom: '1px solid #ddd', textAlign: 'center' }}>Valor Final</th>
              <th style={{ padding: 8, borderBottom: '1px solid #ddd', textAlign: 'center' }}>Usuário</th>
            </tr>
          </thead>
          <tbody>
            {fechamentos
              .filter(f => {
                // Se houver lista de usuários da serventia, filtra só os fechamentos desses usuários
                if (usuariosServentia.length > 0) {
                  return f.codigo === '0001' && usuariosServentia.some(u => u.nome === f.usuario);
                }
                // Caso não tenha lista, mantém filtro antigo (apenas código 0001)
                return f.codigo === '0001';
              })
              .map((f, idx) => {
                const valorInicial = fechamentos.find(
                  fi =>
                    fi.codigo === '0005' &&
                    fi.data === f.data &&
                    fi.usuario === f.usuario
                );
                return (
                  <tr key={f.data + f.hora + f.codigo + idx}>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'center' }}>
                      {f.data ? f.data.slice(0, 10).split('-').reverse().join('/') : ''}
                    </td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'center' }}>{f.hora || ''}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'center' }}>
                      {valorInicial && (valorInicial.valor_unitario || valorInicial.total_valor)
                        ? Number(valorInicial.valor_unitario || valorInicial.total_valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                        : '-'}
                    </td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'center' }}>
                      {Number(f.total_valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'center' }}>{f.usuario}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default MeusFechamentos;