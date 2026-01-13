import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function CartosoftIntegration() {
  const navigate = useNavigate();
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
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

  // Carregar opções de filtro ao montar o componente
  useEffect(() => {
    loadSearchOptions();
  }, []);

  const loadSearchOptions = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Você precisa estar logado para acessar esta funcionalidade');
        navigate('/login');
        return;
      }

      const response = await fetch('/api/cartosoft-search/search-options', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSearchOptions(data);
      }
    } catch (error) {
      console.error('Erro ao carregar opções:', error);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Você precisa estar logado para acessar esta funcionalidade');
        navigate('/login');
        return;
      }

      const response = await fetch('/api/cartosoft-search/search-birth-records', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(searchForm)
      });

      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.registros || []);
      } else {
        const error = await response.json();
        alert(`Erro na busca: ${error.error || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error('Erro na busca:', error);
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