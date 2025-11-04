import config from '../config';

const AverbacoesService = {
  async uploadAnexoPdf(id, file) {
    if (!id || !file) throw new Error('Parâmetros inválidos.');
    const token = localStorage.getItem('token');
    const form = new FormData();
    form.append('file', file, file.name || 'anexo.pdf');
    const res = await fetch(`${config.apiURL}/averbacoes-gratuitas/${encodeURIComponent(id)}/anexo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form
    });
    let data = null;
    try { data = await res.json(); } catch (_) { data = null; }
    if (!res.ok) {
      console.error('[AverbacoesService.uploadAnexoPdf] Falha no upload', { status: res.status, data });
    } else {
      console.log('[AverbacoesService.uploadAnexoPdf] Upload concluído', { status: res.status, data });
    }
    if (!res.ok) {
      const msg = (data && (data.message || data.error || data.detail)) || 'Falha no upload do anexo.';
      throw new Error(msg);
    }
    // Espera { url } vindo do backend após upload na nuvem
    return data;
  }
};

export default AverbacoesService;
