import React, { useEffect, useState } from 'react';
import config from '../../config';

export default function ServicoEntrada({ form, tiposServico, onChange, combosDisponiveis }) {
  const [comboSelecionado, setComboSelecionado] = useState('');
  const [combosAdicionados, setCombosAdicionados] = useState([]);

  // Adiciona combo ao pedido
  const handleAdicionarCombo = () => {
    if (!comboSelecionado) return;
    const combo = combosDisponiveis.find(c => c.id === Number(comboSelecionado));
    if (!combo) return;
    setCombosAdicionados(prev => [
      ...prev,
      {
        id: combo.id,
        nome: combo.nome,
        quantidade: 1,
        codigoTributario: '',
        atos: combo.atos || []
      }
    ]);
    setComboSelecionado('');
  };

  // Altera quantidade ou código tributário de um combo
  const handleComboChange = (idx, field, value) => {
    setCombosAdicionados(prev =>
      prev.map((c, i) =>
        i === idx ? { ...c, [field]: value } : c
      )
    );
  };

  // Remove combo do pedido
  const handleRemoverCombo = idx => {
    setCombosAdicionados(prev => prev.filter((_, i) => i !== idx));
  };

  // Atualiza combos no form principal (se necessário)
  useEffect(() => {
    if (onChange) onChange('combos', combosAdicionados);
  }, [combosAdicionados, onChange]);

  return (
    <div>
      <h3>Entrada do Serviço</h3>
      <label>Número de Protocolo:</label>
      <input type="text" value={form.protocolo} readOnly style={{ width: '100%', marginBottom: 8 }} />
      <label>Tipo de Serviço:</label>
      <select value={form.tipo} onChange={e => onChange('tipo', e.target.value)} style={{ width: '100%', marginBottom: 8 }}>
        <option value="">Selecione...</option>
        {tiposServico.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
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

      {combosAdicionados.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <h4>Combos adicionados ao pedido:</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
            <thead>
              <tr style={{ background: '#f0f0f0' }}>
                <th>Combo</th>
                <th>Atos</th>
                <th>Quantidade</th>
                <th>Código Tributário</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {combosAdicionados.map((combo, idx) => (
                <tr key={combo.id}>
                  <td>{combo.nome}</td>
                  <td>
                    {Array.isArray(combo.atos) && combo.atos.length > 0
                      ? combo.atos.map(a => a.codigo).join(', ')
                      : '-'}
                  </td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      value={combo.quantidade}
                      onChange={e => handleComboChange(idx, 'quantidade', Number(e.target.value))}
                      style={{ width: 60 }}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={combo.codigoTributario}
                      onChange={e => handleComboChange(idx, 'codigoTributario', e.target.value)}
                      style={{ width: 120 }}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleRemoverCombo(idx)}
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

