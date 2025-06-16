import React, { useState, useEffect, useRef } from 'react';

const formasPagamento = [
  { key: 'dinheiro', label: 'Dinheiro' },
  { key: 'debito', label: 'Cartão de Débito' },
  { key: 'credito', label: 'Cartão de Crédito' },
  { key: 'pix', label: 'PIX' },
  { key: 'cheque', label: 'Cheque' },
];

function formatarDataBR(dataISO) {
  const data = new Date(dataISO);
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0'); // Mês começa do zero
  const ano = data.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

function formatarValor(valor) {
  const num = parseFloat(valor);
  return !isNaN(num) ? num.toFixed(2) : '0.00';
}

function AtosPagos() {
  const [dataSelecionada, setDataSelecionada] = useState(() => {
    const hoje = new Date();
    return hoje.toISOString().slice(0, 10); // 'YYYY-MM-DD'
  });
  const [atos, setAtos] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedAto, setSelectedAto] = useState(null);
  const [valorInicialCaixa, setValorInicialCaixa] = useState(0);
  const [depositosCaixa, setDepositosCaixa] = useState(0);
  const [saidasCaixa, setSaidasCaixa] = useState(0);
  const [quantidade, setQuantidade] = useState(1);
  const [pagamentos, setPagamentos] = useState(
    formasPagamento.reduce((acc, fp) => {
      acc[fp.key] = { quantidade: 0, valor: 0, manual: false };
      return acc;
    }, {})
  );
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  const nomeUsuario = usuario?.nome || 'Usuário não identificado';

  const debounceTimeout = useRef(null);

  // Valor total calculado (valor unitário × quantidade)
  const valorTotal = selectedAto ? (selectedAto.valor_final ?? 0) * quantidade : 0;

  // Soma dos valores dos pagamentos
  const somaPagamentos = Object.values(pagamentos).reduce(
    (acc, p) => acc + (parseFloat(p.valor) || 0),
    0
  );

  // Função para comparar valores com tolerância
  const valoresIguais = (a, b, tolerancia = 0.01) => Math.abs(a - b) < tolerancia;

  // Função para calcular o valor final do caixa
  const calcularValorFinalCaixa = () => {
    const totalDinheiro = atos.reduce((acc, ato) => {
      const valorDinheiro = parseFloat(ato.pagamentos?.dinheiro?.valor) || 0;
      return acc + valorDinheiro;
    }, 0);

    return valorInicialCaixa + totalDinheiro - depositosCaixa - saidasCaixa;
  };

  // Função para formatar data e hora atual no formato desejado
  const formatarDataHoraAtual = () => {
    const agora = new Date();
    const data = agora.toISOString().slice(0, 10); // YYYY-MM-DD
    const hora = agora.toLocaleTimeString('pt-BR', { hour12: false });
    return { data, hora };
  };

const pagamentosZerados = formasPagamento.reduce((acc, fp) => {
  acc[fp.key] = { quantidade: 0, valor: 0, manual: false };
  return acc;
}, {});

  // Função para fechamento diário
  const fechamentoDiario = async () => {
    if (!window.confirm('Confirma o fechamento diário do caixa?')) return;

    const { data, hora } = formatarDataHoraAtual();

    const linhasFechamento = [
      {
        data,
        hora,
        codigo: '',
        descricao: 'Valor Inicial do Caixa',
        quantidade: 1,
        valor_unitario: valorInicialCaixa,
        pagamentos: pagamentosZerados,
        usuario: nomeUsuario,  // <-- adicionado
      },
      {
        data,
        hora,
        codigo: '',
        descricao: 'Depósitos do Caixa',
        quantidade: 1,
        valor_unitario: depositosCaixa,
        pagamentos: pagamentosZerados,
        usuario: nomeUsuario,  // <-- adicionado
      },
      {
        data,
        hora,
        codigo: '',
        descricao: 'Saídas do Caixa',
        quantidade: 1,
        valor_unitario: saidasCaixa,
        pagamentos: pagamentosZerados,
        usuario: nomeUsuario,  // <-- adicionado
      },
      {
        data,
        hora,
        codigo: '',
        descricao: 'Valor Final do Caixa',
        quantidade: 1,
        valor_unitario: calcularValorFinalCaixa(),
        pagamentos: pagamentosZerados,
        usuario: nomeUsuario,  // <-- adicionado
      },
    ];

    try {
      const token = localStorage.getItem('token');

      for (const linha of linhasFechamento) {
  console.log('Enviando fechamento:', linha);
  const res = await fetch(
    `${process.env.REACT_APP_API_URL || 'https://backend-dev-ypsu.onrender.com'}/api/atos-pagos`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(linha),
    }
  );

  let json; // Declare a variável json
  try {
    json = await res.json();
  } catch (e) {
    console.error('Erro ao parsear JSON:', e);
    alert('Erro ao parsear JSON da resposta do servidor.');
    return;
  }

  if (!res.ok) {
    console.error('Erro no backend:', json);
    alert('Erro ao salvar fechamento no banco: ' + (json.message || JSON.stringify(json)));
    return;
  }
}

      setAtos((prev) => [...prev, ...linhasFechamento]);

      alert('Fechamento diário realizado com sucesso!');
    } catch (e) {
      console.error('Erro no fechamento diário:', e);
      alert('Erro ao realizar fechamento diário.');
    }
  };

  // Buscar atos pagos para a data selecionada
  useEffect(() => {
    async function carregarAtosPorData() {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(
          `${process.env.REACT_APP_API_URL || 'https://backend-dev-ypsu.onrender.com'}/api/atos-pagos?data=${dataSelecionada}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const data = await res.json();
        if (res.ok) {
          setAtos(data.atosPagos || []);
        } else {
          setAtos([]);
        }
      } catch (e) {
        console.error('Erro ao carregar atos pagos:', e);
        setAtos([]);
      }
    }
    carregarAtosPorData();
  }, [dataSelecionada]);

  // Busca atos no backend conforme o usuário digita (debounce)
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setSuggestions([]);
      return;
    }

    setLoadingSuggestions(true);

    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);

    debounceTimeout.current = setTimeout(async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(
          `${process.env.REACT_APP_API_URL || 'https://backend-dev-ypsu.onrender.com'}/api/atos?search=${encodeURIComponent(
            searchTerm
          )}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const data = await res.json();
        if (res.ok) {
          setSuggestions(data.atos || []);
        } else {
          setSuggestions([]);
        }
      } catch (e) {
        console.error('Erro ao buscar atos:', e);
        setSuggestions([]);
      }
      setLoadingSuggestions(false);
    }, 300);

    return () => clearTimeout(debounceTimeout.current);
  }, [searchTerm]);

  // Quando seleciona um ato, reseta pagamentos e quantidade
  useEffect(() => {
    if (selectedAto) {
      setQuantidade(1);
      setPagamentos(
        formasPagamento.reduce((acc, fp) => {
          acc[fp.key] = { quantidade: 0, valor: 0, manual: false };
          return acc;
        }, {})
      );
    }
  }, [selectedAto]);

  // Atualiza quantidade e recalcula valores automáticos (exceto os manuais)
  const handlePagamentoQuantidadeChange = (key, qtd) => {
    qtd = parseInt(qtd);
    if (isNaN(qtd) || qtd < 0) qtd = 0;

    setPagamentos((prev) => {
      const novo = { ...prev };
      novo[key].quantidade = qtd;

      const valorUnitario = selectedAto?.valor_final ?? 0;

      // Se não foi editado manualmente, atualiza o valor automaticamente
      if (!novo[key].manual) {
        novo[key].valor = valorUnitario * qtd;
      }

      return novo;
    });
  };

  // Atualiza valor manualmente e marca como manual
  const handlePagamentoValorChange = (key, valor) => {
    valor = parseFloat(valor);
    if (isNaN(valor) || valor < 0) valor = 0;

    setPagamentos((prev) => ({
      ...prev,
      [key]: { ...prev[key], valor: valor, manual: true },
    }));
  };

  // Ao mudar a quantidade total do ato, recalcula os valores automáticos para os não manuais
  const handleQuantidadeChange = (qtd) => {
    qtd = parseInt(qtd);
    if (isNaN(qtd) || qtd < 1) qtd = 1;
    setQuantidade(qtd);

    setPagamentos((prev) => {
      const novo = { ...prev };
      const valorUnitario = selectedAto?.valor_final ?? 0;

      formasPagamento.forEach((fp) => {
        if (!novo[fp.key].manual) {
          novo[fp.key].valor = valorUnitario * novo[fp.key].quantidade;
        }
      });

      return novo;
    });
  };

  const adicionarAto = async () => {
    if (!selectedAto) {
      alert('Selecione um ato válido.');
      return;
    }
    const algumPagamento = Object.values(pagamentos).some((p) => p.valor > 0);
    if (quantidade < 1 || !algumPagamento) {
      alert('Informe quantidade válida e pelo menos um valor de pagamento.');
      return;
    }

    if (!valoresIguais(somaPagamentos, valorTotal)) {
      alert('A soma dos pagamentos deve ser igual ao Valor Total do ato.');
      return;
    }

    // Montar objeto para salvar no backend
    const novoAto = {
      data: dataSelecionada,
      hora: new Date().toLocaleTimeString(),
      codigo: selectedAto.codigo,
      descricao: selectedAto.descricao,
      quantidade,
      valor_unitario: selectedAto.valor_final ?? 0,
      pagamentos,
    };

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${process.env.REACT_APP_API_URL || 'https://backend-dev-ypsu.onrender.com'}/api/atos-pagos`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(novoAto),
        }
      );
      if (res.ok) {
        // Atualiza lista localmente
        setAtos((prev) => [...prev, novoAto]);
        // Resetar campos
        setSelectedAto(null);
        setSearchTerm('');
        setQuantidade(1);
        setPagamentos(
          formasPagamento.reduce((acc, fp) => {
            acc[fp.key] = { quantidade: 0, valor: 0, manual: false };
            return acc;
          }, {})
        );
        setSuggestions([]);
      } else {
        alert('Erro ao salvar ato.');
      }
    } catch (e) {
      console.error('Erro ao salvar ato:', e);
      alert('Erro ao salvar ato.');
    }
  };

  const removerAto = async (index) => {
    const atoParaRemover = atos[index];
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${process.env.REACT_APP_API_URL || 'https://backend-dev-ypsu.onrender.com'}/api/atos-pagos/${atoParaRemover.id}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.ok) {
        setAtos(atos.filter((_, i) => i !== index));
      } else {
        alert('Erro ao remover ato.');
      }
    } catch (e) {
      console.error('Erro ao remover ato:', e);
      alert('Erro ao remover ato.');
    }
  };

  return (
    <div
      style={{
        maxWidth: '100%',
        margin: '10px auto',
        padding: '32px',
        background: '#fff',
        boxShadow: '0 2px 8px #0001',
        borderRadius: 12,
      }}
    >
      <h2 style={{ textAlign: 'center', marginBottom: 8 }}>Atos Pagos</h2>

      {/* Seletor de data */}
      <div style={{ marginBottom: 24, textAlign: 'center' }}>
        <label htmlFor="dataSelecionada" style={{ marginRight: 8, fontWeight: 'bold' }}>
          Selecione a data:
        </label>
        <input
          id="dataSelecionada"
          type="date"
          value={dataSelecionada}
          onChange={(e) => setDataSelecionada(e.target.value)}
          max={new Date().toISOString().slice(0, 10)}
        />
      </div>

      {/* Campos do caixa */}
      <div
        style={{
          marginBottom: 24,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          justifyContent: 'center',
        }}
      >
        <div>
          <label>Valor Inicial do Caixa:</label>
          <input
            type="number"
            value={valorInicialCaixa}
            onChange={(e) => setValorInicialCaixa(parseFloat(e.target.value) || 0)}
            style={{
              width: 120,
              marginLeft: 8,
              padding: 6,
              borderRadius: 6,
              border: '1px solid #ccc',
              textAlign: 'right',
            }}
          />
        </div>

        <div>
          <label>Depósitos do Caixa:</label>
          <input
            type="number"
            value={depositosCaixa}
            onChange={(e) => setDepositosCaixa(parseFloat(e.target.value) || 0)}
            style={{
              width: 120,
              marginLeft: 8,
              padding: 6,
              borderRadius: 6,
              border: '1px solid #ccc',
              textAlign: 'right',
            }}
          />
        </div>

        <div>
          <label>Saídas do Caixa:</label>
          <input
            type="number"
            value={saidasCaixa}
            onChange={(e) => setSaidasCaixa(parseFloat(e.target.value) || 0)}
            style={{
              width: 120,
              marginLeft: 8,
              padding: 6,
              borderRadius: 6,
              border: '1px solid #ccc',
              textAlign: 'right',
            }}
          />
        </div>

        <div>
          <label>Valor Final do Caixa:</label>
          <input
            type="text"
            value={`R$ ${calcularValorFinalCaixa().toFixed(2)}`}
            readOnly
            style={{
              width: 120,
              marginLeft: 8,
              padding: 6,
              borderRadius: 6,
              border: '1px solid #ccc',
              backgroundColor: '#eee',
              textAlign: 'right',
            }}
          />
        </div>
      </div>

      {/* Nome do usuário */}
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
            fontWeight: 'bold',
          }}
        />
      </div>

      {/* Busca e seleção do ato */}
      <div
        style={{
          marginBottom: 16,
          position: 'relative',
          maxWidth: 400,
          marginLeft: 'auto',
          marginRight: 'auto',
        }}
      >
        <label>Buscar ato por código ou descrição:</label>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setSelectedAto(null);
          }}
          placeholder="Digite código ou descrição"
          style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc' }}
        />
        {loadingSuggestions && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              background: '#fff',
              border: '1px solid #ccc',
              width: '100%',
              zIndex: 10,
              padding: 8,
            }}
          >
            Carregando...
          </div>
        )}
        {!loadingSuggestions && suggestions.length > 0 && (
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              maxHeight: 200,
              overflowY: 'auto',
              background: '#fff',
              border: '1px solid #ccc',
              borderTop: 'none',
              zIndex: 9999,
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            }}
          >
            {suggestions.map((ato) => (
              <li
                key={ato.id}
                onClick={() => {
                  setSelectedAto(ato);
                  setSearchTerm(`${ato.codigo} - ${ato.descricao}`);
                  setSuggestions([]);
                }}
                style={{ padding: 8, cursor: 'pointer', borderBottom: '1px solid #eee' }}
              >
                {ato.codigo} - {ato.descricao} - R$ {formatarValor(ato.valor_final)}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Quantidade total do ato e Valor Total */}
      <div
        style={{
          marginBottom: 8,
          maxWidth: 400,
          marginLeft: 'auto',
          marginRight: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div>
          <label>Quantidade total do ato selecionado:</label>
          <input
            type="number"
            min={1}
            value={quantidade}
            onChange={(e) => {
              const val = e.target.value;
              setQuantidade(val);
              handleQuantidadeChange(val);
            }}
            disabled={!selectedAto}
            style={{ width: 80, marginLeft: 8, padding: 6, borderRadius: 6, border: '1px solid #ccc' }}
          />
        </div>

        <div>
          <label>Valor Total:</label>
          <input
            type="text"
            value={`R$ ${valorTotal.toFixed(2)}`}
            readOnly
            style={{
              width: 120,
              marginLeft: 8,
              padding: 6,
              borderRadius: 6,
              border: '1px solid #ccc',
              backgroundColor: '#eee',
              textAlign: 'right',
            }}
          />
        </div>
      </div>

      {/* Formas de pagamento */}
      <div style={{ marginBottom: 24 }}>
        <h4 style={{ marginBottom: 8 }}>Formas de Pagamento</h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>
          {formasPagamento.map((fp) => (
            <div
              key={fp.key}
              style={{ background: '#f5f5f5', borderRadius: 8, padding: 12, minWidth: 180 }}
            >
              <strong>{fp.label}</strong>
              <div style={{ marginTop: 8 }}>
                <label style={{ fontSize: 13 }}>Qtd:</label>
                <input
                  type="number"
                  min={0}
                  value={pagamentos[fp.key].quantidade}
                  onChange={(e) => handlePagamentoQuantidadeChange(fp.key, e.target.value)}
                  disabled={!selectedAto}
                  style={{
                    width: 50,
                    marginLeft: 4,
                    marginRight: 8,
                    borderRadius: 4,
                    border: '1px solid #ccc',
                    padding: 4,
                  }}
                />
                <label style={{ fontSize: 13 }}>Valor:</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={pagamentos[fp.key].valor}
                  onChange={(e) => handlePagamentoValorChange(fp.key, e.target.value)}
                  disabled={!selectedAto}
                  style={{
                    width: 80,
                    marginLeft: 4,
                    borderRadius: 4,
                    border: '1px solid #ccc',
                    padding: 4,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Botões Adicionar Ato e Fechamento Diário */}
      <div
        style={{
          textAlign: 'center',
          marginBottom: 32,
          display: 'flex',
          justifyContent: 'center',
          gap: 16,
        }}
      >
        <button
          style={{
            padding: '10px 24px',
            background: '#388e3c',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
          onClick={adicionarAto}
          disabled={
            !selectedAto ||
            quantidade < 1 ||
            !Object.values(pagamentos).some((p) => p.valor > 0) ||
            !valoresIguais(somaPagamentos, valorTotal)
          }
        >
          Adicionar Ato
        </button>

        <button
          style={{
            padding: '10px 24px',
            background: '#1976d2',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
          onClick={fechamentoDiario}
        >
          Fechamento Diário
        </button>
      </div>

      {/* Tabela de atos adicionados */}
      <h3 style={{ marginBottom: 12 }}>
        Atos Pagos em {dataSelecionada.split('-').reverse().join('/')}
      </h3>
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{ width: '100%', borderCollapse: 'collapse', background: '#fafafa' }}
        >
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th style={{ border: '1px solid #ddd', padding: 8 }}>Data</th>
              <th style={{ border: '1px solid #ddd', padding: 8 }}>Hora</th>
              <th style={{ border: '1px solid #ddd', padding: 8 }}>Código Tributário</th>
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
            {atos.map((ato, idx) => (
              <tr key={idx}>
                <td>{formatarDataBR(ato.data)}</td>
                <td style={{ border: '1px solid #ddd', padding: 8 }}>{ato.hora}</td>
                <td style={{ border: '1px solid #ddd', padding: 8 }}>{ato.codigo}</td>
                <td style={{ border: '1px solid #ddd', padding: 8 }}>{ato.descricao}</td>
                <td style={{ border: '1px solid #ddd', padding: 8 }}>{ato.quantidade}</td>
                <td style={{ border: '1px solid #ddd', padding: 8 }}>
                  R$ {formatarValor(ato.valor_unitario)}
                </td>
                <td style={{ border: '1px solid #ddd', padding: 8 }}>
                  {formasPagamento
                    .filter((fp) => {
                      const val = ato.pagamentos[fp.key]?.valor;
                      return (
                        val !== undefined &&
                        val !== null &&
                        !isNaN(parseFloat(val)) &&
                        parseFloat(val) > 0
                      );
                    })
                    .map((fp) => {
                      const val = ato.pagamentos[fp.key]?.valor;
                      const valorNum = parseFloat(val);
                      const valorFormatado = !isNaN(valorNum) ? valorNum.toFixed(2) : '0.00';
                      return `${fp.label}: Qtd ${
                        ato.pagamentos[fp.key]?.quantidade ?? 0
                      }, Valor R$ ${valorFormatado}`;
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
                    onClick={() => removerAto(idx)}
                  >
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AtosPagos;