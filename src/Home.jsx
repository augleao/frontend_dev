import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from './AuthContext';
import config from './config';

function Home() {
  const { login } = useContext(AuthContext);
  const [nome, setNome] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleInlineLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await fetch(`${config.apiURL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ nome, password })
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message || 'Erro ao fazer login.');
        return;
      }
      try { localStorage.setItem('usuario', JSON.stringify(data.user)); } catch (_) {}
      try { localStorage.setItem('token', data.token); } catch (_) {}
      if (typeof login === 'function') {
        login(data.user, data.token);
      }
      navigate('/home2');
    } catch (err) {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="home-shell">
      <style>{`
        :root {
          --navy-deep: #0b1d3a;
          --navy: #10294e;
          --navy-soft: #152f56;
          --gray-bg: #f3f4f6;
          --gray-soft: #e5e7eb;
          --white: #ffffff;
          --gold: #c9a646;
          --blue-cta: #5ca9ff;
          --text-main: #0b1324;
          --text-soft: #4b5563;
        }

        .home-shell {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          font-family: 'Inter', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
          color: var(--text-main);
          background: radial-gradient(circle at 20% 20%, rgba(255,255,255,0.08), transparent 30%),
                      radial-gradient(circle at 80% 0%, rgba(92,169,255,0.1), transparent 35%),
                      linear-gradient(135deg, #0a1630 0%, #0e2145 50%, #0b1d3a 100%);
          position: relative;
          overflow: hidden;
        }

        .home-watermark {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image:
            linear-gradient(135deg, rgba(201,166,70,0.05) 0 20%, transparent 20% 100%),
            radial-gradient(circle at 30% 40%, rgba(255,255,255,0.06), transparent 50%),
            repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 12px);
          opacity: 0.6;
        }

        .nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 48px;
          position: relative;
          z-index: 2;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--white);
          font-weight: 800;
          letter-spacing: 0.4px;
        }

        .brand-mark {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: linear-gradient(135deg, rgba(92,169,255,0.35), rgba(201,166,70,0.5));
          display: grid;
          place-items: center;
          color: var(--white);
          font-weight: 800;
          font-size: 14px;
          box-shadow: 0 10px 24px rgba(0,0,0,0.25);
        }

        .nav-links {
          display: flex;
          gap: 18px;
          color: rgba(255,255,255,0.82);
          font-weight: 600;
          justify-content: center;
          flex: 1;
        }

        .nav-links a {
          color: inherit;
          text-decoration: none;
          padding: 8px 10px;
          border-radius: 10px;
          transition: background 0.2s ease, color 0.2s ease;
        }

        .nav-links a:hover {
          background: rgba(255,255,255,0.08);
          color: var(--white);
        }

        .nav-actions {
          display: flex;
          gap: 12px;
        }

        .btn {
          border: none;
          border-radius: 12px;
          padding: 11px 18px;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.2s ease;
          font-size: 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .btn:active { transform: translateY(1px); }

        .btn-outline {
          background: transparent;
          color: var(--white);
          border: 1.5px solid rgba(255,255,255,0.5);
          box-shadow: 0 8px 20px rgba(0,0,0,0.15);
        }

        .btn-outline:hover {
          border-color: var(--blue-cta);
          color: var(--blue-cta);
          background: rgba(255,255,255,0.06);
        }

        .btn-solid {
          background: linear-gradient(135deg, var(--blue-cta), #2d7dd2);
          color: var(--white);
          box-shadow: 0 10px 24px rgba(45,125,210,0.35);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .btn-solid:hover {
          box-shadow: 0 12px 28px rgba(45,125,210,0.45);
        }

        .hero {
          position: relative;
          z-index: 2;
          display: grid;
          grid-template-columns: 1.2fr 0.9fr;
          gap: 32px;
          padding: 10px 48px 48px;
          align-items: center;
        }

        .hero-left {
          color: var(--white);
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .hero-title {
          font-size: clamp(32px, 4vw, 46px);
          line-height: 1.15;
          font-weight: 800;
        }

        .hero-sub {
          font-size: 17px;
          color: rgba(255,255,255,0.9);
          max-width: 640px;
          line-height: 1.6;
        }

        .hero-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .chip {
          padding: 8px 12px;
          border-radius: 12px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.1);
          color: var(--white);
          font-weight: 600;
          font-size: 13px;
        }

        .hero-cta {
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
          margin-top: 6px;
        }

        .cta-secondary {
          color: var(--white);
          text-decoration: none;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          opacity: 0.85;
        }

        .login-card {
          background: var(--white);
          border-radius: 18px;
          padding: 26px;
          box-shadow: 0 18px 45px rgba(0,0,0,0.18);
          border: 1px solid rgba(16,41,78,0.08);
        }

        .login-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .login-title {
          font-weight: 800;
          color: var(--text-main);
          font-size: 20px;
        }

        .badge {
          padding: 6px 10px;
          border-radius: 10px;
          background: rgba(12,109,197,0.08);
          color: #0c6dc5;
          font-weight: 700;
          font-size: 12px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 14px;
        }

        label {
          font-weight: 700;
          color: var(--text-main);
          font-size: 13px;
        }

        .input {
          border: 1px solid var(--gray-soft);
          border-radius: 12px;
          padding: 12px 14px;
          font-size: 14px;
          background: var(--gray-bg);
          transition: border 0.15s ease, box-shadow 0.15s ease;
        }

        .input:focus {
          outline: none;
          border-color: var(--blue-cta);
          box-shadow: 0 0 0 4px rgba(92,169,255,0.18);
          background: var(--white);
        }

        .login-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 8px;
          gap: 12px;
        }

        .link {
          color: var(--navy);
          font-weight: 700;
          text-decoration: none;
          font-size: 13px;
        }

        .value-section {
          position: relative;
          z-index: 2;
          margin: 24px 48px 48px;
          background: rgba(255,255,255,0.92);
          border-radius: 18px;
          padding: 22px;
          box-shadow: 0 14px 32px rgba(0,0,0,0.16);
          border: 1px solid rgba(16,41,78,0.06);
        }

        .value-title {
          font-size: 18px;
          font-weight: 800;
          color: var(--navy);
          margin-bottom: 12px;
        }

        .value-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 14px;
        }

        .card {
          background: linear-gradient(145deg, #ffffff, #f7f9fb);
          border: 1px solid rgba(16,41,78,0.06);
          border-radius: 14px;
          padding: 14px;
          display: flex;
          gap: 12px;
          align-items: flex-start;
          box-shadow: 0 8px 18px rgba(0,0,0,0.08);
        }

        .icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: rgba(16,41,78,0.08);
          display: grid;
          place-items: center;
          color: var(--navy);
          font-size: 20px;
          font-weight: 700;
        }

        .card-title {
          font-weight: 800;
          color: var(--navy);
          margin-bottom: 4px;
        }

        .card-text {
          color: var(--text-soft);
          font-size: 14px;
          line-height: 1.5;
        }

        @media (max-width: 1024px) {
          .nav {
            flex-wrap: wrap;
            gap: 12px;
          }
          .nav-links { order: 3; width: 100%; justify-content: flex-start; }
          .hero { grid-template-columns: 1fr; padding: 12px 24px 32px; }
          .login-card { order: -1; }
          .value-section { margin: 12px 24px 32px; }
        }

        @media (max-width: 640px) {
          .nav { padding: 14px 18px; }
          .hero { gap: 18px; }
          .login-card { padding: 20px; }
          .nav-actions { width: 100%; justify-content: flex-start; }
        }
      `}</style>

      <div className="home-watermark" />

      <header className="nav">
        <div className="brand">
          <div className="brand-mark">RC</div>
          <div>
            <div style={{ fontSize: 15, opacity: 0.86 }}>Controle Digital</div>
            <div style={{ fontWeight: 900, fontSize: 17 }}>Sua Serventia na sua mão!</div>
          </div>
        </div>

        <nav className="nav-links">
          <a href="#suporte">Suporte</a>
          <a href="#ajuda">Ajuda</a>
          <a href="#documentacao">Documentacao</a>
        </nav>

        <div className="nav-actions">
          <button className="btn btn-solid" onClick={() => navigate('/signup')}>Cadastrar</button>
        </div>
      </header>

      <main className="hero">
        <section className="hero-left">
          <div className="hero-title">Modernidade e segurança na gestão de seu cartório.</div>
          <div className="hero-sub">
            Controle de pedidos, selos pagos, atos gratuitos, relatorios auxiliares como CNJ, ferramentas de IA e muito mais
          </div>
          <div className="hero-chips">
            <span className="chip">Controle de Caixa</span>
            <span className="chip">Fluxos monitorados em tempo real</span>
            <span className="chip">Infraestrutura pronta para LAI e LGPD</span>
          </div>
          <div className="hero-cta">
            <button className="btn btn-solid" onClick={() => navigate('/signup')}>Criar conta agora</button>
            <a className="cta-secondary" href="#mais">Ver como funciona →</a>
          </div>
        </section>

        <section className="login-card">
          <div className="login-head">
            <div className="login-title">Acesse sua conta</div>
            <div className="badge">Ambiente seguro</div>
          </div>
          <form onSubmit={handleInlineLogin}>
            <div className="form-group">
              <label htmlFor="email">Email institucional</label>
              <input
                id="email"
                className="input"
                type="text"
                placeholder="usuario@serventia.gov.br"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div className="form-group">
              <label htmlFor="senha">Senha</label>
              <input
                id="senha"
                className="input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            {error && (
              <div style={{ color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecdd3', padding: 10, borderRadius: 10, marginBottom: 8 }}>
                {error}
              </div>
            )}
            <div className="login-footer">
              <a className="link" href="/login#recuperar">Esqueci minha senha</a>
              <button className="btn btn-solid" style={{ minWidth: 120 }} type="submit" disabled={loading}>
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </div>
          </form>
        </section>
      </main>

      <section className="value-section" id="mais">
        <div className="value-title">Feito para o cartorio moderno</div>
        <div className="value-cards">
          <div className="card">
            <div className="icon">📄</div>
            <div>
              <div className="card-title">Controle de Caixa</div>
              <div className="card-text">Controle de caixa integrado com gestao de pedidos e selos.</div>
            </div>
          </div>
          <div className="card">
            <div className="icon">📚</div>
            <div>
              <div className="card-title">Ferramentas de IA</div>
              <div className="card-text">Crie averbações, leia livros manuscritos, tanto para carga na CRC quanto para inteiro teor.</div>
            </div>
          </div>
          <div className="card">
            <div className="icon">🔒</div>
            <div>
              <div className="card-title">Seguranca Juridica</div>
              <div className="card-text">Trilhas de auditoria e criptografia em todas as etapas.</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;