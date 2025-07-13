import React, { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from './AuthContext';

function NavBar() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const buttonStyle = {
    fontSize: '1.2rem',
    padding: '12px 24px',
    background: '#4CAF50',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    textDecoration: 'none',
    marginLeft: '10px',
  };

  // Função para o botão Voltar
  const handleVoltar = () => {
    window.history.back();
  };

  // Função para logout com redirecionamento para home.html
  const handleLogout = () => {
    logout(); // chama a função logout do contexto
    navigate('/home.html'); // redireciona para home.html
  };

  return (
    <nav
      style={{
        padding: '10px 20px',
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        backgroundColor: '#f0f0f0',
        borderBottom: '1px solid #ddd',
      }}
    >
      {user && user.cargo === 'Registrador' && (
        <Link to="/admin" style={{ ...buttonStyle, background: '#1976d2' }}>
          Contas
        </Link>
      )}
      {user ? (
        <>
          <span style={{ 
            fontWeight: 'bold', 
            color: '#333', 
            marginRight: '16px', 
            fontSize: '1.1rem' 
          }}>
            👤 {user.nome || user.email}
          </span>
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