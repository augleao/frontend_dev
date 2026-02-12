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
    navigate('/'); // redireciona primeiro para a nova Home
    logout(); // depois limpa o estado de auth
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
        backgroundColor: '#f0f0f0',
        borderBottom: '1px solid #ddd',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      }}
    >
      {user ? (
        <>
          <span style={{ 
            fontWeight: 'bold', 
            color: '#333', 
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