import React, { useState, useEffect, useMemo } from 'react';
import { gerarRelatorioPDF } from './RelatorioPDF';
import CaixaInfo from './CaixaInfo';
import AtosGrid from './AtosGrid';
import MensagemStatus from './MensagemStatus';
import config from '../config';
import { extrairDadosDoTexto, calcularValorTotalComISS, moedaParaNumero, formatarMoeda } from './utilsAtos';

export default function AtosTable({ texto, usuario: usuarioProp }) {
  const usuario = useMemo(() => {
    return usuarioProp || JSON.parse(localStorage.getItem('usuario') || '{}');
  }, [usuarioProp]);
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

  // Inicializa atos com valorInput vazio para cada forma de pagamento
  useEffect(() => {
    if (texto) {
      const { dataRelatorio, atos } = extrairDadosDoTexto(texto);
      console.log('Dados extraídos do texto:', { dataRelatorio, atos });
      const atosComValorInput = atos.map(ato => ({
        ...ato,
        pagamentoDinheiro: { ...ato.pagamentoDinheiro, valorInput: '' },
        pagamentoCartao: { ...ato.pagamentoCartao, valorInput: '' },
        pagamentoPix: { ...ato.pagamentoPix, valorInput: '' },
        pagamentoCRC: { ...ato.pagamentoCRC, valorInput: '' },
        depositoPrevio: { ...ato.depositoPrevio, valorInput: '' },
      }));
      setDataRelatorio(dataRelatorio);
      setAtos(atosComValorInput);
      console.log('Estado atos inicializado com valorInput:', atosComValorInput);
    }
    if (usuario && usuario.nome) {
      setResponsavel(usuario.nome);
      console.log('Responsável definido:', usuario.nome);
    }
  }, [texto, usuario]);

  const atosComISS = useMemo(() => {
    const resultado = atos.map(ato => ({
      ...ato,
      valorTotalComISS: calcularValorTotalComISS(ato.valorTotal, moedaParaNumero(ISS))
    }));
    console.log('atosComISS recalculado:', resultado);
    return resultado;
  }, [atos, ISS]);

  const valorFinalCaixa = useMemo(() => {
    const totalDinheiro = atosComISS.reduce((acc, ato) => acc + ato.pagamentoDinheiro.valor, 0);
    const valorFinal = valorInicialCaixa + totalDinheiro - saidasCaixa - depositosCaixa;
    console.log('valorFinalCaixa calculado:', valorFinal);
    return valorFinal;
  }, [valorInicialCaixa, depositosCaixa, saidasCaixa, atosComISS]);

  const handleValorChange = (id, campo, valorInput) => {
    console.log('handleValorChange chamado:', { id, campo, valorInput });
    setAtos(prevAtos =>
      prevAtos.map(ato => {
        if (ato.id === id) {
          const novoAto = {
            ...ato,
            [campo]: {
              ...ato[campo],
              valorInput,
            },
          };
          console.log('Novo ato após handleValorChange:', novoAto);
          return novoAto;
        }
        return ato;
      })
    );
  };

  const handleValorBlur = (id, campo) => {
    console.log('handleValorBlur chamado:', { id, campo });
    setAtos(prevAtos =>
      prevAtos.map(ato => {
        if (ato.id === id) {
          const valorStr = ato[campo].valorInput ?? '';
          const valorNum = valorStr === '' ? 0 : moedaParaNumero(valorStr);
          const novoAto = {
            ...ato,
            [campo]: {
              ...ato[campo],
              valor: valorNum,
              valorManual: true,
              valorInput: undefined,
            },
          };
          console.log('Novo ato após handleValorBlur:', novoAto);
          return novoAto;
        }
        return ato;
      })
    );
  };

  const handleAtoChange = (id, campo, subcampo, valor) => {
    console.log('handleAtoChange chamado:', { id, campo, subcampo, valor });
    setAtos(prevAtos =>
      prevAtos.map(ato => {
        if (ato.id === id) {
          if (campo === 'observacoes') {
            const novoAto = { ...ato, observacoes: valor };
            console.log('Novo ato após atualizar observacoes:', novoAto);
            return novoAto;
          }
          if (
            ['pagamentoDinheiro', 'pagamentoCartao', 'pagamentoPix', 'pagamentoCRC', 'depositoPrevio'].includes(campo)
          ) {
            if (subcampo === 'quantidade') {
              const quantidadeNum = parseInt(valor) || 0;
              const novoAto = {
                ...ato,
                [campo]: { ...ato[campo], quantidade: quantidadeNum },
              };
              console.log('Novo ato após atualizar quantidade:', novoAto);
              return novoAto;
            }
            return ato;
          }
          return ato;
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
      console.error('Erro no salvarRelatorio:', error);
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
        <button className="atos-table-btn" onClick={() => conferirCaixa()}>
          Gerar Relatório
        </button>
      </div>

      <MensagemStatus mensagem={mensagemSalvar} />

      <AtosGrid
        atos={atosComISS}
        handleAtoChange={handleAtoChange}
        handleValorChange={handleValorChange}
        handleValorBlur={handleValorBlur}
      />
    </div>
  );
}