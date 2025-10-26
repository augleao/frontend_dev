import React, { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from './AuthContext';

function NavBar() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const buttonStyle = {
    fontSize: '0.9rem',
    padding: '6px 14px',
    background: '#4CAF50',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    textDecoration: 'none',
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

  // Função para logout com redirecionamento para home.html
  const handleLogout = () => {
    logout(); // chama a função logout do contexto
    navigate('/home.html'); // redireciona para home.html
  };

  return (
    <nav
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
            <Link to="/admin" style={{ ...buttonStyle, background: '#1976d2' }}>
              Administração
            </Link>
          )}
          <button style={buttonStyle} onClick={handleHome}>
            Home
          </button>
          <button style={buttonStyle} onClick={handleVoltar}>
            Voltar
          </button>
          <button style={buttonStyle} onClick={handleLogout}>
            Logout
          </button>
        </>
      ) : (
        <>
          <Link to="/login" style={buttonStyle}>
            Login
          </Link>
          <Link to="/signup" style={buttonStyle}>
            Cadastro
          </Link>
        </>
      )}
    </nav>
  );
}

export default NavBar;