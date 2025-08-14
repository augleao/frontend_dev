import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import config from '../../config';

export default function ServicoEntrada({ form, tiposServico, onChange, combosDisponiveis, atosPedido, setAtosPedido }) {
  // Estado para controlar popup/modal de adicionar atos
  const [showAdicionarAtosModal, setShowAdicionarAtosModal] = useState(false);
  const [modalComboSelecionado, setModalComboSelecionado] = useState('');
  const [modalTipoRegistro, setModalTipoRegistro] = useState('');
  const [modalNomeRegistrados, setModalNomeRegistrados] = useState('');
  const [modalLivro, setModalLivro] = useState('');
  const [modalFolha, setModalFolha] = useState('');
  const [modalTermo, setModalTermo] = useState('');
  const [modalCodigoTributario, setModalCodigoTributario] = useState('');
  
  // Estado para controlar popup/modal de adicionar pagamentos
  const [showAdicionarPagamentoModal, setShowAdicionarPagamentoModal] = useState(false);
  const [modalValorPagamento, setModalValorPagamento] = useState('');
  const [modalFormaPagamento, setModalFormaPagamento] = useState('');
  // Carrega os atos do pedido salvo (edição), incluindo campos extras
  useEffect(() => {
    if (form && Array.isArray(form.combos) && form.combos.length > 0) {
      const mappedAtos = form.combos.map(ato => ({
        comboId: ato.combo_id,
        comboNome: ato.combo_nome,
        atoId: ato.ato_id,
        atoCodigo: ato.ato_codigo,
        atoDescricao: ato.ato_descricao,
        valor_final: ato.valor_final,
        quantidade: ato.quantidade,
        codigoTributario: ato.codigo_tributario,
        tipoRegistro: ato.tipo_registro || '',
        nomeRegistrados: ato.nome_registrados || '',
        livro: ato.livro || '',
        folha: ato.folha || '',
        termo: ato.termo || ''
      }));
      setAtosPedido(mappedAtos);
    }
    // eslint-disable-next-line
  }, [form.combos]);
  const [serventiaInfo, setServentiaInfo] = useState(null);
  // Buscar informações completas da serventia ao montar
  useEffect(() => {
    async function fetchServentia() {
      let id = form.serventiaId || form.serventia_id || form.serventia || null;
      // Se não houver id no form, buscar do usuário logado
      if (!id) {
        const usuarioLogado = JSON.parse(localStorage.getItem('usuario') || '{}');
        id = usuarioLogado.serventia || usuarioLogado.serventiaId || usuarioLogado.serventia_id || null;
        console.log('[DEBUG] Buscando serventia do usuario logado:', id, '| usuario:', usuarioLogado);
      }
      console.log('[DEBUG] Buscando serventia, id:', id);
      if (!id) {
        console.warn('[DEBUG] Nenhum id de serventia encontrado no form nem no usuario. form completo:', JSON.stringify(form, null, 2));
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
    form.valorAdiantadoDetalhes || []
  );

  useEffect(() => {
    setValorAdiantadoDetalhes(form.valorAdiantadoDetalhes || []);
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

  // Adiciona TODOS os atos do combo selecionado ao pedido, cada um com os campos extras preenchidos
  const handleAdicionarComboModal = () => {
    if (!modalComboSelecionado) return;
    const combo = combosDisponiveis.find(c => c.id === Number(modalComboSelecionado));
    if (!combo || !Array.isArray(combo.atos) || combo.atos.length === 0) return;
    setAtosPedido(prev => [
      ...prev,
      ...combo.atos.map(ato => ({
        comboId: combo.id,
        comboNome: combo.nome,
        atoId: ato.id,
        atoCodigo: ato.codigo,
        atoDescricao: ato.descricao,
        quantidade: 1,
        codigoTributario: modalCodigoTributario,
        tipoRegistro: modalTipoRegistro,
        nomeRegistrados: modalNomeRegistrados,
        livro: modalLivro,
        folha: modalFolha,
        termo: modalTermo
      }))
    ]);
    // Limpa campos do modal, mas mantém o popup aberto para adicionar mais combos/atos
    setModalComboSelecionado('');
    setModalTipoRegistro('');
    setModalNomeRegistrados('');
    setModalLivro('');
    setModalFolha('');
    setModalTermo('');
    setModalCodigoTributario('');
  };

  // Adiciona pagamento adiantado através do modal
  const handleAdicionarPagamentoModal = () => {
    if (!modalValorPagamento || !modalFormaPagamento) return;
    
    const novoPagamento = {
      valor: modalValorPagamento,
      forma: modalFormaPagamento
    };
    
    setValorAdiantadoDetalhes(prev => [...prev, novoPagamento]);
    
    // Limpa campos do modal
    setModalValorPagamento('');
    setModalFormaPagamento('');
  };
      

  // Função para enviar o pedido (salvar ou atualizar)
  const handleSubmit = async () => {
    try {
      // Sempre define status como 'Aguardando Conferência'
      let novoForm = { ...form, status: 'Aguardando Conferência' };
      // Sempre POST para /api/pedidos
      const url = `${config.apiURL}/pedidos-criar`;
      const method = 'POST';
      // Converter atosPedido para combos conforme esperado pelo backend
      const combos = atosPedido.map(ato => ({
        combo_id: ato.comboId,
        ato_id: ato.atoId,
        quantidade: ato.quantidade,
        codigo_tributario: ato.codigoTributario,
        tipo_registro: ato.tipoRegistro || '',
        nome_registrados: ato.nomeRegistrados || '',
        livro: ato.livro || '',
        folha: ato.folha || '',
        termo: ato.termo || ''
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
    // Usa a data/hora do salvamento do pedido (form.criado_em), se disponível
    let data = '-';
    if (form.criado_em) {
      try {
        const d = new Date(form.criado_em);
        data = d.toLocaleString('pt-BR');
      } catch (e) {
        console.warn('[PROTOCOLO LOG] Erro ao converter form.criado_em:', form.criado_em, e);
        data = form.criado_em;
      }
    } else {
      data = new Date().toLocaleString('pt-BR');
    }
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    const nomeUsuario = usuario.nome || usuario.email || 'Usuário';
    // Dados do cliente
    const cliente = form.cliente || {};
    const clienteNome = cliente.nome || form.clienteNome || '-';
    const clienteDoc = cliente.cpf || cliente.cnpj || form.clienteCpf || form.clienteCnpj || '-';
    const clienteEmail = cliente.email || form.clienteEmail || '-';
    const clienteTel = cliente.telefone || form.clienteTelefone || '-';
    // Sempre exibir bloco completo da serventia, mesmo que alguns campos estejam vazios
    const s = serventiaInfo || {};
    // LOG para rastrear dados recebidos da serventia
    console.log('[PROTOCOLO LOG] Dados da serventia recebidos para impressão:', s);
    if (!s || typeof s !== 'object') {
      console.warn('[PROTOCOLO LOG] serventiaInfo está indefinido ou não é objeto:', s);
    }
    if (!s.nome_completo) {
      console.warn('[PROTOCOLO LOG] nome_completo ausente na serventia:', s);
    }
    let serventiaHtml = `
      <div style="text-align:center; margin-bottom:4px;">
        <img src='/brasao-da-republica-do-brasil-logo-png_seeklogo-263322.png' alt='Brasão da República' style='height:38px; margin-bottom:2px;' />
      </div>
      <div><b>${s.nome_completo || ''}</b></div>
      <div>${s.endereco || ''}</div>
      <div>CNPJ: ${s.cnpj || ''}</div>
      <div>Telefone: ${s.telefone || ''}</div>
      <div>Email: ${s.email || ''}</div>
    `;
    // Monta HTML do protocolo para impressora térmica 80 colunas, apenas preto
    const html = `
      <html>
      <head>
        <title>Recibo de Protocolo</title>
        <style>
          @page { size: A4; margin: 1cm; }
          body { font-family: 'Times New Roman', serif; font-size: 11pt; color: black; line-height: 1.4; margin: 0; padding: 0; width: 19cm; height: 13.5cm; box-sizing: border-box; }
          .serventia-bloco { text-align: center; margin-bottom: 10px; }
          .info { margin-bottom: 4px; text-align: center; }
          .label { color: #000; font-weight: bold; }
          .valor { color: #000; }
          .atos-table { width: 100%; border-collapse: collapse; margin-top: 6px; }
          .atos-table th, .atos-table td { border: 1px solid #000; padding: 2px 3px; font-size: 10px; color: #000; }
          .atos-table th { background: #fff; color: #000; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="serventia-bloco">${serventiaHtml}</div>
        <h2 style="color: #000; text-align: center; font-size: 15px; margin: 2px 0 8px 0; font-weight: bold;">Recibo de Protocolo nº ${protocolo}</h2>
        <div class="info"><span class="label">Data/Hora:</span> <span class="valor">${data}</span></div>
        <div class="info"><span class="label">Escrevente responsável pelo Protocolo:</span> <span class="valor">${nomeUsuario}</span></div>
        <div class="info"><span class="label">Cliente:</span> <span class="valor">${clienteNome}</span></div>
        <div class="info"><span class="label">CPF/CNPJ:</span> <span class="valor">${clienteDoc}</span></div>
        <div class="info"><span class="label">E-mail:</span> <span class="valor">${clienteEmail}</span></div>
        <div class="info"><span class="label">Tel:</span> <span class="valor">${clienteTel}</span></div>
        <div class="info"><span class="label">Descrição:</span> <span class="valor">${form.descricao || ''}</span></div>
        <div class="info"><span class="label">Origem:</span> <span class="valor">${form.origem || ''} ${form.origemInfo ? '(' + form.origemInfo + ')' : ''}</span></div>
        <div class="info"><span class="label">Previsão de Entrega:</span> <span class="valor">${form.prazo || ''}</span></div>
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
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `;
  const win = window.open('', '_blank', 'width=794,height=550'); // Tamanho aproximado de meia folha A4
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 500);
  };

  return (
    <div style={{ background: '#f5e6fa', padding: '0', borderRadius: '16px', width: '100%', boxSizing: 'border-box', display: 'flex', justifyContent: 'center' }}>
      <div style={{
        width: '100%',
        maxWidth: '100%',
        margin: '32px 0',
        padding: '24px 32px',
        borderRadius: '16px',
        border: '2px solid #9b59b6',
        boxShadow: '0 2px 12px rgba(155,89,182,0.10)',
        background: '#f5e6fa',
        overflow: 'hidden',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch'
      }}>
        {/* Header */}
        <div style={{
          padding: '10px 16px 6px 16px',
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <h2 style={{ margin: 0, color: '#6c3483', fontWeight: 700, fontSize: 18 }}>
            Informações do Serviço:
          </h2>
        </div>


        {/* Descrição do Serviço, Origem, campo condicional e Prazo na mesma linha */}
        <div style={{
          padding: '8px 12px',
          margin: '0 0 8px 0',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexWrap: 'wrap'
        }}>
          <label style={{ color: '#6c3483', fontWeight: 600, fontSize: 13, minWidth: 100, margin: 0 }}>Descrição do Serviço:</label>
          <input
            type="text"
            value={form.descricao || ''}
            onChange={e => onChange('descricao', e.target.value)}
            maxLength={200}
            style={{
              width: 160,
              border: '1.5px solid #d6d6f5',
              borderRadius: 6,
              padding: '4px 2px',
              fontSize: 13,
              height: 32,
              boxSizing: 'border-box',
            }}
            placeholder="Descreva o serviço..."
          />
          <label style={{ color: '#6c3483', fontWeight: 600, fontSize: 13, minWidth: 50, margin: 0 }}>Origem:</label>
          <select
            value={form.origem || ''}
            onChange={e => onChange('origem', e.target.value)}
            style={{
              width: 110,
              border: '1.5px solid #d6d6f5',
              borderRadius: 6,
              padding: '4px 2px',
              fontSize: 13,
              height: 32,
              boxSizing: 'border-box',
            }}
          >
            <option value="">Selecione a origem...</option>
            <option value="Balcão">Balcão</option>
            <option value="CRC">CRC</option>
            <option value="email">email</option>
            <option value="Whatsapp">Whatsapp</option>
            <option value="Malote Digital">Malote Digital</option>
            <option value="PJE">PJE</option>
          </select>
          {/* Campo condicional logo após Origem, exceto para Balcão */}
          {form.origem && form.origem !== 'Balcão' && (
            <>
              <label style={{ color: '#6c3483', fontWeight: 600, fontSize: 13, minWidth: 50, margin: 0 }}>
                {form.origem === 'CRC' ? 'Protocolo CRC:' :
                  form.origem === 'email' ? 'E-mail:' :
                  form.origem === 'Whatsapp' ? 'Telefone Whatsapp:' :
                  form.origem === 'Malote Digital' ? 'Nº de Rastreabilidade:' :
                  form.origem === 'PJE' ? 'Nº do Processo PJE:' : ''}
              </label>
              <input
                type={form.origem === 'email' ? 'email' : 'text'}
                value={form.origemInfo || ''}
                onChange={e => onChange('origemInfo', e.target.value)}
                style={{
                  width: 180,
                  border: '1.5px solid #d6d6f5',
                  borderRadius: 6,
                  padding: '4px 2px',
                  fontSize: 13,
                  height: 32,
                  boxSizing: 'border-box',
                }}
                placeholder={
                  form.origem === 'CRC' ? 'Digite o protocolo CRC' :
                  form.origem === 'email' ? 'Digite o e-mail de origem' :
                  form.origem === 'Whatsapp' ? 'Digite o telefone do Whatsapp' :
                  form.origem === 'Malote Digital' ? 'Digite o número de rastreabilidade' :
                  form.origem === 'PJE' ? 'Digite o número do processo PJE' : ''
                }
              />
            </>
          )}
          <label style={{ color: '#6c3483', fontWeight: 600, fontSize: 13, minWidth: 65, margin: 0 }}>Prazo estimado:</label>
          <input
            type="date"
            value={form.prazo}
            onChange={e => onChange('prazo', e.target.value)}
            style={{
              width: 120,
              border: '1.5px solid #d6d6f5',
              borderRadius: 6,
              padding: '4px 2px',
              fontSize: 13,
              height: 32,
              boxSizing: 'border-box',
            }}
          />
          <label style={{ color: '#6c3483', fontWeight: 600, fontSize: 13, minWidth: 70, margin: 0 }}>Observação:</label>
          <input
            type="text"
            value={form.observacao || ''}
            onChange={e => onChange('observacao', e.target.value)}
            maxLength={150}
            style={{
              width: 200,
              border: '1.5px solid #d6d6f5',
              borderRadius: 6,
              padding: '4px 2px',
              fontSize: 13,
              height: 32,
              boxSizing: 'border-box',
            }}
            placeholder="Observações..."
          />
        </div>

        {/* Botões de Adicionar Pagamento e Atos */}
        <div style={{
          padding: '6px 8px',
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          <button
            type="button"
            onClick={() => setShowAdicionarPagamentoModal(true)}
            style={{
              padding: '6px 18px',
              background: '#2874a6',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontWeight: 'bold',
              fontSize: 13,
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
          >
            ➕ Adicionar Pagamento
          </button>
          <button
            type="button"
            onClick={() => setShowAdicionarAtosModal(true)}
            style={{
              padding: '6px 18px',
              background: '#9b59b6',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontWeight: 'bold',
              fontSize: 15,
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
          >
            ➕ Adicionar Atos
          </button>
        </div>

        {/* Valor Adiantado - Tabela */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-start',
          marginBottom: '8px',
        }}>
          {/* Valor Adiantado Card */}
          <div style={{
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            width: '100%'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ color: '#6c3483', fontWeight: 600, fontSize: 14 }}>💰 Valores Adiantados pelo Usuário:</label>
            </div>
            
            {/* Tabela de Pagamentos */}
            {valorAdiantadoDetalhes.length > 0 && valorAdiantadoDetalhes.some(item => item.valor && item.forma) && (
              <div style={{
                overflowX: 'auto',
                background: '#e8f4fd',
                borderRadius: 8,
                border: '2px solid #2874a6',
                boxShadow: '0 2px 8px rgba(40,116,166,0.06)',
                padding: '8px 0',
              }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    marginBottom: 0,
                    fontSize: 13,
                    background: 'transparent',
                  }}
                >
                  <thead>
                    <tr style={{ background: '#d1ecf1' }}>
                      <th style={{ padding: 8, color: '#2874a6', fontWeight: 700, fontSize: 12, textAlign: 'left' }}>Valor</th>
                      <th style={{ padding: 8, color: '#2874a6', fontWeight: 700, fontSize: 12, textAlign: 'left' }}>Forma de Pagamento</th>
                      <th style={{ padding: 8, color: '#2874a6', fontWeight: 700, fontSize: 12, textAlign: 'center' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {valorAdiantadoDetalhes
                      .filter(item => item.valor && item.forma)
                      .map((item, idx) => (
                        <tr key={idx} style={{ background: idx % 2 === 0 ? '#f8fcff' : 'transparent' }}>
                          <td style={{ padding: 8, fontSize: 12 }}>
                            R$ {parseFloat(item.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: 8, fontSize: 12 }}>{item.forma || '-'}</td>
                          <td style={{ padding: 8, textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => {
                                const originalIndex = valorAdiantadoDetalhes.findIndex(originalItem => 
                                  originalItem.valor === item.valor && originalItem.forma === item.forma
                                );
                                if (originalIndex !== -1) {
                                  handleRemoveValorAdiantadoDetalhe(originalIndex);
                                }
                              }}
                              style={{
                                background: '#e74c3c',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 6,
                                padding: '4px 8px',
                                fontWeight: 'bold',
                                fontSize: 10,
                                cursor: 'pointer',
                                transition: 'all 0.3s ease'
                              }}
                            >
                              Remover
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
            
            {/* Mensagem quando não há pagamentos */}
            {(!valorAdiantadoDetalhes.length || !valorAdiantadoDetalhes.some(item => item.valor && item.forma)) && (
              <div style={{
                padding: 16,
                textAlign: 'center',
                color: '#6c757d',
                background: '#f8f9fa',
                borderRadius: 8,
                border: '1px dashed #dee2e6',
                fontSize: 12
              }}>
                Nenhum pagamento adiantado adicionado ainda. Clique em "Adicionar Pagamento" para começar.
              </div>
            )}
          </div>
        </div>

        {/* Modal/Popup para adicionar pagamento */}
        {showAdicionarPagamentoModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.25)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div style={{
              background: '#fff',
              borderRadius: 12,
              boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
              padding: 32,
              minWidth: 420,
              maxWidth: 500,
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              position: 'relative'
            }}>
              <button
                onClick={() => setShowAdicionarPagamentoModal(false)}
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 16,
                  background: 'transparent',
                  border: 'none',
                  fontSize: 22,
                  color: '#2874a6',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
                title="Fechar"
              >×</button>
              <h2 style={{ color: '#2874a6', fontWeight: 700, fontSize: 18, margin: 0 }}>💰 Adicionar Pagamento Adiantado</h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ fontWeight: 600, color: '#2874a6', fontSize: 13 }}>Valor:</label>
                <input 
                  type="number" 
                  min={0}
                  step="0.01"
                  value={modalValorPagamento} 
                  onChange={e => setModalValorPagamento(e.target.value)} 
                  style={{ 
                    width: '100%', 
                    borderRadius: 6, 
                    padding: '8px 12px', 
                    border: '1.5px solid #aed6f1', 
                    fontSize: 14, 
                    boxSizing: 'border-box', 
                    height: 40 
                  }} 
                  placeholder="Digite o valor..." 
                />
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ fontWeight: 600, color: '#2874a6', fontSize: 13 }}>Forma de Pagamento:</label>
                <select 
                  value={modalFormaPagamento} 
                  onChange={e => setModalFormaPagamento(e.target.value)} 
                  style={{ 
                    width: '100%', 
                    borderRadius: 6, 
                    padding: '8px 12px', 
                    border: '1.5px solid #aed6f1', 
                    fontSize: 14, 
                    boxSizing: 'border-box', 
                    height: 40 
                  }}
                >
                  <option value="">Selecione a forma de pagamento...</option>
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="Cartão">Cartão</option>
                  <option value="Pix">Pix</option>
                  <option value="CRC">CRC</option>
                  <option value="Depósito Prévio">Depósito Prévio</option>
                  <option value="Transferência">Transferência</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>
              
              <button
                type="button"
                onClick={handleAdicionarPagamentoModal}
                disabled={!modalValorPagamento || !modalFormaPagamento}
                style={{
                  marginTop: 18,
                  padding: '12px 0',
                  background: modalValorPagamento && modalFormaPagamento ? '#28a745' : '#ccc',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 'bold',
                  fontSize: 16,
                  cursor: modalValorPagamento && modalFormaPagamento ? 'pointer' : 'not-allowed',
                  transition: 'all 0.3s ease',
                  width: '100%'
                }}
              >
                ✅ ADICIONAR PAGAMENTO
              </button>
            </div>
          </div>
        )}

        {/* Modal/Popup para adicionar UM ato do combo */}
        {showAdicionarAtosModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.25)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div style={{
              background: '#fff',
              borderRadius: 12,
              boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
              padding: 32,
              minWidth: 420,
              maxWidth: 600,
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              position: 'relative'
            }}>
              <button
                onClick={() => setShowAdicionarAtosModal(false)}
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 16,
                  background: 'transparent',
                  border: 'none',
                  fontSize: 22,
                  color: '#9b59b6',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
                title="Fechar"
              >×</button>
              <h2 style={{ color: '#6c3483', fontWeight: 700, fontSize: 18, margin: 0 }}>Adicionar Ato do Combo</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ fontWeight: 600, color: '#6c3483', fontSize: 13 }}>Adicionar Combo:</label>
                <select value={modalComboSelecionado} onChange={e => setModalComboSelecionado(e.target.value)} style={{ width: '100%', borderRadius: 6, padding: '6px 8px', border: '1.5px solid #d6d6f5', fontSize: 13, boxSizing: 'border-box', height: 32 }}>
                  <option value="">Selecione um combo...</option>
                  {combosDisponiveis.map(c => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ fontWeight: 600, color: '#6c3483', fontSize: 13 }}>Código Tributário:</label>
                <input type="text" value={modalCodigoTributario} onChange={e => setModalCodigoTributario(e.target.value)} style={{ width: '100%', borderRadius: 6, padding: '6px 8px', border: '1.5px solid #d6d6f5', fontSize: 13, boxSizing: 'border-box', height: 32 }} placeholder="Código Tributário" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ fontWeight: 600, color: '#6c3483', fontSize: 13 }}>Tipo de Registro:</label>
                <select value={modalTipoRegistro} onChange={e => setModalTipoRegistro(e.target.value)} style={{ width: '100%', borderRadius: 6, padding: '6px 8px', border: '1.5px solid #d6d6f5', fontSize: 13, boxSizing: 'border-box', height: 32 }}>
                  <option value="">Selecione...</option>
                  <option value="Livro E">Livro E</option>
                  <option value="Nascimento">Nascimento</option>
                  <option value="Casamento">Casamento</option>
                  <option value="Casamento Religioso com Efeito Civil">Casamento Religioso com Efeito Civil</option>
                  <option value="Obito">Óbito</option>
                  <option value="Natimorto">Natimorto</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ fontWeight: 600, color: '#6c3483', fontSize: 13 }}>Nome do(s) Registrado(s):</label>
                <input type="text" value={modalNomeRegistrados} onChange={e => setModalNomeRegistrados(e.target.value)} style={{ width: '100%', borderRadius: 6, padding: '6px 8px', border: '1.5px solid #d6d6f5', fontSize: 13, boxSizing: 'border-box', height: 32 }} placeholder="Nome(s)" />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontWeight: 600, color: '#6c3483', fontSize: 13 }}>Livro:</label>
                  <input type="text" value={modalLivro} onChange={e => setModalLivro(e.target.value)} style={{ width: '100%', borderRadius: 6, padding: '6px 8px', border: '1.5px solid #d6d6f5', fontSize: 13, boxSizing: 'border-box', height: 32 }} placeholder="Livro" />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontWeight: 600, color: '#6c3483', fontSize: 13 }}>Folha:</label>
                  <input type="text" value={modalFolha} onChange={e => setModalFolha(e.target.value)} style={{ width: '100%', borderRadius: 6, padding: '6px 8px', border: '1.5px solid #d6d6f5', fontSize: 13, boxSizing: 'border-box', height: 32 }} placeholder="Folha" />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontWeight: 600, color: '#6c3483', fontSize: 13 }}>Termo:</label>
                  <input type="text" value={modalTermo} onChange={e => setModalTermo(e.target.value)} style={{ width: '100%', borderRadius: 6, padding: '6px 8px', border: '1.5px solid #d6d6f5', fontSize: 13, boxSizing: 'border-box', height: 32 }} placeholder="Termo" />
                </div>
              </div>
              <button
                type="button"
                onClick={handleAdicionarComboModal}
                style={{
                  marginTop: 18,
                  padding: '8px 0',
                  background: '#2ecc71',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 'bold',
                  fontSize: 16,
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  width: '100%'
                }}
              >
                ADICIONAR
              </button>
            </div>
          </div>
        )}

        {/* Atos Table Card */}
        {atosPedido.length > 0 && (
          <div style={{
            padding: '16px',
            marginBottom: '16px',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              margin: '0 0 16px 0',
              borderBottom: '2px solid #9b59b6',
              paddingBottom: '10px',
            }}>
              <h3 style={{color: '#6c3483', fontWeight: 600, fontSize: 14 }}>
                📋 Atos adicionados ao pedido
              </h3>
              <span style={{
                color: '#2c3e50',
                fontSize: '16px',
                fontWeight: '600',
                letterSpacing: 0.5
              }}>
                Valor dos atos: {(() => {
                  const total = calcularTotalAtosPagos();
                  return `R$${total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                })()}
              </span>
            </div>
            <div style={{
              overflowX: 'auto',
              background: '#f5e6fa',
              borderRadius: 8,
              border: '2px solid #9b59b6',
              boxShadow: '0 2px 8px rgba(155,89,182,0.06)',
              padding: '8px 0',
            }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  marginBottom: 0,
                  tableLayout: 'fixed',
                  fontSize: 13,
                  background: 'transparent',
                }}
              >
                <thead>
                  <tr style={{ background: '#ede1f7' }}>
                    <th style={{ padding: 6, color: '#6c3483', fontWeight: 700, fontSize: 10 }}>Combo</th>
                    <th style={{ padding: 6, color: '#6c3483', fontWeight: 700, fontSize: 10 }}>Código do Ato</th>
                    <th style={{ padding: 6, color: '#6c3483', fontWeight: 700, fontSize: 10 }}>Descrição do Ato</th>
                    <th style={{ padding: 6, color: '#6c3483', fontWeight: 700, fontSize: 10 }}>Quantidade</th>
                    <th style={{ padding: 6, color: '#6c3483', fontWeight: 700, fontSize: 10 }}>Código Tributário</th>
                    <th style={{ padding: 6, color: '#6c3483', fontWeight: 700, fontSize: 10 }}>Tipo de Registro</th>
                    <th style={{ padding: 6, color: '#6c3483', fontWeight: 700, fontSize: 10 }}>Nome do(s) Registrado(s)</th>
                    <th style={{ padding: 6, color: '#6c3483', fontWeight: 700, fontSize: 10 }}>Livro</th>
                    <th style={{ padding: 6, color: '#6c3483', fontWeight: 700, fontSize: 10 }}>Folha</th>
                    <th style={{ padding: 6, color: '#6c3483', fontWeight: 700, fontSize: 10 }}>Termo</th>
                    <th style={{ padding: 6, color: '#6c3483', fontWeight: 700, fontSize: 10 }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {atosPedido.map((ato, idx) => (
                  <tr key={`${ato.comboId}-${ato.atoId}-${idx}`} style={{ background: idx % 2 === 0 ? '#f8f4fc' : 'transparent', fontSize: 10 }}>
                      <td style={{ padding: 6, fontSize: 10 }}>{ato.comboNome}</td>
                      <td style={{ padding: 6, fontSize: 10 }}>{ato.atoCodigo}</td>
                      <td style={{ padding: 6, fontSize: 10 }}>{ato.atoDescricao ? ato.atoDescricao.slice(0, 15) : ''}</td>
                      <td style={{ padding: 6, fontSize: 10 }}>
                        <input
                          type="number"
                          min={1}
                          value={ato.quantidade}
                          onChange={e => handleAtoChange(idx, 'quantidade', Number(e.target.value))}
                          style={{ width: 50, maxWidth: 60, borderRadius: 6, border: '1.5px solid #d6d6f5', padding: '2px 6px', fontSize: 10, boxSizing: 'border-box', textAlign: 'center' }}
                        />
                      </td>
                      <td style={{ padding: 6, position: 'relative', fontSize: 10 }}>
                        <input
                          type="text"
                          value={ato.codigoTributario}
                          onChange={e => handleCodigoTributarioInput(idx, e.target.value)}
                          style={{ width: 50, maxWidth: 60, borderRadius: 6, border: '1.5px solid #d6d6f5', padding: '2px 6px', fontSize: 10, boxSizing: 'border-box', textAlign: 'center' }}
                          autoComplete="off"
                        />
                        {codigoTributarioIdx === idx && codigoTributarioSuggestions.length > 0 && (
                          <ul style={{
                            position: 'absolute',
                            background: '#fff',
                            border: '1px solid #ccc',
                            borderRadius: 4,
                            margin: 0,
                            padding: '4px 0',
                            listStyle: 'none',
                            zIndex: 9999,
                            width: 220,
                            left: 0,
                            top: '100%',
                            fontSize: 10,
                            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                          }}>
                            {codigoTributarioSuggestions.map(sug => (
                              <li
                                key={sug.codigo}
                                style={{
                                  padding: '4px 8px',
                                  cursor: 'pointer',
                                  fontSize: 10
                                }}
                                onClick={() => handleSelectCodigoTributario(sug)}
                              >
                                {sug.codigo} - {sug.descricao}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td style={{ padding: 6, fontSize: 10 }}>
                        <select
                          value={ato.tipoRegistro || ''}
                          onChange={e => handleAtoChange(idx, 'tipoRegistro', e.target.value)}
                          style={{ width: '100%', maxWidth: 156, borderRadius: 6, border: '1.5px solid #d6d6f5', padding: '2px 6px', fontSize: 10, boxSizing: 'border-box' }}
                        >
                          <option value="">Selecione...</option>
                          <option value="Livro E">Livro E</option>
                          <option value="Nascimento">Nascimento</option>
                          <option value="Casamento">Casamento</option>
                          <option value="Casamento Religioso com Efeito Civil">Casamento Religioso com Efeito Civil</option>
                          <option value="Obito">Óbito</option>
                          <option value="Natimorto">Natimorto</option>
                        </select>
                      </td>
                      <td style={{ padding: 6, fontSize: 10 }}>
                        <input
                          type="text"
                          value={ato.nomeRegistrados || ''}
                          onChange={e => handleAtoChange(idx, 'nomeRegistrados', e.target.value)}
                          style={{ width: '100%', maxWidth: 640, borderRadius: 6, border: '1.5px solid #d6d6f5', padding: '2px 6px', fontSize: 10, boxSizing: 'border-box' }}
                          placeholder="Nome(s)"
                        />
                      </td>
                      <td style={{ padding: 6, fontSize: 10 }}>
                        <input
                          type="text"
                          value={ato.livro || ''}
                          onChange={e => handleAtoChange(idx, 'livro', e.target.value)}
                          style={{ width: 50, maxWidth: 60, borderRadius: 6, border: '1.5px solid #d6d6f5', padding: '2px 6px', fontSize: 10, boxSizing: 'border-box', textAlign: 'center' }}
                          placeholder="Livro"
                        />
                      </td>
                      <td style={{ padding: 6, fontSize: 10 }}>
                        <input
                          type="text"
                          value={ato.folha || ''}
                          onChange={e => handleAtoChange(idx, 'folha', e.target.value)}
                          style={{ width: 50, maxWidth: 60, borderRadius: 6, border: '1.5px solid #d6d6f5', padding: '2px 6px', fontSize: 10, boxSizing: 'border-box', textAlign: 'center' }}
                          placeholder="Folha"
                        />
                      </td>
                      <td style={{ padding: 6, fontSize: 10 }}>
                        <input
                          type="text"
                          value={ato.termo || ''}
                          onChange={e => handleAtoChange(idx, 'termo', e.target.value)}
                          style={{ width: 50, maxWidth: 60, borderRadius: 6, border: '1.5px solid #d6d6f5', padding: '2px 6px', fontSize: 10, boxSizing: 'border-box', textAlign: 'center' }}
                          placeholder="Termo"
                        />
                      </td>
                      <td style={{ padding: 6, fontSize: 10 }}>
                        <button
                          type="button"
                          onClick={() => handleRemoverAto(idx)}
                          style={{
                            background: '#e74c3c',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 8,
                            padding: '4px 12px',
                            fontWeight: 'bold',
                            fontSize: 10,
                            cursor: 'pointer',
                            transition: 'all 0.3s ease'
                          }}
                        >
                          Remover
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Salvar/Atualizar Button e Imprimir Protocolo */}
        <div style={{
          padding: '6px 0',
          marginBottom: '8px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 10
        }}>
          <button
            onClick={handleSubmit}
            style={{
              padding: '6px 18px',
              background: '#2ecc71',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontWeight: 'bold',
              fontSize: 15,
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
          >
            {form.protocolo && form.protocolo.trim() !== '' ? 'Atualizar Pedido' : 'Salvar Pedido'}
          </button>
          <button
            type="button"
            onClick={handleImprimirProtocolo}
            style={{
              padding: '6px 18px',
              background: '#9b59b6',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontWeight: 'bold',
              fontSize: 15,
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
          >
            Imprimir Protocolo
          </button>
        </div>
      </div>
    </div>
  );
}

