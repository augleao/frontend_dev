import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function RG() {
  const navigate = useNavigate();

  const modules = [
    {
      id: 'rg-caixa',
      title: 'Financeiro (Caixa)',
      description: 'Abertura/fechamento e movimentação do caixa para emissão de RG',
      icon: '💰',
      color: '#27ae60',
      route: '/rg/caixa'
    },
    {
      id: 'rg-agenda',
      title: 'Agenda de Atendimentos',
      description: 'Gerencie os agendamentos para emissão de RG',
      icon: '📅',
      color: '#2563eb',
      route: '/rg/agenda'
    }
  ];

  const cardStyle = (color) => ({
    background: 'white',
    borderRadius: '12px',
    padding: '24px',
    cursor: 'pointer',
    boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
    border: `3px solid ${color}`,
    textAlign: 'center'
  });

  return (
    <div style={{ minHeight: '100vh', padding: 24 }}>
      <h1 style={{ color: '#2c3e50' }}>RG — Emissão da Carteira de Identidade</h1>
      <p style={{ color: '#6b7280' }}>Módulo para gestão financeira e agenda de atendimentos.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginTop: 20 }}>
        {modules.map(m => (
          <div key={m.id} style={cardStyle(m.color)} onClick={() => navigate(m.route)}>
            <div style={{ fontSize: 40 }}>{m.icon}</div>
            <h3 style={{ margin: '8px 0' }}>{m.title}</h3>
            <p style={{ color: '#6b7280' }}>{m.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
