import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import config from '../../config';

export default function ServicoEntrada({ form, tiposServico, onChange, combosDisponiveis, atosPedido, setAtosPedido }) {
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
          <h2>Recibo de Protocolo</h2>
          <div class="info"><span class="label">Protocolo nº</span> <span class="valor">${protocolo}</span></div>
          <div class="info"><span class="label"></span> <span class="valor">${serventiaHtml}</span></div>
          <div class="info"><span class="label">Data/Hora:</span> <span class="valor">${data}</span></div>
          <div class="info"><span class="label">Usuário:</span> <span class="valor">${nomeUsuario}</span></div>
          <div class="info"><span class="label">Cliente:</span> <span class="valor">${clienteNome}</span></div>
          <div class="info"><span class="label">Doc:</span> <span class="valor">${clienteDoc}</span></div>
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
    <div style={{ background: '#f5e6fa', padding: '0', borderRadius: '16px', width: '100%', boxSizing: 'border-box', display: 'flex', justifyContent: 'center' }}>
      <div style={{
        width: '100%',
        maxWidth: '800px',
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
          <h2 style={{ margin: 0, color: '#2c3e50', fontWeight: 700, fontSize: 18 }}>
            Informações do Serviço:
          </h2>
        </div>


        {/* Descrição do Serviço, Origem, campo condicional e Prazo na mesma linha */}
        <div style={{
          padding: '8px 12px',
          margin: '0 0 8px 0',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap'
        }}>
          <label style={{ color: '#6c3483', fontWeight: 600, fontSize: 13, minWidth: 120, margin: 0 }}>Descrição do Serviço:</label>
          <input
            type="text"
            value={form.descricao || ''}
            onChange={e => onChange('descricao', e.target.value)}
            maxLength={200}
            style={{
              width: 160,
              border: '1.5px solid #d6d6f5',
              borderRadius: 6,
              padding: '4px 8px',
              fontSize: 13,
              height: 32,
              boxSizing: 'border-box',
            }}
            placeholder="Descreva o serviço..."
          />
          <label style={{ color: '#6c3483', fontWeight: 600, fontSize: 13, minWidth: 60, margin: 0 }}>Origem:</label>
          <select
            value={form.origem || ''}
            onChange={e => onChange('origem', e.target.value)}
            style={{
              width: 110,
              border: '1.5px solid #d6d6f5',
              borderRadius: 6,
              padding: '4px 8px',
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
              <label style={{ color: '#6c3483', fontWeight: 600, fontSize: 13, minWidth: 60, margin: 0 }}>
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
                  padding: '4px 8px',
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
          <label style={{ color: '#6c3483', fontWeight: 600, fontSize: 13, minWidth: 80, margin: 0 }}>Prazo estimado:</label>
          <input
            type="date"
            value={form.prazo}
            onChange={e => onChange('prazo', e.target.value)}
            style={{
              width: 120,
              border: '1.5px solid #d6d6f5',
              borderRadius: 6,
              padding: '4px 8px',
              fontSize: 13,
              height: 32,
              boxSizing: 'border-box',
            }}
          />
        </div>


        {/* Valores e Observação */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          marginBottom: '8px',
        }}>
          {/* Valor Adiantado Card */}
          <div style={{
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: 3
          }}>
            <label style={{ color: '#2874a6', fontWeight: 600, fontSize: 12, marginBottom: 2 }}>Valor Adiantado pelo Usuário:</label>
            {valorAdiantadoDetalhes.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 3 }}>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={item.valor}
                  onChange={e => handleValorAdiantadoDetalheChange(idx, 'valor', e.target.value)}
                  style={{
                    width: '50%',
                    border: '1.5px solid #aed6f1',
                    borderRadius: 6,
                    padding: '3px 6px',
                    fontSize: 12,
                    height: 26,
                    boxSizing: 'border-box',
                  }}
                  placeholder="Valor"
                />
                <select
                  value={item.forma}
                  onChange={e => handleValorAdiantadoDetalheChange(idx, 'forma', e.target.value)}
                  style={{
                    width: '40%',
                    border: '1.5px solid #aed6f1',
                    borderRadius: 6,
                    padding: '3px 6px',
                    fontSize: 12,
                    height: 26,
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="">Forma de Pagamento</option>
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="Cartão">Cartão</option>
                  <option value="Pix">Pix</option>
                  <option value="CRC">CRC</option>
                  <option value="Depósito Prévio">Depósito Prévio</option>
                </select>
                {valorAdiantadoDetalhes.length > 1 && (
                  <button type="button" onClick={() => handleRemoveValorAdiantadoDetalhe(idx)} style={{ background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 6, padding: '2px 6px', fontWeight: 'bold', cursor: 'pointer', fontSize: 12, height: 24 }}>-</button>
                )}
              </div>
            ))}
            <button type="button" onClick={handleAddValorAdiantadoDetalhe} style={{ background: '#9b59b6', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontWeight: 'bold', cursor: 'pointer', marginTop: 2, fontSize: 12, height: 26 }}>Adicionar Pagamento</button>
          </div>
          {/* Observação Card */}
          <div style={{
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: 3
          }}>
            <label style={{ color: '#884ea0', fontWeight: 600, fontSize: 12, marginBottom: 2 }}>Observação:</label>
            <textarea
              value={form.observacao || ''}
              onChange={e => onChange('observacao', e.target.value)}
              maxLength={150}
              style={{
                width: '100%',
                maxWidth: '100%',
                border: '1.5px solid #d2b4de',
                borderRadius: 6,
                padding: '3px 6px',
                fontSize: 12,
                resize: 'vertical',
                minHeight: 26,
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Adicionar Combo Card */}
        <div style={{
          padding: '6px 8px',
          marginBottom: '8px',
        }}>
          <label style={{ fontWeight: 600, color: '#6c3483', marginRight: 8, fontSize: 13 }}>Adicionar Combo:</label>
          <select value={comboSelecionado} onChange={e => setComboSelecionado(e.target.value)} style={{ width: '55%', maxWidth: '100%', marginRight: 8, borderRadius: 6, padding: '3px 8px', border: '1.5px solid #d6d6f5', fontSize: 13, boxSizing: 'border-box', height: 28 }}>
            <option value="">Selecione um combo...</option>
            {combosDisponiveis.map(c => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
          <button type="button" onClick={handleAdicionarCombo} style={{
            padding: '4px 12px',
            background: '#9b59b6',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontWeight: 'bold',
            fontSize: 13,
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            height: 28
          }}>
            ➕ Adicionar
          </button>
        </div>

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
              <h3 style={{
                margin: 0,
                color: '#2c3e50',
                fontSize: '16px',
                fontWeight: '600',
                letterSpacing: 0.5
              }}>
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
                          style={{ width: '100%', maxWidth: 60, borderRadius: 6, border: '1.5px solid #d6d6f5', padding: '2px 6px', fontSize: 10, boxSizing: 'border-box' }}
                        />
                      </td>
                      <td style={{ padding: 6, position: 'relative', fontSize: 10 }}>
                        <input
                          type="text"
                          value={ato.codigoTributario}
                          onChange={e => handleCodigoTributarioInput(idx, e.target.value)}
                          style={{ width: '100%', maxWidth: 100, borderRadius: 6, border: '1.5px solid #d6d6f5', padding: '2px 6px', fontSize: 10, boxSizing: 'border-box' }}
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

