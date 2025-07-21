import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import config from '../../config';

export default function ServicoEntrada({ form, tiposServico, onChange, combosDisponiveis, atosPedido, setAtosPedido }) {
  const [comboSelecionado, setComboSelecionado] = useState('');
  const [codigoTributarioSuggestions, setCodigoTributarioSuggestions] = useState([]);
  const [loadingCodigoTributario, setLoadingCodigoTributario] = useState(false);
  const [codigoTributarioTerm, setCodigoTributarioTerm] = useState('');
  const [codigoTributarioIdx, setCodigoTributarioIdx] = useState(null);
  const navigate = useNavigate();

  // Função para calcular o valor previsto dos atos pagos (código tributário "01")
  const calcularValorPrevisto = () => {
    return atosPedido
      .filter(ato => ato.codigoTributario === '01')
      .reduce((total, ato) => {
        // Busca o ato correspondente no combo para obter o valor
        const combo = combosDisponiveis.find(c => c.id === ato.comboId);
        if (combo && combo.atos) {
          const atoDoCombo = combo.atos.find(a => a.id === ato.atoId);
          if (atoDoCombo) {
            const valorUnitario = parseFloat(atoDoCombo.valor_final || atoDoCombo.valor_unitario || 0);
            return total + (valorUnitario * (ato.quantidade || 1));
          }
        }
        return total;
      }, 0);
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
          const currentPath = window.location.pathname;
          navigate(`${currentPath}?protocolo=${encodeURIComponent(data.protocolo)}`);
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
    <div
      style={{
        background: '#f8fafc',
        borderRadius: 16,
        padding: 28,
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
        marginBottom: 24,
        border: '1px solid #e2e8f0'
      }}
    >
      <h3 style={{
        color: '#2d3748',
        fontSize: '20px',
        fontWeight: '700',
        marginBottom: 20,
        borderBottom: '2px solid #667eea',
        paddingBottom: 8
      }}>Entrada do Serviço</h3>
      {/* Exibe o protocolo apenas se existir */}
      {form.protocolo && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ 
            fontWeight: '600', 
            color: '#4a5568',
            fontSize: '14px',
            display: 'block',
            marginBottom: 6
          }}>Número de Protocolo:</label>
          <div style={{
            background: '#edf2f7',
            borderRadius: 8,
            padding: '12px 16px',
            fontFamily: 'monospace',
            fontSize: 16,
            fontWeight: '600',
            color: '#2d3748',
            border: '1px solid #cbd5e0'
          }}>
            {form.protocolo}
          </div>
        </div>
      )}
      <div style={{ marginBottom: 16 }}>
        <label style={{ 
          fontWeight: '600', 
          color: '#4a5568',
          fontSize: '14px',
          display: 'block',
          marginBottom: 6
        }}>Prazo estimado para entrega:</label>
        <input
          type="date"
          value={form.prazo}
          onChange={e => onChange('prazo', e.target.value)}
          style={{ 
            width: '100%', 
            padding: '12px 16px',
            borderRadius: 8,
            border: '1px solid #cbd5e0',
            fontSize: '14px',
            backgroundColor: 'white',
            transition: 'border-color 0.2s ease'
          }}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ 
          fontWeight: '600', 
          color: '#4a5568',
          fontSize: '14px',
          display: 'block',
          marginBottom: 6
        }}>Valor previsto para o serviço:</label>
        <div style={{
          background: '#f0fff4',
          borderRadius: 8,
          padding: '12px 16px',
          border: '2px solid #68d391',
          fontFamily: 'monospace',
          fontSize: 18,
          fontWeight: 'bold',
          color: '#22543d',
          textAlign: 'right'
        }}>
          R$ {calcularValorPrevisto().toFixed(2)}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ 
          fontWeight: '600', 
          color: '#4a5568',
          fontSize: '14px',
          display: 'block',
          marginBottom: 6
        }}>Valor Adiantado pelo Usuário:</label>
        <input
          type="number"
          min={0}
          step="0.01"
          value={form.valorAdiantado || ''}
          onChange={e => onChange('valorAdiantado', e.target.value)}
          style={{ 
            width: '100%', 
            padding: '12px 16px',
            borderRadius: 8,
            border: '1px solid #cbd5e0',
            fontSize: '14px',
            backgroundColor: 'white',
            transition: 'border-color 0.2s ease'
          }}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ 
          fontWeight: '600', 
          color: '#4a5568',
          fontSize: '14px',
          display: 'block',
          marginBottom: 6
        }}>OBS.:</label>
        <textarea
          value={form.observacao || ''}
          onChange={e => onChange('observacao', e.target.value)}
          maxLength={150}
          style={{ 
            width: '100%', 
            padding: '12px 16px',
            borderRadius: 8,
            border: '1px solid #cbd5e0',
            fontSize: '14px',
            backgroundColor: 'white',
            resize: 'vertical', 
            minHeight: 60,
            transition: 'border-color 0.2s ease'
          }}
        />
      </div>

      <hr style={{ 
        margin: '24px 0', 
        border: 'none', 
        height: '1px', 
        background: 'linear-gradient(to right, transparent, #cbd5e0, transparent)' 
      }} />

      <div style={{ marginBottom: 20 }}>
        <label style={{ 
          fontWeight: '600', 
          color: '#4a5568',
          fontSize: '14px',
          display: 'block',
          marginBottom: 6
        }}>Adicionar Combo:</label>
        <div style={{ display: 'flex', gap: 12, alignItems: 'end' }}>
          <select 
            value={comboSelecionado} 
            onChange={e => setComboSelecionado(e.target.value)} 
            style={{ 
              flex: 1,
              padding: '12px 16px',
              borderRadius: 8,
              border: '1px solid #cbd5e0',
              fontSize: '14px',
              backgroundColor: 'white'
            }}
          >
            <option value="">Selecione um combo...</option>
            {combosDisponiveis.map(c => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
          <button 
            type="button" 
            onClick={handleAdicionarCombo} 
            style={{
              padding: '12px 20px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontWeight: 'bold',
              fontSize: 14,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(102,126,234,0.3)',
              transition: 'all 0.2s ease'
            }}
          >
            Adicionar
          </button>
        </div>
      </div>

      {atosPedido.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h4 style={{
            color: '#2d3748',
            fontSize: '16px',
            fontWeight: '600',
            marginBottom: 16
          }}>Atos adicionados ao pedido:</h4>
          <div style={{ 
            background: 'white',
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            border: '1px solid #e2e8f0'
          }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse'
            }}>
              <thead>
                <tr style={{ background: '#f7fafc' }}>
                  <th style={{ 
                    padding: '16px 12px', 
                    textAlign: 'left',
                    fontWeight: '600',
                    color: '#4a5568',
                    fontSize: '14px',
                    borderBottom: '2px solid #e2e8f0'
                  }}>Combo</th>
                  <th style={{ 
                    padding: '16px 12px', 
                    textAlign: 'left',
                    fontWeight: '600',
                    color: '#4a5568',
                    fontSize: '14px',
                    borderBottom: '2px solid #e2e8f0'
                  }}>Código do Ato</th>
                  <th style={{ 
                    padding: '16px 12px', 
                    textAlign: 'left',
                    fontWeight: '600',
                    color: '#4a5568',
                    fontSize: '14px',
                    borderBottom: '2px solid #e2e8f0'
                  }}>Descrição do Ato</th>
                  <th style={{ 
                    padding: '16px 12px', 
                    textAlign: 'center',
                    fontWeight: '600',
                    color: '#4a5568',
                    fontSize: '14px',
                    borderBottom: '2px solid #e2e8f0'
                  }}>Quantidade</th>
                  <th style={{ 
                    padding: '16px 12px', 
                    textAlign: 'left',
                    fontWeight: '600',
                    color: '#4a5568',
                    fontSize: '14px',
                    borderBottom: '2px solid #e2e8f0'
                  }}>Código Tributário</th>
                  <th style={{ 
                    padding: '16px 12px', 
                    textAlign: 'center',
                    fontWeight: '600',
                    color: '#4a5568',
                    fontSize: '14px',
                    borderBottom: '2px solid #e2e8f0'
                  }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {atosPedido.map((ato, idx) => (
                  <tr key={`${ato.comboId}-${ato.atoId}-${idx}`} style={{
                    borderBottom: '1px solid #e2e8f0',
                    transition: 'background-color 0.2s ease'
                  }}>
                    <td style={{ 
                      padding: '12px', 
                      fontSize: '14px',
                      color: '#2d3748'
                    }}>{ato.comboNome}</td>
                    <td style={{ 
                      padding: '12px', 
                      fontSize: '14px',
                      color: '#2d3748',
                      fontWeight: '600'
                    }}>{ato.atoCodigo}</td>
                    <td style={{ 
                      padding: '12px', 
                      fontSize: '14px',
                      color: '#2d3748'
                    }}>
                      {ato.atoDescricao ? ato.atoDescricao.slice(0, 15) : ''}
                    </td>
                    <td style={{ 
                      padding: '12px',
                      textAlign: 'center'
                    }}>
                      <input
                        type="number"
                        min={1}
                        value={ato.quantidade}
                        onChange={e => handleAtoChange(idx, 'quantidade', Number(e.target.value))}
                        style={{ 
                          width: 70,
                          padding: '6px 10px',
                          borderRadius: 6,
                          border: '1px solid #cbd5e0',
                          textAlign: 'center',
                          fontSize: '14px'
                        }}
                      />
                    </td>
                    <td style={{ 
                      padding: '12px',
                      position: 'relative'
                    }}>
                      <input
                        type="text"
                        value={ato.codigoTributario}
                        onChange={e => handleCodigoTributarioInput(idx, e.target.value)}
                        style={{ 
                          width: 140,
                          padding: '6px 10px',
                          borderRadius: 6,
                          border: '1px solid #cbd5e0',
                          fontSize: '14px'
                        }}
                        autoComplete="off"
                      />
                      {/* Sugestões de autocomplete */}
                      {codigoTributarioIdx === idx && codigoTributarioSuggestions.length > 0 && (
                        <ul style={{
                          position: 'absolute',
                          background: '#fff',
                          border: '1px solid #e2e8f0',
                          borderRadius: 8,
                          margin: 0,
                          padding: '8px 0',
                          listStyle: 'none',
                          zIndex: 10,
                          width: 200,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                        }}>
                          {codigoTributarioSuggestions.map(sug => (
                            <li
                              key={sug.codigo}
                              style={{
                                padding: '8px 12px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                borderBottom: '1px solid #f1f5f9'
                              }}
                              onClick={() => handleSelectCodigoTributario(sug)}
                            >
                              {sug.codigo} - {sug.descricao}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td style={{ 
                      padding: '12px',
                      textAlign: 'center'
                    }}>
                      <button
                        type="button"
                        onClick={() => handleRemoverAto(idx)}
                        style={{
                          background: 'linear-gradient(135deg, #e53e3e 0%, #c53030 100%)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 8,
                          padding: '8px 16px',
                          fontWeight: 'bold',
                          fontSize: 12,
                          cursor: 'pointer',
                          boxShadow: '0 2px 6px rgba(197,48,48,0.3)',
                          transition: 'all 0.2s ease'
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

      <button
        onClick={handleSubmit}
        style={{
          marginTop: 24,
          padding: '16px 32px',
          background: 'linear-gradient(135deg, #38a169 0%, #2f855a 100%)',
          color: '#fff',
          border: 'none',
          borderRadius: 12,
          fontWeight: 'bold',
          fontSize: 16,
          cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(56,161,105,0.3)',
          transition: 'all 0.3s ease',
          width: '100%'
        }}
      >
        {form.protocolo && form.protocolo.trim() !== '' ? 'Atualizar Pedido' : 'Salvar Pedido'}
      </button>
    </div>
  );
}

