import React, { useEffect, useState } from 'react';

export default function ServicoEntrada({ form, tiposServico, onChange, combosDisponiveis }) {
  const [comboSelecionado, setComboSelecionado] = useState('');
  const [atosAdicionados, setAtosAdicionados] = useState([]);

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
      <label>Descrição:</label>
      <input type="text" value={form.descricao} onChange={e => onChange('descricao', e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
      <label>Prazo estimado:</label>
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
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
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
                  <td>{ato.atoDescricao}</td>
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
                      onChange={e => handleAtoChange(idx, 'codigoTributario', e.target.value)}
                      style={{ width: 120 }}
                    />
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

