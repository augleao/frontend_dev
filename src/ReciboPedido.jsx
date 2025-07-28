import React, { useEffect, useState } from 'react';
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

  useEffect(() => {
    async function fetchPedido() {
      try {
        const res = await fetch(`${config.apiURL}/recibo/${encodeURIComponent(protocolo)}`);
        const data = await res.json();
        console.log('ReciboPedido: resposta bruta da API', data);
        if (data && typeof data === 'object') {
          Object.keys(data).forEach(k => {
            console.log('ReciboPedido: chave', k, 'valor', data[k]);
          });
        }
        console.log('ReciboPedido: resposta da API', data);
        if (data.pedido) setPedido(data.pedido);
        else setErro('Pedido não encontrado.');
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
    <div style={{ maxWidth: 900, margin: '0 auto', background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(44,62,80,0.08)', padding: 32, fontFamily: 'Arial, sans-serif' }}>
      <div style={{ textAlign: 'right', marginBottom: 8 }}>
        <a href={window.location.href} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: '#6c3483', textDecoration: 'underline' }}>
          Abrir recibo em nova guia
        </a>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontWeight: 700 }}>Recibo de serviço</h2>
          <div style={{ fontSize: 16, margin: '8px 0' }}>
            <b>Tipo serviço:</b> <span style={{ fontWeight: 600 }}>Inscrição de CPF</span>
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
          <b>Data de entrega:</b> Acompanhar pelo portal
        </div>
        <div style={{ border: '2px dashed #aaa', borderRadius: 8, padding: 8, background: '#fafafa' }}>
          <QRCodeCanvas value={urlRecibo} size={100} />
        </div>
      </div>
      <div style={{ border: '1px solid #aaa', borderRadius: 8, padding: 12, marginBottom: 16, background: '#f8f8f8' }}>
        Consulte o andamento do seu pedido pelo QR Code ao lado ou pelo site<br/>
        <b>Protocolo:</b> {pedido.protocolo}<br/>
        <b>Chave:</b> fe345
      </div>
      <h3 style={{ marginTop: 24, marginBottom: 8, fontSize: 18 }}>Dados do CLiente:</h3>
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
  );
}
