import React, { useEffect, useState } from 'react';
import { apiURL } from './config';
import { getUsuariosMap } from './utilsUsuarios';

function MeusFechamentos() {
  const [fechamentos, setFechamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [usuariosServentia, setUsuariosServentia] = useState([]);
  const [caixaUnificado, setCaixaUnificado] = useState(false);
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  const nomeUsuario = usuario?.nome || '';
  const idServentia = usuario?.serventia_id || usuario?.serventiaId || usuario?.serventia;

  useEffect(() => {
    async function fetchConfigECaixas() {
      setLoading(true);
      setErro('');
      let caixaUnificadoDB = false;
      let usuariosDaServentia = [usuario];
      console.log('[RelatoriosCaixaDiario] Usuário logado:', usuario);
      // 1. Buscar config de caixa unificado
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${apiURL}/serventias/${idServentia}`,
          { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        caixaUnificadoDB = !!data.caixa_unificado;
        setCaixaUnificado(caixaUnificadoDB);
        console.log('[RelatoriosCaixaDiario] Configuração caixa_unificado:', data.caixa_unificado, '| caixaUnificadoDB:', caixaUnificadoDB);
      } catch (e) {
        setErro('Erro ao buscar configuração da serventia: ' + (e.message || e));
        console.error('[RelatoriosCaixaDiario] Erro ao buscar configuração da serventia:', e);
      }

      // 2. Buscar usuários da serventia se caixa unificado
      if (caixaUnificadoDB) {
        try {
          const usuariosMap = await getUsuariosMap();
          usuariosDaServentia = Array.from(usuariosMap.values()).filter(u => u.serventia === usuario.serventia);
          setUsuariosServentia(usuariosDaServentia);
          console.log('[RelatoriosCaixaDiario] Usuários da mesma serventia:', usuariosDaServentia);
        } catch (e) {
          setErro('Erro ao buscar usuários: ' + (e.message || e));
          usuariosDaServentia = [usuario];
          setUsuariosServentia([usuario]);
          console.error('[RelatoriosCaixaDiario] Erro ao buscar usuários:', e);
        }
      } else {
        setUsuariosServentia([usuario]);
        console.log('[RelatoriosCaixaDiario] Caixa não unificado, usando apenas usuário logado:', usuario);
      }

      // 3. Buscar fechamentos
      try {
        let url = `${apiURL}/meus-fechamentos`;
        if (caixaUnificadoDB && usuariosDaServentia.length > 0) {
          const nomes = usuariosDaServentia.map(u => u.nome).join(',');
          url += `?usuarios=${encodeURIComponent(nomes)}`;
          console.log('[RelatoriosCaixaDiario] URL de fechamentos (unificado):', url);
        } else {
          console.log('[RelatoriosCaixaDiario] URL de fechamentos (não unificado):', url);
        }
        const token = localStorage.getItem('token');
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        setFechamentos(data.fechamentos || []);
        console.log('[RelatoriosCaixaDiario] Fechamentos recebidos:', data.fechamentos);
      } catch (e) {
        setErro('Erro ao buscar fechamentos: ' + (e.message || e));
        console.error('[RelatoriosCaixaDiario] Erro ao buscar fechamentos:', e);
      }
      setLoading(false);
    }
    fetchConfigECaixas();
  }, [nomeUsuario, usuario?.serventia]);

  return (
    <div style={{
      background: 'white',
      borderRadius: 12,
      padding: 24,
      margin: '32px auto',
      maxWidth: 900,
      boxShadow: '0 4px 16px rgba(0,0,0,0.08)'
    }}>
      <h2 style={{ marginBottom: 18, color: '#2c3e50' }}>🗂️ Fechamentos de Caixa</h2>
      {loading && <div>Carregando...</div>}
      {erro && <div style={{ color: 'red' }}>{erro}</div>}
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
                if (usuariosServentia.length > 0) {
                  return f.codigo === '0001' && usuariosServentia.some(u => u.nome === f.usuario);
                }
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