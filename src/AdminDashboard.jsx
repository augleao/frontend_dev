import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
  const navigate = useNavigate();

  // Estilos dos botões (mesmo padrão do ImportarAtos)
  const buttonStyle = {
    padding: '10px 24px',
    background: '#1976d2',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: 16,
    transition: 'background 0.2s',
  };
  return (
    <div
      style={{
        maxWidth: 1200,
        margin: '40px auto',
        padding: 20,
        border: '1px solid #ddd',
        borderRadius: 8,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', gap: 12 }}>
          <Link
            to="/admin/editar-combos"
            style={{
              padding: '10px 20px',
              background: '#8e44ad',
              color: '#fff',
              borderRadius: 8,
              textDecoration: 'none',
              fontWeight: 'bold',
              fontSize: 16,
            }}
          >
            Editar Combos
          </Link>
          <Link
            to="/admin/importar-atos"
            style={{
              padding: '10px 20px',
              background: '#1976d2',
              color: '#fff',
              borderRadius: 8,
              textDecoration: 'none',
              fontWeight: 'bold',
              fontSize: 16,
            }}
          >
            Editar Atos (Tabelas 07/08)
          </Link>
          <button
            style={{
              padding: '10px 20px',
              background: '#ff9800',
              color: '#fff',
              borderRadius: 8,
              border: 'none',
              fontWeight: 'bold',
              fontSize: 16,
              cursor: 'pointer',
            }}
            onClick={() => navigate('/admin/backup')}
          >
            Backup
          </button>
          <button
            style={{
              padding: '10px 20px',
              background: '#607d8b',
              color: '#fff',
              borderRadius: 8,
              border: 'none',
              fontWeight: 'bold',
              fontSize: 16,
              cursor: 'pointer',
            }}
            onClick={() => navigate('/admin/usuarios')}
          >
            Usuários
          </button>
        </div>
        <h2 style={{ margin: 0 }}>Painel de Administração</h2>
      </div>

      {/* Seção de Gerenciamento de Backups foi movida para outro componente */}
      {/* Seção de Administração de Usuários foi movida para outro componente */}
    </div>
  );
}