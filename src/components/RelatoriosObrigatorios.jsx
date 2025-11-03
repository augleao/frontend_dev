import React, { useEffect, useMemo, useState } from 'react';
import config from '../config';

const RELATORIOS = [
  {
    id: 'ibge_mapa_trimestral',
    nome: 'Mapa trimestral de nascimentos, casamentos e óbitos (IBGE)',
    periodicidade: 'Trimestral',
    mesesEntrega: [0, 3, 6, 9],
    prazoDescricao: 'Até o 8º dia de janeiro, abril, julho e outubro (referente ao trimestre anterior).',
    meiosSugestao: ['fisico', 'email', 'eletronico'],
    observacaoFixa: 'Realizar o envio físico e eletrônico.'
  },
  {
    id: 'pf_estrangeiros',
    nome: 'Comunicação de atos envolvendo estrangeiros (Polícia Federal)',
    periodicidade: 'Mensal',
    prazoDescricao: 'Mensal, envio físico até o último dia útil do mês.',
    meiosSugestao: ['email', 'fisico']
  },
  {
    id: 'defensoria_paternidade',
    nome: 'Registros sem identificação de paternidade (Defensoria Pública/MG)',
    periodicidade: 'Mensal',
    prazoDescricao: 'Até o 5º dia útil de cada mês.',
    meiosSugestao: ['fisico', 'email']
  },
  {
    id: 'infodip_obitos',
    nome: 'Óbitos de cidadãos alistáveis ou inexistência (INFODIP)',
    periodicidade: 'Mensal',
    prazoDescricao: 'Até o dia 15 do mês, via sistema INFODIP.',
    meiosSugestao: ['sistema'],
    observacaoFixa: 'Registrar também a comunicação de inexistência, quando aplicável.'
  },
  {
    id: 'junta_alistamento',
    nome: 'Óbitos masculinos 17 a 45 anos (Junta de Alistamento Militar)',
    periodicidade: 'Mensal',
    prazoDescricao: 'Mensal, envio presencial com contra-recibo.',
    meiosSugestao: ['presencial'],
    destaque: 'Envio presencial obrigatório com contra-recibo.'
  },
  {
    id: 'af_minas',
    nome: 'Óbitos à Administração Fazendária/MG',
    periodicidade: 'Mensal',
    prazoDescricao: 'Até o dia 10 do mês subsequente, por mídia eletrônica aceita.',
    meiosSugestao: ['midia']
  },
  {
    id: 'detran_mg',
    nome: 'Óbitos ao DETRAN/MG',
    periodicidade: 'Mensal',
    prazoDescricao: 'Mensal, por meio físico ou eletrônico.',
    meiosSugestao: ['fisico', 'email', 'eletronico']
  },
  {
    id: 'secretaria_saude',
    nome: 'Causa mortis à Secretaria Municipal de Saúde',
    periodicidade: 'Mensal',
    prazoDescricao: 'Mensal, envio presencial com contra-recibo.',
    meiosSugestao: ['presencial'],
    destaque: 'Envio presencial obrigatório com contra-recibo.'
  },
  {
    id: 'secretaria_seguranca',
    nome: 'Óbitos à Secretaria de Segurança Pública (UF emissora da identidade)',
    periodicidade: 'Mensal',
    prazoDescricao: 'Mensal, por meio físico ou eletrônico.',
    meiosSugestao: ['fisico', 'email', 'eletronico']
  }
];

const MEIO_LABEL = {
  fisico: 'Físico',
  eletronico: 'Eletrônico',
  presencial: 'Presencial (contra-recibo)',
  email: 'E-mail',
  sistema: 'Sistema próprio',
  midia: 'Mídia eletrônica (CD/DVD/pendrive)',
  outro: 'Outro'
};

const DEFAULT_ENVIO = {
  enviado: false,
  data_envio: '',
  meios: [],
  protocolo: '',
  responsavel: '',
  observacoes: ''
};

function getUsuarioLogado() {
  try {
    return JSON.parse(localStorage.getItem('usuario')) || {};
  } catch {
    return {};
  }
}

