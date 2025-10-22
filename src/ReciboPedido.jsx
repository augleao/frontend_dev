import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import config from './config';



export default function ReciboPedido() {
  // Oculta a NavBar se existir
  useEffect(() => {
    const nav = document.querySelector('.navbar, nav, #navbar, .NavBar');
    if (nav) nav.style.display = 'none';
    return () => {
      if (nav) nav.style.display = '';
    };
  }, []);
  const { protocolo } = useParams();
  const [pedido, setPedido] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [sharing, setSharing] = useState(false);

  // Helpers de WhatsApp (gratuitos)
  const onlyDigits = (str = '') => (str || '').replace(/\D+/g, '');
  const toBRDigitsWithCountry = (raw) => {
    const d = onlyDigits(raw);
    if (!d) return '';
    if (d.startsWith('55')) return d;
    if (d.length >= 10 && d.length <= 11) return '55' + d;
    return d;
  };
  const buildShareText = useMemo(() => {
    if (!pedido) return '';
    const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('pt-BR') : '-');
    const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('pt-BR') : '-');
    const fmtBRL = (v) => {
      const n = parseFloat(v || 0);
      try { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); } catch (_) { return `R$ ${n.toFixed(2)}`; }
    };

    const protocolo = pedido?.protocolo || '-';
    const descricao = pedido?.descricao || '-';
    const criadoEm = fmtDateTime(pedido?.criado_em);
    const previsaoEntrega = fmtDate(pedido?.previsao_entrega);

    const clienteNome = pedido?.cliente?.nome || '-';
    const clienteTelefone = pedido?.cliente?.telefone || pedido?.cliente?.celular || '-';
    const clienteCPF = pedido?.cliente?.cpf || '-';

    const serv = pedido?.serventia || {};
    const servNome = serv?.nome_completo || '-';
    const servEndereco = serv?.endereco || '-';
    const servTel = [serv?.telefone, serv?.whatsapp].filter(Boolean).join(' / ') || '-';
    const servEmail = serv?.email || '-';
    const servCNPJ = serv?.cnpj || '-';
    const servCNS = serv?.cns || '-';

    let valoresBloco = 'Nenhum valor antecipado informado.';
    if (Array.isArray(pedido?.valorAdiantadoDetalhes) && pedido.valorAdiantadoDetalhes.length > 0) {
      const linhas = pedido.valorAdiantadoDetalhes.map((item) => {
        const valor = fmtBRL(item?.valor);
        const forma = item?.forma ? ` (${item.forma})` : '';
        return `- ${valor}${forma}`;
      });
      const total = pedido.valorAdiantadoDetalhes.reduce((acc, it) => acc + (parseFloat(it?.valor || 0)), 0);
      valoresBloco = `${linhas.join('\n')}\nTotal antecipado: ${fmtBRL(total)}`;
    }

  const urlRecibo = `${window.location.origin}/recibo/${encodeURIComponent(protocolo)}`;
  const urlReciboHash = `${window.location.origin}/#${`/recibo/${encodeURIComponent(protocolo)}`}`;

    return (
      `Protocolo: ${protocolo}\n` +
      `Tipo de serviço: ${descricao}\n` +
      `Data da solicitação: ${criadoEm}\n` +
      `Previsão de entrega: ${previsaoEntrega}\n\n` +
      `Cliente\n` +
      `- Nome: ${clienteNome}\n` +
      `- Telefone: ${clienteTelefone}\n` +
      `- CPF: ${clienteCPF}\n\n` +
      `Cartório\n` +
      `- Nome: ${servNome}\n` +
      `- Endereço: ${servEndereco}\n` +
      `- Telefone/WhatsApp: ${servTel}\n` +
      `- E-mail: ${servEmail}\n` +
      `- CNPJ: ${servCNPJ}\n` +
      `- CNS: ${servCNS}\n\n` +
      `Valores antecipados\n` +
      `${valoresBloco}\n\n` +
      `Acesse o protocolo neste link: ${urlReciboHash}`
    );
  }, [pedido]);
  const getWhatsAppLink = (phoneDigits, text) => {
    const base = 'https://wa.me';
    const encoded = encodeURIComponent(text);
    if (phoneDigits) return `${base}/${phoneDigits}?text=${encoded}`;
    return `${base}/?text=${encoded}`;
  };
  const openWhatsAppDesktopOrWeb = (phoneDigits, text) => {
    const encoded = encodeURIComponent(text);
    const deep = phoneDigits
      ? `whatsapp://send?phone=${phoneDigits}&text=${encoded}`
      : `whatsapp://send?text=${encoded}`;
    const web = getWhatsAppLink(phoneDigits, text);
    // Tenta abrir o app desktop; em caso de falha, cai para WhatsApp Web
    try {
      // Navega via esquema personalizado; se não existir app, não fará nada
      window.location.href = deep;
      // Fallback após um pequeno atraso (se o app abrir, essa página deixa de estar ativa)
      setTimeout(() => {
        try { window.open(web, '_blank'); } catch (_) {}
      }, 1200);
    } catch (_) {
      // Fallback imediato
      window.open(web, '_blank');
    }
  };
  const tryWebShare = async () => {
    if (!buildShareText) return false;
    if (navigator.share) {
      try {
        await navigator.share({ text: buildShareText });
        return true;
      } catch (_) {
        return false;
      }
    }
    return false;
  };

  useEffect(() => {
    async function fetchPedido() {
      try {
        const res = await fetch(`${config.apiURL}/recibo/${encodeURIComponent(protocolo)}`);
        const data = await res.json();
        // LOG: Mostra exatamente o que foi retornado pela API
        console.log('ReciboPedido: resposta da API recebida', data);
        if (data && typeof data === 'object') {
          Object.keys(data).forEach(k => {
            console.log('ReciboPedido: chave', k, 'valor', data[k]);
          });
        }
        // LOG: Mostra o objeto pedido, se existir
        if (data.pedido) {
          console.log('ReciboPedido: objeto pedido recebido', data.pedido);
          setPedido(data.pedido);
        } else {
          setErro('Pedido não encontrado.');
        }
      } catch (err) {
        setErro('Erro ao buscar pedido.');
      }
      setLoading(false);
    }
    fetchPedido();

  }, [protocolo]);

  if (loading) return <div style={{padding: 32}}>Carregando...</div>;
  if (erro) return <div style={{padding: 32, color: 'red'}}>{erro}</div>;

  if (!pedido) {
    console.log('ReciboPedido: pedido está nulo ou indefinido');
    return null;
  }

  // Monta URL do recibo para QR code
  const urlRecibo = `${window.location.origin}/recibo/${encodeURIComponent(pedido.protocolo)}`;
  const serventia = pedido.serventia || {};
  console.log('ReciboPedido: pedido', pedido);
  if (pedido.serventia === undefined) {
    console.warn('ReciboPedido: pedido.serventia está undefined');
  } else if (pedido.serventia === null) {
    console.warn('ReciboPedido: pedido.serventia está null');
  } else {
    console.log('ReciboPedido: serventia', serventia);
    Object.keys(serventia).forEach(k => {
      console.log('ReciboPedido: serventia campo', k, 'valor', serventia[k]);
    });
  }

  // Sugestão para abrir em nova guia: pode-se usar um botão ou instrução para o usuário
  // Exemplo: <a href={window.location.href} target="_blank" rel="noopener noreferrer">Abrir recibo em nova guia</a>
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 16, fontFamily: 'Arial, sans-serif' }}>
      {/* Barra superior com ações */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'linear-gradient(180deg, #ffffff 70%, rgba(255,255,255,0))',
        padding: '12px 0 8px 0'
      }}>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={() => window.print()}
            style={{
              background: '#2c3e50', color: '#fff', border: 'none', borderRadius: 6,
              padding: '8px 14px', fontWeight: 700, cursor: 'pointer'
            }}
          >Imprimir</button>
          <button
            disabled={sharing || !(pedido?.cliente?.telefone || pedido?.cliente?.celular)}
            onClick={async () => {
              setSharing(true);
              const tel = pedido?.cliente?.telefone || pedido?.cliente?.celular || '';
              const phoneDigits = toBRDigitsWithCountry(tel);
              // Em desktop, prioriza abrir o app; se não, cai para Web. Web Share é menos relevante aqui.
              openWhatsAppDesktopOrWeb(phoneDigits, buildShareText);
              setSharing(false);
            }}
            style={{
              background: '#25D366', color: '#fff', border: 'none', borderRadius: 6,
              padding: '8px 14px', fontWeight: 700, cursor: 'pointer', opacity: sharing ? 0.8 : 1
            }}
          >Enviar via WhatsApp</button>
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(44,62,80,0.08)', padding: 32 }}>
      {/* Link removido conforme solicitado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontWeight: 700 }}>Protocolo</h2>
          <div style={{ fontSize: 16, margin: '8px 0' }}>
            <b>Tipo serviço:</b> <span style={{ fontWeight: 600 }}>{pedido.descricao || '-'}</span>
          </div>
          <div style={{ fontSize: 14 }}>
            <b>Cartório:</b> {serventia.nome_completo || '-'}<br/>
            {serventia.endereco || '-'}<br/>
            {serventia.telefone || ''}{serventia.telefone && serventia.whatsapp ? ' / ' : ''}{serventia.whatsapp || ''}<br/>
            {serventia.email ? <span>{serventia.email}<br/></span> : null}
            {serventia.cnpj ? <span><b>CNPJ:</b> {serventia.cnpj}<br/></span> : null}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 14 }}>
            <b>Pedido nº:</b> {pedido.protocolo}<br/>
            <b>CNS cartório:</b> {serventia.cns || '-'}
          </div>
          {/* <img src="/logo-crc.png" alt="CRC" style={{ height: 32, marginTop: 8 }} /> */}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div style={{ fontSize: 15 }}>
          <b>Data de solicitação:</b> {pedido.criado_em ? new Date(pedido.criado_em).toLocaleDateString() : '-'}<br/>
          <b>Previsão de entrega:</b> {pedido.previsao_entrega ? new Date(pedido.previsao_entrega).toLocaleDateString() : '-'}
        </div>
      </div>
      <h3 style={{ marginTop: 24, marginBottom: 8, fontSize: 18 }}>Dados do Cliente:</h3>
      <div style={{ fontSize: 15, marginBottom: 8 }}>
        <b>Nome:</b> {pedido.cliente?.nome || '-'}<br/>
        <b>Telefone:</b> {pedido.cliente?.telefone || '-'} &nbsp; <b>Nº do CPF:</b>  {pedido.cliente?.cpf || '-'}
      </div>
      <h3 style={{ marginTop: 24, marginBottom: 8, fontSize: 18 }}>Valores pagos pelo cliente</h3>
      <div style={{ fontSize: 15, marginBottom: 8 }}>
        {Array.isArray(pedido.valorAdiantadoDetalhes) && pedido.valorAdiantadoDetalhes.length > 0 ? (
          <>
            <b>Valores antecipados:</b>
            <ul style={{ margin: '8px 0 8px 16px', padding: 0 }}>
              {pedido.valorAdiantadoDetalhes.map((item, idx) => (
                <li key={idx} style={{ marginBottom: 2 }}>
                  Valor: R$ {parseFloat(item.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  {item.forma ? ` (${item.forma})` : ''}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <span>Nenhum valor antecipado informado.</span>
        )}
      </div>
      </div>
    </div>
  );
}
