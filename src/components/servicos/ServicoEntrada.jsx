
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import config from '../../config';

export default function ServicoEntrada({ form, tiposServico, onChange, combosDisponiveis, atosPedido, setAtosPedido }) {
  console.log('PROPS atosPedido recebidos em ServicoEntrada:', atosPedido);
  const [comboSelecionado, setComboSelecionado] = useState('');
  const [codigoTributarioSuggestions, setCodigoTributarioSuggestions] = useState([]);
  const [loadingCodigoTributario, setLoadingCodigoTributario] = useState(false);
  const [codigoTributarioTerm, setCodigoTributarioTerm] = useState('');
  const [codigoTributarioIdx, setCodigoTributarioIdx] = useState(null);
  const [valorAdiantadoDetalhes, setValorAdiantadoDetalhes] = useState(
    form.valorAdiantadoDetalhes || [ { valor: '', forma: '' } ]
  );
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

export default function ServicoEntrada({ form, tiposServico, onChange, combosDisponiveis, atosPedido, setAtosPedido }) {
  console.log('PROPS atosPedido recebidos em ServicoEntrada:', atosPedido);
  const [comboSelecionado, setComboSelecionado] = useState('');
  const [codigoTributarioSuggestions, setCodigoTributarioSuggestions] = useState([]);
  const [loadingCodigoTributario, setLoadingCodigoTributario] = useState(false);
  const [codigoTributarioTerm, setCodigoTributarioTerm] = useState('');
  const [codigoTributarioIdx, setCodigoTributarioIdx] = useState(null);
  const [valorAdiantadoDetalhes, setValorAdiantadoDetalhes] = useState(
    form.valorAdiantadoDetalhes || [ { valor: '', forma: '' } ]
  );
  const navigate = useNavigate();

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
    if (value.length >= 2) {
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
      // Inclui valor adiantado e forma de pagamento no payload
      const body = JSON.stringify({
        ...form,
        descricao: form.descricao || '',
        origem: form.origem || '',
        origemInfo: form.origemInfo || '',
        valorAdiantadoDetalhes,
        combos
      });
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
      if (res.ok) {
        // Pedido enviado com sucesso
        console.log('Operação realizada com sucesso:', data);
        const mensagem = (form.protocolo && form.protocolo.trim() !== '')
          ? `Pedido ${form.protocolo} atualizado com sucesso!`
          : 'Novo pedido criado com sucesso!';
        alert(mensagem);
        // Se foi uma atualização, recarrega a página para mostrar os dados atualizados
        if (form.protocolo && form.protocolo.trim() !== '') {
          window.location.reload();
        } else if (data.protocolo) {
          navigate(`/servicos/manutencao?protocolo=${encodeURIComponent(data.protocolo)}`);
        }
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

  return (
    <div style={{ background: '#f5e6fa', minHeight: '100vh', padding: '0', borderRadius: '24px' }}>
      <div style={{
        maxWidth: 900,
        margin: '0 auto',
        padding: 0,
        borderRadius: '24px',
        border: '3px solid #9b59b6',
        boxShadow: '0 6px 32px rgba(155,89,182,0.10)',
        background: '#f5e6fa',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '28px 32px 18px 32px',
          marginBottom: '24px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <h2 style={{ margin: 0, color: '#2c3e50', fontWeight: 700, fontSize: 28 }}>
            Entrada:
          </h2>
          {form.protocolo && (
            <div style={{
              background: '#f8f9fa',
              borderRadius: 8,
              padding: '10px 18px',
              fontFamily: 'monospace',
              fontSize: 18,
              color: '#6c3483',
              fontWeight: 600,
              border: '2px solid #9b59b6',
              boxShadow: '0 2px 8px rgba(155,89,182,0.08)'
            }}>
              Protocolo: {form.protocolo}
            </div>
          )}
        </div>


        {/* Descrição do Serviço */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '24px',
          margin: '0 0 24px 0',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8
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

        {/* Origem do Pedido */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '24px',
          margin: '0 0 24px 0',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8
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

        {/* Cards Section */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '24px',
          marginBottom: '24px',
        }}>
          {/* Prazo Card */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8
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
          {/* Valor Atos Pagos Card */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '18px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}>
            <div style={{
              background: '#eafaf1',
              borderRadius: 8,
              padding: '10px 18px',
              fontFamily: 'monospace',
              fontSize: 18,
              color: '#229954',
              fontWeight: 600,
              border: '2px solid #229954',
              boxShadow: '0 2px 8px rgba(34,153,84,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              minHeight: 40,
              gap: 12,
            }}>
              <span style={{ color: '#229954', fontWeight: 600, fontFamily: 'inherit', fontSize: 18 }}>
                Valor:
              </span>
              <span style={{ color: '#229954', fontWeight: 600, fontFamily: 'inherit', fontSize: 18 }}>
                {(() => {
                  const total = calcularTotalAtosPagos();
                  console.log('Valor exibido na tela (total dos atos pagos):', total);
                  return `R$${total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                })()}
              </span>
            </div>
          </div>
        </div>

        {/* Valores e Observação */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '24px',
          marginBottom: '24px',
        }}>
          {/* Valor Adiantado Card */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8
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
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8
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
          background: 'white',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
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
            background: 'white',
            borderRadius: '12px',
            padding: '18px',
            marginBottom: '24px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)'
          }}>
            <h3 style={{
              margin: '0 0 20px 0',
              color: '#2c3e50',
              fontSize: '16px',
              fontWeight: '600',
              borderBottom: '2px solid #9b59b6',
              paddingBottom: '10px',
              letterSpacing: 0.5
            }}>
              📋 Atos adicionados ao pedido
            </h3>
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

        {/* Salvar/Atualizar Button */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          textAlign: 'center'
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
        </div>
      </div>
    </div>
  );
}

