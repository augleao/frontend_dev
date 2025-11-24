import React from 'react';
import { formasPagamento, formatarValor } from './utils';

export default function AtosTableEscrevente({ atos, onRemover }) {
  console.log("Atos recebidos na tabela atos-table:", atos);
  try {
    const discrepancies = atos.map(a => {
      const expected = (Number(a.valor_unitario || 0) * Number(a.quantidade || 1)) || 0;
      const paid = (formasPagamento || []).reduce((s, fp) => s + (Number(a.pagamentos?.[fp.key]?.valor || 0)), 0);
      return { id: a.id || null, codigo: a.codigo, expected: Number(expected.toFixed(2)), paid: Number(paid.toFixed(2)), diff: Number((expected - paid).toFixed(2)) };
    }).filter(d => Math.abs(d.diff) > 0.009);
    if (discrepancies.length > 0) {
      console.warn('[AtosTable] Discrepâncias encontradas (expected - paid):', discrepancies.slice(0,20));
    }
  } catch (e) {
    console.error('[AtosTable] Erro ao calcular discrepâncias:', e);
  }

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
            const pagamentos = ato.pagamentos || {};
            const tributacaoTexto = ato.tributacao
              || (ato.tributacao_codigo
                ? `${ato.tributacao_codigo}${ato.tributacao_descricao ? ' - ' + ato.tributacao_descricao : ''}`
                : '-');
            return (
              <tr key={ato.id || idx}>
                <td>{formatarDataBR(ato.data)}</td>
                <td style={{ border: '1px solid #ddd', padding: 8 }}>{ato.hora}</td>
                <td style={{ border: '1px solid #ddd', padding: 8 }}>{ato.codigo}</td>
                <td style={{ border: '1px solid #ddd', padding: 8 }}>{tributacaoTexto}</td>
                <td style={{ border: '1px solid #ddd', padding: 8 }}>{ato.descricao}</td>
                <td style={{ border: '1px solid #ddd', padding: 8 }}>{ato.quantidade}</td>
                <td style={{ border: '1px solid #ddd', padding: 8 }}>R$ {formatarValor(ato.valor_unitario)}</td>
                <td style={{ border: '1px solid #ddd', padding: 8 }}>
                  {formasPagamento
                    .filter((fp) => {
                      const val = pagamentos[fp.key]?.valor;
                      return val !== undefined && val !== null && !isNaN(parseFloat(val)) && parseFloat(val) > 0;
                    })
                    .map((fp) => {
                      const val = pagamentos[fp.key]?.valor;
                      const valorNum = parseFloat(val);
                      const valorFormatado = !isNaN(valorNum) ? valorNum.toFixed(2) : '0.00';
                      return `${fp.label}: Qtd ${pagamentos[fp.key]?.quantidade ?? 0}, Valor R$ ${valorFormatado}`;
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

