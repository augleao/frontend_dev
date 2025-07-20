import React, { useEffect, useState } from 'react';
import config from '../../config';

export default function ServicoEntrada({ form, tiposServico, onChange, combosDisponiveis }) {
  const [comboSelecionado, setComboSelecionado] = useState('');
  const [atosAdicionados, setAtosAdicionados] = useState([]);
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
    setAtosAdicionados(prev => [
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
    setAtosAdicionados(prev =>
      prev.map((a, i) =>
        i === idx ? { ...a, [field]: value } : a
      )
    );
  };

  // Remove ato do pedido
  const handleRemoverAto = idx => {
    setAtosAdicionados(prev => prev.filter((_, i) => i !== idx));
  };

  // Atualiza atos no form principal (se necessário)
  useEffect(() => {
    if (onChange) onChange('atosPedido', atosAdicionados);
  }, [atosAdicionados, onChange]);

  return (
    <div>
      <h3>Entrada do Serviço</h3>
      <label>Número de Protocolo:</label>
      <input type="text" value={form.protocolo} readOnly style={{ width: '100%', marginBottom: 8 }} />
      <label>Prazo estimado para entrega:</label>
      <input type="date" value={form.prazo} onChange={e => onChange('prazo', e.target.value)} style={{ width: '100%', marginBottom: 8 }} />

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

      {atosAdicionados.length > 0 && (
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
              {atosAdicionados.map((ato, idx) => (
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
    </div>
  );
}

