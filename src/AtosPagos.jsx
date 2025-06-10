import React, { useState } from 'react';

// Exemplos de códigos tributários e formas de pagamento
const codigosTributarios = [
  { codigo: '101', descricao: 'Registro de Nascimento' },
  { codigo: '102', descricao: 'Registro de Casamento' },
  { codigo: '103', descricao: 'Registro de Óbito' },
];

const formasPagamento = [
  { key: 'dinheiro', label: 'Dinheiro' },
  { key: 'debito', label: 'Cartão de Débito' },
  { key: 'credito', label: 'Cartão de Crédito' },
  { key: 'pix', label: 'PIX' },
  { key: 'cheque', label: 'Cheque' },
];

// Função para formatar a data no padrão brasileiro
function formatarData(data) {
  return data.toLocaleDateString('pt-BR');
}

function AtosPagos() {
  const [codigo, setCodigo] = useState('');
  const [quantidade, setQuantidade] = useState(1);
  const [pagamentos, setPagamentos] = useState(
    formasPagamento.reduce((acc, fp) => {
      acc[fp.key] = { quantidade: 0, valor: 0 };
      return acc;
    }, {})
  );
  const [atos, setAtos] = useState([]);

  // Data do dia (fixa ao carregar a página)
  const dataHoje = formatarData(new Date());

  // Recupera o nome do usuário do localStorage
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  const nomeUsuario = usuario?.nome || 'Usuário não identificado';

  const handlePagamentoChange = (key, field, value) => {
    setPagamentos(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: field === 'quantidade' ? parseInt(value) || 0 : parseFloat(value) || 0,
      },
    }));
  };

  const adicionarAto = () => {
    const algumPagamento = Object.values(pagamentos).some(p => p.valor > 0);
    if (codigo && quantidade > 0 && algumPagamento) {
      setAtos([
        ...atos,
        {
          data: dataHoje,
          hora: new Date().toLocaleTimeString(),
          codigo,
          quantidade,
          pagamentos: { ...pagamentos },
        },
      ]);
      setCodigo('');
      setQuantidade(1);
      setPagamentos(
        formasPagamento.reduce((acc, fp) => {
          acc[fp.key] = { quantidade: 0, valor: 0 };
          return acc;
        }, {})
      );
    }
  };

  const removerAto = (index) => {
    setAtos(atos.filter((_, i) => i !== index));
  };

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px #0001', padding: 32 }}>
      <h2 style={{ textAlign: 'center', marginBottom: 8 }}>
        Adicionar Ato Pago <span style={{ fontSize: 18, color: '#1976d2', marginLeft: 16 }}>{dataHoje}</span>
      </h2>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <input
          type="text"
          value={nomeUsuario}
          readOnly
          style={{
            width: 320,
            textAlign: 'center',
            fontSize: 16,
            padding: 8,
            borderRadius: 6,
            border: '1px solid #1976d2',
            background: '#f5faff',
            color: '#1976d2',
            fontWeight: 'bold'
          }}
        />
      </div>
      {/* Formulário de adição */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 32, alignItems: 'flex-end', justifyContent: 'center' }}>
        <div>
          <label>Código Tributário:</label>
          <select
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
            value={quantidade}
            onChange={e => setQuantidade(Number(e.target.value))}
            style={{ marginLeft: 8, width: 60, padding: 6, borderRadius: 6, border: '1px solid #ccc' }}
          />
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <h4 style={{ marginBottom: 8 }}>Formas de Pagamento</h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>
          {formasPagamento.map(fp => (
            <div key={fp.key} style={{ background: '#f5f5f5', borderRadius: 8, padding: 12, minWidth: 180 }}>
              <strong>{fp.label}</strong>
              <div style={{ marginTop: 8 }}>
                <label style={{ fontSize: 13 }}>Qtd:</label>
                <input
                  type="number"
                  min={0}
                  value={pagamentos[fp.key].quantidade}
                  onChange={e => handlePagamentoChange(fp.key, 'quantidade', e.target.value)}
                  style={{ width: 50, marginLeft: 4, marginRight: 8, borderRadius: 4, border: '1px solid #ccc', padding: 4 }}
                />
                <label style={{ fontSize: 13 }}>Valor:</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={pagamentos[fp.key].valor}
                  onChange={e => handlePagamentoChange(fp.key, 'valor', e.target.value)}
                  style={{ width: 80, marginLeft: 4, borderRadius: 4, border: '1px solid #ccc', padding: 4 }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <button
          style={{ padding: '10px 24px', background: '#388e3c', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}
          onClick={adicionarAto}
          disabled={!codigo || quantidade < 1 || !Object.values(pagamentos).some(p => p.valor > 0)}
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
              <th style={{ border: '1px solid #ddd', padding: 8 }}>Data</th>
              <th style={{ border: '1px solid #ddd', padding: 8 }}>Hora</th>
              <th style={{ border: '1px solid #ddd', padding: 8 }}>Código Tributário</th>
              <th style={{ border: '1px solid #ddd', padding: 8 }}>Quantidade</th>
              <th style={{ border: '1px solid #ddd', padding: 8 }}>Pagamentos</th>
              <th style={{ border: '1px solid #ddd', padding: 8 }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {atos.map((ato, idx) => (
              <tr key={idx}>
                <td style={{ border: '1px solid #ddd', padding: 8 }}>{ato.data}</td>
                <td style={{ border: '1px solid #ddd', padding: 8 }}>{ato.hora}</td>
                <td style={{ border: '1px solid #ddd', padding: 8 }}>{ato.codigo}</td>
                <td style={{ border: '1px solid #ddd', padding: 8 }}>{ato.quantidade}</td>
                <td style={{ border: '1px solid #ddd', padding: 8 }}>
                  {formasPagamento
                    .filter(fp => ato.pagamentos[fp.key].valor > 0)
                    .map(fp =>
                      `${fp.label}: Qtd ${ato.pagamentos[fp.key].quantidade}, Valor R$ ${ato.pagamentos[fp.key].valor.toFixed(2)}`
                    )
                    .join(' | ')
                  }
                </td>
                <td style={{ border: '1px solid #ddd', padding: 8 }}>
                  <button
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
                <td colSpan={6} style={{ textAlign: 'center', padding: 16, color: '#888' }}>Nenhum ato adicionado hoje.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AtosPagos;