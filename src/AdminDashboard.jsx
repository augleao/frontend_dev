

import './AdminDashboard.css';
import { FaBoxOpen, FaCashRegister, FaUsers, FaChartBar, FaCog, FaSignOutAlt, FaPlus } from 'react-icons/fa';
import ConfigurarServentia from './ConfigurarServentia';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [showConfigurar, setShowConfigurar] = useState(false);

  const atalhoLinks = [
    { label: 'Pedidos/Serviços', icon: <FaBoxOpen />, to: '/manutencao-servicos' },
    { label: 'Caixa Diário', icon: <FaCashRegister />, to: '/caixa-diario' },
    { label: 'Usuários/Admin', icon: <FaUsers />, to: '/usuarios-admin' },
    { label: 'Relatórios', icon: <FaChartBar />, to: '/relatorios' },
    { label: 'Configurações', icon: <FaCog />, to: '/configurar-serventia' },
  ];

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
          <button
            style={{
              padding: '10px 20px',
              background: '#27ae60',
              color: '#fff',
              borderRadius: 8,
              border: 'none',
              fontWeight: 'bold',
              fontSize: 16,
              cursor: 'pointer',
            }}
            onClick={() => setShowConfigurar(true)}
          >
            Configurar Serventia
          </button>
          <button
            style={{
              padding: '10px 20px',
              background: '#2c3e50',
              color: '#fff',
              borderRadius: 8,
              border: 'none',
              fontWeight: 'bold',
              fontSize: 16,
              cursor: 'pointer',
            }}
            onClick={() => navigate('/admin/legislacao')}
          >
            Legislação
          </button>
          <button
            style={{
              padding: '10px 20px',
              background: '#34495e',
              color: '#fff',
              borderRadius: 8,
              border: 'none',
              fontWeight: 'bold',
              fontSize: 16,
              cursor: 'pointer',
            }}
            onClick={() => navigate('/admin/prompts-ia')}
          >
            Prompts IA
          </button>
          <button
            style={{
              padding: '10px 20px',
              background: '#1e40af',
              color: '#fff',
              borderRadius: 8,
              border: 'none',
              fontWeight: 'bold',
              fontSize: 16,
              cursor: 'pointer',
            }}
            onClick={() => navigate('/admin/onedrive')}
          >
            OneDrive
          </button>
        </div>
        <h2 style={{ margin: 0 }}>Painel de Administração</h2>
      </div>

      {/* Seção de Gerenciamento de Backups foi movida para outro componente */}
      {/* Seção de Administração de Usuários foi movida para outro componente */}
    {showConfigurar && (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0,0,0,0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}>
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 4px 24px rgba(44,62,80,0.12)' }}>
          <ConfigurarServentia onClose={() => setShowConfigurar(false)} />
        </div>
      </div>
    )}
  </div>
  );
}