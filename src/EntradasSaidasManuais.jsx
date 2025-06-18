import React, { useState } from 'react';

export default function EntradasSaidasManuais({ atos, setAtos, nomeUsuario }) {
  const [entradaValor, setEntradaValor] = useState('');
  const [entradaObs, setEntradaObs] = useState('');
  const [saidaValor, setSaidaValor] = useState('');
  const [saidaObs, setSaidaObs] = useState('');

  const adicionarEntradaManual = () => {
    const valor = parseFloat(entradaValor.replace(',', '.'));
    if (isNaN(valor) || valor <= 0) {
      alert('Informe um valor válido para a entrada.');
      return;
    }
    const descricao = entradaObs.trim() || '';
    const agora = new Date();

    const novaEntrada = {
      data: agora.toISOString().slice(0, 10),
      hora: agora.toLocaleTimeString(),
      codigo: '0001',
      descricao: `ENTRADA: ${descricao}`,
      quantidade: 1,
      valor_unitario: valor,
      pagamentos: {},
      usuario: nomeUsuario,
    };

    setAtos([...atos, novaEntrada]);
    setEntradaValor('');
    setEntradaObs('');
  };

  const adicionarSaidaManual = () => {
    const valor = parseFloat(saidaValor.replace(',', '.'));
    if (isNaN(valor) || valor <= 0) {
      alert('Informe um valor válido para a saída.');
      return;
    }
    const descricao = saidaObs.trim() || '';
    const agora = new Date();

    const novaSaida = {
      data: agora.toISOString().slice(0, 10),
      hora: agora.toLocaleTimeString(),
      codigo: '0002',
      descricao: `SAÍDA: ${descricao}`,
      quantidade: 1,
      valor_unitario: valor,
      pagamentos: {},
      usuario: nomeUsuario,
    };

    setAtos([...atos, novaSaida]);
    setSaidaValor('');
    setSaidaObs('');
  };

  return (
    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 24 }}>
      <div
        style={{
          backgroundColor: '#e0e0e0',
          borderRadius: 8,
          padding: 16,
          flex: '1 1 45%',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <button
          style={{
            padding: '10px 16px',
            background: '#1976d2',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
          }}
          onClick={adicionarEntradaManual}
        >
          Adicionar Entrada no Caixa
        </button>
        <input
          type="text"
          placeholder="Valor (R$)"
          value={entradaValor}
          onChange={(e) => setEntradaValor(e.target.value)}
          style={{
            width: 120,
            padding: 8,
            borderRadius: 6,
            border: '1px solid #ccc',
            textAlign: 'right',
            fontSize: 14,
          }}
        />
        <input
          type="text"
          placeholder="Observações"
          value={entradaObs}
          onChange={(e) => setEntradaObs(e.target.value)}
          style={{
            flexGrow: 1,
            padding: 8,
            borderRadius: 6,
            border: '1px solid #ccc',
            fontSize: 14,
          }}
        />
      </div>

      <div
        style={{
          backgroundColor: '#e0e0e0',
          borderRadius: 8,
          padding: 16,
          flex: '1 1 45%',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <button
          style={{
            padding: '10px 16px',
            background: '#d32f2f',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
          }}
          onClick={adicionarSaidaManual}
        >
          Adicionar Saída no Caixa
        </button>
        <input
          type="text"
          placeholder="Valor (R$)"
          value={saidaValor}
          onChange={(e) => setSaidaValor(e.target.value)}
          style={{
            width: 120,
            padding: 8,
            borderRadius: 6,
            border: '1px solid #ccc',
            textAlign: 'right',
            fontSize: 14,
          }}
        />
        <input
          type="text"
          placeholder="Observações"
          value={saidaObs}
          onChange={(e) => setSaidaObs(e.target.value)}
          style={{
            flexGrow: 1,
            padding: 8,
            borderRadius: 6,
            border: '1px solid #ccc',
            fontSize: 14,
          }}
        />
      </div>
    </div>
  );
}