function formatCompetencia(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function competenciaAnteriorAtual() {
  const hoje = new Date();
  hoje.setMonth(hoje.getMonth() - 1);
  return formatCompetencia(hoje);
}

function RelatoriosObrigatorios() {
  const [competencia, setCompetencia] = useState(() => competenciaAnteriorAtual());
  const [registros, setRegistros] = useState({});
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [erro, setErro] = useState('');
  const usuario = useMemo(() => getUsuarioLogado(), []);
  const serventia = usuario?.serventia;
  const nomeUsuario = usuario?.nome?.trim() || '';

  const competenciaDate = useMemo(() => {
    const [year, month] = competencia.split('-').map(Number);
    return new Date(year, (month || 1) - 1, 1);
  }, [competencia]);

  useEffect(() => {
    carregarRegistros();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competencia, serventia]);

  const carregarRegistros = async () => {
    if (!serventia) {
      setErro('Não foi possível identificar a serventia do usuário logado. Verifique seu cadastro.');
      return;
    }
    setLoading(true);
    setErro('');
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Sessão expirada. Faça login novamente.');
      const params = new URLSearchParams({ competencia, serventia });
      const response = await fetch(
        `${config.apiURL}/relatorios-obrigatorios?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Erro ao carregar registros.');
      }
      const data = await response.json();
      const map = {};
      (data.registros || []).forEach((item) => {
        map[item.relatorio_id] = {
          enviado: !!item.enviado,
          data_envio: item.data_envio || '',
          meios: Array.isArray(item.meios) ? item.meios : (item.meios ? item.meios.split(',') : []),
          protocolo: item.protocolo || '',
          responsavel: item.responsavel || nomeUsuario || '',
          observacoes: item.observacoes || '',
          atualizado_em: item.atualizado_em
        };
      });
      setRegistros(map);
    } catch (error) {
      console.error('Erro ao carregar relatórios obrigatórios:', error);
      setErro(error.message);
    } finally {
      setLoading(false);
    }
  };

  const onChangeCampo = (id, campo, valor) => {
    setRegistros((prev) => ({
      ...prev,
      [id]: {
        ...DEFAULT_ENVIO,
        ...prev[id],
        [campo]: valor,
        enviado: campo === 'data_envio' && valor ? true : campo === 'enviado' ? valor : prev[id]?.enviado || false
      }
    }));
  };

  const alternarMeio = (id, meio) => {
    setRegistros((prev) => {
      const atual = {
        ...DEFAULT_ENVIO,
        ...prev[id]
      };
      const existe = atual.meios.includes(meio);
      const meiosAtualizados = existe
        ? atual.meios.filter((m) => m !== meio)
        : [...atual.meios, meio];
      return {
        ...prev,
        [id]: {
          ...atual,
          meios: meiosAtualizados
        }
      };
    });
  };

  const salvarRegistro = async (relatorioId) => {
    const payload = {
      relatorio_id: relatorioId,
      competencia,
      ...DEFAULT_ENVIO,
      ...registros[relatorioId]
    };
    if ((!payload.responsavel || !payload.responsavel.trim()) && nomeUsuario) {
      payload.responsavel = nomeUsuario;
      setRegistros((prev) => ({
        ...prev,
        [relatorioId]: {
          ...DEFAULT_ENVIO,
          ...prev[relatorioId],
          responsavel: nomeUsuario
        }
      }));
    }
    if (!payload.enviado && !payload.data_envio) {
      if (!window.confirm('Nenhuma data de envio foi informada. Deseja salvar como "não enviado"?')) {
        return;
      }
    }
    setSavingId(relatorioId);
    setErro('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${config.apiURL}/relatorios-obrigatorios`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...payload,
          meios: payload.meios,
          serventia
        })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Erro ao salvar registro.');
      }
      await carregarRegistros();
    } catch (error) {
      console.error('Erro ao salvar relatório obrigatório:', error);
      setErro(error.message);
    } finally {
      setSavingId(null);
    }
  };

  const limparRegistro = (relatorioId) => {
    if (!window.confirm('Deseja limpar os dados registrados para este relatório?')) return;
    setRegistros((prev) => ({ ...prev, [relatorioId]: { ...DEFAULT_ENVIO } }));
  };

  const competenciaLegivel = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric'
  }).format(competenciaDate);

  return (
    <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>
      <header style={{ marginBottom: '24px' }}>
        <h1 style={{ marginBottom: '8px' }}>Relatórios Obrigatórios - Controle de Envios</h1>
        <p style={{ margin: 0, color: '#555' }}>
          Registre e acompanhe os envios mensais exigidos pelo Provimento TJMG 93/2020, art. 526.
        </p>
      </header>

      <section
        style={{
          background: '#f5f7fb',
          border: '1px solid #dbe1f1',
          borderRadius: '12px',
          padding: '18px',
          marginBottom: '24px'
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
          <label style={{ fontWeight: 600 }}>Competência:</label>
          <input
            type="month"
            value={competencia}
            onChange={(e) => setCompetencia(e.target.value)}
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid #b6c2e1',
              fontSize: '15px'
            }}
          />
          <span style={{ color: '#334', fontSize: '14px' }}>{competenciaLegivel}</span>
          <button
            onClick={carregarRegistros}
            disabled={loading}
            style={{
              padding: '10px 18px',
              background: '#2e7d32',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Atualizando...' : 'Atualizar' }
          </button>
        </div>
        <p style={{ marginTop: '12px', fontSize: '13px', color: '#666' }}>
          Utilize o campo de competência para selecionar o mês de referência do envio (por padrão, o mês anterior ao atual). As informações são salvas por mês e por relatório.
        </p>
      </section>

      {erro && (
        <div
          style={{
            background: '#fdecea',
            color: '#b71c1c',
            border: '1px solid #f5c2c7',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '24px'
          }}
        >
          {erro}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {RELATORIOS.map((relatorio) => {
          const registro = {
            ...DEFAULT_ENVIO,
            ...registros[relatorio.id]
          };
          if ((!registro.responsavel || !registro.responsavel.trim()) && nomeUsuario) {
            registro.responsavel = nomeUsuario;
          }

          const meiosDisponiveis = relatorio.meiosSugestao?.length
            ? relatorio.meiosSugestao
            : Object.keys(MEIO_LABEL);

          return (
            <div
              key={relatorio.id}
              style={{
                border: '1px solid #dbe1f1',
                borderRadius: '12px',
                padding: '20px',
                background: '#ffffff'
              }}
            >
              <header style={{ marginBottom: '16px' }}>
                <h2 style={{ margin: 0, fontSize: '18px', color: '#1b2a4b' }}>{relatorio.nome}</h2>
                <div style={{ fontSize: '13px', color: '#4f5d78', marginTop: '6px' }}>
                  <strong>Periodicidade:</strong> {relatorio.periodicidade}
                  {' | '}
                  <strong>Prazo:</strong> {relatorio.prazoDescricao}
                </div>
                {relatorio.destaque && (
                  <div
                    style={{
                      marginTop: '8px',
                      background: '#fff8e1',
                      border: '1px solid #ffe082',
                      borderRadius: '6px',
                      padding: '6px 10px',
                      fontSize: '13px',
                      color: '#8d6e63'
                    }}
                  >
                    {relatorio.destaque}
                  </div>
                )}
                {relatorio.observacaoFixa && (
                  <div style={{ marginTop: '6px', fontSize: '12px', color: '#6b6b6b' }}>
                    {relatorio.observacaoFixa}
                  </div>
                )}
              </header>

              <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontWeight: 600, fontSize: '13px' }}>Situação</label>
                  <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      checked={registro.enviado}
                      onChange={(e) => onChangeCampo(relatorio.id, 'enviado', e.target.checked)}
                    />
                    {registro.enviado ? 'Enviado' : 'Pendente'}
                  </label>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontWeight: 600, fontSize: '13px' }}>Data do envio</label>
                  <input
                    type="date"
                    value={registro.data_envio || ''}
                    onChange={(e) => onChangeCampo(relatorio.id, 'data_envio', e.target.value)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #b6c2e1'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontWeight: 600, fontSize: '13px' }}>Meio(s) de envio</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {meiosDisponiveis.map((meio) => (
                      <label key={meio} style={{ fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="checkbox"
                          checked={registro.meios.includes(meio)}
                          onChange={() => alternarMeio(relatorio.id, meio)}
                        />
                        {MEIO_LABEL[meio] || meio}
                      </label>
                    ))}
                    {!meiosDisponiveis.includes('outro') && (
                      <label style={{ fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="checkbox"
                          checked={registro.meios.includes('outro')}
                          onChange={() => alternarMeio(relatorio.id, 'outro')}
                        />
                        {MEIO_LABEL.outro}
                      </label>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontWeight: 600, fontSize: '13px' }}>Responsável pelo envio</label>
                  <input
                    type="text"
                    value={registro.responsavel}
                    onChange={(e) => onChangeCampo(relatorio.id, 'responsavel', e.target.value)}
                    placeholder="Nome do responsável"
                    style={{
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #b6c2e1'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontWeight: 600, fontSize: '13px' }}>Protocolo / Recibo</label>
                  <input
                    type="text"
                    value={registro.protocolo}
                    onChange={(e) => onChangeCampo(relatorio.id, 'protocolo', e.target.value)}
                    placeholder="Número do protocolo, recibo ou referência"
                    style={{
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #b6c2e1'
                    }}
                  />
                </div>
              </div>

              <div style={{ marginTop: '16px' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>
                  Observações
                </label>
                <textarea
                  value={registro.observacoes}
                  onChange={(e) => onChangeCampo(relatorio.id, 'observacoes', e.target.value)}
                  placeholder="Anote observações relevantes, como quem recebeu o documento ou referência do sistema."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: '1px solid #b6c2e1',
                    resize: 'vertical'
                  }}
                />
              </div>

              <footer style={{ marginTop: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => salvarRegistro(relatorio.id)}
                  disabled={savingId === relatorio.id}
                  style={{
                    padding: '10px 18px',
                    background: '#1e88e5',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: savingId === relatorio.id ? 'not-allowed' : 'pointer'
                  }}
                >
                  {savingId === relatorio.id ? 'Salvando...' : 'Salvar registro'}
                </button>
                <button
                  onClick={() => limparRegistro(relatorio.id)}
                  style={{
                    padding: '10px 16px',
                    background: '#eceff1',
                    color: '#455a64',
                    border: '1px solid #cfd8dc',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  Limpar campos
                </button>
                {registro.atualizado_em && (
                  <span style={{ fontSize: '12px', color: '#607d8b', alignSelf: 'center' }}>
                    Última atualização: {new Date(registro.atualizado_em).toLocaleString('pt-BR')}
                  </span>
                )}
              </footer>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default RelatoriosObrigatorios;
