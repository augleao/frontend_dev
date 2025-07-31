// AtosTable.jsx
import React from 'react';
import { formasPagamento, formatarDataBR, formatarValor } from './utils';

export default function CaixaTableEscrevente({ atos, onRemover }) {
  console.log("Atos recebidos na tabela caixa-table:", atos);

  // Função para determinar a cor de fundo baseada no código do ato
  const getCorFundo = (codigo) => {
    switch (codigo) {
      case '0002': // Saída manual
        return '#ffcccb'; // Vermelho mais forte
      case '0001': // Valor final do caixa (fechamento)
        return '#bbdefb'; // Azul mais forte
      default: // Todos os outros códigos (0003, 0005 e atos normais)
        return '#c8e6c9'; // Verde mais forte
    }
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fafafa', fontSize: '13px' }}>
        <thead>
          <tr style={{ background: '#f5f5f5' }}>
            <th style={{ border: '1px solid #ddd', padding: '4px 6px', fontSize: '12px', fontWeight: '600' }}>Data</th>
            <th style={{ border: '1px solid #ddd', padding: '4px 6px', fontSize: '12px', fontWeight: '600' }}>Hora</th>
            <th style={{ border: '1px solid #ddd', padding: '4px 6px', fontSize: '12px', fontWeight: '600' }}>Código</th>
            <th style={{ border: '1px solid #ddd', padding: '4px 6px', fontSize: '12px', fontWeight: '600' }}>Descrição</th>
            <th style={{ border: '1px solid #ddd', padding: '4px 6px', fontSize: '12px', fontWeight: '600' }}>Quantidade</th>
            <th style={{ border: '1px solid #ddd', padding: '4px 6px', fontSize: '12px', fontWeight: '600' }}>Valor Unitário</th>
            <th style={{ border: '1px solid #ddd', padding: '4px 6px', fontSize: '12px', fontWeight: '600' }}>Pagamentos</th>
            <th style={{ border: '1px solid #ddd', padding: '4px 6px', fontSize: '12px', fontWeight: '600' }}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {atos.length === 0 && (
            <tr>
              <td colSpan={8} style={{ textAlign: 'center', padding: '12px', color: '#888', fontSize: '13px' }}>
                Nenhum ato cadastrado para esta data.
              </td>
            </tr>
          )}
          {atos.map((ato, idx) => (
            <tr key={idx} style={{ backgroundColor: getCorFundo(ato.codigo) }}>
              <td style={{ border: '1px solid #ddd', padding: '4px 6px', fontSize: '12px' }}>{formatarDataBR(ato.data)}</td>
              <td style={{ border: '1px solid #ddd', padding: '4px 6px', fontSize: '12px' }}>{ato.hora}</td>
              <td style={{ border: '1px solid #ddd', padding: '4px 6px', fontSize: '12px' }}>{ato.codigo}</td>
              <td style={{ border: '1px solid #ddd', padding: '4px 6px', fontSize: '12px' }}>{ato.descricao}</td>
              <td style={{ border: '1px solid #ddd', padding: '4px 6px', fontSize: '12px' }}>{ato.quantidade}</td>
              <td style={{ border: '1px solid #ddd', padding: '4px 6px', fontSize: '12px' }}>R$ {formatarValor(ato.valor_unitario)}</td>
              <td style={{ border: '1px solid #ddd', padding: '4px 6px', fontSize: '11px' }}>
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
              <td style={{ border: '1px solid #ddd', padding: '4px 6px' }}>
                <button
                  style={{
                    background: '#d32f2f',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    padding: '4px 8px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: '600'
                  }}
                  onClick={() => onRemover(idx)}
                >
                  Excluir
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

