import React, { useState, useEffect, useMemo } from 'react';
import { gerarRelatorioPDFCaixaDiario } from './RelatorioPDFCaixaDiario';
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
  const [usuarios, setUsuarios] = useState([]);

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
      gerarRelatorioPDFCaixaDiario({
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

  useEffect(() => {
    async function consultarAtosPagos() {
      if (!dataRelatorio || !usuario?.serventia) return;
      const token = localStorage.getItem('token');
      let dataPesquisa = String(dataRelatorio);
      if (dataPesquisa.includes('T')) dataPesquisa = dataPesquisa.split('T')[0];
      else if (dataPesquisa.includes('/')) {
        const [dia, mes, ano] = dataPesquisa.split('/');
        dataPesquisa = `${ano}-${mes}-${dia}`;
      }

      console.log('[AtosTable] 🔎 Buscando atos pagos para data:', dataPesquisa, 'serventia:', usuario.serventia);

      const res = await fetch(
        `${config.apiURL}/atos-tabela?data=${dataPesquisa}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        console.log('[AtosTable] ❌ Falha ao buscar atos-tabela');
        return;
      }
      const data = await res.json();
      console.log('[AtosTable] 📥 Dados recebidos da API atos-tabela:', data);

      // Filtra atos pagos (tributação === '01') e da serventia
      const atosPagos = (data.atos || []).filter(
        ato => ato.tributacao === '01' && ato.usuario_serventia === usuario.serventia
      );
      console.log('[AtosTable] ✅ Atos pagos filtrados:', atosPagos);

      // Agrupa por código
      const agrupados = {};
      atosPagos.forEach(ato => {
        if (!agrupados[ato.codigo]) {
          agrupados[ato.codigo] = {
            quantidade: 0,
            pagamentos: { dinheiro: 0, cartao: 0, pix: 0, crc: 0, deposito: 0 }
          };
        }
        agrupados[ato.codigo].quantidade += ato.quantidade || 1;
        // Somatório dos pagamentos por tipo
        if (ato.pagamentos) {
          agrupados[ato.codigo].pagamentos.dinheiro += Number(ato.pagamentos.dinheiro) || 0;
          agrupados[ato.codigo].pagamentos.cartao += Number(ato.pagamentos.cartao) || 0;
          agrupados[ato.codigo].pagamentos.pix += Number(ato.pagamentos.pix) || 0;
          agrupados[ato.codigo].pagamentos.crc += Number(ato.pagamentos.crc) || 0;
          agrupados[ato.codigo].pagamentos.deposito += Number(ato.pagamentos.deposito) || 0;
        }
      });
      console.log('[AtosTable] 📊 Atos agrupados por código:', agrupados);

      // Preenche as linhas da tabela com os valores apurados
      setAtos(prevAtos =>
        prevAtos.map(ato => {
          if (agrupados[ato.codigo]) {
            return {
              ...ato,
              pagamentoDinheiroSugerido: agrupados[ato.codigo].pagamentos.dinheiro,
              pagamentoCartaoSugerido: agrupados[ato.codigo].pagamentos.cartao,
              pagamentoPixSugerido: agrupados[ato.codigo].pagamentos.pix,
              pagamentoCRCSugerido: agrupados[ato.codigo].pagamentos.crc,
              depositoPrevioSugerido: agrupados[ato.codigo].pagamentos.deposito,
              quantidadeSugerida: agrupados[ato.codigo].quantidade
            };
          }
          return ato;
        })
      );
    }
    consultarAtosPagos();
  }, [dataRelatorio, usuario?.serventia, usuarios]);

  useEffect(() => {
    async function fetchUsuarios() {
      const token = localStorage.getItem('token');
      const res = await fetch(`${config.apiURL}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsuarios(data.usuarios || []);
      }
    }
    fetchUsuarios();
  }, []);

  if (!atos.length) return null;

  // Azul padrão para todos os containers
  const azulFundo = '#667eea';
  //const azulFundo = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';

  return (
    <div
      style={{
        background: azulFundo,
        borderRadius: 0,
        border: 'none',
        width: '100%',
        boxSizing: 'border-box',
        maxWidth: '100%',
        margin: 0
      }}
    >
      <h2
        style={{
          color: 'white',
          fontSize: '22px',
          fontWeight: 700,
          margin: 0,
          textShadow: '0 2px 4px rgba(0,0,0,0.18)',
          background: azulFundo
        }}
      >
        Atos Extraídos para a data 
        {dataRelatorio && (
          <span style={{ fontWeight: 700, fontSize: '22px', textShadow: '0 2px 4px rgba(0,0,0,0.18)', marginLeft: 12 }}>
            {(() => {
              const str = String(dataRelatorio);
              if (str.includes('T')) {
                // Formato ISO: 2025-07-10T00:00:00.000Z
                const soData = str.split('T')[0];
                const [ano, mes, dia] = soData.split('-');
                return ` ${dia}-${mes}-${ano}`;
              } else if (str.includes('/')) {
                // Formato BR: 10/07/2025
                const [dia, mes, ano] = str.split('/');
                return ` ${dia}-${mes}-${ano}`;
              } else if (str.includes('-')) {
                // Formato ISO sem T: 2025-07-10
                const [ano, mes, dia] = str.split('-');
                return ` ${dia}-${mes}-${ano}`;
              }
              return ` ${str}`;
            })()}
          </span>
        )}
      </h2>

      <div
        style={{
          marginBottom: 12, // reduzido de 32
          padding: '16px 0', // reduzido de 32px 0
          width: '100%',
          boxSizing: 'border-box',
          background: azulFundo
        }}
      >
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

      <div
        style={{
          marginTop: 10, // reduzido de 20
          display: 'flex',
          gap: 8, // reduzido de 10
          justifyContent: 'left',
          padding: 0,
          width: '100%',
          boxSizing: 'border-box',
          background: azulFundo
        }}
      >
        <button
          className="atos-table-btn"
          style={{
            background: '#27ae60',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 18px', // reduzido de 12px 28px
            fontSize: '15px', // reduzido de 16px
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(39,174,96,0.15)',
            transition: 'all 0.2s'
          }}
          onClick={() => {
            conferirCaixa();
          }}
          onMouseEnter={e => (e.target.style.background = '#19d272')}
          onMouseLeave={e => (e.target.style.background = '#19d272')}
          disabled={salvando}
        >
          {salvando ? 'Salvando...' : 'Gerar Relatório'}
        </button>
      </div>

      <MensagemStatus mensagem={mensagemSalvar} />

      <div
        style={{
          marginTop: 16, // reduzido de 32
          background: azulFundo,
          borderRadius: '16px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.07)',
          padding: '12px 0', // reduzido de 24px 0
          width: '100%',
          minWidth: 0,
          maxWidth: '100%',
          overflowX: 'auto',
          boxSizing: 'border-box'
        }}
      >
        <div
          style={{
            maxWidth: '100%',
            margin: 0,
            background: azulFundo
          }}
        >
          <AtosGrid atos={atosComISS} handleAtoChange={handleAtoChange} />
        </div>
      </div>
    </div>
  );
}