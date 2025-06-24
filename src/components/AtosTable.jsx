import React, { useState, useEffect, useMemo } from 'react';
import { gerarRelatorioPDF } from './RelatorioPDF';
import CaixaInfo from './CaixaInfo';
import AtosGrid from './AtosGrid';
import MensagemStatus from './MensagemStatus';
import config from '../config';
import { extrairDadosDoTexto, calcularValorTotalComISS, moedaParaNumero, formatarMoeda } from './utilsAtos';

export default function AtosTable({ texto, usuario: usuarioProp }) {
  // Busca o usuário do localStorage caso não venha como prop
  const usuario = usuarioProp || JSON.parse(localStorage.getItem('usuario') || '{}');

  const [atos, setAtos] = useState([]);
  const [dataRelatorio, setDataRelatorio] = useState(null);
  const [responsavel, setResponsavel] = useState(usuario.nome || ''); // Preenche com nome do usuário logado
  const [ISS, setISS] = useState('');
  const [valorInicialCaixa, setValorInicialCaixa] = useState(0);
  const [depositosCaixa, setDepositosCaixa] = useState(0);
  const [saidasCaixa, setSaidasCaixa] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [mensagemSalvar, setMensagemSalvar] = useState('');
  const [observacoesGerais, setObservacoesGerais] = useState('');

  useEffect(() => {
    if (texto) {
      const { dataRelatorio, atos } = extrairDadosDoTexto(texto);
      setDataRelatorio(dataRelatorio);
      setAtos(atos);
    }
  }, [texto]);

  // Atualiza o responsável se o usuário mudar
  useEffect(() => {
    setResponsavel(usuario.nome || '');
  }, [usuario.nome]);

  const atosComISS = useMemo(() => {
    const resultado = atos.map(ato => ({
      ...ato,
      valorTotalComISS: calcularValorTotalComISS(ato.valorTotal, moedaParaNumero(ISS))
    }));
    return resultado;
  }, [atos, ISS]);

  const valorFinalCaixa = useMemo(() => {
    const totalDinheiro = atosComISS.reduce((acc, ato) => {
      const valorDinheiro = ato.pagamentoDinheiro.valor || 0;
      return acc + valorDinheiro;
    }, 0);

    const resultado = valorInicialCaixa + totalDinheiro + depositosCaixa - saidasCaixa;
    return resultado;
  }, [valorInicialCaixa, depositosCaixa, saidasCaixa, atosComISS]);

  const handleAtoChange = (id, campo, subcampo, valor) => {
    setAtos(prevAtos =>
      prevAtos.map(ato => {
        if (ato.id === id) {
          if (campo === 'observacoes') {
            return { ...ato, observacoes: valor };
          }
          if (subcampo === 'quantidade') {
            const quantidadeNum = parseInt(valor) || 0;
            const valorUnitario = ato.quantidade > 0 ? calcularValorTotalComISS(ato.valorTotal, moedaParaNumero(ISS)) / ato.quantidade : 0;
            const valorAtual = ato[campo].valorManual ? ato[campo].valor : parseFloat((quantidadeNum * valorUnitario).toFixed(2));
            return {
              ...ato,
              [campo]: { quantidade: quantidadeNum, valor: valorAtual, valorManual: false },
            };
          }
          if (subcampo === 'valor') {
            const valorNum = moedaParaNumero(valor);
            return {
              ...ato,
              [campo]: { ...ato[campo], valor: valorNum, valorManual: true },
            };
          }
        }
        return ato;
      })
    );
  };

  const salvarRelatorio = async () => {
    setSalvando(true);
    setMensagemSalvar('');
    try {
      if (!usuario || !usuario.serventia || !usuario.cargo) {
        setMensagemSalvar('Usuário não encontrado. Faça login novamente.');
        setSalvando(false);
        return;
      }

      const token = localStorage.getItem('token');

      const atosDetalhados = atosComISS.map(ato => {
        const pagamentoDinheiro = ato.pagamentoDinheiro || { quantidade: 0, valor: 0 };
        const pagamentoCartao = ato.pagamentoCartao || { quantidade: 0, valor: 0 };
        const pagamentoPix = ato.pagamentoPix || { quantidade: 0, valor: 0 };
        const pagamentoCRC = ato.pagamentoCRC || { quantidade: 0, valor: 0 };
        const depositoPrevio = ato.depositoPrevio || { quantidade: 0, valor: 0 };

        const somaPagamentos = parseFloat((
          pagamentoDinheiro.valor +
          pagamentoCartao.valor +
          pagamentoPix.valor +
          pagamentoCRC.valor +
          depositoPrevio.valor
        ).toFixed(2));
        const valorFaltante = parseFloat((ato.valorTotalComISS - somaPagamentos).toFixed(2));
        return {
          quantidade: ato.quantidade,
          codigo: ato.codigo,
          descricao: ato.descricao,
          valor_total: ato.valorTotalComISS,
          valor_faltante: valorFaltante,
          dinheiro_qtd: pagamentoDinheiro.quantidade,
          dinheiro_valor: pagamentoDinheiro.valor,
          cartao_qtd: pagamentoCartao.quantidade,
          cartao_valor: pagamentoCartao.valor,
          pix_qtd: pagamentoPix.quantidade,
          pix_valor: pagamentoPix.valor,
          crc_qtd: pagamentoCRC.quantidade,
          crc_valor: pagamentoCRC.valor,
          deposito_previo_qtd: depositoPrevio.quantidade,
          deposito_previo_valor: depositoPrevio.valor,
          observacoes: ato.observacoes || ''
        };
      });

      const payload = {
        data_hora: dataRelatorio,
        serventia: usuario.serventia,
        cargo: usuario.cargo,
        responsavel: responsavel,
        iss_percentual: moedaParaNumero(ISS),
        valor_inicial_caixa: valorInicialCaixa,
        depositos_caixa: depositosCaixa,
        saidas_caixa: saidasCaixa,
        valor_final_caixa: valorFinalCaixa,
        observacoes_gerais: observacoesGerais,
        atos: atosDetalhados
      };

      const response = await fetch(`${config.apiURL}/salvar-relatorio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ dadosRelatorio: payload })
      });

      const data = await response.json();

      if (response.ok) {
        setMensagemSalvar('Relatório salvo com sucesso!');
      } else {
        setMensagemSalvar(data.message || 'Erro ao salvar relatório.');
      }
    } catch (error) {
      setMensagemSalvar('Erro de conexão ao salvar relatório.');
    } finally {
      setSalvando(false);
    }
  };

  const conferirCaixa = async () => {
    let totalValorPago = 0;
    atosComISS.forEach(ato => {
      totalValorPago += ato.pagamentoDinheiro.valor +
        ato.pagamentoCartao.valor +
        ato.pagamentoPix.valor +
        ato.pagamentoCRC.valor +
        ato.depositoPrevio.valor;
    });
    totalValorPago = parseFloat(totalValorPago.toFixed(2));
    const totalValorAtos = parseFloat(atosComISS.reduce((acc, ato) => acc + ato.valorTotalComISS, 0).toFixed(2));
    if (Math.abs(totalValorPago - totalValorAtos) < 0.01) {
      gerarRelatorioPDF({
        dataRelatorio,
        atos: atosComISS,
        valorInicialCaixa,
        depositosCaixa,
        saidasCaixa,
        responsavel,
        ISS: moedaParaNumero(ISS),
        observacoesGerais,
      });
      await salvarRelatorio();
    } else {
      alert(
        `Conciliação divergente!\nTotal valor pago: ${formatarMoeda(totalValorPago)}\nTotal valor atos: ${formatarMoeda(totalValorAtos)}`
      );
    }
  };

  if (!atos.length) return null;

  // --- LAYOUT AJUSTADO PARA NÃO ULTRAPASSAR O PAI ---
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: 'Arial, sans-serif'
    }}>
      <main style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '60px 0'
      }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          borderRadius: '24px',
          padding: '48px 0',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          <h2 style={{
            fontSize: '32px',
            fontWeight: '700',
            color: 'white',
            textAlign: 'center',
            margin: '0 0 32px 0',
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
          }}>
            Atos Extraídos
          </h2>
          {/* Bloco de informações do caixa */}
          <div style={{ marginBottom: 32, padding: '0 32px', width: '100%', boxSizing: 'border-box' }}>
            <CaixaInfo
              responsavel={responsavel}
              setResponsavel={setResponsavel}
              ISS={ISS}
              setISS={setISS}
              valorInicialCaixa={valorInicialCaixa}
              setValorInicialCaixa={setValorInicialCaixa}
              depositosCaixa={depositosCaixa}
              setDepositosCaixa={setDepositosCaixa}
              saidasCaixa={saidasCaixa}
              setSaidasCaixa={setSaidasCaixa}
              valorFinalCaixa={valorFinalCaixa}
              observacoesGerais={observacoesGerais}
              setObservacoesGerais={setObservacoesGerais}
            />
          </div>

          <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'center', padding: '0 32px', width: '100%', boxSizing: 'border-box' }}>
            <button
              className="atos-table-btn"
              style={{
                background: '#27ae60',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '12px 28px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(39,174,96,0.15)',
                transition: 'all 0.2s'
              }}
              onClick={() => { conferirCaixa(); }}
              onMouseEnter={e => e.target.style.background = '#219150'}
              onMouseLeave={e => e.target.style.background = '#27ae60'}
              disabled={salvando}
            >
              {salvando ? 'Salvando...' : 'Gerar Relatório'}
            </button>
          </div>

          <MensagemStatus mensagem={mensagemSalvar} />

          <div style={{
            marginTop: 32,
            background: 'white',
            borderRadius: '16px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.07)',
            padding: '24px',
            width: '100%',
            minWidth: 0,
            maxWidth: '100%',
            overflowX: 'auto',
            boxSizing: 'border-box'
          }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
              <AtosGrid
                atos={atosComISS}
                handleAtoChange={handleAtoChange}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}