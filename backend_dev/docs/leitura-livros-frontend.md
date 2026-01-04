Leitura Livros — Inteiro Teor (Frontend)

Resumo
- Endpoints relevantes:
  - `GET /leitura-livros/result/:jobId` — retorna o `payload` de registros e metadados; agora inclui `fullTextPreview`, `fullTextInline`, `fullTextAvailable`, `fullTextDownload`.
  - `GET /leitura-livros/fulltext/:jobId` — (autenticado) retorna o inteiro teor (`fulltext.txt`) do job; suporta gzip quando o cliente enviar `Accept-Encoding: gzip`.

Campos adicionados em `GET /leitura-livros/result/:jobId` (no JSON `payload`):
- `fullTextPreview` (string|null): primeiros ~2000 caracteres do inteiro teor para exibição imediata.
- `fullTextInline` (string|null): inteiro teor inline apenas quando pequeno (configurável via `LEITURA_MAX_FULLTEXT_INLINE_BYTES`).
- `fullTextAvailable` (boolean): indica se o inteiro teor está disponível para download.
- `fullTextDownload` (string|null): URL relativa para baixar o inteiro teor, ex: `/leitura-livros/fulltext/<jobId>`.

Autenticação
- Ambos endpoints requerem autenticação (o mesmo token JWT usado nas demais rotas de leitura de livros).
- Envie o header `Authorization: Bearer <token>` em todas as requests.

Exemplos de uso (frontend)

1) Buscar resultado e mostrar preview

```javascript
// Assumindo que `token` contém o JWT
async function fetchResult(jobId, token) {
  const res = await fetch(`/leitura-livros/result/${jobId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Falha ao obter resultado');
  const payload = await res.json();
  // Mostrar preview
  if (payload.fullTextPreview) {
    document.getElementById('preview').textContent = payload.fullTextPreview;
  }
  // Se o inteiro teor já veio inline, pode mostrar diretamente
  if (payload.fullTextInline) {
    document.getElementById('fulltext').textContent = payload.fullTextInline;
  }
  // Exibir botão de download se disponível
  if (payload.fullTextAvailable && payload.fullTextDownload) {
    const btn = document.getElementById('downloadFullText');
    btn.style.display = 'inline-block';
    btn.onclick = () => downloadFullText(payload.fullTextDownload, token);
  }
}
```

2) Baixar inteiro teor (stream / modal)

```javascript
async function downloadFullText(downloadUrl, token) {
  const res = await fetch(downloadUrl, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    alert('Falha ao baixar inteiro teor');
    return;
  }
  // Browsers descomprimem gzip automaticamente quando presente
  const text = await res.text();
  // Exibir em modal/área
  document.getElementById('fulltext').textContent = text;
}
```

3) Alternativa: abrir em nova aba para download

```javascript
function openFullTextDownload(downloadUrl, token) {
  // Se o backend aceitar cookies de sessão, abrir direto; para token em header, é melhor fazer fetch e criar blob
  fetch(downloadUrl, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => r.blob())
    .then(blob => {
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    });
}
```

Boas práticas
- Use `fullTextPreview` para exibir rapidamente; evite carregar inteiro teor automaticamente para não sobrecarregar UI.
- Se `fullTextInline` estiver presente, prefira essa versão pois evita round-trip adicional.
- Garanta que o usuário esteja autorizado antes de permitir download do inteiro teor (mesma autorização usada para `result`).
- Considere limpar ou paginar a exibição do inteiro teor para melhor UX em textos muito longos.

Configuração
- `LEITURA_MAX_FULLTEXT_INLINE_BYTES` (env): tamanho máximo em bytes para incluir o inteiro teor inline em `result.json`. Padrão aplicado no servidor: 200000 bytes.

Observações
- O inteiro teor é salvo em `jobs/<jobId>/fulltext.txt` no servidor; implemente política de limpeza conforme necessidade de privacidade/armazenamento.
