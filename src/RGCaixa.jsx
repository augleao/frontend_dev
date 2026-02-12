import React, { useState, useEffect } from 'react';
import {
  formasPagamento,
  formatarMoeda,
  formatarDataBR,
  gerarRelatorioPDFCaixaDiario,
} from './utils';
import DataSelector from './DataSelector';
import AtosTable from './CaixaTableEscrevente';
import FechamentoDiarioButton from './FechamentoDiarioButton';
import { apiURL } from './config';

function RGCaixa() {
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  const [caixaUnificado, setCaixaUnificado] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [dataSelecionada, setDataSelecionada] = useState(() => {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  });

  const [valorInicialCaixa, setValorInicialCaixa] = useState(0);
  const [valorFinalCaixa, ValorFinalCaixa] = useState(0);
  const [percentualISS, setPercentualISS] = useState(0);
  const [valorRG, setValorRG] = useState(0);
  const [atos, setAtos] = useState([]);
  const [atosFiltrados, setAtosFiltrados] = useState([]);
  const [fechamentos, setFechamentos] = useState([]);
  const [nomeUsuario, setNomeUsuario] = useState(() => {
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    return usuario?.nome || 'Usuário não identificado';
  });
  const [entradaValor, setEntradaValor] = useState('');
  const [entradaObs, setEntradaObs] = useState('');
  const [saidaValor, setSaidaValor] = useState('');
  const [saidaObs, setSaidaObs] = useState('');
  const [saidaClienteNome, setSaidaClienteNome] = useState('');
  const [saidaTicket, setSaidaTicket] = useState('');

  const parseValorMoeda = (valorStr) => {
    if (!valorStr) return 0;
    const numStr = valorStr.replace(/[^\d,.-]/g, '').replace(',', '.');
    const num = parseFloat(numStr);
    return isNaN(num) ? 0 : num;
  };

  const adicionarEntrada = async () => {
    const valor = parseValorMoeda(entradaValor);
    if (valor <= 0) {
      alert('Informe um valor válido para a entrada.');
      return;
    }
    const agora = new Date();

    const novaEntrada = {
      data: dataSelecionada,
      hora: agora.toLocaleTimeString('pt-BR', { hour12: false }),
      codigo: '0003',
      descricao: `ENTRADA: ${entradaObs || ''}`.trim(),
      quantidade: 1,
      valor_unitario: valor,
      pagamentos: {},
      usuario: nomeUsuario,
    };

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiURL}/rg/atos-pagos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(novaEntrada),
      });

      if (res.ok) {
        setEntradaValor('');
        setEntradaObs('');
        await carregarDadosDaData();
      } else {
        const errorData = await res.json();
        console.error('Erro ao salvar entrada:', errorData);
        alert('Erro ao salvar entrada: ' + (errorData.message || 'Erro desconhecido'));
      }
    } catch (e) {
      console.error('Erro ao salvar entrada:', e);
      alert('Erro ao salvar entrada: ' + e.message);
    }
  };

  const adicionarSaida = async () => {
    const valor = parseValorMoeda(saidaValor);
    if (valor <= 0) {
      alert('Informe um valor válido para a saída.');
      return;
    }
    const agora = new Date();
    const isDevolucao = !!(saidaClienteNome && saidaClienteNome.trim());
    let descricaoDetalhada = '';
    if (isDevolucao) {
      const partes = [];
      partes.push(`Devolução p/Cliente: ${saidaClienteNome.trim()}`);
      if (saidaTicket && saidaTicket.trim()) partes.push(`ticket: ${saidaTicket.trim()}`);
      if (saidaObs && saidaObs.trim()) partes.push(`Obs.: ${saidaObs.trim()}`);
      descricaoDetalhada = partes.join('; ');
    } else {
      descricaoDetalhada = (saidaObs || '').trim();
    }

    const novaSaida = {
      data: dataSelecionada,
      hora: agora.toLocaleTimeString('pt-BR', { hour12: false }),
      codigo: '0002',
      descricao: `SAÍDA: ${descricaoDetalhada}`.trim(),
      quantidade: 1,
      valor_unitario: valor,
      pagamentos: {},
      usuario: nomeUsuario,
    };

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiURL}/rg/atos-pagos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(novaSaida),
      });

      if (res.ok) {
        setAtos((prev) => [...prev, novaSaida]);
        setSaidaValor('');
        setSaidaObs('');
        setSaidaClienteNome('');
        setSaidaTicket('');
      } else {
        const errorData = await res.json();
        console.error('Erro ao salvar saída:', errorData);
        alert('Erro ao salvar saída: ' + (errorData.message || 'Erro desconhecido'));
      }
    } catch (e) {
      console.error('Erro ao salvar saída:', e);
      alert('Erro ao salvar saída: ' + e.message);
    }
  };

  const handleDataChange = (e) => {
    setDataSelecionada(e.target.value);
  };

  const calcularValorFinalCaixa = () => {
    const totalDinheiro = atos.reduce((acc, ato) => {
      if (ato.codigo !== '0003' && ato.codigo !== '0002' && ato.codigo !== '0005') {
        const valorDinheiro = parseFloat(ato.pagamentos?.dinheiro?.valor) || 0;
        return acc + valorDinheiro;
      }
      return acc;
    }, 0);

    const totalEntradas = atos.reduce((acc, ato) => {
      if (ato.codigo === '0003') {
        const valorEntrada = parseFloat(ato.valor_unitario) || 0;
        return acc + valorEntrada;
      }
      return acc;
    }, 0);

    const valorInicial = atos.reduce((acc, ato) => {
      if (ato.codigo === '0005') {
        const valorInicial = parseFloat(ato.valor_unitario) || 0;
        return acc + valorInicial;
      }
      return acc;
    }, 0);

    const totalSaidas = atos.reduce((acc, ato) => {
      if (ato.codigo === '0002') {
        const valorSaida = parseFloat(ato.valor_unitario) || 0;
        return acc + valorSaida;
      }
      return acc;
    }, 0);

    const valorFinal = valorInicial + totalDinheiro + totalEntradas - totalSaidas;
    return isNaN(valorFinal) ? 0 : valorFinal;
  };

  const removerAto = async (index) => {
    const atoParaRemover = atos[index];
    if (atoParaRemover.id) {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${apiURL}/rg/atos-pagos/${atoParaRemover.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          setAtos(atos.filter((_, i) => i !== index));
        } else {
          const errorData = await res.json();
          console.error('Erro ao remover ato do backend:', errorData);
          alert('Erro ao remover ato: ' + (errorData.message || 'Erro desconhecido'));
        }
      } catch (e) {
        console.error('Erro ao remover ato:', e);
        alert('Erro ao remover ato: ' + e.message);
      }
    } else {
      setAtos(atos.filter((_, i) => i !== index));
    }
  };

  const carregarDadosDaData = async () => {
    try {
      const token = localStorage.getItem('token');
      const serventiaParam = usuario?.serventia ? `&serventia=${encodeURIComponent(usuario.serventia)}` : '';
      const resAtos = await fetch(`${apiURL}/rg/atos-pagos?data=${dataSelecionada}${serventiaParam}`, { headers: { Authorization: `Bearer ${token}` } });
      if (resAtos.ok) {
        const dataAtos = await resAtos.json();
        setAtos(dataAtos.CaixaDiario || []);
      }
    } catch (e) {
      console.error('Erro ao carregar dados da data:', e);
    }
  };

  useEffect(() => { async function fetchConfig() {
    setLoadingConfig(true);
    try {
      if (!usuario?.serventia) throw new Error('Usuário sem serventia');
      const res = await fetch(`${apiURL}/configuracoes-serventia?serventia=${encodeURIComponent(usuario.serventia)}`);
      if (!res.ok) throw new Error('Erro ao buscar configuração da serventia');
      const data = await res.json();
      setCaixaUnificado(!!data.caixa_unificado);
    } catch (e) {
      setCaixaUnificado(false);
      console.error('Erro ao buscar config de caixa unificado:', e);
    } finally { setLoadingConfig(false); }
  } fetchConfig(); }, [usuario?.serventia]);

  useEffect(() => {
    if (caixaUnificado) setAtosFiltrados(atos);
    else setAtosFiltrados(atos.filter(a => a.usuario === usuario?.nome));
  }, [caixaUnificado, atos, usuario?.nome]);

  useEffect(() => { carregarDadosDaData(); }, []);
  useEffect(() => { carregarDadosDaData(); }, [dataSelecionada]);

  // Carrega o valor atual de validação do RG (atos.codigo = 8888)
  useEffect(() => {
    async function carregarValorRG() {
      try {
        const token = localStorage.getItem('token');
        const serventiaParam = usuario?.serventia ? `&serventia=${encodeURIComponent(usuario.serventia)}` : '';
        const url = `${apiURL}/atos?codigo=8888${serventiaParam}&limit=1000`;
        console.log('[RGCaixa] Buscando valor RG 8888 em', url);
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) {
          console.warn('[RGCaixa] Falha ao carregar valor RG (status):', res.status);
          return;
        }
        const data = await res.json();
        console.log('[RGCaixa] Resposta valor RG 8888:', data);
        // data can be an array or an object. We must read `atos.valor_final` for codigo 8888.
        let registros = [];
        if (Array.isArray(data)) registros = data;
        else if (data && Array.isArray(data.atos)) registros = data.atos;
        else if (data && Array.isArray(data.rows)) registros = data.rows;
        else if (data) registros = [data];

        const alvo = registros.find(a => String(a.codigo) === '8888');
        const total = alvo ? (parseFloat(alvo.valor_final) || 0) : 0;

        console.log('[RGCaixa] Total calculado (valor_final do 8888):', total, 'registros:', registros.length);
        setValorRG(isNaN(total) ? 0 : total);
      } catch (e) {
        console.error('[RGCaixa] Erro ao carregar valor do RG:', e);
      }
    }
    carregarValorRG();
  }, [usuario?.serventia]);

  const fechamentoDiario = async () => {
    const dataAtual = dataSelecionada;
    const existeFechamento = atos.some((ato) => ato.codigo === '0001' && ato.data === dataAtual && ato.usuario === nomeUsuario);
    if (existeFechamento) { alert('Já existe um fechamento de caixa (código 0001) para este usuário e data.'); return; }
    if (!window.confirm('Confirma o fechamento diário do caixa?')) return;
    const hora = new Date().toLocaleTimeString('pt-BR', { hour12: false });
    const valorFinalCalculado = calcularValorFinalCaixa();
    if (isNaN(valorFinalCalculado)) { alert('Erro no cálculo do valor final do caixa.'); return; }

    const pagamentosZerados = formasPagamento.reduce((acc, fp) => { acc[fp.key] = { quantidade: 0, valor: 0, manual: false }; return acc; }, {});

    const atoFechamento = {
      data: dataAtual,
      hora: hora,
      codigo: '0001',
      descricao: 'VALOR FINAL DO CAIXA',
      quantidade: 1,
      valor_unitario: Number(valorFinalCalculado.toFixed(2)),
      pagamentos: pagamentosZerados,
      usuario: nomeUsuario,
      total_entradas: Number(totalEntradasDoDia || 0),
      total_saidas: Number(totalSaidasDoDia || 0),
    };

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiURL}/rg/atos-pagos`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(atoFechamento) });
      const resText = await res.text();
      if (!res.ok) { alert('Erro ao salvar fechamento no banco: ' + resText); return; }
      await carregarDadosDaData();
      alert('Fechamento diário realizado com sucesso!');
      gerarRelatorioPDFCaixaDiario({
        dataRelatorio: dataSelecionada,
        atos,
        valorInicialCaixa,
        valorFinalCaixa: atos.find(a => a.codigo === '0001')?.valor_unitario || calcularValorFinalCaixa(),
        depositosCaixa: atos.filter(a => a.codigo === '0003'),
        saidasCaixa: atos.filter(a => a.codigo === '0002'),
        responsavel: nomeUsuario,
        ISS: percentualISS,
        observacoesGerais: '',
        nomeArquivo: `FechamentoCaixa_RG_${dataSelecionada}.pdf`
      });
    } catch (e) {
      alert('Erro ao realizar fechamento diário: ' + e.message);
    }
  };

  const salvarValorInicialCaixa = async () => {
    if (!valorInicialCaixa || valorInicialCaixa <= 0) return;
    const existe = atos.find((ato) => ato.codigo === '0005' && ato.data === dataSelecionada && ato.usuario === nomeUsuario);
    if (existe && existe.valor_unitario === valorInicialCaixa) return;
    if (existe && existe.id) {
      try { const token = localStorage.getItem('token'); await fetch(`${apiURL}/rg/atos-pagos/${existe.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); } catch (e) { console.error('Erro ao remover valor inicial antigo:', e); }
    }

    const novoAto = { data: dataSelecionada, hora: new Date().toLocaleTimeString(), codigo: '0005', descricao: 'VALOR INICIAL DO CAIXA', quantidade: 1, valor_unitario: Number(valorInicialCaixa), pagamentos: {}, usuario: nomeUsuario };
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiURL}/rg/atos-pagos`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(novoAto) });
      const resText = await res.text();
      if (res.ok) { await carregarDadosDaData(); } else { alert('Erro ao salvar valor inicial do caixa.'); }
    } catch (e) { console.error('Erro ao salvar valor inicial do caixa:', e); alert('Erro ao salvar valor inicial do caixa: ' + e.message); }
  };

  useEffect(() => {
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    if (usuario?.serventia === 'RCPN de Campanha') setPercentualISS(3);
    else setPercentualISS(0);
  }, []);

  const totalEntradasDoDia = (atosFiltrados || atos).reduce((acc, ato) => { if (ato.codigo === '0003') return acc + (parseFloat(ato.valor_unitario) || 0); return acc; }, 0);
  const totalSaidasDoDia = (atosFiltrados || atos).reduce((acc, ato) => { if (ato.codigo === '0002') return acc + (parseFloat(ato.valor_unitario) || 0); return acc; }, 0);
  const isRegistradorOuSubstituto = (usuario?.cargo === 'Registrador' || usuario?.cargo === 'Substituto');

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '12px', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
        <div style={{ background: 'rgba(255,255,255,0.95)', borderRadius: '12px', padding: '16px', marginBottom: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <h1 style={{ margin: 0, color: '#2c3e50', fontSize: '26px', fontWeight: '600' }}>💰 Movimento Diário do Caixa — RG</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <DataSelector dataSelecionada={dataSelecionada} onChange={handleDataChange} />
            </div>
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: '12px', padding: '16px', marginBottom: '12px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <h2 style={{ margin: 0, color: '#2c3e50', fontSize: '18px', fontWeight: '600' }}>📊 Resumo:</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ color: '#2c3e50', fontSize: '18px', fontWeight: '600' }}>ISS: {percentualISS}%</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ color: '#2c3e50', fontSize: '18px', fontWeight: '600' }}>💳 Valor do RG: {formatarMoeda(valorRG)}</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ color: '#2c3e50', fontSize: '18px', fontWeight: '600' }}>💰 Valor Inicial do Caixa:</span>
              <input type="number" min="0" step="0.01" value={valorInicialCaixa} onChange={e => setValorInicialCaixa(parseFloat(e.target.value) || 0)} onBlur={salvarValorInicialCaixa} style={{ width: '100px', padding: '4px 6px', borderRadius: '4px', border: '1px solid #27ae60', fontSize: '16px', fontWeight: '600' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ color: '#2c3e50', fontSize: '18px', fontWeight: '600' }}>💎 Valor Final do Caixa: {formatarMoeda(calcularValorFinalCaixa())}</span></div>
          </div>
          {isRegistradorOuSubstituto && (<div style={{ marginTop: '12px', display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ color: '#2c3e50', fontSize: '16px', fontWeight: '600', marginLeft: '8px' }}>Total de Entradas:</span>
              <span style={{ color: '#27ae60', fontSize: '16px', fontWeight: '700' }}>{formatarMoeda(totalEntradasDoDia)}</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ color: '#2c3e50', fontSize: '16px', fontWeight: '600' }}>Total de Saídas:</span>
              <span style={{ color: '#e74c3c', fontSize: '16px', fontWeight: '700' }}>{formatarMoeda(totalSaidasDoDia)}</span></div>
          </div>)}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '8px', marginBottom: '8px', maxWidth: '100%', overflow: 'hidden' }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#2c3e50', fontSize: '16px', fontWeight: '600', borderBottom: '2px solid #f39c12', paddingBottom: '8px' }}>💸 Entradas e Saídas Manuais</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
              <div style={{ background: '#f8f9fa', border: '2px solid #27ae60', borderRadius: '8px', padding: '12px' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#27ae60' }}>📈 Entrada de Valor</h4>
                <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontWeight: '600', color: '#2c3e50', minWidth: '60px' }}>Valor:</label>
                  <input type="text" value={entradaValor} onChange={(e) => setEntradaValor(e.target.value)} placeholder="R$ 0,00" style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '2px solid #e3f2fd', fontSize: '14px' }} />
                </div>
                <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontWeight: '600', color: '#2c3e50', minWidth: '100px' }}>Observação:</label>
                  <input type="text" value={entradaObs} onChange={(e) => setEntradaObs(e.target.value)} placeholder="Ex. Troco, abertura de caixa, EValidação RG" style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '2px solid #e3f2fd', fontSize: '14px' }} />
                </div>
                <button type="button" className="btn-gradient btn-gradient-green btn-block" style={{ fontSize: '13px' }} onClick={adicionarEntrada}>➕ Adicionar Entrada</button>
              </div>

              <div style={{ background: '#fff5f5', border: '2px solid #e74c3c', borderRadius: '8px', padding: '12px' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#e74c3c' }}>📉 Saída de Valor</h4>
                <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontWeight: '600', color: '#2c3e50', minWidth: '60px' }}>Valor:</label>
                  <input type="text" value={saidaValor} onChange={(e) => setSaidaValor(e.target.value)} placeholder="R$ 0,00" style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '2px solid #fdecea', fontSize: '14px' }} />
                </div>
                <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontWeight: '600', color: '#2c3e50', minWidth: '100px' }}>Observação:</label>
                  <input type="text" value={saidaObs} onChange={(e) => setSaidaObs(e.target.value)} placeholder="Ex. Devolução, pagamento" style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '2px solid #fdecea', fontSize: '14px' }} />
                </div>
                <button type="button" className="btn-gradient btn-gradient-red btn-block" style={{ fontSize: '13px' }} onClick={adicionarSaida}>➖ Adicionar Saída</button>
              </div>
            </div>
          </div>

          <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: 0, color: '#2c3e50', fontSize: '16px', fontWeight: '600' }}>📋 Movimentos</h3>
            <AtosTable atos={atosFiltrados} onRemove={removerAto} />
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <FechamentoDiarioButton onClick={fechamentoDiario} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RGCaixa;
