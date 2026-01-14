import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import config from './config';

function CartosoftIntegration() {
  const navigate = useNavigate();
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cartosoftAuth, setCartosoftAuth] = useState({
    isAuthenticated: false,
    accessToken: null,
    cookies: null,
    loading: false
  });
  const [loginForm, setLoginForm] = useState({
    username: '',
    password: ''
  });
  const [searchForm, setSearchForm] = useState({
    nome: '',
    dataNascimento: '',
    nomePai: '',
    nomeMae: '',
    municipio: '',
    uf: '',
    pagina: 0,
    tamanho: 20
  });
  const [searchOptions, setSearchOptions] = useState({
    municipios: [],
    ufs: []
  });

  const loadSearchOptions = useCallback(async () => {
    if (!cartosoftAuth.isAuthenticated) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Você precisa estar logado para acessar esta funcionalidade');
        navigate('/login');
        return;
      }

      const response = await fetch(`${config.apiURL}/cartosoft-integration/search-options-with-token`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          accessToken: cartosoftAuth.accessToken,
          cookies: cartosoftAuth.cookies
        })
      });

      if (response.ok) {
        const data = await response.json();
        setSearchOptions(data);
      } else {
        console.error('Erro ao carregar opções:', response.status);
        // Fallback para dados mockados se a API falhar
        setSearchOptions({
          municipios: [
            { id: 1, nome: 'Belo Horizonte', uf: 'MG' },
            { id: 2, nome: 'Contagem', uf: 'MG' },
            { id: 3, nome: 'Betim', uf: 'MG' }
          ],
          ufs: [
            { id: 1, sigla: 'MG', nome: 'Minas Gerais' },
            { id: 2, sigla: 'SP', nome: 'São Paulo' },
            { id: 3, sigla: 'RJ', nome: 'Rio de Janeiro' }
          ]
        });
      }
    } catch (error) {
      console.error('Erro ao carregar opções:', error);
      // Fallback para dados mockados
      setSearchOptions({
        municipios: [
          { id: 1, nome: 'Belo Horizonte', uf: 'MG' },
          { id: 2, nome: 'Contagem', uf: 'MG' },
          { id: 3, nome: 'Betim', uf: 'MG' }
        ],
        ufs: [
          { id: 1, sigla: 'MG', nome: 'Minas Gerais' },
          { id: 2, sigla: 'SP', nome: 'São Paulo' },
          { id: 3, sigla: 'RJ', nome: 'Rio de Janeiro' }
        ]
      });
    }
  }, [cartosoftAuth, navigate]);

  // Função para fazer login no Cartosoft
  const handleCartosoftLogin = async (e) => {
    e.preventDefault();
    setCartosoftAuth(prev => ({ ...prev, loading: true }));

    try {
      console.log('🔐 Fazendo login no Cartosoft via backend...');

      const token = localStorage.getItem('token');
      if (!token) {
        alert('Você precisa estar logado para acessar esta funcionalidade');
        navigate('/login');
        return;
      }

      const response = await fetch(`${config.apiURL}/cartosoft-integration/login-with-credentials`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: loginForm.username,
          password: loginForm.password
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Erro ${response.status}`);
      }

      const loginData = await response.json();
      console.log('✅ Login no Cartosoft bem-sucedido via backend!');

      setCartosoftAuth({
        isAuthenticated: true,
        accessToken: loginData.accessToken,
        cookies: loginData.cookies,
        loading: false
      });

      // Enviar tokens para o backend (opcional, para futuras sessões)
      await sendTokensToBackend(loginData.accessToken, loginData.cookies);

      // Carregar opções após login
      setTimeout(() => loadSearchOptions(), 500);

    } catch (error) {
      console.error('❌ Erro no login do Cartosoft:', error.message);
      alert(`Erro no login do Cartosoft: ${error.message}`);
      setCartosoftAuth(prev => ({ ...prev, loading: false }));
    }
  };

  // Função para enviar tokens para o backend
  const sendTokensToBackend = async (accessToken, cookies) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${config.apiURL}/cartosoft-integration/login-frontend`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          accessToken,
          cookies
        })
      });

      if (response.ok) {
        console.log('✅ Tokens enviados para o backend com sucesso');
      } else {
        console.error('❌ Erro ao enviar tokens para o backend');
      }
    } catch (error) {
      console.error('❌ Erro ao enviar tokens para o backend:', error);
    }
  };

  // Função para fazer logout do Cartosoft
  const handleCartosoftLogout = () => {
    setCartosoftAuth({
      isAuthenticated: false,
      accessToken: null,
      cookies: null,
      loading: false
    });
    setSearchOptions({ municipios: [], ufs: [] });
    setSearchResults([]);
    console.log('👋 Logout do Cartosoft realizado');
  };

  // Carregar opções de filtro quando autenticado no Cartosoft
  useEffect(() => {
    if (cartosoftAuth.isAuthenticated) {
      loadSearchOptions();
    }
  }, [cartosoftAuth.isAuthenticated, loadSearchOptions]);

  const handleSearch = async (e) => {
    e.preventDefault();

    if (!cartosoftAuth.isAuthenticated) {
      alert('Você precisa fazer login no Cartosoft primeiro');
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Você precisa estar logado para acessar esta funcionalidade');
        navigate('/login');
        return;
      }

      const response = await fetch(`${config.apiURL}/cartosoft-integration/search-birth-records-with-token`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...searchForm,
          accessToken: cartosoftAuth.accessToken,
          cookies: cartosoftAuth.cookies
        })
      });

      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.registros || []);
        console.log(`✅ Busca concluída: ${data.registros?.length || 0} registros encontrados`);
      } else {
        const error = await response.json();
        console.error('❌ Erro na busca:', error);
        alert(`Erro na busca: ${error.error || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error('❌ Erro na busca:', error);
      alert('Erro ao conectar com o servidor Cartosoft. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setSearchForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleLoginInputChange = (e) => {
    const { name, value } = e.target;
    setLoginForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: 'Arial, sans-serif',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        background: 'white',
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)',
          color: 'white',
          padding: '24px',
          textAlign: 'center'
        }}>
          <h1 style={{
            margin: '0 0 8px 0',
            fontSize: '28px',
            fontWeight: '600'
          }}>
            🔍 Integração Cartosoft Web
          </h1>
          <p style={{
            margin: 0,
            fontSize: '16px',
            opacity: 0.9
          }}>
            Busque registros de nascimento diretamente do sistema Cartosoft
          </p>
        </div>

        {/* Search Form */}
        <div style={{ padding: '32px' }}>
          {/* Cartosoft Login Form */}
          {!cartosoftAuth.isAuthenticated ? (
            <div style={{
              background: '#fff3cd',
              border: '1px solid #ffeaa7',
              borderRadius: '12px',
              padding: '24px',
              marginBottom: '32px'
            }}>
              <h3 style={{
                margin: '0 0 20px 0',
                color: '#856404',
                fontSize: '20px'
              }}>
                🔐 Login no Cartosoft
              </h3>
              <p style={{
                margin: '0 0 20px 0',
                color: '#856404',
                fontSize: '14px'
              }}>
                Você precisa fazer login no Cartosoft para realizar buscas nos registros de nascimento.
              </p>

              <form onSubmit={handleCartosoftLogin} style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '16px',
                alignItems: 'end'
              }}>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '4px',
                    fontWeight: '500',
                    color: '#495057'
                  }}>
                    Usuário Cartosoft
                  </label>
                  <input
                    type="text"
                    name="username"
                    value={loginForm.username}
                    onChange={handleLoginInputChange}
                    placeholder="Digite seu usuário"
                    required
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #ced4da',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '4px',
                    fontWeight: '500',
                    color: '#495057'
                  }}>
                    Senha Cartosoft
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={loginForm.password}
                    onChange={handleLoginInputChange}
                    placeholder="Digite sua senha"
                    required
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #ced4da',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={cartosoftAuth.loading}
                    style={{
                      background: cartosoftAuth.loading ? '#6c757d' : '#ffc107',
                      color: cartosoftAuth.loading ? 'white' : '#212529',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: cartosoftAuth.loading ? 'not-allowed' : 'pointer',
                      transition: 'background 0.3s ease'
                    }}
                  >
                    {cartosoftAuth.loading ? '🔄 Fazendo login...' : '🔐 Entrar no Cartosoft'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div style={{
              background: '#d4edda',
              border: '1px solid #c3e6cb',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '32px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{
                color: '#155724',
                fontSize: '16px',
                fontWeight: '500'
              }}>
                ✅ Autenticado no Cartosoft
              </div>
              <button
                onClick={handleCartosoftLogout}
                style={{
                  background: '#dc3545',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'background 0.3s ease'
                }}
              >
                👋 Sair do Cartosoft
              </button>
            </div>
          )}

          {/* Search Form */}
          {cartosoftAuth.isAuthenticated && (
            <form onSubmit={handleSearch} style={{
              background: '#f8f9fa',
              padding: '24px',
              borderRadius: '12px',
              marginBottom: '32px'
            }}>
            <h3 style={{
              margin: '0 0 20px 0',
              color: '#2c3e50',
              fontSize: '20px'
            }}>
              📋 Critérios de Busca
            </h3>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '16px',
              marginBottom: '24px'
            }}>
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '4px',
                  fontWeight: '500',
                  color: '#495057'
                }}>
                  Nome
                </label>
                <input
                  type="text"
                  name="nome"
                  value={searchForm.nome}
                  onChange={handleInputChange}
                  placeholder="Digite o nome completo"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ced4da',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '4px',
                  fontWeight: '500',
                  color: '#495057'
                }}>
                  Data de Nascimento
                </label>
                <input
                  type="date"
                  name="dataNascimento"
                  value={searchForm.dataNascimento}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ced4da',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '4px',
                  fontWeight: '500',
                  color: '#495057'
                }}>
                  Nome do Pai
                </label>
                <input
                  type="text"
                  name="nomePai"
                  value={searchForm.nomePai}
                  onChange={handleInputChange}
                  placeholder="Digite o nome do pai"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ced4da',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '4px',
                  fontWeight: '500',
                  color: '#495057'
                }}>
                  Nome da Mãe
                </label>
                <input
                  type="text"
                  name="nomeMae"
                  value={searchForm.nomeMae}
                  onChange={handleInputChange}
                  placeholder="Digite o nome da mãe"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ced4da',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '4px',
                  fontWeight: '500',
                  color: '#495057'
                }}>
                  Município
                </label>
                <select
                  name="municipio"
                  value={searchForm.municipio}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ced4da',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  <option value="">Selecione um município</option>
                  {searchOptions.municipios.map(mun => (
                    <option key={mun.id} value={mun.nome}>
                      {mun.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '4px',
                  fontWeight: '500',
                  color: '#495057'
                }}>
                  UF
                </label>
                <select
                  name="uf"
                  value={searchForm.uf}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ced4da',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  <option value="">Selecione uma UF</option>
                  {searchOptions.ufs.map(uf => (
                    <option key={uf.id} value={uf.sigla}>
                      {uf.sigla} - {uf.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <button
                type="submit"
                disabled={loading}
                style={{
                  background: loading ? '#6c757d' : '#4CAF50',
                  color: 'white',
                  border: 'none',
                  padding: '12px 32px',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'background 0.3s ease'
                }}
              >
                {loading ? '🔄 Buscando...' : '🔍 Buscar Registros'}
              </button>
            </div>
          </form>
          )}

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div>
              <h3 style={{
                margin: '0 0 20px 0',
                color: '#2c3e50',
                fontSize: '20px'
              }}>
                📊 Resultados da Busca ({searchResults.length} registros encontrados)
              </h3>

              <div style={{
                display: 'grid',
                gap: '16px'
              }}>
                {searchResults.map((registro, index) => (
                  <div key={registro.id || index} style={{
                    background: 'white',
                    border: '1px solid #e9ecef',
                    borderRadius: '8px',
                    padding: '20px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)'
                  }}>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '16px'
                    }}>
                      <div>
                        <strong>Nome:</strong> {registro.nome}
                      </div>
                      <div>
                        <strong>Data Nascimento:</strong> {formatDate(registro.dataNascimento)}
                      </div>
                      <div>
                        <strong>Nome do Pai:</strong> {registro.nomePai || 'Não informado'}
                      </div>
                      <div>
                        <strong>Nome da Mãe:</strong> {registro.nomeMae || 'Não informado'}
                      </div>
                      <div>
                        <strong>Município:</strong> {registro.municipio}
                      </div>
                      <div>
                        <strong>UF:</strong> {registro.uf}
                      </div>
                      <div>
                        <strong>Nº Registro:</strong> {registro.numeroRegistro}
                      </div>
                      <div>
                        <strong>Data Registro:</strong> {formatDate(registro.dataRegistro)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {searchResults.length === 0 && !loading && (
            <div style={{
              textAlign: 'center',
              color: '#6c757d',
              fontSize: '16px',
              padding: '40px'
            }}>
              🔍 Nenhum resultado encontrado. Tente ajustar os critérios de busca.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CartosoftIntegration;