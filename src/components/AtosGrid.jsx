import React from 'react';
import { formatarMoeda } from './utilsAtos';

const inputStyleQuantidade = { width: '50px', marginRight: '4px' };
const inputStyleValor = { width: '110px' };
const labelStyle = { fontSize: '0.75rem', marginRight: '4px', display: 'inline-block', width: '30px' };
const brStyle = { display: 'block', height: '4px' };

// ... resto do código do AtosGrid

function renderPagamentoCell(ato, campo, handleAtoChange) {
  return (
    <td>
      <label style={labelStyle}>qnt.</label>
      <input
        type="number"
        min="0"
        placeholder="Qtde"
        value={ato[campo]?.quantidade ?? 0}
        onChange={e => handleAtoChange(ato.id, campo, 'quantidade', e.target.value)}
        style={inputStyleQuantidade}
      />
      <br style={brStyle} />
      <label style={labelStyle}>valor</label>
      <input
        type="text"
        step="0.01"
        min="0"
        value={ato[campo]?.valor ?? ''}
        onChange={e => handleAtoChange(ato.id, campo, 'valor', e.target.value)}
        style={inputStyleValor}
      />
    </td>
  );
}

export default function AtosGrid({ atos, handleAtoChange }) {
  return (
    <div className="atos-table-container">
      <table className="atos-table">
        <thead>
          <tr>
            <th>Qtde.</th>
            <th>Código</th>
            <th>Descrição do Ato</th>
            <th>Valor Total</th>
            <th>Valor Faltante</th>
            <th>Dinheiro</th>
            <th>Cartão</th>
            <th>Pix</th>
            <th>CRC</th>
            <th>Depósito Prévio</th>
            <th>Observações</th>
          </tr>
        </thead>
        <tbody>
          {atos.map(ato => {
            const somaPagamentos = parseFloat((
              ato.pagamentoDinheiro.valor +
              ato.pagamentoCartao.valor +
              ato.pagamentoPix.valor +
              ato.pagamentoCRC.valor +
              ato.depositoPrevio.valor
            ).toFixed(2));
            const valorFaltante = parseFloat((ato.valorTotalComISS - somaPagamentos).toFixed(2));
            let linhaClass = '';
            if (Math.abs(somaPagamentos - ato.valorTotalComISS) < 0.01) {
              linhaClass = 'success-row';
            } else {
              linhaClass = 'error-row';
            }
            return (
              <tr key={ato.id} className={linhaClass}>
                <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 500 }}>{ato.quantidade}</td>
                <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 500 }}>
                  {ato.codigo}
                </td>
                <td style={{ padding: '10px 8px', minWidth: 180 }}>{ato.descricao}</td>
                <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 500 }}>{formatarMoeda(ato.valorTotalComISS)}</td>
                <td style={{ padding: '10px 8px', textAlign: 'right', color: valorFaltante === 0 ? '#388e3c' : '#d32f2f', fontWeight: 500 }}>{formatarMoeda(valorFaltante)}</td>
                {renderPagamentoCell(ato, 'pagamentoDinheiro', handleAtoChange)}
                {renderPagamentoCell(ato, 'pagamentoCartao', handleAtoChange)}
                {renderPagamentoCell(ato, 'pagamentoPix', handleAtoChange)}
                {renderPagamentoCell(ato, 'pagamentoCRC', handleAtoChange)}
                {renderPagamentoCell(ato, 'depositoPrevio', handleAtoChange)}
                <td>
                  <textarea
                    value={ato.observacoes}
                    onChange={e => handleAtoChange(ato.id, 'observacoes', null, e.target.value)}
                    placeholder="Observações"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}