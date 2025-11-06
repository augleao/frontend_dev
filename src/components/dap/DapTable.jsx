import React from 'react';

function formatMonthYear(ano, mes) {
  if (!ano || !mes) return '—';
  return `${String(mes).padStart(2, '0')}/${ano}`;
}

function DapTable({ items = [], onSelect, onDelete, loading }) {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.debug('DapTable render', { count: items.length, sample: items[0] });
  }
  return (
    <div style={containerStyle}>
      <div style={tableWrapperStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th>Competência</th>
              <th>Tipo</th>
              <th>Status</th>
              <th>Nº DAP</th>
              <th>Data Emissão</th>
              <th>Retifica</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} style={loadingCellStyle}>
                  Carregando declarações...
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={7} style={emptyCellStyle}>
                  Nenhuma DAP cadastrada ainda. Utilize o botão “Nova DAP” para iniciar o histórico mensal.
                </td>
              </tr>
            )}
            {!loading &&
              items.map((dap) => (
                <tr key={dap.id}
                  style={{ background: dap.status === 'RETIFICADA' ? '#fef3c7' : 'transparent' }}
                >
                  <td>{formatMonthYear(dap.ano, dap.mes)}</td>
                  <td>{dap.tipo ?? 'ORIGINAL'}</td>
                  <td>
                    <span style={badgeStyle(dap.status)}>{dap.status ?? 'ATIVA'}</span>
                  </td>
                  <td>{dap.numero ?? '—'}</td>
                  <td>{dap.data_emissao ? new Date(dap.data_emissao).toLocaleDateString('pt-BR') : '—'}</td>
                  <td>
                    {dap.retificadora_de_id ? (
                      <span style={tagStyle('#1d4ed8')}>Retifica #{dap.retificadora_de_id}</span>
                    ) : dap.retificada_por_id ? (
                      <span style={tagStyle('#f97316')}>Retificada por #{dap.retificada_por_id}</span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button
                      type="button"
                      onClick={() => onSelect?.(dap)}
                      style={actionButtonStyle('#2563eb')}
                    >
                      Detalhes
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete?.(dap)}
                      style={actionButtonStyle('#dc2626')}
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

const containerStyle = {
  background: 'white',
  borderRadius: '18px',
  padding: '24px',
  boxShadow: '0 20px 50px rgba(30, 64, 175, 0.12)',
};

const tableWrapperStyle = {
  overflowX: 'auto',
};

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '14px',
};

const loadingCellStyle = {
  padding: '24px',
  textAlign: 'center',
  fontWeight: 600,
  color: '#1e3a8a',
};

const emptyCellStyle = {
  padding: '24px',
  textAlign: 'center',
  color: '#475569',
};

const badgeStyle = (status) => ({
  background: status === 'RETIFICADA' ? '#fef3c7' : '#dbeafe',
  color: status === 'RETIFICADA' ? '#b45309' : '#1d4ed8',
  padding: '6px 12px',
  borderRadius: '999px',
  fontWeight: 600,
  fontSize: '12px',
});

const tagStyle = (color) => ({
  display: 'inline-block',
  padding: '6px 10px',
  borderRadius: '8px',
  background: `${color}1a`,
  color,
  fontWeight: 600,
  fontSize: '12px',
});

const actionButtonStyle = (color) => ({
  background: color,
  color: 'white',
  border: 'none',
  borderRadius: '999px',
  padding: '8px 16px',
  fontSize: '12px',
  fontWeight: 700,
  cursor: 'pointer',
  marginRight: '8px',
  boxShadow: `0 12px 24px ${color}33`,
});

actionButtonStyle.base = {
  marginRight: '8px',
};

export default DapTable;
