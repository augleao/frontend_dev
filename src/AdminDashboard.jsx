

import React from 'react';
import './AdminDashboard.css';
import { FaBoxOpen, FaCashRegister, FaUsers, FaChartBar, FaCog, FaSignOutAlt, FaPlus } from 'react-icons/fa';

export default function AdminDashboard() {
  // Mock de dados de resumo
  const resumo = [
    { label: 'Pedidos', value: 128, icon: <FaBoxOpen color="#8e44ad" /> },
    { label: 'Caixa do Dia', value: 'R$ 2.350,00', icon: <FaCashRegister color="#2874a6" /> },
    { label: 'Usuários Ativos', value: 12, icon: <FaUsers color="#27ae60" /> },
    { label: 'Relatórios', value: 7, icon: <FaChartBar color="#e67e22" /> },
  ];

  const atalhoLinks = [
    { label: 'Pedidos/Serviços', icon: <FaBoxOpen />, to: '/manutencao-servicos' },
    { label: 'Caixa Diário', icon: <FaCashRegister />, to: '/caixa-diario' },
    { label: 'Usuários/Admin', icon: <FaUsers />, to: '/usuarios-admin' },
    { label: 'Relatórios', icon: <FaChartBar />, to: '/relatorios' },
    { label: 'Configurações', icon: <FaCog />, to: '/configurar-serventia' },
  ];

  return (
    <div className="dashboard-root">
      {/* Sidebar */}
      <aside className="dashboard-sidebar">
        <div className="sidebar-logo">Bibliofilia</div>
        <nav className="sidebar-nav">
          {atalhoLinks.map(link => (
            <a key={link.label} href={link.to} className="sidebar-link">
              {link.icon}
              <span>{link.label}</span>
            </a>
          ))}
        </nav>
        <div className="sidebar-logout">
          <button className="logout-btn"><FaSignOutAlt /> Sair</button>
        </div>
      </aside>

      {/* Main content */}
      <div className="dashboard-main">
        {/* Topbar */}
        <header className="dashboard-topbar">
          <div className="topbar-title">Painel Administrativo</div>
          <div className="topbar-user">Olá, Administrador</div>
        </header>

        {/* Cards de resumo */}
        <div className="dashboard-cards">
          {resumo.map(card => (
            <div className="dashboard-card" key={card.label}>
              <div className="card-icon">{card.icon}</div>
              <div className="card-info">
                <div className="card-label">{card.label}</div>
                <div className="card-value">{card.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Atalhos rápidos */}
        <div className="dashboard-actions">
          <a href="/manutencao-servicos" className="action-btn"><FaPlus /> Novo Pedido</a>
          <a href="/caixa-diario" className="action-btn"><FaCashRegister /> Caixa Diário</a>
          <a href="/relatorios" className="action-btn"><FaChartBar /> Relatórios</a>
        </div>

        {/* Espaço para gráficos ou lista de atividades recentes */}
        <div className="dashboard-extra">
          <div className="extra-placeholder">
            {/* Aqui você pode adicionar gráficos, tabelas ou atividades recentes */}
            <span style={{ color: '#aaa' }}>[Gráficos e atividades recentes]</span>
          </div>
        </div>
      </div>
    </div>
  );
}