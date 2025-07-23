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
              padding: 0,
              width: '100%',
              minWidth: 0,
            }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  marginBottom: 0,
                  tableLayout: 'fixed',
                  fontSize: 11,
                  background: 'transparent',
                  minWidth: 600,
                }}
              >
                <thead>
                  <tr style={{ background: '#ede1f7' }}>
                    <th style={{ padding: 4, color: '#6c3483', fontWeight: 700, fontSize: 11 }}>Combo</th>
                    <th style={{ padding: 4, color: '#6c3483', fontWeight: 700, fontSize: 11 }}>Código do Ato</th>
                    <th style={{ padding: 4, color: '#6c3483', fontWeight: 700, fontSize: 11 }}>Descrição do Ato</th>
                    <th style={{ padding: 4, color: '#6c3483', fontWeight: 700, fontSize: 11 }}>Quantidade</th>
                    <th style={{ padding: 4, color: '#6c3483', fontWeight: 700, fontSize: 11 }}>Código Tributário</th>
                    <th style={{ padding: 4, color: '#6c3483', fontWeight: 700, fontSize: 11 }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {atosPedido.map((ato, idx) => (
                    <tr key={`${ato.comboId}-${ato.atoId}-${idx}`} style={{ background: idx % 2 === 0 ? '#f8f4fc' : 'transparent' }}>
                      <td style={{ padding: 4 }}>{ato.comboNome}</td>
                      <td style={{ padding: 4 }}>{ato.atoCodigo}</td>
                      <td style={{ padding: 4 }}>{ato.atoDescricao ? ato.atoDescricao.slice(0, 15) : ''}</td>
                      <td style={{ padding: 4 }}>
                        <input
                          type="number"
                          min={1}
                          value={ato.quantidade}
                          onChange={e => handleAtoChange(idx, 'quantidade', Number(e.target.value))}
                          style={{ width: '100%', maxWidth: 50, borderRadius: 6, border: '1.5px solid #d6d6f5', padding: '1px 4px', fontSize: 11, boxSizing: 'border-box' }}
                        />
                      </td>
                      <td style={{ padding: 4, position: 'relative' }}>
                        <input
                          type="text"
                          value={ato.codigoTributario}
                          onChange={e => handleCodigoTributarioInput(idx, e.target.value)}
                          style={{ width: '100%', maxWidth: 80, borderRadius: 6, border: '1.5px solid #d6d6f5', padding: '1px 4px', fontSize: 11, boxSizing: 'border-box' }}
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
                            width: 100,
                            left: 0,
                            top: 20
                          }}>
                            {codigoTributarioSuggestions.map(sug => (
                              <li
                                key={sug.codigo}
                                style={{
                                  padding: '4px 8px',
                                  cursor: 'pointer',
                                  fontSize: 11
                                }}
                                onClick={() => handleSelectCodigoTributario(sug)}
                              >
                                {sug.codigo} - {sug.descricao}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td style={{ padding: 4 }}>
                        <button
                          type="button"
                          onClick={() => handleRemoverAto(idx)}
                          style={{
                            background: '#e74c3c',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 8,
                            padding: '2px 8px',
                            fontWeight: 'bold',
                            fontSize: 11,
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
    <div style={{ background: '#fff', minHeight: '100vh', padding: '32px 0' }}>
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
                    <th style={{ padding: 6, color: '#6c3483', fontWeight: 700, fontSize: 13 }}>Combo</th>
                    <th style={{ padding: 6, color: '#6c3483', fontWeight: 700, fontSize: 13 }}>Código do Ato</th>
                    <th style={{ padding: 6, color: '#6c3483', fontWeight: 700, fontSize: 13 }}>Descrição do Ato</th>
                    <th style={{ padding: 6, color: '#6c3483', fontWeight: 700, fontSize: 13 }}>Quantidade</th>
                    <th style={{ padding: 6, color: '#6c3483', fontWeight: 700, fontSize: 13 }}>Código Tributário</th>
                    <th style={{ padding: 6, color: '#6c3483', fontWeight: 700, fontSize: 13 }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {atosPedido.map((ato, idx) => (
                    <tr key={`${ato.comboId}-${ato.atoId}-${idx}`} style={{ background: idx % 2 === 0 ? '#f8f4fc' : 'transparent' }}>
                      <td style={{ padding: 6 }}>{ato.comboNome}</td>
                      <td style={{ padding: 6 }}>{ato.atoCodigo}</td>
                      <td style={{ padding: 6 }}>{ato.atoDescricao ? ato.atoDescricao.slice(0, 15) : ''}</td>
                      <td style={{ padding: 6 }}>
                        <input
                          type="number"
                          min={1}
                          value={ato.quantidade}
                          onChange={e => handleAtoChange(idx, 'quantidade', Number(e.target.value))}
                          style={{ width: '100%', maxWidth: 60, borderRadius: 6, border: '1.5px solid #d6d6f5', padding: '2px 6px', fontSize: 13, boxSizing: 'border-box' }}
                        />
                      </td>
                      <td style={{ padding: 6, position: 'relative' }}>
                        <input
                          type="text"
                          value={ato.codigoTributario}
                          onChange={e => handleCodigoTributarioInput(idx, e.target.value)}
                          style={{ width: '100%', maxWidth: 100, borderRadius: 6, border: '1.5px solid #d6d6f5', padding: '2px 6px', fontSize: 13, boxSizing: 'border-box' }}
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
                            width: 140,
                            left: 0,
                            top: 28
                          }}>
                            {codigoTributarioSuggestions.map(sug => (
                              <li
                                key={sug.codigo}
                                style={{
                                  padding: '4px 8px',
                                  cursor: 'pointer',
                                  fontSize: 13
                                }}
                                onClick={() => handleSelectCodigoTributario(sug)}
                              >
                                {sug.codigo} - {sug.descricao}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td style={{ padding: 6 }}>
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
                            fontSize: 13,
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

