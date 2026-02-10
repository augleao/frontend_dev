import React, { useEffect, useMemo, useState } from 'react';
import { apiURL } from './config';
import { formatarMoeda } from './utils';

const today = new Date();

const toISODate = (dateObj) => {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const currentDayISO = toISODate(today);
const currentMonthISO = currentDayISO.slice(0, 7);

const formatDisplayDate = (isoDate) => {
  if (!isoDate) return '-';
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3) return isoDate;
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString('pt-BR');
};

const monthBoundaries = (monthValue) => {
  if (!monthValue || !/^\d{4}-\d{2}$/.test(monthValue)) return null;
  const [year, month] = monthValue.split('-').map(Number);
  const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDayDate = new Date(year, month, 0);
  const lastDay = `${year}-${String(month).padStart(2, '0')}-${String(lastDayDate.getDate()).padStart(2, '0')}`;
  return { inicio: firstDay, fim: lastDay };
};

const modeOptions = [
  { value: 'month', label: 'Mês completo' },
  { value: 'day', label: 'Dia específico' },
  { value: 'range', label: 'Período personalizado' }
];

function RGRelatorioFinanceiro() {
  const usuario = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('usuario') || '{}');
    } catch (err) {
      return {};
    }
  }, []);

  const [modo, setModo] = useState('month');
  const [mesSelecionado, setMesSelecionado] = useState(currentMonthISO);
  const [diaSelecionado, setDiaSelecionado] = useState(currentDayISO);
  const [inicioPersonalizado, setInicioPersonalizado] = useState(currentMonthISO + '-01');
  const [fimPersonalizado, setFimPersonalizado] = useState(currentDayISO);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState(null);

  const serventia = usuario?.serventia || 'Serventia não definida';

  const periodoAtivo = useMemo(() => {
    if (!resultado?.periodo) return '';
    const { inicio, fim } = resultado.periodo;
    if (!inicio || !fim) return '';
    return `${formatDisplayDate(inicio)} até ${formatDisplayDate(fim)}`;
  }, [resultado]);

  const resolverIntervalo = () => {
    if (modo === 'month') {
      return monthBoundaries(mesSelecionado);
    }
    if (modo === 'day') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(diaSelecionado)) return null;
      return { inicio: diaSelecionado, fim: diaSelecionado };
    }
    if (modo === 'range') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(inicioPersonalizado) || !/^\d{4}-\d{2}-\d{2}$/.test(fimPersonalizado)) return null;
      const start = new Date(`${inicioPersonalizado}T00:00:00`);
      const end = new Date(`${fimPersonalizado}T00:00:00`);
      if (start > end) return null;
      return { inicio: inicioPersonalizado, fim: fimPersonalizado };
    }
    return null;
  };

  const gerarRelatorio = async (silent = false) => {
    const intervalo = resolverIntervalo();
    if (!intervalo) {
      if (!silent) setErro('Selecione um período válido antes de gerar o relatório.');
      return;
    }

    if (!apiURL) {
      setErro('apiURL não configurado.');
      return;
    }

    setLoading(true);
    setErro('');
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('rg_token');
      if (!token) throw new Error('Usuário não autenticado.');
      const params = new URLSearchParams({ startDate: intervalo.inicio, endDate: intervalo.fim });
      const res = await fetch(`${apiURL}/rg/relatorios/financeiro?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Erro ao gerar relatório.');
      }
      const data = await res.json();
      setResultado(data);
    } catch (err) {
      setResultado(null);
      setErro(err.message || 'Erro inesperado ao gerar o relatório.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    gerarRelatorio(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resumoCards = resultado ? [
    { label: 'Receitas no período', value: formatarMoeda(resultado.totalReceitas || 0), color: '#2ecc71' },
    { label: 'Despesas no período', value: formatarMoeda(resultado.totalDespesas || 0), color: '#e74c3c' },
    { label: 'Saldo projetado', value: formatarMoeda((resultado.totalReceitas || 0) - (resultado.totalDespesas || 0)), color: '#1abc9c' }
  ] : [];

  const receitaBruta = resultado?.totalReceitas || 0;
  const ficValor = resultado?.impostos?.fic || 0;
  const baseCalculo = resultado?.impostos?.baseCalculo || 0;
  const irpfValor = resultado?.impostos?.irpf || 0;
  const issValor = resultado?.impostos?.iss || 0;
  const liquidoAntesDespesas = receitaBruta - ficValor - irpfValor - issValor;

  const impostosCards = resultado ? [
    { label: 'Receita bruta considerada', value: formatarMoeda(receitaBruta), color: '#0f172a' },
    { label: 'FIC (1,5%)', value: formatarMoeda(ficValor) },
    { label: 'Base p/ ISS & IRPF', value: formatarMoeda(baseCalculo) },
    { label: 'IRPF (27,5%)', value: formatarMoeda(irpfValor) },
    { label: 'ISS (3%)', value: formatarMoeda(issValor) },
    { label: 'Resultado líquido antes das despesas', value: formatarMoeda(liquidoAntesDespesas), color: '#047857' }
  ] : [];

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 50%, #1f8ef1 100%)', padding: '24px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <header style={{ background: 'rgba(255,255,255,0.95)', borderRadius: '18px', padding: '24px', boxShadow: '0 12px 30px rgba(0,0,0,0.15)', marginBottom: '24px' }}>
          <h1 style={{ margin: 0, fontSize: '28px', color: '#1f2d3d', fontWeight: 700 }}>📑 Relatórios Financeiros — RG</h1>
          <p style={{ margin: '8px 0 0 0', color: '#4a5568' }}>
            Gere rapidamente receitas, despesas e tributos da emissão de RG utilizando apenas os movimentos registrados no caixa diário.
          </p>
          <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '12px', color: '#1f2d3d' }}>
            <span style={{ background: '#e0f2fe', padding: '6px 12px', borderRadius: '999px', fontWeight: 600 }}>Serventia: {serventia}</span>
            {periodoAtivo && (
              <span style={{ background: '#fef3c7', padding: '6px 12px', borderRadius: '999px', fontWeight: 600 }}>Período: {periodoAtivo}</span>
            )}
          </div>
        </header>

        <section style={{ background: 'rgba(255,255,255,0.95)', borderRadius: '18px', padding: '24px', boxShadow: '0 12px 24px rgba(0,0,0,0.12)', marginBottom: '24px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', color: '#1f2d3d', fontWeight: 600 }}>Escolha o período do relatório</h2>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '16px' }}>
            {modeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setModo(option.value)}
                style={{
                  padding: '10px 16px',
                  borderRadius: '999px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                  color: modo === option.value ? 'white' : '#1f2d3d',
                  background: modo === option.value ? '#2563eb' : '#e2e8f0',
                  boxShadow: modo === option.value ? '0 6px 18px rgba(37,99,235,0.35)' : 'none'
                }}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginTop: '20px' }}>
            {modo === 'month' && (
              <label style={{ display: 'flex', flexDirection: 'column', fontWeight: 600, color: '#1f2d3d' }}>
                Mês referência
                <input
                  type="month"
                  value={mesSelecionado}
                  onChange={(e) => setMesSelecionado(e.target.value)}
                  style={{ marginTop: '8px', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5f5' }}
                />
              </label>
            )}
            {modo === 'day' && (
              <label style={{ display: 'flex', flexDirection: 'column', fontWeight: 600, color: '#1f2d3d' }}>
                Dia específico
                <input
                  type="date"
                  value={diaSelecionado}
                  onChange={(e) => setDiaSelecionado(e.target.value)}
                  style={{ marginTop: '8px', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5f5' }}
                />
              </label>
            )}
            {modo === 'range' && (
              <>
                <label style={{ display: 'flex', flexDirection: 'column', fontWeight: 600, color: '#1f2d3d' }}>
                  Início do período
                  <input
                    type="date"
                    value={inicioPersonalizado}
                    onChange={(e) => setInicioPersonalizado(e.target.value)}
                    style={{ marginTop: '8px', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5f5' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', fontWeight: 600, color: '#1f2d3d' }}>
                  Fim do período
                  <input
                    type="date"
                    value={fimPersonalizado}
                    onChange={(e) => setFimPersonalizado(e.target.value)}
                    style={{ marginTop: '8px', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5f5' }}
                  />
                </label>
              </>
            )}
          </div>

          <div style={{ marginTop: '24px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => gerarRelatorio(false)}
              disabled={loading}
              style={{
                background: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                padding: '12px 24px',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 10px 20px rgba(37,99,235,0.25)'
              }}
            >
              {loading ? 'Gerando...' : 'Gerar relatório'}
            </button>
            {erro && <span style={{ color: '#c53030', fontWeight: 600 }}>{erro}</span>}
          </div>
        </section>

        {loading && (
          <div style={{ background: 'rgba(255,255,255,0.9)', padding: '16px', borderRadius: '12px', textAlign: 'center', color: '#1f2d3d', boxShadow: '0 8px 16px rgba(0,0,0,0.12)' }}>
            Carregando dados do relatório...
          </div>
        )}

        {!loading && resultado && (
          <>
            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              {resumoCards.map((card) => (
                <div key={card.label} style={{ background: 'rgba(255,255,255,0.95)', borderRadius: '16px', padding: '18px', boxShadow: '0 10px 20px rgba(0,0,0,0.12)', borderTop: `4px solid ${card.color}` }}>
                  <p style={{ margin: 0, color: '#4a5568', fontWeight: 600 }}>{card.label}</p>
                  <strong style={{ fontSize: '22px', display: 'block', marginTop: '6px', color: card.color }}>{card.value}</strong>
                </div>
              ))}
            </section>

            <section style={{ background: 'rgba(255,255,255,0.95)', borderRadius: '18px', padding: '24px', boxShadow: '0 12px 24px rgba(0,0,0,0.12)', marginBottom: '24px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#1f2d3d', fontWeight: 600 }}>Tributos previstos</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '16px' }}>
                {impostosCards.map((card) => (
                  <div
                    key={card.label}
                    style={{
                      background: '#f8fafc',
                      borderRadius: '12px',
                      padding: '16px',
                      border: `1px solid ${card.color ? `${card.color}33` : '#e2e8f0'}`
                    }}
                  >
                    <p style={{ margin: 0, color: '#475569', fontWeight: 600 }}>{card.label}</p>
                    <strong style={{ fontSize: '18px', marginTop: '6px', display: 'block', color: card.color || '#0f172a' }}>{card.value}</strong>
                  </div>
                ))}
              </div>
              <p style={{ marginTop: '14px', color: '#475569', fontSize: '14px' }}>
                * O cálculo aplica 1,5% (FIC) sobre a receita bruta e, em seguida, calcula IRPF (27,5%) e ISS (3%) sobre a base já deduzida do FIC.
              </p>
            </section>

            <section style={{ background: 'rgba(255,255,255,0.95)', borderRadius: '18px', padding: '24px', boxShadow: '0 12px 24px rgba(0,0,0,0.12)' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#1f2d3d', fontWeight: 600 }}>Movimento diário do período</h3>
              {resultado.diario && resultado.diario.length > 0 ? (
                <div style={{ overflowX: 'auto', marginTop: '16px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '15px' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', color: '#1f2d3d' }}>
                        <th style={{ textAlign: 'left', padding: '12px 10px' }}>Data</th>
                        <th style={{ textAlign: 'right', padding: '12px 10px' }}>Receitas</th>
                        <th style={{ textAlign: 'right', padding: '12px 10px' }}>Despesas</th>
                        <th style={{ textAlign: 'right', padding: '12px 10px' }}>Saldo diário</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultado.diario.map((dia) => (
                        <tr key={dia.data} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '10px', color: '#1f2d3d' }}>{formatDisplayDate(dia.data)}</td>
                          <td style={{ padding: '10px', textAlign: 'right', color: '#0f9d58', fontWeight: 600 }}>{formatarMoeda(dia.receitas || 0)}</td>
                          <td style={{ padding: '10px', textAlign: 'right', color: '#c53030', fontWeight: 600 }}>{formatarMoeda(dia.despesas || 0)}</td>
                          <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600, color: (dia.receitas || 0) - (dia.despesas || 0) >= 0 ? '#1a936f' : '#c53030' }}>
                            {formatarMoeda((dia.receitas || 0) - (dia.despesas || 0))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ marginTop: '12px', color: '#475569' }}>Nenhum movimento encontrado para o período selecionado.</p>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

export default RGRelatorioFinanceiro;
