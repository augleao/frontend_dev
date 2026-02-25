import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function RG() {
  const navigate = useNavigate();

  const modules = [
    { id: 'rg-agenda', title: 'Agenda', description: 'Gerenciar atendimentos agendados', icon: '📅', route: '/rg/agenda', color: '#2563eb' },
    { id: 'rg-caixa', title: 'Financeiro (Caixa)', description: 'Abertura/fechamento e movimentação do caixa', icon: '💰', route: '/rg/caixa', color: '#059669' },
    { id: 'rg-emissao', title: 'Emissão', description: 'Processo de emissão da carteira de identidade', icon: '🪪', route: '/rg/emissao', color: '#d97706' },
    { id: 'rg-relatorios', title: 'Relatórios', description: 'Relatórios e extrações', icon: '📊', route: '/rg/relatorios', color: '#7c3aed' },
  ];

  return (
    <div className="home2-shell">
      <style>{`
      :root{ --accent-1: linear-gradient(90deg,#0ea5e9,#7c3aed); }
      .home2-shell{ min-height:100vh; background: linear-gradient(180deg,#0f172a 0%, #071029 100%); padding:32px 24px; font-family: Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; }
      .home2-watermark{ position:absolute; right:-120px; top:40px; width:520px; height:520px; background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.03), transparent 30%), conic-gradient(from 120deg at 50% 50%, rgba(255,255,255,0.02), transparent 40%); filter: blur(24px) saturate(120%); transform: rotate(12deg); z-index:0 }
      .home2-main{ position:relative; z-index:5; max-width:1200px; margin:0 auto; }
      .hero-panel{ display:flex; gap:20px; align-items:stretch; margin-bottom:22px }
      .hero-copy{ flex:1; padding:24px; border-radius:12px; background: #ffffff; box-shadow:0 8px 26px rgba(2,6,23,0.08); color:#0b1d3a }
      .hero-title{ font-size:28px; font-weight:800; margin-bottom:8px; text-shadow:0 6px 14px rgba(0,0,0,0.4) }
      .hero-sub{ color: rgba(255,255,255,0.85); margin-bottom:12px }
      .hero-chips{ display:flex; gap:8px; margin-bottom:12px }
      .hero-chip{ background:rgba(255,255,255,0.03); padding:6px 10px; border-radius:999px; color:#e6eef8; font-weight:700 }
      .hero-actions{ display:flex; gap:10px }
      .btn{ padding:8px 12px; border-radius:8px; background:transparent; border:1px solid rgba(255,255,255,0.12); color:#fff; cursor:pointer }
      .mini-panel{ width:320px; padding:18px; border-radius:12px; background: #ffffff; color: #0b1d3a; box-shadow: 0 8px 20px rgba(2,6,23,0.06); border: 1px solid rgba(16,41,78,0.06); }
      .mini-title{ display:flex; flex-direction:column; gap:6px; margin-bottom:12px; font-weight:700 }
      .mini-panel .mini-title span { color: #0b1d3a; }
      .quick-links{ display:flex; flex-direction:column; gap:8px }
      .quick-link{ display:flex; gap:12px; align-items:center; padding:10px; border-radius:8px; background: rgba(11,29,58,0.03); color: #0b1d3a; cursor:pointer }
      .cards-grid{ display:grid; grid-template-columns: repeat(auto-fit,minmax(240px,1fr)); gap:18px }
      .hub-card{ background: #ffffff; border-radius:18px; padding:18px; color:#0b1d3a; box-shadow: 0 14px 32px rgba(0,0,0,0.12); border: 1px solid rgba(16,41,78,0.08); position:relative; cursor:pointer; transition: transform .15s ease }
      .hub-icon{ width:44px; height:44px; border-radius:12px; display:grid; place-items:center; font-size:22px; font-weight:800; color:#0b1d3a; background: rgba(16,41,78,0.06) }
      .hub-title{ font-size:16px; font-weight:800; color:#0b1d3a; margin-top:8px }
      .hub-desc{ color:#475569; font-size:14px; margin-top:6px }
      `}</style>

      <div className="home2-watermark" />

      <main className="home2-main">
        <div className="hero-panel">
          <div className="hero-copy">
            <div className="hero-title">Módulo RG — Gestão Financeira e Agenda</div>
            <div className="hero-sub">Acesse e gerencie o caixa e os atendimentos para emissão da carteira de identidade.</div>
            <div className="hero-chips">
              <span className="hero-chip">Agendamento</span>
              <span className="hero-chip">Emissão</span>
              <span className="hero-chip">Financeiro</span>
            </div>
            <div className="hero-actions">
              <button className="btn" onClick={() => navigate('/rg/agenda')}>Ver Agenda</button>
              <button className="btn" onClick={() => navigate('/rg/caixa')}>Abrir Caixa</button>
              <button className="btn" onClick={() => navigate('/rg/relatorios')}>Relatórios</button>
            </div>
          </div>

          <div className="mini-panel">
            <div className="mini-title">
              <span>Atalhos RG</span>
              <span style={{ color: '#9ca3af', fontWeight: 700 }}>Tudo em 1 clique</span>
            </div>
            <div className="quick-links">
              {modules.slice(0,3).map((m) => (
                <div key={m.id} className="quick-link" onClick={() => navigate(m.route)}>
                  <span style={{ fontSize: 18 }}>{m.icon}</span>
                  <span style={{ fontWeight:700 }}>{m.title}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="cards-grid">
          {modules.map((m) => (
            <div key={m.id} className="hub-card" onClick={() => navigate(m.route)} style={{ borderColor: `${m.color}22` }}>
              <div className="hub-icon" style={{ background: `${m.color}22`, color: '#0b1d3a' }}>{m.icon}</div>
              <div className="hub-title">{m.title}</div>
              <div className="hub-desc">{m.description}</div>
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: `${m.color}66`, borderRadius: '0 0 12px 12px' }} />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
