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

  const atosComISS = useMemo(() => {
    const resultado = atos.map(ato => ({
      ...ato,
      valorTotalComISS: calcularValorTotalComISS(ato.valorTotal, moedaParaNumero(ISS))
    }));
    console.log('atosComISS recalculado:', resultado);
    return resultado;
  }, [atos, ISS]);

  const valorFinalCaixa = useMemo(() => {
    const totalDinheiro = atosComISS.reduce((acc, ato) => {
      const valorDinheiro = ato.pagamentoDinheiro.valor || 0;
      console.log(`Ato ${ato.id}: pagamentoDinheiro.valor = ${valorDinheiro}`);
      return acc + valorDinheiro;
    }, 0);
    
    console.log('Valores para cálculo do caixa:', {
      valorInicialCaixa,
      totalDinheiro,
      depositosCaixa,
      saidasCaixa
    });
    
    const resultado = valorInicialCaixa + totalDinheiro + depositosCaixa - saidasCaixa;
    console.log('valorFinalCaixa calculado:', resultado);
    return resultado;
  }, [valorInicialCaixa, depositosCaixa, saidasCaixa, atosComISS]);

  const handleAtoChange = (id, campo, subcampo, valor) => {
    console.log('handleAtoChange chamado:', { id, campo, subcampo, valor });
    
    setAtos(prevAtos =>
      prevAtos.map(ato => {
        if (ato.id === id) {
          console.log('Ato encontrado para edição:', ato);
          
          if (campo === 'observacoes') {
            return { ...ato, observacoes: valor };
          }
          
          if (subcampo === 'quantidade') {
            const quantidadeNum = parseInt(valor) || 0;
            const valorUnitario = ato.quantidade > 0 ? calcularValorTotalComISS(ato.valorTotal, moedaParaNumero(ISS)) / ato.quantidade : 0;
            const valorAtual = ato[campo].valorManual ? ato[campo].valor : parseFloat((quantidadeNum * valorUnitario).toFixed(2));
            
            const atoAtualizado = {
              ...ato,
              [campo]: { quantidade: quantidadeNum, valor: valorAtual, valorManual: false },
            };
            console.log('Ato atualizado (quantidade):', atoAtualizado);
            return atoAtualizado;
          }
          
          if (subcampo === 'valor') {
            const valorNum = moedaParaNumero(valor);
            console.log('Convertendo valor:', { valorOriginal: valor, valorConvertido: valorNum });
            
            const atoAtualizado = {
              ...ato,
              [campo]: { ...ato[campo], valor: valorNum, valorManual: true },
            };
            console.log('Ato atualizado (valor):', atoAtualizado);
            return atoAtualizado;
          }
        }
        return ato;
      })
    );
  };

  const salvarRelatorio = async () => {
    console.log('Tentando salvar relatório...');
    setSalvando(true);
    setMensagemSalvar('');
    try {
      // Verificação defensiva do usuário
      if (!usuario || !usuario.serventia || !usuario.cargo) {
        console.error('Usuário não definido ou incompleto:', usuario);
        setMensagemSalvar('Usuário não encontrado. Faça login novamente.');
        setSalvando(false);
        return;
      }

      const token = localStorage.getItem('token');
      console.log('Token:', token);

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

      console.log('Payload:', payload);
      console.log('URL da requisição:', `${config.apiURL}/salvar-relatorio`);

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
      console.error('Erro no salvarRelatorio:', error);
    } finally {
      setSalvando(false);
    }
  };

  const conferirCaixa = async () => {
    console.log('conferirCaixa chamado');
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
      console.log('salvarRelatorio foi chamado');
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
        <button className="atos-table-btn" onClick={() => { console.log('Botão clicado!'); conferirCaixa(); }}>
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