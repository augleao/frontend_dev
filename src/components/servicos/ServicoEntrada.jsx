import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import config from '../../config';

export default function ServicoEntrada({ form, tiposServico, onChange, combosDisponiveis, atosPedido, setAtosPedido }) {
  console.log('PROPS atosPedido recebidos em ServicoEntrada:', atosPedido);
  console.log('[LOG] form recebido em ServicoEntrada:', form);
  console.log('[LOG] form.valorAdiantadoDetalhes recebido:', form.valorAdiantadoDetalhes);
  const [comboSelecionado, setComboSelecionado] = useState('');
  const [codigoTributarioSuggestions, setCodigoTributarioSuggestions] = useState([]);
  const [loadingCodigoTributario, setLoadingCodigoTributario] = useState(false);
  const [codigoTributarioTerm, setCodigoTributarioTerm] = useState('');
  const [codigoTributarioIdx, setCodigoTributarioIdx] = useState(null);
  const [valorAdiantadoDetalhes, setValorAdiantadoDetalhes] = useState(
    form.valorAdiantadoDetalhes || [ { valor: '', forma: '' } ]
  );

  useEffect(() => {
    console.log('[LOG] useEffect - form.valorAdiantadoDetalhes mudou:', form.valorAdiantadoDetalhes);
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
    console.log('Atos filtrados para código tributário 01:', atosFiltrados);
    const total = atosFiltrados.reduce((total, ato) => {
      const valor = parseFloat(ato.valor_final || 0);
      console.log(`Ato:`, ato, `Valor considerado:`, valor, `Quantidade:`, ato.quantidade);
      return total + (valor * (ato.quantidade || 1));
    }, 0);
    console.log('Total calculado dos atos pagos:', total);
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
      console.log('[handleSubmit] Nome do usuário logado enviado no pedido:', nomeUsuario);
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };
      console.log('[handleSubmit] Enviando pedido:', { url, method, body });
      const res = await fetch(url, {
        method,
        headers,
        body
      });
      console.log('[handleSubmit] Status da resposta:', res.status, res.statusText);
      const responseText = await res.text();
      console.log('[handleSubmit] Texto da resposta:', responseText);
      let data = {};
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (jsonErr) {
        console.error('[handleSubmit] Erro ao fazer parse do JSON da resposta:', jsonErr);
      }
      // Após salvar o pedido, grava o status 'Aguardando Conferência' no DB
      if (res.ok) {
        // Pedido enviado com sucesso
        console.log('Operação realizada com sucesso:', data);
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
            console.log('[Status POST] Protocolo:', protocoloParaStatus);
            console.log('[Status POST] Usuário:', usuario);
            console.log('[Status POST] Body:', statusBody);
            const statusRes = await fetch(`${config.apiURL}/pedidos/${encodeURIComponent(protocoloParaStatus)}/status`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {})
              },
              body: JSON.stringify(statusBody)
            });
            const statusText = await statusRes.text();
            console.log('[Status POST] Status da resposta:', statusRes.status, statusRes.statusText);
            console.log('[Status POST] Texto da resposta:', statusText);
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
    // Dados principais do protocolo
    const protocolo = form.protocolo || '(sem número)';
    const data = new Date().toLocaleString('pt-BR');
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    const nomeUsuario = usuario.nome || usuario.email || 'Usuário';
    // Monta HTML do protocolo
    const html = `
      <html>
      <head>
        <title>Protocolo de Entrada</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 32px; }
          .protocolo-box { border: 2px solid #9b59b6; border-radius: 12px; padding: 32px; max-width: 600px; margin: 0 auto; }
          h2 { color: #9b59b6; text-align: center; }
          .info { margin-bottom: 18px; }
          .label { color: #6c3483; font-weight: bold; }
          .valor { color: #222; }
          .atos-table { width: 100%; border-collapse: collapse; margin-top: 18px; }
          .atos-table th, .atos-table td { border: 1px solid #ccc; padding: 6px 10px; font-size: 13px; }
          .atos-table th { background: #ede1f7; color: #6c3483; }
        </style>
      </head>
      <body>
        <div class="protocolo-box">
          <h2>PROTOCOLO DE ENTRADA</h2>
          <div class="info"><span class="label">Protocolo:</span> <span class="valor">${protocolo}</span></div>
          <div class="info"><span class="label">Data/Hora:</span> <span class="valor">${data}</span></div>
          <div class="info"><span class="label">Usuário:</span> <span class="valor">${nomeUsuario}</span></div>
          <div class="info"><span class="label">Descrição:</span> <span class="valor">${form.descricao || ''}</span></div>
          <div class="info"><span class="label">Origem:</span> <span class="valor">${form.origem || ''} ${form.origemInfo ? '(' + form.origemInfo + ')' : ''}</span></div>
          <div class="info"><span class="label">Prazo estimado:</span> <span class="valor">${form.prazo || ''}</span></div>
          <div class="info"><span class="label">Observação:</span> <span class="valor">${form.observacao || ''}</span></div>
          <div class="info"><span class="label">Valor(es) Adiantado(s):</span> <span class="valor">${(valorAdiantadoDetalhes || []).map(v => v.valor ? `R$${parseFloat(v.valor).toLocaleString('pt-BR', {minimumFractionDigits:2})} (${v.forma})` : '').filter(Boolean).join(' | ') || '-'}</span></div>
          <table class="atos-table">
            <thead>
              <tr>
                <th>Combo</th>
                <th>Cód. Ato</th>
                <th>Descrição</th>
                <th>Qtd</th>
                <th>Cód. Tributário</th>
              </tr>
            </thead>
            <tbody>
              ${(atosPedido || []).map(ato => `
                <tr>
                  <td>${ato.comboNome || ''}</td>
                  <td>${ato.atoCodigo || ''}</td>
                  <td>${ato.atoDescricao ? ato.atoDescricao.slice(0, 30) : ''}</td>
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
    <div style={{ background: '#f5e6fa', padding: '0', borderRadius: '24px', width: '100%', boxSizing: 'border-box' }}>
      <div style={{
        width: '100%',
        margin: '0',
        padding: 0,
        borderRadius: '24px',
        border: '3px solid #9b59b6',
        boxShadow: '0 6px 32px rgba(155,89,182,0.10)',
        background: '#f5e6fa',
        overflow: 'hidden',
        boxSizing: 'border-box'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px 12px 24px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <h2 style={{ margin: 0, color: '#2c3e50', fontWeight: 700, fontSize: 28 }}>
            Entrada:
          </h2>
          {/* Protocolo removido daqui, agora exibido no topo do ServicoManutencao */}
        </div>


        {/* Descrição do Serviço */}
        <div style={{
          padding: '16px',
          margin: '0 0 16px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 6
        }}>
          <label style={{ color: '#6c3483', fontWeight: 600 }}>Descrição do Serviço:</label>
          <textarea
            value={form.descricao || ''}
            onChange={e => onChange('descricao', e.target.value)}
            maxLength={200}
            style={{
              width: '100%',
              maxWidth: '100%',
              border: '1.5px solid #d6d6f5',
              borderRadius: 6,
              padding: '8px 12px',
              fontSize: 16,
              resize: 'vertical',
              minHeight: 40,
              boxSizing: 'border-box',
            }}
            placeholder="Descreva o serviço a ser realizado..."
          />
        </div>

        {/* Origem do Pedido e Prazo */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
          marginBottom: '16px',
        }}>
          {/* Origem do Pedido */}
          <div style={{
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6
          }}>
            <label style={{ color: '#6c3483', fontWeight: 600 }}>Origem:</label>
            <select
              value={form.origem || ''}
              onChange={e => onChange('origem', e.target.value)}
              style={{
                width: '100%',
                border: '1.5px solid #d6d6f5',
                borderRadius: 6,
                padding: '8px 12px',
                fontSize: 16,
                marginBottom: 8,
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
            {/* Campo condicional conforme a origem */}
            {form.origem === 'CRC' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ color: '#6c3483', fontWeight: 600 }}>Protocolo CRC:</label>
                <input
                  type="text"
                  value={form.origemInfo || ''}
                  onChange={e => onChange('origemInfo', e.target.value)}
                  style={{
                    width: '100%',
                    border: '1.5px solid #d6d6f5',
                    borderRadius: 6,
                    padding: '8px 12px',
                    fontSize: 16,
                    boxSizing: 'border-box',
                  }}
                  placeholder="Digite o protocolo CRC"
                />
              </div>
            )}
            {form.origem === 'email' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ color: '#6c3483', fontWeight: 600 }}>E-mail:</label>
                <input
                  type="email"
                  value={form.origemInfo || ''}
                  onChange={e => onChange('origemInfo', e.target.value)}
                  style={{
                    width: '100%',
                    border: '1.5px solid #d6d6f5',
                    borderRadius: 6,
                    padding: '8px 12px',
                    fontSize: 16,
                    boxSizing: 'border-box',
                  }}
                  placeholder="Digite o e-mail de origem"
                />
              </div>
            )}
            {form.origem === 'Whatsapp' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ color: '#6c3483', fontWeight: 600 }}>Telefone Whatsapp:</label>
                <input
                  type="text"
                  value={form.origemInfo || ''}
                  onChange={e => onChange('origemInfo', e.target.value)}
                  style={{
                    width: '100%',
                    border: '1.5px solid #d6d6f5',
                    borderRadius: 6,
                    padding: '8px 12px',
                    fontSize: 16,
                    boxSizing: 'border-box',
                  }}
                  placeholder="Digite o telefone do Whatsapp"
                />
              </div>
            )}
            {form.origem === 'Malote Digital' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ color: '#6c3483', fontWeight: 600 }}>Nº de Rastreabilidade:</label>
                <input
                  type="text"
                  value={form.origemInfo || ''}
                  onChange={e => onChange('origemInfo', e.target.value)}
                  style={{
                    width: '100%',
                    border: '1.5px solid #d6d6f5',
                    borderRadius: 6,
                    padding: '8px 12px',
                    fontSize: 16,
                    boxSizing: 'border-box',
                  }}
                  placeholder="Digite o número de rastreabilidade"
                />
              </div>
            )}
            {form.origem === 'PJE' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ color: '#6c3483', fontWeight: 600 }}>Nº do Processo PJE:</label>
                <input
                  type="text"
                  value={form.origemInfo || ''}
                  onChange={e => onChange('origemInfo', e.target.value)}
                  style={{
                    width: '100%',
                    border: '1.5px solid #d6d6f5',
                    borderRadius: 6,
                    padding: '8px 12px',
                    fontSize: 16,
                    boxSizing: 'border-box',
                  }}
                  placeholder="Digite o número do processo PJE"
                />
              </div>
            )}
          </div>
          
          {/* Prazo Card */}
          <div style={{
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6
          }}>
            <label style={{ color: '#6c3483', fontWeight: 600 }}>Prazo estimado para entrega:</label>
            <input
              type="date"
              value={form.prazo}
              onChange={e => onChange('prazo', e.target.value)}
              style={{
                width: '100%',
                maxWidth: '100%',
                border: '1.5px solid #d6d6f5',
                borderRadius: 6,
                padding: '8px 12px',
                fontSize: 16,
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Valores e Observação */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
          marginBottom: '16px',
        }}>
          {/* Valor Adiantado Card */}
          <div style={{
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6
          }}>
            <label style={{ color: '#2874a6', fontWeight: 600 }}>Valor Adiantado pelo Usuário:</label>
            {valorAdiantadoDetalhes.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 6 }}>
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
                    padding: '8px 12px',
                    fontSize: 16,
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
                    padding: '8px 12px',
                    fontSize: 16,
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
                  <button type="button" onClick={() => handleRemoveValorAdiantadoDetalhe(idx)} style={{ background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontWeight: 'bold', cursor: 'pointer' }}>-</button>
                )}
              </div>
            ))}
            <button type="button" onClick={handleAddValorAdiantadoDetalhe} style={{ background: '#9b59b6', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 16px', fontWeight: 'bold', cursor: 'pointer', marginTop: 4 }}>Adicionar Pagamento</button>
          </div>
          {/* Observação Card */}
          <div style={{
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6
          }}>
            <label style={{ color: '#884ea0', fontWeight: 600 }}>Observação:</label>
            <textarea
              value={form.observacao || ''}
              onChange={e => onChange('observacao', e.target.value)}
              maxLength={150}
              style={{
                width: '100%',
                maxWidth: '100%',
                border: '1.5px solid #d2b4de',
                borderRadius: 6,
                padding: '8px 12px',
                fontSize: 16,
                resize: 'vertical',
                minHeight: 40,
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Adicionar Combo Card */}
        <div style={{
          padding: '16px',
          marginBottom: '16px',
        }}>
          <label style={{ fontWeight: 600, color: '#6c3483', marginRight: 12 }}>Adicionar Combo:</label>
          <select value={comboSelecionado} onChange={e => setComboSelecionado(e.target.value)} style={{ width: '60%', maxWidth: '100%', marginRight: 12, borderRadius: 6, padding: '6px 10px', border: '1.5px solid #d6d6f5', fontSize: 16, boxSizing: 'border-box' }}>
            <option value="">Selecione um combo...</option>
            {combosDisponiveis.map(c => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
          <button type="button" onClick={handleAdicionarCombo} style={{
            padding: '8px 20px',
            background: '#9b59b6',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontWeight: 'bold',
            fontSize: 15,
            cursor: 'pointer',
            transition: 'all 0.3s ease'
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
                            position: 'fixed',
                            background: '#fff',
                            border: '1px solid #ccc',
                            borderRadius: 4,
                            margin: 0,
                            padding: '4px 0',
                            listStyle: 'none',
                            zIndex: 9999,
                            width: 220,
                            left: (() => {
                              // Calcula a posição do input na tela
                              const input = document.querySelectorAll('input[type="text"]')[idx];
                              if (input) {
                                const rect = input.getBoundingClientRect();
                                return rect.left;
                              }
                              return 0;
                            })(),
                            top: (() => {
                              const input = document.querySelectorAll('input[type="text"]')[idx];
                              if (input) {
                                const rect = input.getBoundingClientRect();
                                return rect.bottom;
                              }
                              return 0;
                            })(),
                            fontSize: 10
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
          padding: '16px',
          marginBottom: '16px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 16
        }}>
          <button
            onClick={handleSubmit}
            style={{
              padding: '12px 32px',
              background: '#2ecc71',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontWeight: 'bold',
              fontSize: 18,
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
              padding: '12px 32px',
              background: '#9b59b6',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontWeight: 'bold',
              fontSize: 18,
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

