import React from 'react';

function DataTable({ data, onPaymentChange }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Ato</th>
          <th>Quantidade</th>
          <th>Forma de Pagamento</th>
        </tr>
      </thead>
      <tbody>
        {data.map((item) => (
          <tr key={item.id}>
            <td>{item.nome}</td>
            <td>
              <input
                type="number"
                value={item.quantidade}
                onChange={(e) => onPaymentChange(item.id, 'quantidade', e.target.value)}
              />
            </td>
            <td>
              <select
                value={item.formaPagamento}
                onChange={(e) => onPaymentChange(item.id, 'formaPagamento', e.target.value)}
              >
                <option value="">Selecione</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="cartao">Cartão</option>
                <option value="pix">Pix</option>
              </select>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default DataTable;
