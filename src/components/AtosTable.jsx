import React, { useState, useEffect, useMemo } from 'react';
import { gerarRelatorioPDF } from './RelatorioPDF';
import CaixaInfo from './CaixaInfo';
import AtosGrid from './AtosGrid';
import MensagemStatus from './MensagemStatus';
import config from '../config';
import { extrairDadosDoTexto, calcularValorTotalComISS, moedaParaNumero, formatarMoeda } from './utilsAtos';

export default function AtosTable({ texto, usuario }) {
  const [atos, setAtos] = useState([]);
  const [dataRelatorio, setDataRelatorio] = useState(null);
  const [responsavel, setResponsavel] = useState('');
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

  const atosComISS = useMemo(() =>
    atos.map(ato => ({
      ...ato,
      valorTotalComISS: calcularValorTotalComISS(ato.valorTotal, moedaParaNumero(ISS))
    })), [atos, ISS]
  );

  const valorFinalCaixa = useMemo(() => {
    const totalDinheiro = atosComISS.reduce((acc, ato) => acc + ato.pagamentoDinheiro.valor, 0);
    return valorInicialCaixa + totalDinheiro - saidasCaixa - depositosCaixa;
  }, [valorInicialCaixa, depositosCaixa, saidasCaixa, atosComISS]);

  const handleAtoChange = (id, campo, subcampo, valor) => {
    setAtos(prevAtos =>
      prevAtos.map(ato => {
        if (ato.id === id) {
          const valorUnitario = ato.quantidade > 0 ? calcularValorTotalComISS(ato.valorTotal, moedaParaNumero(ISS)) / ato.quantidade : 0;
          if (campo === 'observacoes') {
            return { ...ato, observacoes: valor };
          }
          if (subcampo === 'quantidade') {
            const quantidadeNum = parseInt(valor) || 0;
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
    console.log('Tentando salvar relatório...'); // 1. Adicione aqui
    setSalvando(true);
    setMensagemSalvar('');
    try {
      const token = localStorage.getItem('token');
      const atosDetalhados = atosComISS.map(ato => {
        const somaPagamentos = parseFloat((
          ato.pagamentoDinheiro.valor +
          ato.pagamentoCartao.valor +
          ato.pagamentoPix.valor +
          ato.pagamentoCRC.valor +
          ato.depositoPrevio.valor
        ).toFixed(2));
        const valorFaltante = parseFloat((ato.valorTotalComISS - somaPagamentos).toFixed(2));
        return {
          quantidade: ato.quantidade,
          codigo: ato.codigo,
          descricao: ato.descricao,
          valor_total: ato.valorTotalComISS,
          valor_faltante: valorFaltante,
          dinheiro_qtd: ato.pagamentoDinheiro.quantidade,
          dinheiro_valor: ato.pagamentoDinheiro.valor,
          cartao_qtd: ato.pagamentoCartao.quantidade,
          cartao_valor: ato.pagamentoCartao.valor,
          pix_qtd: ato.pagamentoPix.quantidade,
          pix_valor: ato.pagamentoPix.valor,
          crc_qtd: ato.pagamentoCRC.quantidade,
          crc_valor: ato.pagamentoCRC.valor,
          deposito_previo_qtd: ato.depositoPrevio.quantidade,
          deposito_previo_valor: ato.depositoPrevio.valor,
          observacoes: ato.observacoes || ''
        };
      });
      const payload = {
        data_hora: dataRelatorio,
        serventia: usuario.serventia, // valor real do usuário logado
        cargo: usuario.cargo,         // valor real do usuário logado
        responsavel: responsavel,
        iss_percentual: moedaParaNumero(ISS),
        valor_inicial_caixa: valorInicialCaixa,
        depositos_caixa: depositosCaixa,
        saidas_caixa: saidasCaixa,
        valor_final_caixa: valorFinalCaixa,
        observacoes_gerais: observacoesGerais, // <-- aqui!
        atos: atosDetalhados
      };
      console.log('Payload:', payload); // 2. Adicione aqui
      console.log('Token:', token); // 3. Adicione aqui
      const response = await fetch(`${config.apiURL}/salvar-relatorio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ dadosRelatorio: payload })
      });
      console.log('Resposta salvar-relatorio:', response);
      const data = await response.json();
      console.log('Dados da resposta:', data);
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
    console.log('conferirCaixa chamado'); // 4. Adicione aqui
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
        observacoesGerais, // <-- Adicione esta linha!
      });
      console.log('salvarRelatorio foi chamado'); // 5. Adicione aqui
      await salvarRelatorio();
    } else {
      alert(
        `Conciliação divergente!\nTotal valor pago: ${formatarMoeda(totalValorPago)}\nTotal valor atos: ${formatarMoeda(totalValorAtos)}`
      );
    }
  };

  if (!atos.length) return null;

  return (
    <div>
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

      <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
        <button className="atos-table-btn" onClick={() => { console.log('Botão clicado!'); conferirCaixa(); }}> {/* 6. Adicione aqui */}
          Gerar Relatório
        </button>
      </div>

      <MensagemStatus mensagem={mensagemSalvar} />

      <AtosGrid
        atos={atosComISS}
        handleAtoChange={handleAtoChange}
      />
    </div>
  );
}