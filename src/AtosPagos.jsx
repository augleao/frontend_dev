import React, { useState } from 'react';

// Exemplo de códigos tributários e formas de pagamento
const codigosTributarios = [
  { codigo: '101', descricao: 'Registro de Nascimento' },
  { codigo: '102', descricao: 'Registro de Casamento' },
  { codigo: '103', descricao: 'Registro de Óbito' },
  // ...adicione outros conforme necessário
];

const formasPagamento = [
  'Dinheiro',
  'Cartão de Débito',
  'Cartão de Crédito',
  'PIX',
  'Cheque',
];

function AtosPagos() {
  const [codigo, setCodigo] = useState('');
  const [quantidade, setQuantidade] = useState(1);
  const [pagamentos, setPagamentos] = useState([]);
  const [pagamentoAtual, setPagamentoAtual] = useState('');
  const [atos, setAtos] = useState([]);

  // Adiciona uma forma de pagamento à lista temporária
  const adicionarPagamento = () => {
    if (pagamentoAtual && !pagamentos.includes(pagamentoAtual)) {
      setPagamentos([...pagamentos, pagamentoAtual]);
      setPagamentoAtual('');
    }
  };

  // Adiciona o ato à tabela
  const adicionarAto = () => {
    if (codigo && quantidade > 0 && pagamentos.length > 0) {
      setAtos([
        ...atos,
        {
          hora: new Date().toLocaleTimeString(),
          codigo,
          quantidade,
          pagamentos: [...pagamentos],
        },
      ]);
      setCodigo('');
      setQuantidade(1);
      setPagamentos([]);
    }
  };

  // Remove um ato da tabela
  const removerAto = (index) => {
    setAtos(atos.filter((_, i) => i !== index));
  };

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px #0001', padding: 32 }}>
      <h2 style={{ textAlign: 'center', marginBottom: 24 }}>Adicionar Ato Pago</h2>
      {/* Formulário de adição */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 32, alignItems: 'flex-end', justifyContent: 'center' }}>
        <div>
          <label>Código Tributário:</label>
          <select
            className="atos-table-input"
            value={codigo}
            onChange={e => setCodigo(e.target.value)}
            style={{ marginLeft: 8, padding: 6, borderRadius: 6, border: '1px solid #ccc' }}
          >
            <option value="">Selecione</option>
            {codigosTributarios.map(opt => (
              <option key={opt.codigo} value={opt.codigo}>
                {opt.codigo} - {opt.descricao}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Quantidade:</label>
          <input
            type="number"
            min={1}
            className="atos-table-input"
            value={quantidade}
            onChange={e => setQuantidade(Number(e.target.value))}
            style={{ marginLeft: 8, width: 60, padding: 6, borderRadius: 6, border: '1px solid #ccc' }}
          />
        </div>
        <div>
          <label>Forma de Pagamento:</label>
          <select
            className="atos-table-input"
            value={pagamentoAtual}
            onChange={e => setPagamentoAtual(e.target.value)}
            style={{ marginLeft: 8, padding: 6, borderRadius: 6, border: '1px solid #ccc' }}
          >
            <option value="">Selecione</option>
            {formasPagamento.map(fp => (
              <option key={fp} value={fp}>{fp}</option>
            ))}
          </select>
          <button
            type="button"
            className="atos-table-btn"
            style={{ marginLeft: 8, padding: '6px 12px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
            onClick={adicionarPagamento}
            disabled={!pagamentoAtual}
          >
            Adicionar
          </button>
        </div>
        <div>
          {pagamentos.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {pagamentos.map((fp, idx) => (
                <span key={idx} style={{ background: '#e3e3e3', padding: '4px 10px', borderRadius: 6 }}>{fp}</span>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          className="atos-table-btn"
          style={{ padding: '10px 24px', background: '#388e3c', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', marginLeft: 16 }}
          onClick={adicionarAto}
          disabled={!codigo || quantidade < 1 || pagamentos.length === 0}
        >
          Adicionar Ato
        </button>
      </div>

      {/* Tabela de atos adicionados */}
      <h3 style={{ marginBottom: 12 }}>Atos Pagos do Dia</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fafafa' }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th style={{ border: '1px solid #ddd', padding: 8 }}>Hora</th>
              <th style={{ border: '1px solid #ddd', padding: 8 }}>Código Tributário</th>
              <th style={{ border: '1px solid #ddd', padding: 8 }}>Quantidade</th>
              <th style={{ border: '1px solid #ddd', padding: 8 }}>Formas de Pagamento</th>
              <th style={{ border: '1px solid #ddd', padding: 8 }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {atos.map((ato, idx) => (
              <tr key={idx}>
                <td style={{ border: '1px solid #ddd', padding: 8 }}>{ato.hora}</td>
                <td style={{ border: '1px solid #ddd', padding: 8 }}>{ato.codigo}</td>
                <td style={{ border: '1px solid #ddd', padding: 8 }}>{ato.quantidade}</td>
                <td style={{ border: '1px solid #ddd', padding: 8 }}>{ato.pagamentos.join(', ')}</td>
                <td style={{ border: '1px solid #ddd', padding: 8 }}>
                  <button
                    className="atos-table-btn"
                    style={{ background: '#d32f2f', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}
                    onClick={() => removerAto(idx)}
                  >
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
            {atos.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: 16, color: '#888' }}>Nenhum ato adicionado hoje.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AtosPagos;