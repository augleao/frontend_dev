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
  const navigate = useNavigate();

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
    // Adiciona cada ato como uma linha separada
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

  const buscarCodigosTributarios = async (term) => {
    if (term.trim() === '') {
      setCodigoTributarioSuggestions([]);
      return;
    }
    
    setLoadingCodigoTributario(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
  `${config.apiURL}/codigos-gratuitos?search=${encodeURIComponent(term)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      if (res.ok) {
        setCodigoTributarioSuggestions(data.codigos || []);
      } else {
        setCodigoTributarioSuggestions([]);
      }
    } catch (error) {
      console.error('Erro ao buscar códigos tributários:', error);
      setCodigoTributarioSuggestions([]);
    }
    setLoadingCodigoTributario(false);
  };

  const handleCodigoTributarioInput = (idx, value) => {
    setCodigoTributarioTerm(value);
    setCodigoTributarioIdx(idx);
    handleAtoChange(idx, 'codigoTributario', value);
    buscarCodigosTributarios(value);
  };

  // Função para selecionar código tributário
  const handleSelectCodigoTributario = (codigo) => {
    if (codigoTributarioIdx !== null) {
      handleAtoChange(codigoTributarioIdx, 'codigoTributario', codigo.codigo);
      setCodigoTributarioTerm('');
      setCodigoTributarioSuggestions([]);
      setCodigoTributarioIdx(null);
    }
  };

  // Altera quantidade ou código tributário de um ato
  const handleAtoChange = (idx, field, value) => {
    setAtosPedido(prev =>
      prev.map((a, i) =>
        i === idx ? { ...a, [field]: value } : a
      )
    );
  };

  // Remove ato do pedido
  const handleRemoverAto = idx => {
    setAtosPedido(prev => prev.filter((_, i) => i !== idx));
  };

  // Função para envio do pedido
  const handleSubmit = async () => {
    const token = localStorage.getItem('token');
    // Supondo que o nome do usuário está em localStorage ou contexto
    //const usuario = form.usuario?.nome || form.usuario || '';
    // ou, se estiver no localStorage:
    const usuarioObj = JSON.parse(localStorage.getItem('usuario') || '{}');
    const usuario = usuarioObj.nome || '';

    // Prepara os dados para envio
    const dadosParaEnvio = {
      ...form,
      clienteId: form.clienteId || null, // Converte string vazia para null
      valorAdiantado: form.valorAdiantado || 0, // Garante que seja número
      combos: atosPedido.map(ato => ({
        combo_id: ato.comboId,
        combo_nome: ato.comboNome,
        ato_id: ato.atoId,
        ato_codigo: ato.atoCodigo,
        ato_descricao: ato.atoDescricao,
        quantidade: ato.quantidade || 1,
        codigo_tributario: ato.codigoTributario || ''
      })),
      usuario
    };

    console.log('=== DADOS SENDO ENVIADOS PARA O BACKEND ===');
    console.log('Dados formatados para envio:', dadosParaEnvio);
    console.log('=== FIM DOS DADOS ===');

    // Detecta se é atualização (protocolo existe) ou criação (novo pedido)
    const isUpdate = form.protocolo && form.protocolo.trim() !== '';
    
    console.log(`Operação: ${isUpdate ? 'ATUALIZAÇÃO' : 'CRIAÇÃO'} - Método: POST`);
    console.log(`URL: ${config.apiURL}/pedidos`);

    try {
      const res = await fetch(`${config.apiURL}/pedidos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(dadosParaEnvio)
      });
      
      if (res.ok) {
        // Pedido enviado com sucesso
        const data = await res.json();
        console.log('Operação realizada com sucesso:', data);
        
        const mensagem = isUpdate 
          ? `Pedido ${form.protocolo} atualizado com sucesso!`
          : 'Novo pedido criado com sucesso!';
        
        alert(mensagem);
        
        // Se foi uma atualização, recarrega a página para mostrar os dados atualizados
        if (isUpdate) {
          // Force reload by navigating to the same URL
          window.location.reload();
        } else if (data.protocolo) {
          // Se foi criação e retornou protocolo, navega para a página de edição
          // Use a mesma rota atual com o novo protocolo
          // Navega sempre para a rota correta de manutenção do serviço
          navigate(`/servicos/manutencao?protocolo=${encodeURIComponent(data.protocolo)}`);
        }
      } else {
        // Tratar erro no envio do pedido
        const errorText = await res.text();
        console.error('Erro ao enviar pedido:', res.status, res.statusText, errorText);
        
        const mensagem = isUpdate 
          ? `Erro ao atualizar pedido: ${res.status}`
          : `Erro ao criar pedido: ${res.status}`;
        
        alert(mensagem);
      }
    } catch (error) {
      console.error('Erro ao enviar pedido:', error);
    }
  };

  return (
    <div style={{ background: '#f4f6fb', minHeight: '100vh', padding: '32px 0' }}>
      <div style={{
        maxWidth: 900,
        margin: '0 auto',
        padding: 0,
        borderRadius: '24px',
        border: '3px solid #9b59b6',
        boxShadow: '0 6px 32px rgba(155,89,182,0.10)',
        background: '#fff',
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
            Entrada do Serviço
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
            padding: '24px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}>
            <label style={{ color: '#229954', fontWeight: 600 }}>Valor total dos atos pagos (código tributário 01):</label>
            <div style={{
              background: '#eafaf1',
              borderRadius: 8,
              padding: '16px',
              border: '2px solid #229954',
              fontFamily: 'monospace',
              fontSize: 20,
              fontWeight: 'bold',
              color: '#229954',
              textAlign: 'right',
              boxShadow: '0 2px 8px rgba(34,153,84,0.08)'
            }}>
              {(() => {
                const total = calcularTotalAtosPagos();
                console.log('Valor exibido na tela (total dos atos pagos):', total);
                return `R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
              })()}
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
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.valorAdiantado || ''}
              onChange={e => onChange('valorAdiantado', e.target.value)}
              style={{
                width: '100%',
                maxWidth: '100%',
                border: '1.5px solid #aed6f1',
                borderRadius: 6,
                padding: '8px 12px',
                fontSize: 16,
                boxSizing: 'border-box',
              }}
            />
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
            padding: '24px',
            marginBottom: '24px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)'
          }}>
            <h3 style={{
              margin: '0 0 20px 0',
              color: '#2c3e50',
              fontSize: '18px',
              fontWeight: '600',
              borderBottom: '2px solid #9b59b6',
              paddingBottom: '10px'
            }}>
              📋 Atos adicionados ao pedido
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  marginBottom: 12,
                  tableLayout: 'fixed',
                  fontSize: 15
                }}
              >
                <thead>
                  <tr style={{ background: '#f0f0f0' }}>
                    <th style={{ padding: 8 }}>Combo</th>
                    <th style={{ padding: 8 }}>Código do Ato</th>
                    <th style={{ padding: 8 }}>Descrição do Ato</th>
                    <th style={{ padding: 8 }}>Quantidade</th>
                    <th style={{ padding: 8 }}>Código Tributário</th>
                    <th style={{ padding: 8 }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {atosPedido.map((ato, idx) => (
                    <tr key={`${ato.comboId}-${ato.atoId}-${idx}`}>
                      <td style={{ padding: 8 }}>{ato.comboNome}</td>
                      <td style={{ padding: 8 }}>{ato.atoCodigo}</td>
                      <td style={{ padding: 8 }}>{ato.atoDescricao ? ato.atoDescricao.slice(0, 15) : ''}</td>
                      <td style={{ padding: 8 }}>
                        <input
                          type="number"
                          min={1}
                          value={ato.quantidade}
                          onChange={e => handleAtoChange(idx, 'quantidade', Number(e.target.value))}
                          style={{ width: '100%', maxWidth: 80, borderRadius: 6, border: '1.5px solid #d6d6f5', padding: '4px 8px', fontSize: 15, boxSizing: 'border-box' }}
                        />
                      </td>
                      <td style={{ padding: 8, position: 'relative' }}>
                        <input
                          type="text"
                          value={ato.codigoTributario}
                          onChange={e => handleCodigoTributarioInput(idx, e.target.value)}
                          style={{ width: '100%', maxWidth: 140, borderRadius: 6, border: '1.5px solid #d6d6f5', padding: '4px 8px', fontSize: 15, boxSizing: 'border-box' }}
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
                            zIndex: 10,
                            width: 180,
                            left: 0,
                            top: 36
                          }}>
                            {codigoTributarioSuggestions.map(sug => (
                              <li
                                key={sug.codigo}
                                style={{
                                  padding: '4px 8px',
                                  cursor: 'pointer',
                                  fontSize: 15
                                }}
                                onClick={() => handleSelectCodigoTributario(sug)}
                              >
                                {sug.codigo} - {sug.descricao}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td style={{ padding: 8 }}>
                        <button
                          type="button"
                          onClick={() => handleRemoverAto(idx)}
                          style={{
                            background: '#e74c3c',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 8,
                            padding: '6px 18px',
                            fontWeight: 'bold',
                            fontSize: 15,
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

