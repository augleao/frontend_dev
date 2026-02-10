import React from 'react';
import { useNavigate } from 'react-router-dom';
import './RG.css';

export default function RG() {
  const navigate = useNavigate();

  const modules = [
    {
      id: 'rg-caixa',
      title: 'Financeiro (Caixa)',
      description: 'Abertura, movimentação e fechamento inteligente do caixa exclusivo do RG.',
      icon: '💰',
      color: '#27ae60',
      route: '/rg/caixa'
    },
    {
      id: 'rg-agenda',
      title: 'Agenda de Atendimentos',
      description: 'Organize horários, acompanhe status e mantenha o fluxo de atendimento sincronizado.',
      icon: '📅',
      color: '#2563eb',
      route: '/rg/agenda'
    },
    {
      id: 'rg-relatorios',
      title: 'Relatórios Financeiros',
      description: 'Visualize receitas, despesas e tributos projetados para recolhimento do RG.',
      icon: '📊',
      color: '#f59e0b',
      route: '/rg/relatorios'
    },
    {
      id: 'rg-fechamentos',
      title: 'Fechamentos de Caixa',
      description: 'Histórico consolidado dos fechamentos diários para auditoria e conferência.',
      icon: '🗂️',
      color: '#1f8ef1',
      route: '/rg/meus-fechamentos'
    }
  ];

  const formatPillLabel = (id) => id.replace(/^rg-/, 'RG ').replace(/-/g, ' ').toUpperCase();

  const handleNavigate = (route) => navigate(route);

  const handleCardKey = (event, route) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleNavigate(route);
    }
  };

  return (
    <div className="rg-page">
      <main className="rg-content">
        <header className="rg-hero">
          <div className="rg-hero-text">
            <span className="rg-hero-eyebrow">plataforma exclusiva</span>
            <h1 className="rg-hero-title">RG — Emissão da Carteira de Identidade</h1>
            <p className="rg-hero-subtitle">
              Centralize finanças, agenda e relatórios do módulo RG em uma experiência otimizada para desktop e iPhone.
            </p>
          </div>
          <div className="rg-hero-badge">Mobile-ready · iOS otimizado</div>
        </header>

        <section className="rg-intro">
          <h2>Módulo RG — Gestão Financeira e Agenda</h2>
          <p>
            Navegue por cada fluxo do RG com cartões responsivos: caixa diário, agenda, fechamentos e relatórios de arrecadação em um só lugar.
          </p>
        </section>

        <section className="rg-module-grid">
          {modules.map((module) => (
            <div
              key={module.id}
              className="rg-module-card"
              role="button"
              tabIndex={0}
              style={{ '--accent-color': module.color }}
              onClick={() => handleNavigate(module.route)}
              onKeyDown={(event) => handleCardKey(event, module.route)}
            >
              <div className="rg-module-card-icon">{module.icon}</div>
              <span className="rg-module-card-pill">{formatPillLabel(module.id)}</span>
              <h3 className="rg-module-card-title">{module.title}</h3>
              <p className="rg-module-card-desc">{module.description}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
