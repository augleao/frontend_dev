import React from 'react';

export default function ServicoEntrega({ form, onChange }) {
  return (
    <div style={{ background: '#e8f5e8', padding: '0', borderRadius: '24px', width: '100%', boxSizing: 'border-box' }}>
      <div
        style={{
          width: '100%',
          margin: '0',
          padding: 0,
          borderRadius: '24px',
          border: '3px solid #27ae60',
          boxShadow: '0 6px 32px rgba(39,174,96,0.10)',
          background: '#e8f5e8',
          overflow: 'hidden',
          boxSizing: 'border-box'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 24px 8px 24px',
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <h2 style={{ margin: 0, color: '#2c3e50', fontWeight: 700, fontSize: 16 }}>
            Entrega:
          </h2>
        </div>

        {/* Responsável, Data e Hora da Entrega */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '16px',
          marginBottom: '8px',
        }}>
          {/* Responsável */}
          <div style={{
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4
          }}>
            <label style={{ color: '#1e8449', fontWeight: 600, fontSize: 14 }}>Responsável:</label>
            <span style={{
              color: '#1e8449',
              fontWeight: 600,
              fontSize: 14,
              padding: '4px 0',
              background: 'transparent'
            }}>
              {(() => {
                const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
                return usuario.nome || usuario.email || 'Usuário';
              })()}
            </span>
          </div>
          
          {/* Data da Entrega */}
          <div style={{
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4
          }}>
            <label style={{ color: '#1e8449', fontWeight: 600, fontSize: 14 }}>Data da entrega:</label>
            <input 
              type="date" 
              value={form.entrega.data} 
              onChange={e => onChange('data', e.target.value)} 
              style={{
                width: '100%',
                border: '1.5px solid #a9dfbf',
                borderRadius: 6,
                padding: '8px 12px',
                fontSize: 14,
                boxSizing: 'border-box',
              }}
            />
          </div>
          
          {/* Hora da Entrega */}
          <div style={{
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4
          }}>
            <label style={{ color: '#1e8449', fontWeight: 600, fontSize: 14 }}>Hora da entrega:</label>
            <input 
              type="time" 
              value={form.entrega.hora} 
              onChange={e => onChange('hora', e.target.value)} 
              style={{
                width: '100%',
                border: '1.5px solid #a9dfbf',
                borderRadius: 6,
                padding: '8px 12px',
                fontSize: 14,
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Dados de Retirada */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
          marginBottom: '8px',
        }}>
          {/* Retirado Via */}
          <div style={{
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4
          }}>
            <label style={{ color: '#1e8449', fontWeight: 600, fontSize: 14 }}>Retirado via:</label>
            <input 
              type="text" 
              value={form.entrega.retiradoPor} 
              onChange={e => onChange('retiradoPor', e.target.value)} 
              style={{
                width: '100%',
                border: '1.5px solid #a9dfbf',
                borderRadius: 6,
                padding: '8px 12px',
                fontSize: 14,
                boxSizing: 'border-box',
              }}
              placeholder="Nome da pessoa que retirou"
            />
          </div>
        </div>
      </div>
    </div>
  );
}