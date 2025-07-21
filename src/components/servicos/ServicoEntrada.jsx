import React, { useEffect, useState } from 'react';
import config from '../../config';

export default function ServicoEntrada({ form, tiposServico, onChange, combosDisponiveis, atosPedido, setAtosPedido }) {
  const [comboSelecionado, setComboSelecionado] = useState('');
  const [codigoTributarioSuggestions, setCodigoTributarioSuggestions] = useState([]);
  const [loadingCodigoTributario, setLoadingCodigoTributario] = useState(false);
  const [codigoTributarioTerm, setCodigoTributarioTerm] = useState('');
  const [codigoTributarioIdx, setCodigoTributarioIdx] = useState(null);

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

    try {
      const res = await fetch(`${config.apiURL}/pedidos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          tipo: form.tipo,
          descricao: form.descricao,
          prazo: form.prazo,
          clienteId: form.clienteId,
          combos: atosPedido,
          usuario // <-- adicione esta linha
        })
      });
      
      if (res.ok) {
        // Pedido enviado com sucesso
        const data = await res.json();
        console.log('Pedido enviado:', data);
        // Aqui você pode adicionar um feedback para o usuário, como um alerta ou uma notificação
      } else {
        // Tratar erro no envio do pedido
        console.error('Erro ao enviar pedido:', res.status, res.statusText);
      }
    } catch (error) {
      console.error('Erro ao enviar pedido:', error);
    }
  };

  return (
    <div
      style={{
        border: '2px solid #3498db',
        borderRadius: 12,
        padding: 24,
        background: '#fafcff',
        boxShadow: '0 2px 8px rgba(52,152,219,0.08)',
        marginBottom: 24
      }}
    >
      <h3>Entrada do Serviço</h3>
      {/* Exibe o protocolo apenas se existir */}
      {form.protocolo && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontWeight: 600, color: '#555' }}>Número de Protocolo:</label>
          <div style={{
            background: '#f4f4f4',
            borderRadius: 6,
            padding: '8px 12px',
            fontFamily: 'monospace',
            fontSize: 16,
            color: '#333'
          }}>
            {form.protocolo}
          </div>
        </div>
      )}
      <label>Prazo estimado para entrega:</label>
      <input
        type="date"
        value={form.prazo}
        onChange={e => onChange('prazo', e.target.value)}
        style={{ width: '100%', marginBottom: 8 }}
      />

      <label>Valor Adiantado pelo Usuário:</label>
      <input
        type="number"
        min={0}
        step="0.01"
        value={form.valorAdiantado || ''}
        onChange={e => onChange('valorAdiantado', e.target.value)}
        style={{ width: '100%', marginBottom: 8 }}
      />

      <label>OBS.:</label>
      <textarea
        value={form.observacao || ''}
        onChange={e => onChange('observacao', e.target.value)}
        maxLength={150}
        style={{ width: '100%', marginBottom: 8, resize: 'vertical', minHeight: 40 }}
      />

      <hr style={{ margin: '18px 0' }} />

      <label>Adicionar Combo:</label>
      <select value={comboSelecionado} onChange={e => setComboSelecionado(e.target.value)} style={{ width: '70%', marginRight: 8 }}>
        <option value="">Selecione um combo...</option>
        {combosDisponiveis.map(c => (
          <option key={c.id} value={c.id}>{c.nome}</option>
        ))}
      </select>
      <button type="button" onClick={handleAdicionarCombo} style={{
        padding: '6px 16px',
        background: '#3498db',
        color: '#fff',
        border: 'none',
        borderRadius: 6,
        fontWeight: 'bold',
        fontSize: 14,
        cursor: 'pointer'
      }}>
        Adicionar
      </button>

      {atosPedido.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <h4>Atos adicionados ao pedido:</h4>
          <table
            style={{
              width: '100%',
              maxWidth: '100%',
              borderCollapse: 'collapse',
              marginBottom: 12,
              tableLayout: 'fixed'
            }}
          >
            <thead>
              <tr style={{ background: '#f0f0f0' }}>
                <th>Combo</th>
                <th>Código do Ato</th>
                <th>Descrição do Ato</th>
                <th>Quantidade</th>
                <th>Código Tributário</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {atosPedido.map((ato, idx) => (
                <tr key={`${ato.comboId}-${ato.atoId}-${idx}`}>
                  <td>{ato.comboNome}</td>
                  <td>{ato.atoCodigo}</td>
                  <td>
                    {/* Exibe apenas o texto, limitado a 15 caracteres */}
                    {ato.atoDescricao ? ato.atoDescricao.slice(0, 15) : ''}
                  </td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      value={ato.quantidade}
                      onChange={e => handleAtoChange(idx, 'quantidade', Number(e.target.value))}
                      style={{ width: 60 }}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={ato.codigoTributario}
                      onChange={e => handleCodigoTributarioInput(idx, e.target.value)}
                      style={{ width: 120 }}
                      autoComplete="off"
                    />
                    {/* Sugestões de autocomplete */}
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
                        width: 120
                      }}>
                        {codigoTributarioSuggestions.map(sug => (
                          <li
                            key={sug.codigo}
                            style={{
                              padding: '4px 8px',
                              cursor: 'pointer'
                            }}
                            onClick={() => handleSelectCodigoTributario(sug)}
                          >
                            {sug.codigo} - {sug.descricao}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleRemoverAto(idx)}
                      style={{
                        background: '#e74c3c',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        padding: '6px 16px',
                        fontWeight: 'bold',
                        fontSize: 14,
                        cursor: 'pointer'
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

      <button
        onClick={handleSubmit}
        style={{
          marginTop: 12,
          padding: '10px 20px',
          background: '#2ecc71',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          fontWeight: 'bold',
          fontSize: 16,
          cursor: 'pointer'
        }}
      >
        Enviar Pedido
      </button>
    </div>
  );
}

