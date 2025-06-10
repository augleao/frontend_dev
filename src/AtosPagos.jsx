import React, { useState } from 'react';

// Exemplo de opções de código tributário e formas de pagamento
const codigosTributarios = [
  { codigo: '101', descricao: 'Registro de Nascimento' },
  { codigo: '102', descricao: 'Registro de Casamento' },
  { codigo: '103', descricao: 'Registro de Óbito' },
  // ...adicione outros códigos conforme necessário
];

const formasPagamento = [
  'Dinheiro',
  'Cartão de Débito',
  'Cartão de Crédito',
  'PIX',
  'Cheque',
];

const AtosPagos = () => {
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
    <div className="p-4">
      {/* Parte superior: Formulário de adição */}
      <div className="mb-6 border-b pb-4">
        <h2 className="text-lg font-bold mb-2">Adicionar Ato Pago</h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label>Código Tributário:</label>
            <select
              className="border rounded p-1 ml-2"
              value={codigo}
              onChange={e => setCodigo(e.target.value)}
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
              className="border rounded p-1 ml-2 w-16"
              value={quantidade}
              onChange={e => setQuantidade(Number(e.target.value))}
            />
          </div>
          <div>
            <label>Forma de Pagamento:</label>
            <select
              className="border rounded p-1 ml-2"
              value={pagamentoAtual}
              onChange={e => setPagamentoAtual(e.target.value)}
            >
              <option value="">Selecione</option>
              {formasPagamento.map(fp => (
                <option key={fp} value={fp}>{fp}</option>
              ))}
            </select>
            <button
              type="button"
              className="ml-2 px-2 py-1 bg-blue-600 text-white rounded"
              onClick={adicionarPagamento}
              disabled={!pagamentoAtual}
            >
              Adicionar
            </button>
          </div>
          <div>
            {pagamentos.length > 0 && (
              <div className="flex gap-2">
                {pagamentos.map((fp, idx) => (
                  <span key={idx} className="bg-gray-200 px-2 py-1 rounded">{fp}</span>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            className="ml-4 px-4 py-2 bg-green-600 text-white rounded"
            onClick={adicionarAto}
            disabled={!codigo || quantidade < 1 || pagamentos.length === 0}
          >
            Adicionar Ato
          </button>
        </div>
      </div>

      {/* Parte inferior: Tabela de atos adicionados */}
      <div>
        <h2 className="text-lg font-bold mb-2">Atos Pagos do Dia</h2>
        <table className="min-w-full border">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-2 py-1">Hora</th>
              <th className="border px-2 py-1">Código Tributário</th>
              <th className="border px-2 py-1">Quantidade</th>
              <th className="border px-2 py-1">Formas de Pagamento</th>
              <th className="border px-2 py-1">Ações</th>
            </tr>
          </thead>
          <tbody>
            {atos.map((ato, idx) => (
              <tr key={idx}>
                <td className="border px-2 py-1">{ato.hora}</td>
                <td className="border px-2 py-1">{ato.codigo}</td>
                <td className="border px-2 py-1">{ato.quantidade}</td>
                <td className="border px-2 py-1">
                  {ato.pagamentos.join(', ')}
                </td>
                <td className="border px-2 py-1">
                  <button
                    className="bg-red-600 text-white px-2 py-1 rounded"
                    onClick={() => removerAto(idx)}
                  >
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
            {atos.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-2">Nenhum ato adicionado hoje.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AtosPagos;