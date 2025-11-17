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

function CaixaDiario() {
  // Usuário logado
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  const [caixaUnificado, setCaixaUnificado] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  // Estados
  const [dataSelecionada, setDataSelecionada] = useState(() => {
    const hoje = new Date();
    // Corrige para o fuso local
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  });

  const [valorInicialCaixa, setValorInicialCaixa] = useState(0);
  const [valorFinalCaixa, ValorFinalCaixa] = useState(0); // Deixe só esta!
  const [percentualISS, setPercentualISS] = useState(0); // Estado para ISS
  const [atos, setAtos] = useState([]);
  const [atosFiltrados, setAtosFiltrados] = useState([]);
  const [fechamentos, setFechamentos] = useState([]);
  

  const [nomeUsuario, setNomeUsuario] = useState(() => {
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    console.log('🧑 nomeUsuario recebido CaixaDiario:', usuario);
    return usuario?.nome || 'Usuário não identificado';
  });
  const [entradaValor, setEntradaValor] = useState('');
  const [entradaObs, setEntradaObs] = useState('');
  const [saidaValor, setSaidaValor] = useState('');
  const [saidaObs, setSaidaObs] = useState('');
  const [saidaClienteNome, setSaidaClienteNome] = useState('');
  const [saidaTicket, setSaidaTicket] = useState('');

// Função para formatar valor de input para número (ex: "R$ 1.234,56" -> 1234.56)
  const parseValorMoeda = (valorStr) => {
    if (!valorStr) return 0;
    // Remove tudo que não é número ou vírgula/ponto
    const numStr = valorStr.replace(/[^\d,.-]/g, '').replace(',', '.');
    const num = parseFloat(numStr);
    return isNaN(num) ? 0 : num;
  };

  // Função para adicionar entrada no caixa
  const adicionarEntrada = async () => {
    const valor = parseValorMoeda(entradaValor);
    if (valor <= 0) {
      alert('Informe um valor válido para a entrada.');
      return;
    }
   // const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
   //
   //  const nomeUsuario = usuario?.nome || 'Usuário não identificado';
    const agora = new Date();

    const novaEntrada = {
      data: dataSelecionada, // Usar a data selecionada
      hora: agora.toLocaleTimeString('pt-BR', { hour12: false }),
      codigo: '0003',
      descricao: `ENTRADA: ${entradaObs || ''}`.trim(),
      quantidade: 1,
      valor_unitario: valor,
      pagamentos: {}, // vazio conforme solicitado
      usuario: nomeUsuario,
      };
    console.log('entrada enviada para o backend:', novaEntrada);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${apiURL}/atos-pagos`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(novaEntrada),
        }
      );

      if (res.ok) {
        setEntradaValor('');
        setEntradaObs('');
        // Em vez de setAtos([...]), recarregue do backend:
        await carregarDadosDaData();
        console.log('Entrada manual salva com sucesso:', novaEntrada);
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

  // Função para adicionar saída no caixa
  const adicionarSaida = async () => {
    const valor = parseValorMoeda(saidaValor);
    if (valor <= 0) {
      alert('Informe um valor válido para a saída.');
      return;
    }
    //const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    //const nomeUsuario = usuario?.nome || 'Usuário não identificado';
    const agora = new Date();

    // Monta descrição com máscara de devolução se houver nome do cliente
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
      data: dataSelecionada, // Usar a data selecionada
      hora: agora.toLocaleTimeString('pt-BR', { hour12: false }),
      codigo: '0002',
      descricao: `SAÍDA: ${descricaoDetalhada}`.trim(),
      quantidade: 1,
      valor_unitario: valor,
      pagamentos: {}, // vazio conforme solicitado
      usuario: nomeUsuario,
    };

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${apiURL}/atos-pagos`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(novaSaida),
        }
      );

      if (res.ok) {
        setAtos((prev) => [...prev, novaSaida]);
        setSaidaValor('');
        setSaidaObs('');
        setSaidaClienteNome('');
        setSaidaTicket('');
        console.log('Saída manual salva com sucesso:', novaSaida);
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

  // Funções auxiliares
  const handleDataChange = (e) => {
    setDataSelecionada(e.target.value);
  };

  const calcularValorFinalCaixa = () => {
    // Busca o valor inicial do caixa (código 0005) da tabela de atos
    

    // Soma todos os valores em dinheiro dos atos normais (exceto entradas/saídas/valor inicial)
    const totalDinheiro = atos.reduce((acc, ato) => {
      if (
        ato.codigo !== '0003' && // não entrada manual
        ato.codigo !== '0002' && // não saída manual
        ato.codigo !== '0005'    // não valor inicial
      ) {
        const valorDinheiro = parseFloat(ato.pagamentos?.dinheiro?.valor) || 0;
        return acc + valorDinheiro;
      }
      return acc;
    }, 0);

    // Soma as entradas manuais (código 0003)
    const totalEntradas = atos.reduce((acc, ato) => {
      if (ato.codigo === '0003') {
        const valorEntrada = parseFloat(ato.valor_unitario) || 0;
        return acc + valorEntrada;
      }
      return acc;
    }, 0);

        // Soma as entradas manuais (código 0005)
    const valorInicial = atos.reduce((acc, ato) => {
      if (ato.codigo === '0005') {
        const valorInicial = parseFloat(ato.valor_unitario) || 0;
        return acc + valorInicial;
      }
      return acc;
    }, 0);

    // Subtrai as saídas manuais (código 0002)
    const totalSaidas = atos.reduce((acc, ato) => {
      if (ato.codigo === '0002') {
        const valorSaida = parseFloat(ato.valor_unitario) || 0;
        return acc + valorSaida;
      }
      return acc;
    }, 0);

    const valorFinal = valorInicial + totalDinheiro + totalEntradas - totalSaidas;

    console.log("Cálculo do Valor Final do Caixa:");
    console.log("- Valor Inicial (tabela):", valorInicial);
    console.log("- Total Dinheiro (atos):", totalDinheiro);
    console.log("- Total Entradas (0003):", totalEntradas);
    console.log("- Total Saídas (0002):", totalSaidas);
    console.log("- Valor Final Calculado:", valorFinal);

    return isNaN(valorFinal) ? 0 : valorFinal;
  };

  // Função para calcular valor com ISS
  const calcularValorComISS = (valorBase) => {
    if (!valorBase || percentualISS === 0) return valorBase;
    const valorComISS = valorBase * (1 + percentualISS / 100);
  // Valor base/ISS log REMOVIDO
    return valorComISS;
  };

  const valoresIguais = (a, b, tolerancia = 0.01) => Math.abs(a - b) < tolerancia;

  

  

  const removerAto = async (index) => {
    const atoParaRemover = atos[index];
    
    // Verificar se o ato tem ID (foi salvo no backend)
    if (atoParaRemover.id) {
      // Ato existe no backend, precisa deletar lá também
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(
          `${apiURL}/atos-pagos/${atoParaRemover.id}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        
        if (res.ok) {
          setAtos(atos.filter((_, i) => i !== index));
          console.log('Ato removido do backend e da lista local:', atoParaRemover);
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
      // Ato só existe localmente, remover apenas da lista
      setAtos(atos.filter((_, i) => i !== index));
      console.log('Ato removido apenas da lista local (não tinha ID):', atoParaRemover);
    }
  };

  // Função para carregar atos do backend
  const carregarDadosDaData = async () => {
    try {
      const token = localStorage.getItem('token');
      // Adiciona o parâmetro serventia na requisição
      const serventiaParam = usuario?.serventia ? `&serventia=${encodeURIComponent(usuario.serventia)}` : '';
      const resAtos = await fetch(
        `${apiURL}/atos-pagos?data=${dataSelecionada}${serventiaParam}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (resAtos.ok) {
        const dataAtos = await resAtos.json();
        console.log('[CaixaDiario] Atos recebidos do backend:', dataAtos.CaixaDiario);
        setAtos(dataAtos.CaixaDiario || []);
      }
    } catch (e) {
      console.error('Erro ao carregar dados da data:', e);
    }
  };

  // Buscar config de caixa unificado da serventia
  useEffect(() => {
    async function fetchConfig() {
      setLoadingConfig(true);
      try {
        if (!usuario?.serventia) throw new Error('Usuário sem serventia');
        console.log('[CaixaDiario] Serventia do usuário:', usuario.serventia);
        const res = await fetch(`${apiURL}/configuracoes-serventia?serventia=${encodeURIComponent(usuario.serventia)}`);
        if (!res.ok) throw new Error('Erro ao buscar configuração da serventia');
        const data = await res.json();
        setCaixaUnificado(!!data.caixa_unificado);
        console.log('[CaixaDiario] Valor de caixaUnificado:', !!data.caixa_unificado);
      } catch (e) {
        setCaixaUnificado(false);
        console.error('Erro ao buscar config de caixa unificado:', e);
      } finally {
        setLoadingConfig(false);
      }
    }
    fetchConfig();
  }, [usuario?.serventia]);

  // Filtrar atos conforme config
  useEffect(() => {
    if (caixaUnificado) {
      setAtosFiltrados(atos);
      console.log('[CaixaDiario] caixaUnificado=true, exibindo todos os atos:', atos);
    } else {
      const filtrados = atos.filter(a => a.usuario === usuario?.nome);
      setAtosFiltrados(filtrados);
      console.log('[CaixaDiario] caixaUnificado=false, exibindo só do usuário', usuario?.nome, filtrados);
    }
  }, [caixaUnificado, atos, usuario?.nome]);

// Adicione este useEffect:
useEffect(() => {
  carregarDadosDaData();
}, []);

  // useEffect para carregar atos ao mudar a data
  useEffect(() => {
    let isMounted = true;
    carregarDadosDaData();
    return () => { isMounted = false; };
  }, [dataSelecionada]);

  

    const fechamentoDiario = async () => {
    const dataAtual = dataSelecionada;
    const existeFechamento = atos.some(
      (ato) =>
        ato.codigo === "0001" &&
        ato.data === dataAtual &&
        ato.usuario === nomeUsuario
    );

    if (existeFechamento) {
      alert("Já existe um fechamento de caixa (código 0001) para este usuário e data.");
      return;
    }

    if (!window.confirm("Confirma o fechamento diário do caixa?")) return;

    const hora = new Date().toLocaleTimeString("pt-BR", { hour12: false });
    const valorFinalCalculado = calcularValorFinalCaixa();

    if (isNaN(valorFinalCalculado)) {
      alert("Erro no cálculo do valor final do caixa. Verifique os dados e tente novamente.");
      return;
    }

    const pagamentosZerados = formasPagamento.reduce((acc, fp) => {
      acc[fp.key] = { quantidade: 0, valor: 0, manual: false };
      return acc;
    }, {});

    const atoFechamento = {
      data: dataAtual,
      hora: hora,
      codigo: '0001',
      descricao: 'VALOR FINAL DO CAIXA',
      quantidade: 1,
      valor_unitario: Number(valorFinalCalculado.toFixed(2)),
      pagamentos: pagamentosZerados,
      usuario: nomeUsuario,
    };

    try {
      const token = localStorage.getItem('token');
      console.log('Enviando fechamento ao backend:', atoFechamento);
      const res = await fetch(
        `${apiURL}/atos-pagos`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(atoFechamento),
        }
      );
      const resText = await res.text();
      console.log('Resposta do backend ao salvar fechamento:', res.status, resText);

      if (!res.ok) {
        alert('Erro ao salvar fechamento no banco: ' + resText);
        return;
      }

      await carregarDadosDaData();
      alert('Fechamento diário realizado com sucesso!');

      // Gere o PDF no frontend:
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
        nomeArquivo: `FechamentoCaixa_${dataSelecionada}.pdf`
      });
    } catch (e) {
      alert('Erro ao realizar fechamento diário: ' + e.message);
      console.error('Erro ao realizar fechamento diário:', e);
    }
  };

  const salvarValorInicialCaixa = async () => {
    if (!valorInicialCaixa || valorInicialCaixa <= 0) {
      console.warn('Valor inicial do caixa inválido:', valorInicialCaixa);
      return;
    }

    // Verifica se já existe um ato 0005 para o dia e usuário
    const existe = atos.find(
      (ato) =>
        ato.codigo === '0005' &&
        ato.data === dataSelecionada &&
        ato.usuario === nomeUsuario
    );

    // Se já existe e o valor não mudou, não faz nada
    if (existe && existe.valor_unitario === valorInicialCaixa) {
      console.info('Valor inicial já existe e não mudou:', existe);
      return;
    }

    // Se já existe, remove do backend
    if (existe && existe.id) {
      try {
        const token = localStorage.getItem('token');
        const resDel = await fetch(
          `${apiURL}/atos-pagos/${existe.id}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        console.log('Remoção do valor inicial antigo:', resDel.status, await resDel.text());
      } catch (e) {
        console.error('Erro ao remover valor inicial antigo:', e);
      }
    }

    // Salva novo valor inicial no backend
    const novoAto = {
      data: dataSelecionada,
      hora: new Date().toLocaleTimeString(),
      codigo: '0005',
      descricao: 'VALOR INICIAL DO CAIXA',
      quantidade: 1,
      valor_unitario: Number(valorInicialCaixa),
      pagamentos: {},
      usuario: nomeUsuario,
    };

    try {
      const token = localStorage.getItem('token');
      console.log('Enviando valor inicial ao backend:', novoAto);
      const res = await fetch(
        `${apiURL}/atos-pagos`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(novoAto),
        }
      );
      const resText = await res.text();
      console.log('Resposta do backend ao salvar valor inicial:', res.status, resText);
      if (res.ok) {
        await carregarDadosDaData();
      } else {
        alert('Erro ao salvar valor inicial do caixa.');
      }
    } catch (e) {
      console.error('Erro ao salvar valor inicial do caixa:', e);
      alert('Erro ao salvar valor inicial do caixa: ' + e.message);
    }
  };

  // ISS automático conforme serventia do usuário
useEffect(() => {
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  if (usuario?.serventia === 'RCPN de Campanha') {
    setPercentualISS(3);
  } else if (usuario?.serventia === 'RCPN de Lavras') {
    setPercentualISS(0);
  } else {
    setPercentualISS(0);
  }
}, []);

  // Totais (usamos atosFiltrados para refletir o que o usuário vê)
  const totalEntradasDoDia = (atosFiltrados || atos).reduce((acc, ato) => {
    if (ato.codigo === '0003') return acc + (parseFloat(ato.valor_unitario) || 0);
    return acc;
  }, 0);

  const totalSaidasDoDia = (atosFiltrados || atos).reduce((acc, ato) => {
    if (ato.codigo === '0002') return acc + (parseFloat(ato.valor_unitario) || 0);
    return acc;
  }, 0);

  // Log para depuração: verificar se o usuário é Registrador ou Substituto
  const isRegistradorOuSubstituto = (usuario?.cargo === 'Registrador' || usuario?.cargo === 'Substituto');
  console.log('[CaixaDiario] usuario.cargo:', usuario?.cargo, 'isRegistradorOuSubstituto:', isRegistradorOuSubstituto, 'usuario:', usuario, 'totaisEntradas:', totalEntradasDoDia, 'totaisSaidas:', totalSaidasDoDia);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '12px',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
    }}>
      {/* Container Principal */}
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        width: '100%'
      }}>
        
        {/* Header */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '12px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>      <h1 style={{ 
          margin: 0, 
          color: '#2c3e50',
          fontSize: '26px',
          fontWeight: '600'
        }}>
          💰 Movimento Diário do Caixa
        </h1>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span style={{ color: '#666', fontSize: '14px' }}></span>
            <DataSelector dataSelecionada={dataSelecionada} onChange={handleDataChange} />
          </div>
        </div>
      </div>

      {/* Resumo do Caixa */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '12px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
      }}>
        {/* Tudo na mesma linha do título */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <h2 style={{ 
            margin: 0, 
            color: '#2c3e50',
            fontSize: '18px',
            fontWeight: '600'
          }}>
            📊 Resumo:
          </h2>

          {/* Percentual de ISS */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{
              color: '#2c3e50',
              fontSize: '18px',
              fontWeight: '600'
            }}>
              ISS: {percentualISS}%
            </span>
          </div>

          {/* Valor Inicial do Caixa */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{
              color: '#2c3e50',
              fontSize: '18px',
              fontWeight: '600'
            }}>
              💰 Valor Inicial do Caixa:
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={valorInicialCaixa}
              onChange={e => setValorInicialCaixa(parseFloat(e.target.value) || 0)}
              onBlur={salvarValorInicialCaixa}
              style={{
                width: '100px',
                padding: '4px 6px',
                borderRadius: '4px',
                border: '1px solid #27ae60',
                fontSize: '16px',
                fontWeight: '600'
              }}
            />
          </div>

          {/* Valor Final do Caixa */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{
              color: '#2c3e50',
              fontSize: '18px',
              fontWeight: '600'
            }}>
              💎 Valor Final do Caixa: {formatarMoeda(calcularValorFinalCaixa())}
            </span>
          </div>
        </div>

        {/* Totais visíveis apenas para Registrador/Substituto */}
        {isRegistradorOuSubstituto && (
          <div style={{ marginTop: '12px', display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#2c3e50', fontSize: '16px', fontWeight: '600' }}>Total de Entradas:</span>
              <span style={{ color: '#27ae60', fontSize: '16px', fontWeight: '700' }}>{formatarMoeda(totalEntradasDoDia)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#2c3e50', fontSize: '16px', fontWeight: '600' }}>Total de Saídas:</span>
              <span style={{ color: '#e74c3c', fontSize: '16px', fontWeight: '700' }}>{formatarMoeda(totalSaidasDoDia)}</span>
            </div>
          </div>
        )}

      </div>




      {/* Layout Principal - Grid Responsivo */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
        gap: '8px',
        marginBottom: '8px',
        maxWidth: '100%',
        overflow: 'hidden'
      }}>

        {/* Seção de Entradas e Saídas Manuais */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '16px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
        }}>
          <h3 style={{ 
            margin: '0 0 12px 0', 
            color: '#2c3e50',
            fontSize: '16px',
            fontWeight: '600',
            borderBottom: '2px solid #f39c12',
            paddingBottom: '8px'
          }}>
            💸 Entradas e Saídas Manuais
          </h3>

          {/* Entrada e Saída lado a lado */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
            {/* Entrada Manual */}
            <div style={{
              background: '#f8f9fa',
              border: '2px solid #27ae60',
              borderRadius: '8px',
              padding: '12px'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#27ae60' }}>
                📈 Entrada de Valor
              </h4>
              <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ 
                  fontWeight: '600',
                  color: '#2c3e50',
                  minWidth: '60px'
                }}>
                  Valor:
                </label>
                <input
                  type="text"
                  value={entradaValor}
                  onChange={(e) => setEntradaValor(e.target.value)}
                  placeholder="R$ 0,00"
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '6px',
                    border: '2px solid #e3f2fd',
                    fontSize: '14px'
                  }}
                />
              </div>
              <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ 
                  fontWeight: '600',
                  color: '#2c3e50',
                  minWidth: '100px'
                }}>
                  Observação:
                </label>
                <input
                  type="text"
                  value={entradaObs}
                  onChange={(e) => setEntradaObs(e.target.value)}
                  placeholder="Ex. Troco, abertura de caixa, outras entradas"
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '6px',
                    border: '2px solid #e3f2fd',
                    fontSize: '14px'
                  }}
                />
              </div>
              <button
                onClick={adicionarEntrada}
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: '#27ae60',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
              >
                ➕ Adicionar Entrada
              </button>
            </div>

            {/* Saída Manual */}
            <div style={{
              background: '#f8f9fa',
              border: '2px solid #e74c3c',
              borderRadius: '8px',
              padding: '12px'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#e74c3c' }}>
                📉 Saída de Valor
              </h4>
              <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ 
                  fontWeight: '600',
                  color: '#2c3e50',
                  minWidth: '60px'
                }}>
                  Valor:
                </label>
                <input
                  type="text"
                  value={saidaValor}
                  onChange={(e) => setSaidaValor(e.target.value)}
                  placeholder="R$ 0,00"
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '6px',
                    border: '2px solid #e3f2fd',
                    fontSize: '14px'
                  }}
                />
              </div>
              {/* Campos de Devolução: Nome do Cliente e Ticket */}
              <div style={{ marginBottom: '10px', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ 
                    fontWeight: '600',
                    color: '#2c3e50',
                    minWidth: '200px'
                  }}>
                    Nome do Cliente (Devolução):
                  </label>
                  <input
                    type="text"
                    value={saidaClienteNome}
                    onChange={(e) => setSaidaClienteNome(e.target.value)}
                    placeholder="Ex.: João da Silva"
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '6px',
                      border: '2px solid #e3f2fd',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ 
                    fontWeight: '600',
                    color: '#2c3e50',
                    minWidth: '60px'
                  }}>
                    Ticket:
                  </label>
                  <input
                    type="text"
                    value={saidaTicket}
                    onChange={(e) => setSaidaTicket(e.target.value)}
                    placeholder="Ex.: 12345"
                    style={{
                      width: '120px',
                      padding: '8px 6px',
                      borderRadius: '6px',
                      border: '2px solid #e3f2fd',
                      fontSize: '14px'
                    }}
                  />
                </div>
              </div>
              <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ 
                  fontWeight: '600',
                  color: '#2c3e50',
                  minWidth: '100px'
                }}>
                  Observação:
                </label>
                <input
                  type="text"
                  value={saidaObs}
                  onChange={(e) => setSaidaObs(e.target.value)}
                  placeholder="Ex. Depósitos, retiradas, outras saídas."
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '6px',
                    border: '2px solid #e3f2fd',
                    fontSize: '14px'
                  }}
                />
              </div>
              <button
                onClick={adicionarSaida}
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
              >
                ➖ Adicionar Saída
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Botão de Fechamento */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '8px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
        textAlign: 'center'
      }}>
        <FechamentoDiarioButton onClick={fechamentoDiario} />
      </div>

      {/* Tabela de Atos */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '8px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
      }}>
        <h3 style={{ 
          margin: '0 0 12px 0', 
          color: '#2c3e50',
          fontSize: '16px',
          fontWeight: '600',
          borderBottom: '2px solid #9b59b6',
          paddingBottom: '8px'
        }}>
          📋 Movimentos do Dia
        </h3>
        {loadingConfig ? (
          <div>Carregando configuração da serventia...</div>
        ) : (
          <AtosTable atos={atosFiltrados} onRemover={removerAto} />
        )}
      </div>
      
      </div> {/* Fim do Container Principal */}
    </div> 
  );
}

export default CaixaDiario;

