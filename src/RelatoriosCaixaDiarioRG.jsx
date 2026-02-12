import React, { useEffect, useState } from 'react';
import { apiURL } from './config';
import { getUsuariosMap } from './utilsUsuarios';
import BackgroundWrapper from './components/common/BackgroundWrapper';

function MeusFechamentosRG() {
  const [fechamentos, setFechamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [usuariosServentia, setUsuariosServentia] = useState([]);
  const [caixaUnificado, setCaixaUnificado] = useState(false);
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  const nomeUsuario = usuario?.nome || '';

  useEffect(() => {
    async function fetchConfigECaixas() {
      setLoading(true);
      setErro('');
      let caixaUnificadoDB = false;
      let usuariosDaServentia = [usuario];

      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${apiURL}/configuracoes-serventia?serventia=${encodeURIComponent(usuario.serventia)}`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        caixaUnificadoDB = !!data.caixa_unificado;
        setCaixaUnificado(caixaUnificadoDB);
      } catch (e) {
        setErro('Erro ao buscar configuração da serventia: ' + (e.message || e));
      }

      if (caixaUnificadoDB) {
        try {
          const token = localStorage.getItem('token');
          const resUsuarios = await fetch(`${apiURL}/usuarios/mesma-serventia?serventia=${encodeURIComponent(usuario.serventia)}`, { headers: { Authorization: `Bearer ${token}` } });
          if (!resUsuarios.ok) throw new Error('Erro ao buscar usuários da mesma serventia');
          const dataUsuarios = await resUsuarios.json();
          usuariosDaServentia = dataUsuarios.usuarios || [];
          setUsuariosServentia(usuariosDaServentia);
        } catch (e) {
          setErro('Erro ao buscar usuários: ' + (e.message || e));
          usuariosDaServentia = [usuario];
          setUsuariosServentia([usuario]);
        }
      } else {
        setUsuariosServentia([usuario]);
      }

      try {
        let url = `${apiURL}/rg/meus-fechamentos`;
        if (caixaUnificadoDB && usuariosDaServentia.length > 0) {
          const nomes = usuariosDaServentia.map(u => u.nome).join(',');
          url += `?usuarios=${encodeURIComponent(nomes)}`;
        }
        const token = localStorage.getItem('token');
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        setFechamentos(data.fechamentos || []);
      } catch (e) {
        setErro('Erro ao buscar fechamentos: ' + (e.message || e));
      }
      setLoading(false);
    }
    fetchConfigECaixas();
  }, [nomeUsuario, usuario?.serventia]);

  return (
    <BackgroundWrapper padding={24}>
      <div style={{ background: 'white', borderRadius: 12, padding: 24, margin: '32px auto', maxWidth: 900, boxShadow: '0 4px 16px rgba(0,0,0,0.08)', position: 'relative', zIndex: 1 }}>
        <h2 style={{ marginBottom: 18, color: '#2c3e50' }}>🗂️ Fechamentos de Caixa — RG</h2>
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
              <th style={{ padding: 8, borderBottom: '1px solid #ddd', textAlign: 'center' }}>Total Entradas</th>
              <th style={{ padding: 8, borderBottom: '1px solid #ddd', textAlign: 'center' }}>Total Saídas</th>
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
              .sort((a, b) => {
                const dateA = new Date(a.data + ' ' + (a.hora || '00:00:00'));
                const dateB = new Date(b.data + ' ' + (b.hora || '00:00:00'));
                return dateA - dateB;
              })
              .map((f, idx, sortedArray) => {
                const valorInicial = fechamentos.find(fi => fi.codigo === '0005' && fi.data === f.data);
                let backgroundColor = '#d4edda';
                if (idx < sortedArray.length - 1) {
                  const valorInicialAtual = fechamentos.find(fi => fi.codigo === '0005' && fi.data === f.data);
                  const valorInicialAtualNum = Number(valorInicialAtual?.valor_unitario || valorInicialAtual?.total_valor || 0);
                  const fechamentoPosterior = sortedArray[idx + 1];
                  const valorFinalPosterior = Number(fechamentoPosterior.total_valor || 0);
                  const diferenca = Math.abs(valorInicialAtualNum - valorFinalPosterior);
                  if (diferenca > 2.00) backgroundColor = '#ffd1d1';
                }

                return (
                  <tr key={f.data + f.hora + f.codigo + idx} style={{ backgroundColor }}>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'center' }}>{f.data ? f.data.slice(0,10).split('-').reverse().join('/') : ''}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'center' }}>{f.hora || ''}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'center' }}>{valorInicial && (valorInicial.valor_unitario || valorInicial.total_valor) ? Number(valorInicial.valor_unitario || valorInicial.total_valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'center' }}>{Number(f.total_entradas || f.totalEntradas || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'center' }}>{Number(f.total_saidas || f.totalSaidas || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'center' }}>{Number(f.total_valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'center' }}>{f.usuario}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      )}
    </div>
    </BackgroundWrapper>
  );
}

export default MeusFechamentosRG;
