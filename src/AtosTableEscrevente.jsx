import React from 'react';
import { formasPagamento, formatarMoeda } from './utils';
import './buttonGradients.css';

export default function AtosTableEscrevente({ atos, onRemover }) {
  console.log("Atos recebidos na tabela atos-table:", atos);

  // Extrai ISS de um ato, tentando várias fontes:
  // 1) campos explícitos (issqn, iss, valor_iss, etc.)
  // 2) diferença entre valor_unitario e detalhes_pagamentos.valor_total (quando disponível)
  const extrairISS = (ato) => {
    if (!ato) return 0;
    const candidates = [
      ato.issqn,
      ato.iss,
      ato.iss_qn,
      ato.issqn_valor,
      ato.valor_issqn,
      ato.valor_iss,
      ato.valorIss,
      ato.valorIssqn
    ];
    const val = candidates.find((v) => v !== undefined && v !== null);
    if (val !== undefined && val !== null) return Number(val) || 0;

    // tentar inferir pela diferença entre valor_unitario e detalhes_pagamentos.valor_total
    try {
      const detalhes = ato.detalhes_pagamentos || ato.detalhes_pagamento || null;
      const valorUnit = Number(ato.valor_unitario) || 0;
      let valorTotalDetalhes = null;
      if (detalhes) {
        if (typeof detalhes === 'string') {
          try { const parsed = JSON.parse(detalhes); valorTotalDetalhes = parsed.valor_total ?? parsed.valor ?? null; } catch {}
        } else if (typeof detalhes === 'object') {
          valorTotalDetalhes = detalhes.valor_total ?? detalhes.valor ?? null;
        }
      }
      if (valorTotalDetalhes !== null && !isNaN(Number(valorTotalDetalhes))) {
        const diff = valorUnit - Number(valorTotalDetalhes);
        if (diff > 0.009) return Number(diff.toFixed(2));
      }
    } catch (e) {
      // ignore
    }

    return 0;
  };

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
              <td colSpan={8} style={{ textAlign: 'center', padding: 16, color: '#888' }}>
                Nenhum ato cadastrado para esta data.
              </td>
            </tr>
          )}
            {atos.map((ato, idx) => {

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

              const escolherFormaLabel = (formaKeyOrName) => {
                if (!formaKeyOrName) return 'OUTRO';
                const key = String(formaKeyOrName).toLowerCase();
                const found = formasPagamento.find(fp => fp.key === key || fp.label.toLowerCase() === key);
                if (found) return found.label.toUpperCase();
                return String(formaKeyOrName).toUpperCase();
              };

              if (temDetalhes) {
                const detalhes = detalhesRaw;

                // Caso comum: objeto com `valor_total` e `formas_utilizadas` (ex: importados)
                if (typeof detalhes === 'object' && ('valor_total' in detalhes || 'formas_utilizadas' in detalhes)) {
                  const valor = Number(detalhes.valor_total ?? detalhes.valor ?? detalhes.amount ?? 0) || 0;
                  let formaLabel = null;
                  if (Array.isArray(detalhes.formas_utilizadas) && detalhes.formas_utilizadas.length > 0) {
                    formaLabel = escolherFormaLabel(detalhes.formas_utilizadas[0]);
                  } else if (detalhes.forma) {
                    formaLabel = escolherFormaLabel(detalhes.forma);
                  } else {
                    // tentar encontrar a primeira chave com valor > 0
                    const keys = Object.keys(detalhes);
                    for (let k of keys) {
                      const v = detalhes[k];
                      const num = Number((typeof v === 'object' ? v.valor : v) ?? 0) || 0;
                      if (num > 0) { formaLabel = escolherFormaLabel(k); break; }
                    }
                  }
                  return `Valor: ${formatarMoeda(valor)}${formaLabel ? ' - ' + formaLabel : ''}`;
                }

                // Se for array de { forma, valor } -> pegar primeiro registro para exibir valor/forma
                if (Array.isArray(detalhes) && detalhes.length > 0) {
                  const first = detalhes.find(d => d && (d.valor || d.valor_pago || d.amount || d.valor_total)) || detalhes[0];
                  const valor = Number(first.valor ?? first.valor_pago ?? first.amount ?? first.valor_total ?? 0) || 0;
                  const formaLabel = escolherFormaLabel(first.forma || first.forma_pagamento || first.tipo || null);
                  return `Valor: ${formatarMoeda(valor)}${formaLabel ? ' - ' + formaLabel : ''}`;
                }

                // Objeto com chaves (dinheiro/cartao/pix) -> pegar primeira chave com valor
                if (typeof detalhes === 'object') {
                  const labels = formasPagamento.map(fp => ({ key: fp.key, label: fp.label }));
                  for (let l of labels) {
                    const v = detalhes[l.key] ?? (detalhes[l.key] && detalhes[l.key].valor) ?? null;
                    const num = Number((typeof v === 'object' ? v.valor : v) ?? 0) || 0;
                    if (num > 0) return `Valor: ${formatarMoeda(num)} - ${l.label.toUpperCase()}`;
                  }
                }

                // Fallback: string ou JSON compacto
                try {
                  if (typeof detalhes === 'string') return detalhes;
                  return JSON.stringify(detalhes);
                } catch (e) {
                  return String(detalhes);
                }
              }

              // Caso não haja detalhes originais, usar `pagamentos` (possível máscara gerada internamente)
              const pagamentos = atoItem.pagamentos || null;
              if (pagamentos) {
                // pagamentos como array -> usar primeiro
                if (Array.isArray(pagamentos) && pagamentos.length > 0) {
                  const p = pagamentos[0];
                  const valor = Number(p.valor ?? p.valor_pago ?? p.amount ?? p.valor_total ?? 0) || 0;
                  const formaLabel = escolherFormaLabel(p.forma || p.forma_pagamento || p.tipo || null);
                  return `Valor: ${formatarMoeda(valor)}${formaLabel ? ' - ' + formaLabel : ''}`;
                }

                // pagamentos como objeto por formas
                if (typeof pagamentos === 'object') {
                  for (let fp of formasPagamento) {
                    const entry = pagamentos[fp.key];
                    const num = Number(entry?.valor ?? entry ?? 0) || 0;
                    if (num > 0) return `Valor: ${formatarMoeda(num)} - ${fp.label.toUpperCase()}`;
                  }
                }
              }

              return '-';
            };

            return (
              <tr key={ato.id || idx}>
                <td>{formatarDataBR(ato.data)}</td>
                <td style={{ border: '1px solid #ddd', padding: 8 }}>{ato.hora}</td>
                <td style={{ border: '1px solid #ddd', padding: 8 }}>{ato.codigo}</td>
                <td style={{ border: '1px solid #ddd', padding: 8 }}>{ato.descricao}</td>
                <td style={{ border: '1px solid #ddd', padding: 8 }}>{ato.quantidade}</td>
                <td style={{ border: '1px solid #ddd', padding: 8 }}>
                  {(() => {
                    const valorUnit = Number(ato.valor_unitario) || 0;
                    const iss = extrairISS(ato);
                    return `${formatarMoeda(valorUnit)}${iss ? ` (inclui ISS ${formatarMoeda(iss)})` : ''}`;
                  })()}
                </td>
                <td style={{ border: '1px solid #ddd', padding: 8 }}>{renderPagamentos(ato)}</td>
                <td style={{ border: '1px solid #ddd', padding: 8 }}>
                  <button
                    type="button"
                    className="btn-gradient btn-gradient-red btn-compact"
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

