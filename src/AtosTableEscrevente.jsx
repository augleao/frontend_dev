import React from 'react';
import { formasPagamento, formatarValor } from './utils';

export default function AtosTableEscrevente({ atos, onRemover }) {
  console.log("Atos recebidos na tabela atos-table:", atos);

  // Função para formatar data no padrão brasileiro (DD/MM/AAAA)
  const formatarDataBR = (dataStr) => {
    if (!dataStr) return '-';
    const match = String(dataStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[3]}/${match[2]}/${match[1]}`;
    }
    if (dataStr instanceof Date) {
      return dataStr.toLocaleDateString('pt-BR');
    }
    try {
      const d = new Date(dataStr);
      if (!isNaN(d)) return d.toLocaleDateString('pt-BR');
    } catch {}
    return dataStr;
  };

  // Função para remover ato pelo id
  const handleRemover = (id) => {
    if (window.confirm('Tem certeza que deseja remover este ato?')) {
      onRemover(id);
    }
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fafafa' }}>
        <thead>
          <tr style={{ background: '#f5f5f5' }}>
            <th style={{ border: '1px solid #ddd', padding: 8 }}>Data</th>
            <th style={{ border: '1px solid #ddd', padding: 8 }}>Hora</th>
            <th style={{ border: '1px solid #ddd', padding: 8 }}>Código</th>
            <th style={{ border: '1px solid #ddd', padding: 8 }}>Tributação</th>
            <th style={{ border: '1px solid #ddd', padding: 8 }}>Descrição</th>
            <th style={{ border: '1px solid #ddd', padding: 8 }}>Quantidade</th>
            <th style={{ border: '1px solid #ddd', padding: 8 }}>Valor Unitário</th>
            <th style={{ border: '1px solid #ddd', padding: 8 }}>Pagamentos</th>
            <th style={{ border: '1px solid #ddd', padding: 8 }}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {atos.length === 0 && (
            <tr>
              <td colSpan={9} style={{ textAlign: 'center', padding: 16, color: '#888' }}>
                Nenhum ato cadastrado para esta data.
              </td>
            </tr>
          )}
          {atos.map((ato, idx) => {
            return (
              <tr key={ato.id || idx}>
                <td>{formatarDataBR(ato.data)}</td>
                <td style={{ border: '1px solid #ddd', padding: 8 }}>{ato.hora}</td>
                <td style={{ border: '1px solid #ddd', padding: 8 }}>{ato.codigo}</td>
                <td style={{ border: '1px solid #ddd', padding: 8 }}>{ato.tributacao || '-'}</td>
                <td style={{ border: '1px solid #ddd', padding: 8 }}>{ato.descricao}</td>
                <td style={{ border: '1px solid #ddd', padding: 8 }}>{ato.quantidade}</td>
                <td style={{ border: '1px solid #ddd', padding: 8 }}>R$ {formatarValor(ato.valor_unitario)}</td>
                <td style={{ border: '1px solid #ddd', padding: 8 }}>
                  {formasPagamento
                    .filter((fp) => {
                      const val = ato.pagamentos[fp.key]?.valor;
                      return val !== undefined && val !== null && !isNaN(parseFloat(val)) && parseFloat(val) > 0;
                    })
                    .map((fp) => {
                      const val = ato.pagamentos[fp.key]?.valor;
                      const valorNum = parseFloat(val);
                      const valorFormatado = !isNaN(valorNum) ? valorNum.toFixed(2) : '0.00';
                      return `${fp.label}: Qtd ${ato.pagamentos[fp.key]?.quantidade ?? 0}, Valor R$ ${valorFormatado}`;
                    })
                    .join(' | ')}
                </td>
                <td style={{ border: '1px solid #ddd', padding: 8 }}>
                  <button
                    style={{
                      background: '#d32f2f',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      padding: '6px 12px',
                      cursor: 'pointer',
                    }}
                    onClick={() => handleRemover(ato.id)}
                  >
                    Excluir
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

