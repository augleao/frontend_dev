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

  // Helper para extrair um valor numérico real de um registro de ato/fechamento
  const obterValorAto = (ato) => {
    if (!ato) return 0;
    const toNum = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };

    // 1) detalhes_pagamentos.valor_total (quando presente)
    if (ato.detalhes_pagamentos && (ato.detalhes_pagamentos.valor_total || ato.detalhes_pagamentos.valor_total === 0)) {
      return toNum(ato.detalhes_pagamentos.valor_total);
    }

    // 2) total_valor (campo usado em outros relatórios)
    if (ato.total_valor || ato.total_valor === 0) {
      return toNum(ato.total_valor);
    }

    // 3) valor_unitario
    if (ato.valor_unitario || ato.valor_unitario === 0) {
      return toNum(ato.valor_unitario);
    }

    // 4) se existe objeto pagamentos com valores, somar esses valores
    if (ato.pagamentos && typeof ato.pagamentos === 'object') {
      try {
        const soma = Object.values(ato.pagamentos).reduce((acc, p) => {
          // p pode ser número ou objeto com .valor
          if (p == null) return acc;
          if (typeof p === 'number') return acc + toNum(p);
          if (typeof p === 'object') return acc + toNum(p.valor || p.valor_total || 0);
          return acc + toNum(p);
        }, 0);
        if (soma) return soma;
      } catch (e) {
        // ignore
      }
    }

    return 0;
  };

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
        const res = await fetch(`${apiURL}/configuracoes-serventia?serventia=${encodeURIComponent(usuario.serventia)}`,
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
          const token = localStorage.getItem('token');
          const resUsuarios = await fetch(`${apiURL}/usuarios/mesma-serventia?serventia=${encodeURIComponent(usuario.serventia)}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (!resUsuarios.ok) throw new Error('Erro ao buscar usuários da mesma serventia');
          const dataUsuarios = await resUsuarios.json();
          usuariosDaServentia = dataUsuarios.usuarios || [];
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
                  <th style={{ padding: 8, borderBottom: '1px solid #ddd', textAlign: 'center' }}>Entradas</th>
                  <th style={{ padding: 8, borderBottom: '1px solid #ddd', textAlign: 'center' }}>Saídas</th>
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
                // Ordena por data e hora para comparação sequencial
                const dateA = new Date(a.data + ' ' + (a.hora || '00:00:00'));
                const dateB = new Date(b.data + ' ' + (b.hora || '00:00:00'));
                return dateA - dateB;
              })
                .map((f, idx, sortedArray) => {
                // Busca valor de abertura de qualquer usuário da mesma serventia na mesma data
                const valorInicial = fechamentos.find(
                  fi =>
                    fi.codigo === '0005' &&
                    fi.data === f.data
                );

                // Calcular Entradas (código 0003) e Saídas (código 0002) para a mesma data
                const entradasLista = fechamentos.filter(fi => fi.codigo === '0003' && fi.data === f.data);
                const entradasValor = entradasLista.reduce((acc, it) => acc + obterValorAto(it), 0);

                const saidasLista = fechamentos.filter(fi => fi.codigo === '0002' && fi.data === f.data);
                const saidasValor = saidasLista.reduce((acc, it) => acc + obterValorAto(it), 0);

                // Logs de debug para entender por que saiu 0
                if ((entradasValor === 0 && entradasLista.length > 0) || (saidasValor === 0 && saidasLista.length > 0)) {
                  console.log(`[RelatoriosCaixaDiario] Debug valores para data ${f.data}: entradasCount=${entradasLista.length}, entradasSum=${entradasValor}, saidasCount=${saidasLista.length}, saidasSum=${saidasValor}`);
                  console.log('Exemplos de registros de entrada:', entradasLista.slice(0,3));
                  console.log('Exemplos de registros de saída:', saidasLista.slice(0,3));
                }

                // Determinar cor de fundo baseada na comparação entre Valor Inicial da linha atual e Valor Final da linha posterior
                let backgroundColor = '#d4edda'; // verde padrão (mesma cor do CaixaDiario)

                if (idx < sortedArray.length - 1) {
                  // Busca valor de abertura da linha atual
                  const valorInicialAtual = fechamentos.find(
                    fi =>
                      fi.codigo === '0005' &&
                      fi.data === f.data
                  );
                  const valorInicialAtualNum = Number(valorInicialAtual?.valor_unitario || valorInicialAtual?.total_valor || 0);
                  const fechamentoPosterior = sortedArray[idx + 1];
                  const valorFinalPosterior = Number(fechamentoPosterior.total_valor || 0);

                  const diferenca = Math.abs(valorInicialAtualNum - valorFinalPosterior);

                  if (diferenca > 2.00) {
                    backgroundColor = '#ffd1d1'; // vermelho se diferença > R$2,00 (mesma cor do CaixaDiario)
                  }

                  console.log(`[RelatoriosCaixaDiario] Comparação ${idx}: Abertura atual: R$${valorInicialAtualNum.toFixed(2)}, Fechamento posterior: R$${valorFinalPosterior.toFixed(2)}, Diferença: R$${diferenca.toFixed(2)}, Cor: ${diferenca > 2.00 ? 'vermelho' : 'verde'}`);
                }

                return (
                  <tr key={f.data + f.hora + f.codigo + idx} style={{ backgroundColor }}>
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
                      {Number(entradasValor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'center' }}>
                      {Number(saidasValor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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