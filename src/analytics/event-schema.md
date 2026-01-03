Esquema mínimo de eventos para captura no frontend

Resumo
- Objetivo: permitir reconstruir sessões e analisar comportamento sem PII.
- Enviar JSON por evento ou em lote; usar `sessionId` para correlacionar com logins.

Campos recomendados (mínimo)
- eventType: string (page_view | navigation | click | form_submit | ui_interaction | error)
- eventId: string (uuid)
- userId: string|null (quando disponível)
- sessionId: string (gerado no cliente)
- timestamp: ISO 8601 (UTC)
- url: string (rota atual)
- referrer: string|null
- clientVersion: string (app/frontend version)
- sequence: integer (incremental por sessão)
- metadata: object (campo livre com detalhes específicos do evento)

Exemplos de `metadata` por evento
- page_view: { "route": "/atos", "params": {"q":"..."} }
- click: { "selector": "#btn-salvar", "text": "Salvar", "dataset": {"track":"true"} }
- form_submit: { "formId": "loginForm", "fields": {"email":"HASHED_OR_MASKED"} }
- navigation: { "from": "/home", "to": "/config", "action": "push" }
- error: { "message": "TypeError...", "stack": "<stack>", "source": "bundle.js" }

JSON de exemplo (page_view)
{
  "eventType": "page_view",
  "eventId": "b6b8f2d8-...",
  "userId": "user-123", 
  "sessionId": "sess-456",
  "timestamp": "2026-01-03T12:34:56.789Z",
  "url": "https://app.example/atos?q=test",
  "referrer": "https://app.example/home",
  "clientVersion": "1.0.0",
  "sequence": 12,
  "metadata": { "route": "/atos", "params": {"q":"test"} }
}

Boas práticas
- Nunca enviar senhas ou dados sensíveis; envie hashes quando estritamente necessário.
- Use `navigator.sendBeacon` em unload; faça batching para reduzir chamadas.
- Indexar `sessionId`, `userId`, `timestamp` no backend para consultas rápidas.
- Adicionar um campo `sampleRate` se for necessário reduzir volume.

Integração com eventos de login já existentes
- Ao gravar o evento de login no DB, correlacione `sessionId` do cliente com o registro de login para ligar sessões e eventos de navegação.
