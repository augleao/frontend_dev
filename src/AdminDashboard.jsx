import './AdminDashboard.css';
import {
  FaArchive,
  FaBalanceScale,
  FaBoxOpen,
  FaCalendarAlt,
  FaChartArea,
  FaChartBar,
  FaCloud,
  FaCog,
  FaFileUpload,
  FaLayerGroup,
  FaMoneyBillWave,
  FaRobot,
  FaShareAlt,
  FaSignOutAlt,
  FaStar,
  FaTachometerAlt,
  FaThumbsUp,
  FaUsers
} from 'react-icons/fa';
import ConfigurarServentia from './ConfigurarServentia';
import { useMemo, useState } from 'react';
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
    { label: 'Atividades (tracker)', icon: FaChartArea, to: '/admin/tracker' },
    { label: 'Relatórios', icon: FaChartBar, to: '/relatorios' },
    { label: 'Legislação', icon: FaBalanceScale, to: '/admin/legislacao' },
    { label: 'Backup', icon: FaArchive, to: '/admin/backup' },
    { label: 'OneDrive', icon: FaCloud, to: '/admin/onedrive' },
    { label: 'Backblaze B2', icon: FaCloud, to: '/admin/backblaze' },
    { label: 'Prompts IA', icon: FaRobot, to: '/admin/prompts-ia' }
  ];

  const kpiCards = [
    {
      label: 'Earning',
      value: '$ 628',
      caption: 'Atualizado há 5 min',
      icon: FaMoneyBillWave
    },
    {
      label: 'Share',
      value: '2.434',
      caption: 'Último disparo social',
      icon: FaShareAlt
    },
    {
      label: 'Likes',
      value: '1.259',
      caption: 'Campanha ativa',
      icon: FaThumbsUp
    },
    {
      label: 'Rating',
      value: '8,5',
      caption: 'Pesquisa CNJ',
      icon: FaStar
    }
  ];

  const resultData = [
    { month: 'JAN', current: 24, previous: 18 },
    { month: 'FEB', current: 38, previous: 32 },
    { month: 'MAR', current: 28, previous: 22 },
    { month: 'APR', current: 26, previous: 20 },
    { month: 'MAY', current: 35, previous: 25 },
    { month: 'JUN', current: 48, previous: 30 },
    { month: 'JUL', current: 30, previous: 24 },
    { month: 'AUG', current: 19, previous: 21 },
    { month: 'SEP', current: 27, previous: 18 }
  ];

  const maxResultValue = useMemo(
    () => Math.max(...resultData.map((item) => Math.max(item.current, item.previous))),
    [resultData]
  );

  const calendarMatrix = [
    ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
    [null, null, 1, 2, 3, 4, 5],
    [6, 7, 8, 9, 10, 11, 12],
    [13, 14, 15, 16, 17, 18, 19],
    [20, 21, 22, 23, 24, 25, 26],
    [27, 28, 29, 30, null, null, null]
  ];

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

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <div className="dashboard-root">
      <aside className="dashboard-sidebar">
        <div className="sidebar-profile">
          <div className="sidebar-avatar">
            <span>JD</span>
          </div>
          <h2>John Don</h2>
          <p>johndon@company.com</p>
        </div>
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
          <div>
            <div className="topbar-subtitle">Dashboard</div>
            <h1>Painel Administrativo</h1>
          </div>
          <button type="button" className="topbar-action-btn" onClick={() => setShowConfigurar(true)}>
            <FaCog size={16} />
            Agentes de IA
          </button>
        </div>

        <section className="dashboard-cards">
          {kpiCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="dashboard-card">
                <div className="card-icon">
                  <Icon size={18} />
                </div>
                <div className="card-info">
                  <span className="card-label">{card.label}</span>
                  <span className="card-value">{card.value}</span>
                  <span className="card-description">{card.caption}</span>
                </div>
              </div>
            );
          })}
        </section>

        <section className="chart-grid">
          <div className="chart-card">
            <div className="chart-header">
              <div>
                <strong>Result</strong>
                <span>Comparativo {new Date().getFullYear()}</span>
              </div>
              <button type="button" className="pill-btn">
                28,79%
              </button>
            </div>
            <div className="bar-chart">
              {resultData.map((item) => (
                <div key={item.month} className="bar-column">
                  <div
                    className="bar bar-current"
                    style={{ height: `${(item.current / maxResultValue) * 100}%` }}
                  />
                  <div
                    className="bar bar-previous"
                    style={{ height: `${(item.previous / maxResultValue) * 100}%` }}
                  />
                  <span className="bar-label">{item.month}</span>
                </div>
              ))}
            </div>
            <div className="legend">
              <span>
                <span className="dot dot-primary" /> 2019
              </span>
              <span>
                <span className="dot dot-secondary" /> 2020
              </span>
            </div>
          </div>

          <div className="chart-card donut-card">
            <div className="chart-header">
              <div>
                <strong>Engajamento</strong>
                <span>Meta mensal</span>
              </div>
              <FaChartBar size={20} />
            </div>
            <div className="donut-wrapper">
              <div className="donut" />
              <div className="donut-value">45%</div>
            </div>
            <ul className="donut-list">
              <li>Lorem ipsum</li>
              <li>Lorem ipsum</li>
              <li>Lorem ipsum</li>
              <li>Lorem ipsum</li>
            </ul>
            <button type="button" className="pill-btn secondary">Agentes de IA</button>
          </div>
        </section>

        <section className="insight-grid">
          <div className="chart-card wave-card">
            <div className="chart-header">
              <div>
                <strong>Fluxo Diário</strong>
                <span>Atos registrados</span>
              </div>
              <FaChartArea size={18} />
            </div>
            <svg viewBox="0 0 360 160" preserveAspectRatio="none" className="wave-svg">
              <defs>
                <linearGradient id="waveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#ffb347" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#fdf5e6" stopOpacity="0.1" />
                </linearGradient>
                <linearGradient id="waveGradientSecondary" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#3555ff" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#d6e4ff" stopOpacity="0.1" />
                </linearGradient>
              </defs>
              <path
                d="M0 120 C40 80 80 90 120 110 C150 125 180 100 210 95 C250 88 290 110 330 90 L360 110 L360 160 L0 160 Z"
                fill="url(#waveGradient)"
                stroke="none"
              />
              <path
                d="M0 140 C50 120 90 130 130 100 C170 70 210 115 250 95 C290 75 320 120 360 105 L360 160 L0 160 Z"
                fill="url(#waveGradientSecondary)"
                stroke="none"
              />
            </svg>
            <div className="wave-legend">
              <span>
                <span className="dot dot-primary" /> Loren Ipsum
              </span>
              <span>
                <span className="dot dot-secondary" /> Dolor Amet
              </span>
            </div>
          </div>

          <div className="chart-card calendar-card">
            <div className="chart-header">
              <div>
                <strong>Calendário</strong>
                <span>Agosto</span>
              </div>
              <FaCalendarAlt size={18} />
            </div>
            <div className="calendar-grid">
              {calendarMatrix.map((row, rowIndex) => (
                <div key={`row-${rowIndex}`} className="calendar-row">
                  {row.map((cell, cellIndex) => (
                    <span
                      key={`cell-${cellIndex}`}
                      className={`calendar-cell ${cell === 13 || cell === 25 ? 'active' : ''}`}
                    >
                      {cell ?? ''}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
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