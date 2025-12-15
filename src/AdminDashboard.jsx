import './AdminDashboard.css';
import {
  FaArchive,
  FaBalanceScale,
  FaBoxOpen,
  FaChartBar,
  FaChevronRight,
  FaCloud,
  FaCog,
  FaFileUpload,
  FaLayerGroup,
  FaRobot,
  FaSignOutAlt,
  FaTachometerAlt,
  FaUsers
} from 'react-icons/fa';
import ConfigurarServentia from './ConfigurarServentia';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [showConfigurar, setShowConfigurar] = useState(false);

  const sidebarLinks = [
    { label: 'Visão Geral', icon: FaTachometerAlt, to: '/admin' },
    { label: 'Pedidos & Serviços', icon: FaBoxOpen, to: '/manutencao-servicos' },
    { label: 'Importar Atos', icon: FaFileUpload, to: '/admin/importar-atos' },
    { label: 'Versões TJMG', icon: FaLayerGroup, to: '/admin/atos-tabelas' },
    { label: 'Usuários', icon: FaUsers, to: '/admin/usuarios' },
    { label: 'Relatórios', icon: FaChartBar, to: '/relatorios' },
    { label: 'Legislação', icon: FaBalanceScale, to: '/admin/legislacao' },
    { label: 'Backup', icon: FaArchive, to: '/admin/backup' },
    { label: 'OneDrive', icon: FaCloud, to: '/admin/onedrive' },
    { label: 'Backblaze B2', icon: FaCloud, to: '/admin/backblaze' },
    { label: 'Prompts IA', icon: FaRobot, to: '/admin/prompts-ia' }
  ];

  const featureCards = [
    {
      label: 'Central de Serviços',
      description: 'Acompanhe pedidos, execução e entrega em tempo real.',
      icon: FaBoxOpen,
      to: '/manutencao-servicos'
    },
    {
      label: 'Versões TJMG',
      description: 'Capture, compare e ative tabelas oficiais de atos do TJMG.',
      icon: FaLayerGroup,
      to: '/admin/atos-tabelas'
    },
    {
      label: 'Financeiro',
      description: 'Visualize o caixa diário e exporte relatórios.',
      icon: FaChartBar,
      to: '/caixa-diario'
    },
    {
      label: 'Equipe e Acessos',
      description: 'Gerencie perfis de usuários e permissões.',
      icon: FaUsers,
      to: '/usuarios-admin'
    },
    {
      label: 'Integrações',
      description: 'Configure OneDrive, automações e prompts IA.',
      icon: FaCloud,
      to: '/admin/onedrive'
    }
  ];

  // add Backblaze card to quick access
  featureCards.push({
    label: 'Backblaze',
    description: 'Configure Backblaze B2 (armazenamento de PDFs).',
    icon: FaCloud,
    to: '/admin/backblaze'
  });

  const quickActions = [
    {
      label: 'Configurar Serventia',
      description: 'Atualize dados institucionais e branding.',
      icon: FaCog,
      onClick: () => setShowConfigurar(true)
    },
    {
      label: 'Importar Atos',
      description: 'Suba novas tabelas 07/08 em minutos.',
      icon: FaFileUpload,
      to: '/admin/importar-atos'
    },
    {
      label: 'Versões TJMG',
      description: 'Selecione qual tabela de atos abastece o sistema.',
      icon: FaLayerGroup,
      to: '/admin/atos-tabelas'
    },
    {
      label: 'Backup Manual',
      description: 'Dispare uma cópia de segurança imediata.',
      icon: FaArchive,
      to: '/admin/backup'
    },
    {
      label: 'Prompts IA',
      description: 'Edite assistentes e roteiros inteligentes.',
      icon: FaRobot,
      to: '/admin/prompts-ia'
    }
  ];

  const handleCardClick = (entry) => {
    if (entry?.to) {
      navigate(entry.to);
    } else if (entry?.onClick) {
      entry.onClick();
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <div className="dashboard-root">
      <aside className="dashboard-sidebar">
        <div className="sidebar-logo">Bibliofilia Admin</div>
        <nav className="sidebar-nav">
          {sidebarLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.label} to={item.to} className="sidebar-link">
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-logout">
          <button type="button" className="logout-btn" onClick={handleLogout}>
            <FaSignOutAlt size={16} />
            Sair
          </button>
        </div>
      </aside>

      <main className="dashboard-main">
        <div className="dashboard-topbar">
          <div className="topbar-title">Painel de Administração</div>
          <div className="topbar-actions">
            <button type="button" className="topbar-action-btn" onClick={() => setShowConfigurar(true)}>
              <FaCog size={16} />
              Configurar Serventia
            </button>
          </div>
        </div>

        <section className="dashboard-cards">
          {featureCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                type="button"
                key={card.label}
                className="dashboard-card"
                onClick={() => handleCardClick(card)}
              >
                <div className="card-icon">
                  <Icon size={22} />
                </div>
                <div className="card-info">
                  <span className="card-label">{card.label}</span>
                  <span className="card-description">{card.description}</span>
                </div>
                <FaChevronRight className="card-chevron" size={16} />
              </button>
            );
          })}
        </section>

        <section className="dashboard-actions">
          {quickActions.map((action) => {
            const Icon = action.icon;
            if (action.to) {
              return (
                <Link key={action.label} to={action.to} className="action-btn">
                  <Icon size={18} />
                  <span>
                    <strong>{action.label}</strong>
                    <br />
                    <span className="action-description">{action.description}</span>
                  </span>
                </Link>
              );
            }
            return (
              <button
                type="button"
                key={action.label}
                className="action-btn"
                onClick={action.onClick}
              >
                <Icon size={18} />
                <span>
                  <strong>{action.label}</strong>
                  <br />
                  <span className="action-description">{action.description}</span>
                </span>
              </button>
            );
          })}
        </section>

        <section className="dashboard-extra">
          <div className="extra-placeholder">
            Dica: acompanhe os indicadores principais diariamente para antecipar gargalos nas equipes e no fluxo de atos.
          </div>
        </section>
      </main>

      {showConfigurar && (
        <div className="dashboard-modal-overlay">
          <div className="dashboard-modal">
            <ConfigurarServentia onClose={() => setShowConfigurar(false)} />
          </div>
        </div>
      )}
    </div>
  );
}