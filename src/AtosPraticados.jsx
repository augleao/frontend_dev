import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  formasPagamento,
  formatarMoeda,
  formatarDataBR,
  gerarRelatorioPDFAtosPraticados,
  converterDetalhesPagamentoParaMascara,
} from './utils';
import DataSelector from './DataSelector';
import AtoSearchAtosPraticados from './AtoSearchAtosPraticados';
import FormasPagamento from './FormasPagamento';
import AtosTable from './AtosTableEscrevente';
import FechamentoDiarioButton from './FechamentoDiarioButton';
import dayjs from 'dayjs';
import { apiURL } from './config';
import TributacaoSearch from './TributacaoSearch'; // Adicione esta linha no topo
import Toast from './components/Toast';
import { DEFAULT_TOAST_DURATION } from './components/toastConfig';
//import { gerarRelatorioPDFAtosPraticados } from './components/RelatorioPDF';

function AtosPraticados() {
  // Silencia logs enquanto o componente estiver montado (não afeta outros módulos após unmount)
  useEffect(() => {
    const _orig = { log: console.log, warn: console.warn, error: console.error };
    try {
      console.log = () => {};
      console.warn = () => {};
      console.error = () => {};
    } catch (e) {
      // noop
    }
    return () => {
      try {
        console.log = _orig.log;
        console.warn = _orig.warn;
        console.error = _orig.error;
      } catch (e) {
        // noop
      }
    };
  }, []);
  // Estados
  const [dataSelecionada, setDataSelecionada] = useState(() => {
    const hoje = new Date();
    // Corrige para o fuso local
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  });

  const [percentualISS, setPercentualISS] = useState(0); // Estado para ISS
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [tributacao, setTributacao] = useState(''); // Adicione este estado

  const [pagamentos, setPagamentos] = useState(
    formasPagamento.reduce((acc, fp) => {
      acc[fp.key] = { quantidade: 0, valor: 0, manual: false };
      return acc;
    }, {})
  );

  const [quantidade, setQuantidade] = useState(1);
  const [atos, setAtos] = useState([]);
  const [recarregando, setRecarregando] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Trigger para forçar refresh
  const debounceTimeout = useRef(null);
  const toastTimerRef = useRef(null);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');

  // Nome do usuário logado (precisa estar antes de qualquer uso)
  const [nomeUsuario, setNomeUsuario] = useState(() => {
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    console.log('🧑 nomeUsuario recebido atosPraticados:', usuario);
    return usuario?.nome || 'Usuário não identificado';
  });

  // Helper para comparação robusta de nomes (reuso no render)
  const normalizarNome = (nome) => {
    if (!nome) return '';
    return String(nome)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove acentos
      .replace(/[^\w\s]/g, '') // remove pontuação
      .trim();
  };

  const correspondeUsuario = (usuarioAto, usuarioRef) => {
    if (!usuarioAto || !usuarioRef) return false;
    if (usuarioAto === usuarioRef) return true;
    const a = normalizarNome(usuarioAto);
    const b = normalizarNome(usuarioRef);
    if (a === b) return true;
    const pa = a.split(/\s+/).filter(Boolean);
    const pb = b.split(/\s+/).filter(Boolean);
    if (pb.length === 1) return pa.includes(pb[0]);
    if (pa.length >= 2 && pb.length >= 2) {
      return pa[0] === pb[0] && pa[pa.length - 1] === pb[pb.length - 1];
    }
    return false;
  };

  // Filtrar somente os atos do usuário logado para a tabela detalhada
  const atosDoUsuario = useMemo(
    () => atos.filter((a) => correspondeUsuario(a.usuario, nomeUsuario)),
    [atos, nomeUsuario]
  );

  // useEffect para monitorar mudanças no estado dos atos
  useEffect(() => {
    console.log('📊 [AtosPraticados] Estado dos atos atualizado:', {
      total: atos.length,
      atos: atos.map(a => ({
        id: a.id,
        codigo: a.codigo,
        usuario: a.usuario,
        origem_importacao: a.origem_importacao
      }))
    });
  }, [atos]);

  const [entradaValor, setEntradaValor] = useState('');
  const [entradaObs, setEntradaObs] = useState('');
  const [saidaValor, setSaidaValor] = useState('');
  const [saidaObs, setSaidaObs] = useState('');

// Função para formatar valor de input para número (ex: "R$ 1.234,56" -> 1234.56)
  const parseValorMoeda = (valorStr) => {
    if (!valorStr) return 0;
    // Remove tudo que não é número ou vírgula/ponto
    const numStr = valorStr.replace(/[^\d,.-]/g, '').replace(',', '.');
    const num = parseFloat(numStr);
    return isNaN(num) ? 0 : num;
  };

  // Funções auxiliares
  const handleDataChange = (e) => {
    setDataSelecionada(e.target.value);
  };



  const valoresIguais = (a, b, tolerancia = 0.01) => Math.abs(a - b) < tolerancia;

  const somaPagamentos = Object.values(pagamentos).reduce(
    (acc, p) => acc + (parseFloat(p.valor) || 0),
    0
  );

  // Aplicar ISS no valor total
  const valorTotal = 0; // Removido o uso de selectedAto
  // const valorTotal = selectedAto ? calcularValorComISS((selectedAto.valor_final ?? 0) * quantidade) : 0;

  const corFundoPagamentos = (key) => {
    const metodosParaValidar = ['dinheiro', 'cartao', 'pix', 'crc', 'depositoPrevio'];
    if (!metodosParaValidar.includes(key)) return '#ffd1d1';
    return valoresIguais(somaPagamentos, valorTotal) ? '#d4edda' : '#ffd1d1';
  };

  const handlePagamentoQuantidadeChange = (key, qtd) => {
    qtd = parseInt(qtd);
    if (isNaN(qtd) || qtd < 0) qtd = 0;

    setPagamentos((prev) => {
      const novo = { ...prev };
      novo[key].quantidade = qtd;

      const valorUnitarioComISS = 0; // Removido o uso de selectedAto
      // const valorUnitarioComISS = selectedAto ? calcularValorComISS(selectedAto.valor_final ?? 0) : 0;

      if (!novo[key].manual) {
        novo[key].valor = valorUnitarioComISS * qtd;
      }

      return novo;
    });
  };

  const handlePagamentoValorChange = (key, valor) => {
    valor = parseFloat(valor);
    if (isNaN(valor) || valor < 0) valor = 0;

    setPagamentos((prev) => ({
      ...prev,
      [key]: { ...prev[key], valor: valor, manual: true },
    }));
  };

  const handleQuantidadeChange = (qtd) => {
    qtd = parseInt(qtd);
    if (isNaN(qtd) || qtd < 1) qtd = 1;
    setQuantidade(qtd);

    setPagamentos((prev) => {
      const novo = { ...prev };
      const valorUnitarioComISS = 0; // Removido o uso de selectedAto
      // const valorUnitarioComISS = selectedAto ? calcularValorComISS(selectedAto.valor_final ?? 0) : 0;

      formasPagamento.forEach((fp) => {
        if (!novo[fp.key].manual) {
          novo[fp.key].valor = valorUnitarioComISS * novo[fp.key].quantidade;
        }
      });

      return novo;
    });
  };



  const removerAto = async (atoIdOuIndex) => {
    // Se for um número maior que o array, provavelmente é um ID
    // Se for um número menor que o array, provavelmente é um índice
    let atoParaRemover;
    let indexParaRemover;
    
    if (typeof atoIdOuIndex === 'number' && atoIdOuIndex < atos.length) {
      // É um índice
      indexParaRemover = atoIdOuIndex;
      atoParaRemover = atos[atoIdOuIndex];
    } else {
      // É um ID, procurar no array
      indexParaRemover = atos.findIndex(ato => ato.id === atoIdOuIndex);
      atoParaRemover = atos[indexParaRemover];
    }
    
    if (!atoParaRemover) {
      console.error('Ato não encontrado para remoção:', atoIdOuIndex);
      return;
    }
    
    // Verificar se o ato tem ID (foi salvo no backend)
    if (atoParaRemover.id) {
      // Ato existe no backend, precisa deletar lá também
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(
          `${apiURL}/atos-praticados/${atoParaRemover.id}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        
        if (res.ok) {
          setAtos(atos.filter((_, i) => i !== indexParaRemover));
          console.log('Ato removido do backend e da lista local:', atoParaRemover);
          // Dispara refresh para atualizar também o resumo (tabela de atos agrupados)
          setRefreshTrigger(prev => prev + 1);
          // Toast de sucesso
          setToastType('success');
          setToastMessage('Ato removido com sucesso!');
          if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
          toastTimerRef.current = setTimeout(() => {
            setToastMessage('');
            toastTimerRef.current = null;
          }, DEFAULT_TOAST_DURATION);
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
      setAtos(atos.filter((_, i) => i !== indexParaRemover));
      console.log('Ato removido apenas da lista local (não tinha ID):', atoParaRemover);
          // Ainda assim, atualiza o resumo por consistência
          setRefreshTrigger(prev => prev + 1);
          // Toast de sucesso
          setToastType('success');
          setToastMessage('Ato removido com sucesso!');
          if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
          toastTimerRef.current = setTimeout(() => {
            setToastMessage('');
            toastTimerRef.current = null;
          }, DEFAULT_TOAST_DURATION);
    }
  };

  // Cria uma "assinatura" de um ato para detectar mudanças sem depender de IDs
  const assinaturaAto = (ato) => {
    if (!ato) return '';
    const usuario = (ato.usuario || '').toLowerCase();
    const codigo = String(ato.codigo || '');
    const hora = String(ato.hora || '');
    const valor = String(ato.valor_unitario ?? '');
    const data = String(ato.data || '');
    return `${usuario}|${codigo}|${hora}|${valor}|${data}`;
  };

  // Função para carregar atos do backend
  const carregarDadosPraticadosDaData = async () => {
    console.log('🔄 [AtosPraticados] Iniciando carregamento de dados para data:', dataSelecionada);
    
    try {
      const token = localStorage.getItem('token');
      // Log mascarado do token para diagnóstico (não imprime o token completo)
      try {
        console.log('🔐 [AtosPraticados] token present?', token ? `yes len=${token.length} starts=${String(token).slice(0,6)}...` : 'no');
      } catch (e) {
        console.log('🔐 [AtosPraticados] token inspection failed', e);
      }
      const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
      const nomeLogado = usuario?.nome || usuario?.email;
      const serventiaUsuario = usuario?.serventia;

      console.log('👤 [AtosPraticados] Usuario logado:', { nomeLogado, usuario, serventia: serventiaUsuario });

      // 1. Verificar se a serventia tem caixa unificado
      let caixaUnificado = false;
      let usuariosDaServentia = [];

      if (serventiaUsuario) {
        console.log('🔍 [AtosPraticados] Verificando configuração de caixa unificado para serventia:', serventiaUsuario);
        
        try {
          const resConfig = await fetch(`${apiURL}/configuracoes-serventia?serventia=${encodeURIComponent(serventiaUsuario)}`, {
            headers: { Authorization: `Bearer ${token}` }
          });

          if (resConfig.ok) {
            const configData = await resConfig.json();
            caixaUnificado = configData?.caixa_unificado || false;
            console.log('⚙️ [AtosPraticados] Configuração caixa unificado:', caixaUnificado);

            // 2. Se tem caixa unificado, buscar todos os usuários da serventia
            if (caixaUnificado) {
              console.log('🏢 [AtosPraticados] Buscando usuários da serventia para caixa unificado');
              
              const resUsuarios = await fetch(`${apiURL}/users`, {
                headers: { Authorization: `Bearer ${token}` }
              });

              if (resUsuarios.ok) {
                const usuariosData = await resUsuarios.json();
                usuariosDaServentia = (usuariosData.usuarios || []).filter(u => u.serventia === serventiaUsuario);
                console.log('👥 [AtosPraticados] Usuários da serventia encontrados:', usuariosDaServentia.map(u => u.nome));
              } else {
                console.warn('⚠️ [AtosPraticados] Erro ao buscar usuários da serventia, usando apenas usuário logado');
              }
            }
          } else {
            console.warn('⚠️ [AtosPraticados] Erro ao verificar configuração da serventia, usando apenas usuário logado');
          }
        } catch (configError) {
          console.warn('⚠️ [AtosPraticados] Erro ao verificar configurações:', configError);
        }
      }

      const ts = Date.now();
      const urlAtos = `${apiURL}/atos-praticados?data=${dataSelecionada}&_ts=${ts}`;
      console.log('🔗 [AtosPraticados] URL da requisição:', urlAtos);

      const resAtos = await fetch(
        urlAtos,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store'
        }
      );
      
      console.log('📡 [AtosPraticados] Response status:', resAtos.status);
      console.log('📡 [AtosPraticados] Response ok:', resAtos.ok);
      
      if (resAtos.ok) {
        const dataAtos = await resAtos.json();
        console.log('📊 [AtosPraticados] Dados recebidos do backend:', dataAtos);
        console.log('📊 [AtosPraticados] Tipo dos dados:', typeof dataAtos);
        console.log('📊 [AtosPraticados] É array?', Array.isArray(dataAtos));
        console.log('📊 [AtosPraticados] Chaves do objeto:', Object.keys(dataAtos));
        
        // Suporte para diferentes formatos de retorno
        let listaAtos = [];
        
        if (Array.isArray(dataAtos)) {
          // Se é um array direto
          listaAtos = dataAtos;
          console.log('📋 [AtosPraticados] Usando dados como array direto');
        } else if (dataAtos && Array.isArray(dataAtos.atos)) {
          // Se tem propriedade 'atos' que é um array
          listaAtos = dataAtos.atos;
          console.log('📋 [AtosPraticados] Usando dados.atos');
        } else if (dataAtos && Array.isArray(dataAtos.CaixaDiario)) {
          // Se tem propriedade 'CaixaDiario' que é um array (compatibilidade)
          listaAtos = dataAtos.CaixaDiario;
          console.log('📋 [AtosPraticados] Usando dados.CaixaDiario');
        } else {
          // Última tentativa - se não é array nem tem propriedades conhecidas
          console.log('⚠️ [AtosPraticados] Formato não reconhecido, tentando converter para array');
          listaAtos = [];
        }
            
        console.log('📋 [AtosPraticados] Lista de atos extraída:', listaAtos);
        console.log('📋 [AtosPraticados] Total de atos na lista:', listaAtos.length);
        
        // Determinar quais usuários incluir baseado na configuração de caixa unificado
        let atosFiltrados = [];

        if (caixaUnificado && usuariosDaServentia.length > 0) {
          // Caixa unificado: mostrar atos de todos os usuários da serventia
          const nomesUsuariosServentia = usuariosDaServentia.map(u => u.nome);
          console.log('🏢 [AtosPraticados] Modo caixa unificado - incluindo usuários:', nomesUsuariosServentia);
          
          atosFiltrados = listaAtos.filter(ato => {
            return nomesUsuariosServentia.some(nomeServentia => {
              // Usar comparação flexível para cada usuário da serventia
              return usuarioCorresponde(ato.usuario, nomeServentia);
            });
          });
          
          console.log('🏢 [AtosPraticados] Atos filtrados por serventia (caixa unificado):', atosFiltrados.length);
        } else {
          // Caixa individual: mostrar apenas atos do usuário logado
          console.log('👤 [AtosPraticados] Modo caixa individual - apenas usuário logado:', nomeLogado);
          
          atosFiltrados = listaAtos.filter(ato => usuarioCorresponde(ato.usuario, nomeLogado));
          
          console.log('👤 [AtosPraticados] Atos filtrados por usuário individual:', atosFiltrados.length);
        }

        // Função para verificar se um usuário corresponde ao usuário de referência
        function usuarioCorresponde(usuarioAto, usuarioReferencia) {
          if (!usuarioAto || !usuarioReferencia) return false;
          
          // Comparação exata primeiro
          if (usuarioAto === usuarioReferencia) return true;
          
          // Normalizar nomes para comparação flexível
          const normalizar = (nome) => nome
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // remove acentos
            .replace(/[^\w\s]/g, '') // remove pontuação
            .trim();
          const usuarioAtoNorm = normalizar(usuarioAto);
          const usuarioReferenciaNo = normalizar(usuarioReferencia);
          
          // Se são iguais após normalização
          if (usuarioAtoNorm === usuarioReferenciaNo) return true;
          
          // Separar palavras dos nomes
          const palavrasAto = usuarioAtoNorm.split(/\s+/).filter(p => p.length > 0);
          const palavrasReferencia = usuarioReferenciaNo.split(/\s+/).filter(p => p.length > 0);
          
          // Se o usuário de referência é apenas um nome, verificar se está contido no nome do ato
          if (palavrasReferencia.length === 1) {
            return palavrasAto.includes(palavrasReferencia[0]);
          }
          
          // Se ambos têm múltiplas palavras, verificar primeiro e último nome
          if (palavrasReferencia.length >= 2 && palavrasAto.length >= 2) {
            const primeiroReferencia = palavrasReferencia[0];
            const ultimoReferencia = palavrasReferencia[palavrasReferencia.length - 1];
            const primeiroAto = palavrasAto[0];
            const ultimoAto = palavrasAto[palavrasAto.length - 1];
            
            return primeiroReferencia === primeiroAto && ultimoReferencia === ultimoAto;
          }
          
          return false;
        }
        
        console.log('🔍 [AtosPraticados] Atos após filtrar:', atosFiltrados);
        console.log('📈 [AtosPraticados] Total de atos filtrados:', atosFiltrados.length);
        
        if (atosFiltrados.length !== listaAtos.length) {
          console.log('⚠️ [AtosPraticados] Alguns atos foram filtrados. Detalhes do filtro:');
          const usuariosNosAtos = [...new Set(listaAtos.map(ato => ato.usuario))];
          console.log('👥 [AtosPraticados] Usuários encontrados nos atos:', usuariosNosAtos);
          console.log('🎯 [AtosPraticados] Filtro aplicado:', caixaUnificado ? 'Caixa Unificado (serventia)' : 'Usuário Individual');
        }
        
        // Converter detalhes de pagamento para a máscara esperada
        let atosComPagamentosConvertidos = atosFiltrados.map(ato => {
          if (ato.detalhes_pagamentos || ato.detalhes_pagamento) {
            console.log('🔄 [AtosPraticados] Convertendo detalhes de pagamento para ato:', ato.codigo);
            // Preferir detalhes_pagamentos, depois detalhes_pagamento
            const detalhesOriginais = ato.detalhes_pagamentos || ato.detalhes_pagamento;
            // Converter para a máscara de pagamentos
            const pagamentosConvertidos = converterDetalhesPagamentoParaMascara(detalhesOriginais);
            console.log('📦 [AtosPraticados] Detalhes originais:', detalhesOriginais);
            console.log('✅ [AtosPraticados] Pagamentos convertidos:', pagamentosConvertidos);
            return {
              ...ato,
              pagamentos: pagamentosConvertidos
            };
          }
          return ato;
        });

        // Se houver grupos de selo com múltiplos atos, garantir valor_unitario via lookup
        try {
          // Agrupar por chave de selo possível, mas APLICAR apenas a atos importados
          const chaveSelo = (ato) => (
            ato.selo_consulta || ato.selo || ato.selo_id || ato.import_batch || ato.origem_importacao || ato.selo_numero || null
          );

          const marcadoComoImportado = (ato) => Boolean(
            ato.selo_consulta || ato.selo || ato.selo_id || ato.import_batch || ato.origem_importacao || ato.selo_numero
          );

          const grupoPorSelo = {};
          const atosImportados = atosComPagamentosConvertidos.filter(marcadoComoImportado);

          atosImportados.forEach(ato => {
            const k = chaveSelo(ato) || `sem_selo_${ato.usuario || 'x'}`;
            if (!grupoPorSelo[k]) grupoPorSelo[k] = [];
            grupoPorSelo[k].push(ato);
          });

          // Cache para evitar buscas repetidas
          const cacheValorFinal = {};
          // Flag para evitar spam de requisições quando o backend exige autorização e retorna 401
          let lookupUnauthorized = false;

          // Função para buscar valor_final por codigo (usa rota /atos?search=)
          const buscarValorFinal = async (codigo) => {
            if (!codigo) return null;
            if (lookupUnauthorized) {
              // Já recebemos 401 anteriormente — evitar novas tentativas
              console.warn('🔒 [buscarValorFinal] lookup bloqueado por 401 anterior para', codigo);
              cacheValorFinal[codigo] = null;
              return null;
            }
            if (cacheValorFinal[codigo] !== undefined) {
              console.log('🔁 [buscarValorFinal] retornando cache para', codigo, cacheValorFinal[codigo]);
              return cacheValorFinal[codigo];
            }
            try {
              const hasToken = Boolean(token);
              const masked = token ? `len=${token.length} starts=${String(token).slice(0,6)}...` : '<no token>';
              console.log('🔎 [buscarValorFinal] iniciando lookup para codigo=', codigo, 'hasToken=', hasToken, 'token=', masked);
              const headers = hasToken ? { Authorization: `Bearer ${token}`, Accept: 'application/json' } : { Accept: 'application/json' };
              const res = await fetch(`${apiURL}/atos?search=${encodeURIComponent(codigo)}`, { headers });
              console.log('🔎 [buscarValorFinal] resposta raw para', codigo, 'status=', res.status);
              if (res.status === 401) {
                // Marcar para evitar novas tentativas e usar fallback
                console.warn('⚠️ [AtosPraticados] 401 Unauthorized ao buscar valor_final para', codigo);
                lookupUnauthorized = true;
                cacheValorFinal[codigo] = null;
                return null;
              }
              if (!res.ok) {
                const txt = await res.text().catch(() => '<unreadable>');
                console.warn('⚠️ [AtosPraticados] Busca valor_final não ok para', codigo, res.status, txt);
                cacheValorFinal[codigo] = null;
                return null;
              }
              const body = await res.json().catch(async (e) => {
                const txt = await res.text().catch(() => '<unreadable>');
                console.error('❌ [buscarValorFinal] falha ao parsear JSON para', codigo, 'texto=', txt, e);
                return null;
              });
              console.log('🔎 [buscarValorFinal] body recebida para', codigo, body && (Array.isArray(body) ? `array(${body.length})` : Object.keys(body).slice(0,5)));
              // body pode ser array ou objeto
              let found = null;
              if (Array.isArray(body) && body.length) found = body[0];
              else if (body && Array.isArray(body.atos) && body.atos.length) found = body.atos[0];
              else if (body && body.valor_final !== undefined) found = body;
              if (!found) {
                console.warn('⚠️ [buscarValorFinal] não encontrou registro com valor_final para codigo', codigo, 'body=', body);
              }
              const valor = found ? (found.valor_final ?? found.valor ?? null) : null;
              console.log('🔔 [buscarValorFinal] valor extraido para', codigo, valor);
              cacheValorFinal[codigo] = valor;
              return valor;
            } catch (e) {
              console.error('Erro ao buscar valor_final para codigo', codigo, e);
              cacheValorFinal[codigo] = null;
              return null;
            }
          };

          // Primeiro: garantir que TODOS os atos tenham `valor_unitario` baseado no `codigo` (valor_final)
          try {
            const codigosTodos = [...new Set(atosComPagamentosConvertidos.map(a => a.codigo).filter(Boolean))];
            await Promise.all(codigosTodos.map(c => buscarValorFinal(c)));
            atosComPagamentosConvertidos.forEach(ato => {
              const codigo = ato.codigo;
              const valorFinal = cacheValorFinal[codigo] ?? ato.valor_unitario ?? ato.valor_final ?? 0;
              ato.valor_unitario = valorFinal;
            });
            console.log('🔎 [AtosPraticados] Valor unitario preenchido via lookup para códigos:', codigosTodos);
          } catch (e) {
            console.warn('⚠️ [AtosPraticados] Erro ao popular valor_unitario globalmente:', e);
          }

          // Para cada grupo com mais de 1 ato, buscar valores e ajustar pagamentos
          for (const k of Object.keys(grupoPorSelo)) {
            const grupo = grupoPorSelo[k];
            if (!grupo || grupo.length <= 0) continue;

            // Determinar formas presentes no grupo (union)
            const formasPresentes = new Set();
            grupo.forEach(ato => {
              const formas = ato.pagamentos ? Object.keys(ato.pagamentos) : [];
              formas.forEach(f => formasPresentes.add(f));
            });

            // Buscar valores finais para códigos distintos no grupo
            const codigosUnicos = [...new Set(grupo.map(a => a.codigo))].filter(Boolean);
            await Promise.all(codigosUnicos.map(c => buscarValorFinal(c)));

            // Cache para detalhes de pagamento do pedido (por protocolo)
            const cachePedidoDetalhes = {};

            // Tentativa robusta de encontrar um protocolo/pedido dentro do ato
            const encontrarProtocoloNoAto = (ato) => {
              if (!ato || typeof ato !== 'object') return null;
              const candidates = [
                'protocolo',
                'pedido_protocolo',
                'protocolo_pedido',
                'pedidoNumero',
                'pedido_numero',
                'pedidoId',
                'pedido_id',
                'recibo',
                'selo_protocolo',
                'protocolo_recibo'
              ];
              for (const k of candidates) {
                if (ato[k]) return String(ato[k]);
              }
              // Tentar dentro de sub-objetos comuns
              if (ato.pedido && (ato.pedido.protocolo || ato.pedido.numero)) return String(ato.pedido.protocolo || ato.pedido.numero);
              if (ato.recibo && ato.recibo.protocolo) return String(ato.recibo.protocolo);
              return null;
            };

            // Buscar detalhes de pagamento do pedido/recibo (retorna array de detalhes ou null)
            const buscarDetalhesPagamentoDoPedido = async (protocolo) => {
              if (!protocolo) return null;
              if (cachePedidoDetalhes[protocolo] !== undefined) return cachePedidoDetalhes[protocolo];
              try {
                const tokenLocal = localStorage.getItem('token');
                // Primeiro tentar endpoint /recibo/:protocolo que retorna objeto { pedido }
                try {
                  const resRecibo = await fetch(`${apiURL}/recibo/${encodeURIComponent(protocolo)}`, {
                    headers: tokenLocal ? { Authorization: `Bearer ${tokenLocal}` } : {}
                  });
                  if (resRecibo.ok) {
                    const body = await resRecibo.json().catch(() => null);
                    const pedido = body && (body.pedido || body);
                    if (pedido) {
                      const detalhes = pedido.valorAdiantadoDetalhes || pedido.valor_adiantado_detalhes || pedido.valorAdiantado || null;
                      if (detalhes && (Array.isArray(detalhes) && detalhes.length > 0)) {
                        cachePedidoDetalhes[protocolo] = detalhes;
                        return detalhes;
                      }
                    }
                  }
                } catch (e) {
                  // ignore and fallback
                }

                // Em seguida tentar /pedido_pagamento/:protocolo
                try {
                  const resPag = await fetch(`${apiURL}/pedido_pagamento/${encodeURIComponent(protocolo)}`, {
                    headers: tokenLocal ? { Authorization: `Bearer ${tokenLocal}` } : {}
                  });
                  if (resPag.ok) {
                    const dataPag = await resPag.json().catch(() => null);
                    // detectar formatos possíveis
                    let detalhes = null;
                    if (Array.isArray(dataPag.detalhes_pagamento) && dataPag.detalhes_pagamento.length > 0) detalhes = dataPag.detalhes_pagamento;
                    else if (Array.isArray(dataPag.complementos_pagamento) && dataPag.complementos_pagamento.length > 0) detalhes = dataPag.complementos_pagamento;
                    else if (Array.isArray(dataPag.valorAdiantadoDetalhes) && dataPag.valorAdiantadoDetalhes.length > 0) detalhes = dataPag.valorAdiantadoDetalhes;
                    else if (Array.isArray(dataPag)) detalhes = dataPag;

                    if (detalhes) {
                      cachePedidoDetalhes[protocolo] = detalhes;
                      return detalhes;
                    }
                  }
                } catch (e) {
                  // ignore
                }

                cachePedidoDetalhes[protocolo] = null;
                return null;
              } catch (e) {
                cachePedidoDetalhes[protocolo] = null;
                return null;
              }
            };

            // Ajustar cada ato: set valor_unitario e pagamentos por forma = quantidade * valor_unitario
            for (const ato of grupo) {
              const codigo = ato.codigo;
              const valorFinal = cacheValorFinal[codigo] ?? ato.valor_unitario ?? ato.valor_final ?? 0;
              const quantidadeAto = Number(ato.quantidade) || 1;
              // Atualizar valor_unitario no ato
              ato.valor_unitario = valorFinal;

              // Tentar obter forma de pagamento a partir do pedido/recibo vinculado ao ato
              let novoPagamentos = formasPagamento.reduce((acc, fp) => {
                acc[fp.key] = { quantidade: 0, valor: 0, manual: false };
                return acc;
              }, {});

              try {
                const protocolo = encontrarProtocoloNoAto(ato);
                const detalhesPedido = protocolo ? await buscarDetalhesPagamentoDoPedido(protocolo) : null;

                let chaveEscolhida = null;
                if (detalhesPedido && Array.isArray(detalhesPedido) && detalhesPedido.length > 0) {
                  // Converter detalhes para máscara e escolher a primeira forma encontrada
                  const mask = converterDetalhesPagamentoParaMascara(detalhesPedido);
                  chaveEscolhida = Object.keys(mask).find(k => (mask[k] && Number(mask[k].valor) > 0)) || Object.keys(mask)[0];

                  // Atribuir o valor total do ato (valor_unitario * quantidade) para a forma escolhida
                  novoPagamentos = formasPagamento.reduce((acc, fp) => {
                    if (fp.key === chaveEscolhida) {
                      acc[fp.key] = {
                        quantidade: quantidadeAto,
                        valor: Number(((valorFinal || 0) * quantidadeAto).toFixed(2)),
                        manual: true
                      };
                    } else {
                      acc[fp.key] = { quantidade: 0, valor: 0, manual: false };
                    }
                    return acc;
                  }, {});
                  // mark diagnostics for this ato
                  ato.__detectedPagamento = { protocolo: protocolo || null, source: 'pedido', chosenForm: chaveEscolhida || null };
                } else {
                  // Fallback: usar as formas detectadas no grupo (formasPresentes)
                  const primeiraForma = formasPresentes.values().next().value;
                  if (primeiraForma) {
                    novoPagamentos[primeiraForma] = {
                      quantidade: quantidadeAto,
                      valor: Number(((valorFinal || 0) * quantidadeAto).toFixed(2)),
                      manual: true
                    };
                    ato.__detectedPagamento = { protocolo: null, source: 'group', chosenForm: primeiraForma };
                  } else {
                    // Último recurso: colocar em 'dinheiro'
                    novoPagamentos['dinheiro'] = {
                      quantidade: quantidadeAto,
                      valor: Number(((valorFinal || 0) * quantidadeAto).toFixed(2)),
                      manual: true
                    };
                    ato.__detectedPagamento = { protocolo: null, source: 'fallback', chosenForm: 'dinheiro' };
                  }
                }
              } catch (e) {
                // Se qualquer erro ocorrer, fallback conservador
                const primeiraForma = formasPresentes.values().next().value;
                if (primeiraForma) {
                  novoPagamentos[primeiraForma] = {
                    quantidade: quantidadeAto,
                    valor: Number(((valorFinal || 0) * quantidadeAto).toFixed(2)),
                    manual: true
                  };
                  ato.__detectedPagamento = { protocolo: null, source: 'error-fallback', chosenForm: primeiraForma };
                } else {
                  novoPagamentos['dinheiro'] = {
                    quantidade: quantidadeAto,
                    valor: Number(((valorFinal || 0) * quantidadeAto).toFixed(2)),
                    manual: true
                  };
                  ato.__detectedPagamento = { protocolo: null, source: 'error-fallback', chosenForm: 'dinheiro' };
                }
              }

              ato.pagamentos = novoPagamentos;
              // Ensure quantidade in pagamentos reflects ato.quantidade for consistency
              Object.keys(ato.pagamentos || {}).forEach(k => {
                if (ato.pagamentos[k] && ato.pagamentos[k].quantidade === 0 && ato.__detectedPagamento && ato.__detectedPagamento.chosenForm === k) {
                  ato.pagamentos[k].quantidade = quantidadeAto;
                }
              });
            }
          }
        } catch (e) {
          console.error('Erro ao ajustar grupos de selo:', e);
        }

        try {
          // Diagnostic: compare raw listaAtos (bruto do backend) vs atos convertidos
          try {
            const resumoBruto = listaAtos.map(a => ({ id: a.id, codigo: a.codigo, quantidade: a.quantidade || 1, valor_unitario: a.valor_unitario ?? a.valor_final ?? null, pagamentos: a.pagamentos || a.detalhes_pagamentos || a.detalhes_pagamento || null, origem_importacao: a.origem_importacao || null }));
            const resumoConvertido = atosComPagamentosConvertidos.map(a => ({ id: a.id, codigo: a.codigo, quantidade: a.quantidade || 1, valor_unitario: a.valor_unitario ?? a.valor_final ?? null, pagamentos: a.pagamentos || null, origem_importacao: a.origem_importacao || null }));
            console.log('🔬 [DIAGNOSTIC] bruto vs convertido (resumo):', { brutoCount: resumoBruto.length, convertidoCount: resumoConvertido.length });
            // Log compact arrays to avoid huge dumps
            console.log('🔬 [DIAGNOSTIC] bruto sample:', resumoBruto.slice(0, 20));
            console.log('🔬 [DIAGNOSTIC] convertido sample:', resumoConvertido.slice(0, 20));

            // Find per-codigo mismatches for quick view
            const mismatches = [];
            resumoConvertido.forEach(conv => {
              const match = resumoBruto.find(b => (b.id && b.id === conv.id) || (b.codigo === conv.codigo && b.quantidade === conv.quantidade && b.origem_importacao === conv.origem_importacao));
              const expected = Number(conv.valor_unitario || 0) * Number(conv.quantidade || 1);
              const paid = Object.values(conv.pagamentos || {}).reduce((s, p) => s + (Number(p && p.valor) || 0), 0);
              if (Math.abs(expected - paid) > 0.009) {
                mismatches.push({ codigo: conv.codigo, id: conv.id, expected, paid, conv });
              }
            });
            if (mismatches.length) console.log('🔍 [DIAGNOSTIC] Mismatches expected vs paid (first 20):', mismatches.slice(0,20));
          } catch (e) {
            console.error('🔬 [DIAGNOSTIC] erro ao gerar resumo diagnostic:', e);
          }
        } finally {
          setAtos(atosComPagamentosConvertidos);
          console.log('✅ [AtosPraticados] Estado dos atos atualizado com', atosComPagamentosConvertidos.length, 'atos (com conversão de pagamentos e ajustes)');
        }
      } else {
        const errorText = await resAtos.text();
        console.error('❌ [AtosPraticados] Erro na resposta:', resAtos.status, errorText);
      }
    } catch (e) {
      console.error('💥 [AtosPraticados] Erro ao carregar dados da data:', e);
    }
  };

// Adicione este useEffect:
useEffect(() => {
  carregarDadosPraticadosDaData();
}, []);

  // Cleanup do timer do toast ao desmontar
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // useEffect para carregar atos ao mudar a data
  useEffect(() => {
    console.log('🔄 [AtosPraticados] useEffect disparado - mudança de data para:', dataSelecionada, 'trigger:', refreshTrigger);
    let isMounted = true;
    carregarDadosPraticadosDaData();
    return () => { 
      console.log('🧹 [AtosPraticados] useEffect cleanup executado');
      isMounted = false; 
    };
  }, [dataSelecionada, refreshTrigger]);

  // useEffect para buscar sugestões com debounce
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setSuggestions([]);
      return;
    }

  

    
    setLoadingSuggestions(true);

    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);

    debounceTimeout.current = setTimeout(async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(
          `${apiURL}/codigos-tributarios?search=${encodeURIComponent(
            searchTerm
          )}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const data = await res.json();
        if (res.ok) {
          setSuggestions(data.atos || []);
        } else {
          setSuggestions([]);
        }
      } catch (e) {
        console.error('Erro ao buscar atos:', e);
        setSuggestions([]);
      }
      setLoadingSuggestions(false);
    }, 300);

    return () => clearTimeout(debounceTimeout.current);
  }, [searchTerm]);

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

    const pagamentosZerados = formasPagamento.reduce((acc, fp) => {
      acc[fp.key] = { quantidade: 0, valor: 0, manual: false };
      return acc;
    }, {});

    const atoFechamento = {
      data: dataAtual,
      hora: hora,
      codigo: '0001',
      descricao: 'FECHAMENTO DIÁRIO DOS ATOS',
      quantidade: 1,
      valor_unitario: 0, // Não usa valor final do caixa
      pagamentos: pagamentosZerados,
      usuario: nomeUsuario,
    };

    try {
      const token = localStorage.getItem('token');
      console.log('Enviando fechamento ao backend:', atoFechamento);
      const res = await fetch(
        `${apiURL}/atos-praticados`,
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

      await carregarDadosPraticadosDaData();
      alert('Fechamento diário realizado com sucesso!');

      // Gere o PDF no frontend:
      gerarRelatorioPDFAtosPraticados({
        dataRelatorio: dataSelecionada,
        atos,
        depositosCaixa: atos.filter(a => a.codigo === '0003'), // entradas manuais
        saidasCaixa: atos.filter(a => a.codigo === '0002'),    // saídas manuais
        responsavel: nomeUsuario,
        ISS: percentualISS,
        observacoesGerais: '' // ou outro campo se desejar
      });
    } catch (e) {
      alert('Erro ao realizar fechamento diário: ' + e.message);
      console.error('Erro ao realizar fechamento diário:', e);
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

  // Função para importar atos praticados
  const importarAtosPraticados = async () => {
    try {
      // Snapshot antes da importação para detectar novos atos
      const assinaturasAntes = new Set(atos.map(assinaturaAto));

      const token = localStorage.getItem('token');
      const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
      const nomeLogado = usuario?.nome || usuario?.email;
      const serventiaUsuario = usuario?.serventia;

      if (!serventiaUsuario) {
        alert('Usuário não tem serventia configurada');
        return;
      }

      if (!nomeLogado) {
        alert('Não foi possível identificar o usuário logado');
        return;
      }

      // Importar atos apenas do usuário logado
      console.log('🔄 Iniciando importação de atos:', { 
        data: dataSelecionada, 
        usuario: nomeLogado, 
        serventia: serventiaUsuario,
        apiURL: apiURL
      });

      // Preparar payload padrão para solicitacao de importacao
      const payloadImport = {
        data: dataSelecionada,
        usuarios: [nomeLogado], // Apenas o usuário logado
        serventia: serventiaUsuario
      };

      try {
        const maskedToken = token ? `len=${token.length} starts=${String(token).slice(0,6)}...` : '<no token>';
        console.log('📤 [ImportarAtos] solicitando lista para importação (preview) payload:', payloadImport, 'token=', maskedToken);
      } catch (e) {}

      // 1) Tentar solicitar um preview (backend pode aceitar um flag `preview`/`simular`)
      let atosParaImportar = null;
      try {
        const resPreview = await fetch(`${apiURL}/atos-praticados/importar-servicos`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ ...payloadImport, preview: true })
        });

        if (resPreview.ok) {
          const body = await resPreview.json().catch(() => null);
          // Tentar extrair lista de atos de possíveis chaves
          atosParaImportar = body && (body.atos || body.lista || body.items || body.data || body.attemptos || null) || null;
          // Em alguns backends a chave pode ser `novosAtos` ou similar
          if (!atosParaImportar && body) {
            // procurar por qualquer array no body
            const anyArrayKey = Object.keys(body).find(k => Array.isArray(body[k]));
            if (anyArrayKey) atosParaImportar = body[anyArrayKey];
          }
        } else {
          console.warn('[ImportarAtos] preview retornou não-ok:', resPreview.status);
        }
      } catch (e) {
        console.warn('[ImportarAtos] erro no preview:', e);
      }

      // Helper local: buscar valor_final por codigo (sem poluir escopo global)
      const buscarValorFinalLocal = async (codigo) => {
        if (!codigo) return null;
        try {
          const tk = localStorage.getItem('token');
          const headers = tk ? { Authorization: `Bearer ${tk}`, Accept: 'application/json' } : { Accept: 'application/json' };
          const res = await fetch(`${apiURL}/atos?search=${encodeURIComponent(codigo)}`, { headers });
          if (!res.ok) return null;
          const body = await res.json().catch(() => null);
          let found = null;
          if (Array.isArray(body) && body.length) found = body[0];
          else if (body && Array.isArray(body.atos) && body.atos.length) found = body.atos[0];
          else if (body && body.valor_final !== undefined) found = body;
          return found ? (found.valor_final ?? found.valor ?? null) : null;
        } catch (e) {
          return null;
        }
      };

      // Se obtivemos uma lista de atos a importar, pré-processar e enviar cada um individualmente
      if (Array.isArray(atosParaImportar) && atosParaImportar.length > 0) {
        console.log('[ImportarAtos] Preview retornou', atosParaImportar.length, 'atos; pré-processando e salvando individualmente...');
        let salvos = 0;
        for (const atoRaw of atosParaImportar) {
          try {
            const ato = { ...atoRaw };
            const codigo = ato.codigo || ato.codigoTributario || ato.codigo_tributario || null;
            const quantidadeAto = Number(ato.quantidade) || 1;

            // Buscar valor unitario via lookup
            const valorLookup = await buscarValorFinalLocal(codigo);
            const valorUnitario = valorLookup ?? ato.valor_unitario ?? ato.valor_final ?? 0;
            ato.valor_unitario = valorUnitario;

            // Montar pagamentos: tentativa simples — usar detalhes existentes ou escolher primeira forma conhecida
            const novoPagamentos = formasPagamento.reduce((acc, fp) => {
              acc[fp.key] = { quantidade: 0, valor: 0, manual: false };
              return acc;
            }, {});

            // Tentar extrair formas da estrutura existente (detalhes_pagamentos / pagamentos)
            let chaveEscolhida = null;
            if (ato.detalhes_pagamentos || ato.detalhes_pagamento) {
              try {
                const detalhes = ato.detalhes_pagamentos || ato.detalhes_pagamento;
                const mask = converterDetalhesPagamentoParaMascara(detalhes);
                chaveEscolhida = Object.keys(mask).find(k => mask[k] && Number(mask[k].valor) > 0) || Object.keys(mask)[0];
              } catch (e) {
                chaveEscolhida = null;
              }
            }

            // Se não encontrou, usar a primeira forma presente em ato.pagamentos
            if (!chaveEscolhida && ato.pagamentos) {
              const keys = Object.keys(ato.pagamentos || {});
              if (keys.length) chaveEscolhida = keys[0];
            }

            if (!chaveEscolhida) chaveEscolhida = 'dinheiro';

            novoPagamentos[chaveEscolhida] = {
              quantidade: quantidadeAto,
              valor: Number(((valorUnitario || 0) * quantidadeAto).toFixed(2)),
              manual: true
            };

            ato.pagamentos = novoPagamentos;

            // Preparar payload final para salvar
            const payloadAto = {
              data: ato.data || dataSelecionada,
              hora: ato.hora || ato.horaReg || new Date().toLocaleTimeString('pt-BR', { hour12: false }),
              codigo: ato.codigo,
              descricao: ato.descricao || ato.nome || '',
              quantidade: quantidadeAto,
              valor_unitario: ato.valor_unitario,
              pagamentos: ato.pagamentos,
              usuario: nomeLogado,
              origem_importacao: ato.origem_importacao || 'importado-frontend'
            };

            try {
              const masked = token ? `len=${token.length} starts=${String(token).slice(0,6)}...` : '<no token>';
              console.log('📤 [ImportarAtos] salvando ato preprocessado:', { payloadAto, token: masked });
            } catch (e) {}

            const resSave = await fetch(`${apiURL}/atos-praticados`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify(payloadAto)
            });

            if (resSave.ok) salvos += 1;
            else {
              const txt = await resSave.text().catch(() => '');
              console.warn('[ImportarAtos] falha ao salvar ato preprocessado:', resSave.status, txt);
            }
          } catch (e) {
            console.error('[ImportarAtos] erro ao processar ato:', e);
          }
        }

        alert(`✅ Importação concluída: ${salvos} de ${atosParaImportar.length} atos salvos (pré-processados).`);

        // Recarregar dados
        setAtos([]);
        await new Promise(resolve => setTimeout(resolve, 400));
        await carregarDadosPraticadosDaData();
        setRefreshTrigger(prev => prev + 1);
        return;
      }

      // Se não obteve preview com lista de atos, volta ao comportamento anterior (chamar import endpoint)
      console.log('[ImportarAtos] Preview não retornou lista de atos — voltando ao import padrão (server-side).');
      const resImportar = await fetch(`${apiURL}/atos-praticados/importar-servicos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payloadImport)
      });

      if (!resImportar.ok) {
        let errorMessage = `Erro HTTP ${resImportar.status}: ${resImportar.statusText}`;
        try { const errorText = await resImportar.text();
          try { const errorData = JSON.parse(errorText); errorMessage = errorData.message || errorMessage; } catch {} }
        catch(e){}
        alert('❌ Erro ao importar atos: ' + errorMessage);
        return;
      }

      const resultData = await resImportar.json().catch(() => ({}));
      const atosImportados = resultData.atosImportados || 0;
      const atosEncontrados = resultData.atosEncontrados || 0;
      if (atosImportados === 0) {
        alert(`ℹ️ ${resultData.message || 'Nenhum ato novo encontrado para importar'}\n\nAtos encontrados: ${atosEncontrados}`);
      } else {
        alert(`✅ Importação concluída com sucesso!\n\n${atosImportados} atos foram importados de ${atosEncontrados} encontrados.`);
      }

      // Recarregar após import padrão
      setAtos([]);
      await new Promise(resolve => setTimeout(resolve, 800));
      await carregarDadosPraticadosDaData();
      let detectouMudanca = false;
      for (let tentativa = 1; tentativa <= 6; tentativa++) {
        await new Promise(r => setTimeout(r, 400));
        await carregarDadosPraticadosDaData();
        const assinaturasDepois = new Set(atos.map(assinaturaAto));
        for (const s of assinaturasDepois) {
          if (!assinaturasAntes.has(s)) { detectouMudanca = true; break; }
        }
        if (detectouMudanca) break;
      }
      setRefreshTrigger(prev => prev + 1);

    } catch (error) {
      console.error('💥 Erro ao importar atos praticados:', error);
      
      // Análise detalhada do erro
      if (error.message.includes('Failed to fetch')) {
        alert('❌ Erro de conexão: Não foi possível conectar ao servidor.\n\nVerifique sua conexão com a internet e se o servidor está funcionando.');
      } else if (error.message.includes('Unexpected token')) {
        alert('❌ Erro de formato: O servidor retornou dados inválidos.\n\nEste é um erro interno do servidor.');
      } else {
        alert('❌ Erro ao importar atos: ' + error.message);
      }
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '12px', // reduzido de 20px
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
          borderRadius: '16px',
          padding: '16px', // reduzido de 25px
          marginBottom: '12px', // reduzido de 20px
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px' // reduzido de 15px
        }}>      <h1 style={{ 
          margin: 0, 
          color: '#2c3e50',
          fontSize: '24px', // reduzido de 28px
          fontWeight: '600'
        }}>
          🔗 Atos Praticados Neste Dia
        </h1>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '10px', // reduzido de 15px
          flexWrap: 'wrap'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px' // reduzido de 8px
          }}>
            <span style={{ color: '#666', fontSize: '13px' }}>👤 Usuário:</span>
            <input
              type="text"
              value={nomeUsuario}
              readOnly
              tabIndex={-1}
              style={{
                padding: '6px 10px', // reduzido de 8px 12px
                borderRadius: '8px',
                border: '2px solid rgb(0, 0, 0)',
                backgroundColor: '#e3f2fd',
                fontWeight: '600',
                color: '#000',
                fontSize: '13px', // reduzido de 14px
                pointerEvents: 'none',
              }}
            />
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px' // reduzido de 8px
          }}>
            <span style={{ color: '#666', fontSize: '13px' }}>📅</span>
            <DataSelector dataSelecionada={dataSelecionada} onChange={handleDataChange} />
          </div>
        </div>
      </div>

      {/* Layout Principal - Grid Responsivo */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
        gap: '12px', // reduzido de 20px
        marginBottom: '12px', // reduzido de 20px
        maxWidth: '100%',
        overflow: 'hidden'
      }}>
        {/* Seção de Adição de Atos */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '16px', // reduzido de 25px
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px'
          }}>
            <h3 style={{
              margin: '0',
              color: '#2c3e50',
              fontSize: '16px',
              fontWeight: '600',
              borderBottom: '2px solid #27ae60',
              paddingBottom: '6px'
            }}>
              ➕ Adicionar Ato
            </h3>
            <button
              onClick={importarAtosPraticados}
              style={{
                background: '#3498db',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(52, 152, 219, 0.3)',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => e.target.style.background = '#2980b9'}
              onMouseOut={(e) => e.target.style.background = '#3498db'}
            >
              📥 Importar Atos
            </button>
          </div>
          {/* Integração do AtoSearchAtosPraticados */}
          <AtoSearchAtosPraticados
            dataSelecionada={dataSelecionada}
            nomeUsuario={nomeUsuario}
            onAtoAdicionado={() => setRefreshTrigger((prev) => prev + 1)}
            resumoRefreshTrigger={refreshTrigger}
          />

          {/* Tabela de Atos Praticados (lista detalhada) - logo abaixo do resumo agrupado */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '12px',
            marginTop: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px'
            }}>
              <h3 style={{
                margin: 0,
                color: '#2c3e50',
                fontSize: '16px',
                fontWeight: 600
              }}>
                📋 Atos praticados por {nomeUsuario} em {formatarDataBR(dataSelecionada)}
              </h3>
            </div>
            <AtosTable atos={atosDoUsuario} onRemover={removerAto} />
          </div>
        </div>
      </div>
      {/* Toast de feedback de exclusão */}
      <Toast
        message={toastMessage}
        type={toastType}
        position="bottom-right"
        onClose={() => setToastMessage('')}
      />
    </div>
  </div>
);
}

export default AtosPraticados;

