import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import config from '../../config';

export default function ServicoEntrada({ form, tiposServico, onChange, combosDisponiveis, atosPedido, setAtosPedido }) {
  const [serventiaInfo, setServentiaInfo] = useState(null);
  // Buscar informações completas da serventia ao montar
  useEffect(() => {
    async function fetchServentia() {
      let id = form.serventiaId || form.serventia_id || form.serventia || null;
      console.log('[DEBUG] Buscando serventia, id:', id);
      if (!id) {
        console.log('[DEBUG] Nenhum id de serventia encontrado no form. form:', form);
        return;
      }
      try {
        const token = localStorage.getItem('token');
        const url = `${config.apiURL}/serventias/${id}`;
        console.log('[DEBUG] Fazendo fetch para:', url, '| token:', token);
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        console.log('[DEBUG] Status da resposta:', res.status, res.statusText);
        let text = await res.text();
        console.log('[DEBUG] Corpo da resposta:', text);
        let data = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch (jsonErr) {
          console.error('[DEBUG] Erro ao fazer parse do JSON da resposta:', jsonErr);
        }
        if (res.ok) {
          console.log('[DEBUG] Resposta da API serventia (objeto final):', data);
          setServentiaInfo(data.serventia || data);
        } else {
          console.log('[DEBUG] Erro ao buscar serventia, status:', res.status, '| corpo:', text);
        }
      } catch (e) {
        console.log('[DEBUG] Erro no fetch da serventia:', e);
      }
    }
    fetchServentia();
  }, [form.serventiaId, form.serventia_id, form.serventia]);
  const [comboSelecionado, setComboSelecionado] = useState('');
  const [codigoTributarioSuggestions, setCodigoTributarioSuggestions] = useState([]);
  const [loadingCodigoTributario, setLoadingCodigoTributario] = useState(false);
  const [codigoTributarioTerm, setCodigoTributarioTerm] = useState('');
  const [codigoTributarioIdx, setCodigoTributarioIdx] = useState(null);
  const [valorAdiantadoDetalhes, setValorAdiantadoDetalhes] = useState(
    form.valorAdiantadoDetalhes || [ { valor: '', forma: '' } ]
  );

  useEffect(() => {
    setValorAdiantadoDetalhes(form.valorAdiantadoDetalhes || [ { valor: '', forma: '' } ]);
  }, [form.valorAdiantadoDetalhes]);
  const navigate = useNavigate();

  // Manipula mudança em um item de valor adiantado (valor ou forma)
  const handleValorAdiantadoDetalheChange = (idx, campo, valor) => {
    setValorAdiantadoDetalhes(prev => prev.map((item, i) => i === idx ? { ...item, [campo]: valor } : item));
  };

  // Adiciona um novo item de valor adiantado
  const handleAddValorAdiantadoDetalhe = () => {
    setValorAdiantadoDetalhes(prev => [...prev, { valor: '', forma: '' }]);
  };

  // Remove um item de valor adiantado
  const handleRemoveValorAdiantadoDetalhe = (idx) => {
    setValorAdiantadoDetalhes(prev => prev.filter((_, i) => i !== idx));
  };



  // Manipula alteração de quantidade ou outros campos do ato
  const handleAtoChange = (idx, campo, valor) => {
    setAtosPedido(prev => prev.map((ato, i) => i === idx ? { ...ato, [campo]: valor } : ato));
  };

  // Manipula input do código tributário (com sugestões)
  const handleCodigoTributarioInput = async (idx, value) => {
    setAtosPedido(prev => prev.map((ato, i) => i === idx ? { ...ato, codigoTributario: value } : ato));
    setCodigoTributarioIdx(idx);
    setCodigoTributarioTerm(value);
    // Busca sugestões se houver pelo menos 2 caracteres
    if (value.length >= 1) {
      setLoadingCodigoTributario(true);
      try {
        // Ajuste a URL abaixo conforme a rota real do seu backend
        const res = await fetch(`${config.apiUrl || config.apiURL}/codigos-tributarios?s=${encodeURIComponent(value)}`);
        if (res.ok) {
          const data = await res.json();
          setCodigoTributarioSuggestions(data.sugestoes || []);
        } else {
          setCodigoTributarioSuggestions([]);
        }
      } catch (err) {
        setCodigoTributarioSuggestions([]);
      }
      setLoadingCodigoTributario(false);
    } else {
      setCodigoTributarioSuggestions([]);
    }
  };

  // Seleciona sugestão de código tributário
  const handleSelectCodigoTributario = (sug) => {
    if (codigoTributarioIdx !== null) {
      setAtosPedido(prev => prev.map((ato, i) => i === codigoTributarioIdx ? { ...ato, codigoTributario: sug.codigo } : ato));
      setCodigoTributarioSuggestions([]);
      setCodigoTributarioIdx(null);
      setCodigoTributarioTerm('');
    }
  };

  // Remove ato do pedido
  const handleRemoverAto = (idx) => {
    setAtosPedido(prev => prev.filter((_, i) => i !== idx));
  };

  // Função para calcular a soma dos valores dos atos pagos (código tributário "01")
  const calcularTotalAtosPagos = () => {
    const atosFiltrados = atosPedido.filter(ato => ato.codigoTributario === '01');
    const total = atosFiltrados.reduce((total, ato) => {
      const valor = parseFloat(ato.valor_final || 0);
      return total + (valor * (ato.quantidade || 1));
    }, 0);
    return total;
  };

  // Adiciona todos os atos do combo ao pedido
  const handleAdicionarCombo = () => {
    if (!comboSelecionado) return;
    const combo = combosDisponiveis.find(c => c.id === Number(comboSelecionado));
    if (!combo || !Array.isArray(combo.atos)) return;
    setAtosPedido(prev => [
      ...prev,
      ...combo.atos.map(ato => ({
        comboId: combo.id,
        comboNome: combo.nome,
        atoId: ato.id,
        atoCodigo: ato.codigo,
        atoDescricao: ato.descricao,
        quantidade: 1,
        codigoTributario: ''
      }))
    ]);
    setComboSelecionado('');
  };
      

  // Função para enviar o pedido (salvar ou atualizar)
  const handleSubmit = async () => {
    try {
      // Sempre define status como 'Aguardando Conferência'
      let novoForm = { ...form, status: 'Aguardando Conferência' };
      // Sempre POST para /api/pedidos
      const url = `${config.apiURL}/pedidos`;
      const method = 'POST';
      // Converter atosPedido para combos conforme esperado pelo backend
      const combos = atosPedido.map(ato => ({
        combo_id: ato.comboId,
        ato_id: ato.atoId,
        quantidade: ato.quantidade,
        codigo_tributario: ato.codigoTributario
      }));
      // Recupera usuário logado do localStorage
      const usuarioLogado = JSON.parse(localStorage.getItem('usuario') || '{}');
      const nomeUsuario = usuarioLogado.nome || usuarioLogado.email || 'Sistema';
      // Inclui valor adiantado, forma de pagamento e o nome do usuário no payload
      const body = JSON.stringify({
        ...novoForm,
        usuario: nomeUsuario,
        descricao: novoForm.descricao || '',
        origem: novoForm.origem || '',
        origemInfo: novoForm.origemInfo || '',
        valorAdiantadoDetalhes,
        combos
      });
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };
      const res = await fetch(url, {
        method,
        headers,
        body
      });
      const responseText = await res.text();
      let data = {};
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (jsonErr) {
        console.error('[handleSubmit] Erro ao fazer parse do JSON da resposta:', jsonErr);
      }
      // Após salvar o pedido, grava o status 'Aguardando Conferência' no DB
      if (res.ok) {
        // Pedido enviado com sucesso
        // Grava status 'Aguardando Conferência' na tabela de status
        const protocoloParaStatus = data.protocolo || form.protocolo;
        if (protocoloParaStatus) {
          try {
            const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
            const nomeUsuario = usuario.nome || usuario.email || 'Sistema';
            const statusBody = {
              status: 'Aguardando Conferência',
              usuario: nomeUsuario
            };
            const statusRes = await fetch(`${config.apiURL}/pedidos/${encodeURIComponent(protocoloParaStatus)}/status`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {})
              },
              body: JSON.stringify(statusBody)
            });
            const statusText = await statusRes.text();
            if (!statusRes.ok) {
              console.error('[Status POST] Erro ao gravar status:', statusRes.status, statusRes.statusText, statusText);
            }
          } catch (errStatus) {
            console.error('Erro ao gravar status (catch):', errStatus);
          }
        }
        const mensagem = (form.protocolo && form.protocolo.trim() !== '')
          ? `Pedido ${form.protocolo} atualizado com sucesso!`
          : 'Novo pedido criado com sucesso!';
        alert(mensagem);
        // Após salvar ou atualizar, volta um nível na navegação
        navigate(-1);
      } else {
        // Tratar erro no envio do pedido
        console.error('Erro ao enviar pedido:', res.status, res.statusText, data);
        const mensagem = (form.protocolo && form.protocolo.trim() !== '')
          ? `Erro ao atualizar pedido: ${res.status}`
          : `Erro ao criar pedido: ${res.status}`;
        alert(mensagem);
      }
    } catch (error) {
      console.error('Erro ao enviar pedido (catch):', error);
    }
  };

  // Função para gerar protocolo em HTML e abrir para impressão
  const handleImprimirProtocolo = () => {
    // DEBUG: logar serventiaInfo para depuração
    console.log('[PROTOCOLO DEBUG] serventiaInfo:', serventiaInfo);
    // Dados principais do protocolo
    const protocolo = form.protocolo || '(sem número)';
    const data = new Date().toLocaleString('pt-BR');
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    const nomeUsuario = usuario.nome || usuario.email || 'Usuário';
    // Dados do cliente
    const cliente = form.cliente || {};
    const clienteNome = cliente.nome || form.clienteNome || '-';
    const clienteDoc = cliente.cpf || cliente.cnpj || form.clienteCpf || form.clienteCnpj || '-';
    const clienteEmail = cliente.email || form.clienteEmail || '-';
    const clienteTel = cliente.telefone || form.clienteTelefone || '-';
    // Exibir apenas os campos do banco: nome_completo, endereco, cnpj, telefone, email
    let serventiaHtml = '-';
    const s = serventiaInfo || {};
    if (s && (s.nome_completo || s.endereco || s.cnpj)) {
      serventiaHtml = `
        <div><b>${s.nome_completo || ''}</b></div>
        <div>${s.endereco || ''}</div>
        <div>CNPJ: ${s.cnpj || ''}</div>
        <div>Telefone: ${s.telefone || ''}</div>
        <div>Email: ${s.email || ''}</div>
      `;
    } else {
      // fallback para string simples
      serventiaHtml = form.serventia || usuario.serventia || '-';
    }
    // Monta HTML do protocolo para impressora térmica 80 colunas, apenas preto
    const html = `
      <html>
      <head>
        <title>Protocolo de Entrada</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 4px; font-size: 11px; color: #000; background: #fff; }
          .protocolo-box { border: 1px solid #000; border-radius: 6px; padding: 8px 8px 4px 8px; max-width: 420px; margin: 0 auto; }
          h2 { color: #000; text-align: center; font-size: 15px; margin: 2px 0 8px 0; font-weight: bold; }
          .info { margin-bottom: 4px; }
          .label { color: #000; font-weight: bold; }
          .valor { color: #000; }
          .atos-table { width: 100%; border-collapse: collapse; margin-top: 6px; }
          .atos-table th, .atos-table td { border: 1px solid #000; padding: 2px 3px; font-size: 10px; color: #000; }
          .atos-table th { background: #fff; color: #000; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="protocolo-box">
          <h2>PROTOCOLO DE ENTRADA</h2>
          <div class="info"><span class="label">Serventia:</span> <span class="valor">${serventiaHtml}</span></div>
          <div class="info"><span class="label">Protocolo:</span> <span class="valor">${protocolo}</span></div>
          <div class="info"><span class="label">Data/Hora:</span> <span class="valor">${data}</span></div>
          <div class="info"><span class="label">Usuário:</span> <span class="valor">${nomeUsuario}</span></div>
          <div class="info"><span class="label">Cliente:</span> <span class="valor">${clienteNome}</span></div>
          <div class="info"><span class="label">Doc:</span> <span class="valor">${clienteDoc}</span></div>
          <div class="info"><span class="label">E-mail:</span> <span class="valor">${clienteEmail}</span></div>
          <div class="info"><span class="label">Tel:</span> <span class="valor">${clienteTel}</span></div>
          <div class="info"><span class="label">Descrição:</span> <span class="valor">${form.descricao || ''}</span></div>
          <div class="info"><span class="label">Origem:</span> <span class="valor">${form.origem || ''} ${form.origemInfo ? '(' + form.origemInfo + ')' : ''}</span></div>
          <div class="info"><span class="label">Prazo:</span> <span class="valor">${form.prazo || ''}</span></div>
          <div class="info"><span class="label">Obs:</span> <span class="valor">${form.observacao || ''}</span></div>
          <div class="info"><span class="label">Valor(es) Adiantado(s):</span> <span class="valor">${(valorAdiantadoDetalhes || []).map(v => v.valor ? `R$${parseFloat(v.valor).toLocaleString('pt-BR', {minimumFractionDigits:2})} (${v.forma})` : '').filter(Boolean).join(' | ') || '-'}</span></div>
          <table class="atos-table">
            <thead>
              <tr>
                <th>Combo</th>
                <th>Cód.</th>
                <th>Desc.</th>
                <th>Qtd</th>
                <th>Trib.</th>
              </tr>
            </thead>
            <tbody>
              ${(atosPedido || []).map(ato => `
                <tr>
                  <td>${ato.comboNome || ''}</td>
                  <td>${ato.atoCodigo || ''}</td>
                  <td>${ato.atoDescricao ? ato.atoDescricao.slice(0, 18) : ''}</td>
                  <td>${ato.quantidade || 1}</td>
                  <td>${ato.codigoTributario || ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `;
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
  };

  return (
    <div
      style={{
        width: '100%',
        margin: '0',
        padding: '16px',
        borderRadius: '16px',
        border: '2px solid #9b59b6',
        boxShadow: '0 2px 12px rgba(155,89,182,0.10)',
        background: '#f5e6fa',
        overflow: 'hidden',
        marginBottom: 16,
        boxSizing: 'border-box',
      }}
    >
      {/* ...coloque aqui o conteúdo do formulário, tabelas, botões, etc... conforme estava na última versão funcional... */}
    </div>
  );
}

