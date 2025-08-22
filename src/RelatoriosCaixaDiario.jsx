import React, { useEffect, useState } from 'react';
import { apiURL } from './config';
import { getUsuariosMap } from './utilsUsuarios';

function MeusFechamentos() {
  const [fechamentos, setFechamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [caixaUnificado, setCaixaUnificado] = useState(false);
  const [usuariosServentia, setUsuariosServentia] = useState([]);
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  const nomeUsuario = usuario?.nome || '';

  useEffect(() => {
    async function fetchConfigAndFechamentos() {
      setLoading(true);
      setErro('');
      try {
        // 1. Buscar config de caixa unificado da serventia
        if (!usuario?.serventia) throw new Error('Usuário sem serventia');
        const configRes = await fetch(`${apiURL}/configuracoes-serventia?serventia=${encodeURIComponent(usuario.serventia)}`);
        if (!configRes.ok) throw new Error('Erro ao buscar configuração da serventia');
        const configData = await configRes.json();
        setCaixaUnificado(!!configData.caixa_unificado);
        console.log('[MeusFechamentos] caixaUnificado:', !!configData.caixa_unificado);

        // 2. Buscar fechamentos normalmente
        const token = localStorage.getItem('token');
        const res = await fetch(
          `${apiURL}/meus-fechamentos`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        let fechamentosRecebidos = data.fechamentos || [];
        console.log('[MeusFechamentos] Fechamentos recebidos:', fechamentosRecebidos);

        // 3. Se caixa unificado, buscar todos usuários da serventia e filtrar fechamentos
        if (configData.caixa_unificado) {
          const usuariosMap = await getUsuariosMap();
          const usuariosDaServentia = Array.from(usuariosMap.values()).filter(u => u.serventia === usuario.serventia);
          setUsuariosServentia(usuariosDaServentia);
          const nomesUsuariosServentia = usuariosDaServentia.map(u => u.nome);
          // Filtra fechamentos de todos os usuários da serventia
          fechamentosRecebidos = fechamentosRecebidos.filter(f => nomesUsuariosServentia.includes(f.usuario));
          console.log('[MeusFechamentos] Fechamentos filtrados (caixa unificado):', fechamentosRecebidos);
        } else {
          // Se não for unificado, filtra só do usuário logado
          fechamentosRecebidos = fechamentosRecebidos.filter(f => f.usuario === nomeUsuario);
        }
        setFechamentos(fechamentosRecebidos);
      } catch (e) {
        setErro(e.message);
        console.error('[MeusFechamentos] Erro:', e);
      }
      setLoading(false);
    }
    fetchConfigAndFechamentos();
  }, [nomeUsuario, usuario?.serventia]);

  console.log('[MeusFechamentos] fechamentos no estado:', fechamentos);

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
            </tr>
          </thead>
          <tbody>
            {fechamentos
              .filter(f => {
                const isFechamento = f.codigo === '0001';
                if (!isFechamento) return false;
                console.log('[MeusFechamentos] Fechamento encontrado:', f);
                return true;
              })
              .map((f, idx) => {
                const valorInicial = fechamentos.find(
                  fi =>
                    fi.codigo === '0005' &&
                    fi.data === f.data &&
                    fi.usuario === f.usuario
                );
                if (valorInicial) {
                  console.log('[MeusFechamentos] Valor inicial encontrado para fechamento:', f, valorInicial);
                } else {
                  console.log('[MeusFechamentos] Nenhum valor inicial encontrado para fechamento:', f);
                }
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