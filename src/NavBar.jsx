import React, { useContext, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from './AuthContext';

function NavBar() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const buttonStyle = {
    fontSize: '0.9rem',
    padding: '6px 14px',
    marginLeft: '8px',
  };

  // Função para o botão Voltar
  const handleVoltar = () => {
    navigate(-1);
  };

  // Função para o botão Home
  const handleHome = () => {
    navigate('/home2');
  };

  // Função para logout e retorno para a landing page nova
  const handleLogout = () => {
    try {
      console.log('[NavBar] logout clicked, user:', user);
    } catch (e) {
      console.log('[NavBar] logout clicked');
    }
    // Clear auth state first
    logout();
    console.log('[NavBar] logout() called, performing full-page redirect to /');
    // Use full page redirect to avoid SPA PrivateRoute re-evaluating mid-transition
    window.location.replace('/');
  };

  const navRef = useRef(null);

  useEffect(() => {
    const applyHeight = () => {
      const h = navRef.current?.offsetHeight || 0;
      const val = h > 0 ? `${h}px` : '56px';
      document.documentElement.style.setProperty('--navbar-height', val);
    };
    applyHeight();
    window.addEventListener('resize', applyHeight);
    return () => window.removeEventListener('resize', applyHeight);
  }, []);

  return (
    <nav
      ref={navRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        padding: '6px 20px',
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        background: 'linear-gradient(90deg, rgba(10,22,48,0.72), rgba(14,33,69,0.68))',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        color: 'white',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 6px 20px rgba(2,6,23,0.35)',
      }}
    >
      {user ? (
        <>
          <span style={{ 
            fontWeight: '700', 
            color: 'white', 
            marginRight: '12px', 
            fontSize: '0.9rem' 
          }}>
            👤 {user.nome || user.email}
          </span>
          {user.cargo === 'Registrador' && (
            <Link to="/admin" className="btn-gradient btn-gradient-blue" style={buttonStyle}>
              Administração
            </Link>
          )}
          <button type="button" className="btn-gradient btn-gradient-green" style={buttonStyle} onClick={handleHome}>
            Home
          </button>
          <button type="button" className="btn-gradient btn-gradient-green" style={buttonStyle} onClick={handleVoltar}>
            Voltar
          </button>
          <button type="button" className="btn-gradient btn-gradient-green" style={buttonStyle} onClick={handleLogout}>
            Logout
          </button>
        </>
      ) : (
        <>
          <Link to="/login" className="btn-gradient btn-gradient-green" style={buttonStyle}>
            Login
          </Link>
          <Link to="/signup" className="btn-gradient btn-gradient-green" style={buttonStyle}>
            Cadastro
          </Link>
        </>
      )}
    </nav>
  );
}

export default NavBar;