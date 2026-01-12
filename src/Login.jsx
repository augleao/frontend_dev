import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from './AuthContext';
import { trackEvent, getUid } from './utils/tracker';
import config from './config';

async function checarAlertasRelatorios(token) {
  try {
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    const params = new URLSearchParams();
    if (usuario?.serventia) {
      params.append('serventia', usuario.serventia);
    }
    const queryString = params.toString();
    const url = queryString
      ? `${config.apiURL}/relatorios-obrigatorios/alertas?${queryString}`
      : `${config.apiURL}/relatorios-obrigatorios/alertas`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    if (!response.ok) return;
    const data = await response.json();
    if (Array.isArray(data.alertas) && data.alertas.length > 0) {
      const mensagem = data.alertas
        .map((alerta) => `⚠️ ${alerta.titulo}\nPrazo: ${alerta.prazoFormatado}\nCompetência: ${alerta.competencia}`)
        .join('\n\n');
      window.alert(mensagem);
    }
  } catch (error) {
    console.error('Erro ao verificar alertas de relatórios obrigatórios:', error);
  }
}

function Login() {
  const [nome, setNome] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${config.apiURL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ nome, password }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('usuario', JSON.stringify(data.user));
        localStorage.setItem('token', data.token);

        // persist track_uid locally to send in tracker payloads (cookies podem ser bloqueados)
        if (data.track_uid) {
          try { localStorage.setItem('biblio_uid', data.track_uid); } catch (e) {}
        }

        login(data.user, data.token);

        try {
          const uid = data.track_uid || getUid();
          const userId = data?.user?.id;
          const userName = data?.user?.nome;
          const payload = {
            event: 'login',
            path: '/login',
            ts: new Date().toISOString(),
            data: { method: 'password', uid, userId, userName }
          };
          
          fetch(`${config.apiURL}/tracker/events`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          })
            .then(async (res) => {
                if (!res.ok) {
                const body = await res.text().catch(() => '');
              } else {
              }
            })
            .catch((err) => {
            });
        } catch (e) {
        }

        await checarAlertasRelatorios(data.token);

        navigate('/home2');
      } else {
        setError(data.message || 'Erro ao fazer login.');
      }
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      maxWidth: '400px', 
      margin: '50px auto', 
      padding: '20px',
      border: '1px solid #ddd',
      borderRadius: '8px',
      backgroundColor: '#f9f9f9'
    }}>
      <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Login</h2>
      
      {error && (
        <div style={{ 
          color: 'red', 
          backgroundColor: '#ffe6e6', 
          padding: '10px', 
          borderRadius: '4px', 
          marginBottom: '15px',
          textAlign: 'center'
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Nome:
          </label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Digite seu nome"
            autoComplete="username"
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '16px'
            }}
            required
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Senha:
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Digite sua senha"
            autoComplete="current-password"
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '16px'
            }}
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: loading ? '#ccc' : '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '16px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: '15px' }}>
        <p>
        </p>
      </div>
    </div>
  );
}

export default Login;