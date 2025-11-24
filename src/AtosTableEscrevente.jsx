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
            const tributacaoTexto = ato.tributacao
              || (ato.tributacao_codigo
                ? `${ato.tributacao_codigo}${ato.tributacao_descricao ? ' - ' + ato.tributacao_descricao : ''}`
                : '-');

            // Helper: tenta parsear detalhes_pagamentos (string JSON ou objeto)
            const parseDetalhes = (det) => {
              if (!det) return null;
              if (typeof det === 'string') {
                try {
                  return JSON.parse(det);
                } catch (e) {
                  return det; // keep raw string
                }
              }
              return det;
            };

            // Helper: render Pagamentos a partir de diferentes formatos
            const renderPagamentos = (atoItem) => {
              // Preferir exibir `detalhes_pagamentos` originais quando presentes (importados)
              const detalhesRaw = parseDetalhes(atoItem.detalhes_pagamentos || atoItem.detalhes_pagamento || null);
              const temDetalhes = (() => {
                if (!detalhesRaw) return false;
                if (Array.isArray(detalhesRaw)) return detalhesRaw.length > 0;
                if (typeof detalhesRaw === 'object') return Object.keys(detalhesRaw).length > 0;
                if (typeof detalhesRaw === 'string') return detalhesRaw.trim().length > 0;
                return false;
              })();

              if (temDetalhes) {
                const detalhes = detalhesRaw;
                // Se for array de { forma, valor }
                if (Array.isArray(detalhes) && detalhes.length > 0 && typeof detalhes[0] === 'object' && ('forma' in detalhes[0] || 'valor' in detalhes[0])) {
                  return detalhes
                    .map(d => {
                      const forma = d.forma || d.forma_pagamento || d.tipo || 'Outro';
                      const valor = d.valor ?? d.valor_pago ?? d.amount ?? 0;
                      const valorNum = Number(valor) || 0;
                      return `${forma}: Valor R$ ${valorNum.toFixed(2)}`;
                    })
                    .join(' | ');
                }

                // Se for objeto com chaves como dinheiro/cartao/pix
                if (typeof detalhes === 'object') {
                  const labels = formasPagamento.map(fp => ({ key: fp.key, label: fp.label }));
                  const parts = [];
                  labels.forEach(l => {
                    const v = detalhes[l.key] ?? (detalhes[l.key] && detalhes[l.key].valor) ?? null;
                    if (v !== null && v !== undefined) {
                      const num = Number((typeof v === 'object' ? v.valor : v) ?? 0) || 0;
                      if (num > 0) parts.push(`${l.label}: R$ ${num.toFixed(2)}`);
                    }
                  });
                  if (parts.length > 0) return parts.join(' | ');
                }

                // Por fim, renderizar JSON compacto ou string
                try {
                  if (typeof detalhes === 'string') return detalhes;
                  return JSON.stringify(detalhes);
                } catch (e) {
                  return String(detalhes);
                }
              }

              // Caso não haja detalhes originais, usar `pagamentos` (possível máscara gerada internamente)
              const pagamentos = atoItem.pagamentos || null;
              if (pagamentos && Object.keys(pagamentos).length > 0) {
                return formasPagamento
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
                  .join(' | ');
              }

              return '-';
            };

            return (
              <tr key={ato.id || idx}>
                <td>{formatarDataBR(ato.data)}</td>
                <td style={{ border: '1px solid #ddd', padding: 8 }}>{ato.hora}</td>
                <td style={{ border: '1px solid #ddd', padding: 8 }}>{ato.codigo}</td>
                <td style={{ border: '1px solid #ddd', padding: 8 }}>{tributacaoTexto}</td>
                <td style={{ border: '1px solid #ddd', padding: 8 }}>{ato.descricao}</td>
                <td style={{ border: '1px solid #ddd', padding: 8 }}>{ato.quantidade}</td>
                <td style={{ border: '1px solid #ddd', padding: 8 }}>R$ {formatarValor(ato.valor_unitario)}</td>
                <td style={{ border: '1px solid #ddd', padding: 8 }}>{renderPagamentos(ato)}</td>
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

