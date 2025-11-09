
# Rotas do Backend - Projeto Bibliofilia

## Pedidos
- `GET    /api/pedidos`                → Lista todos os pedidos
- `POST   /api/pedidos`                → Cria um novo pedido
- `GET    /api/pedidos/:protocolo`     → Busca detalhes de um pedido
- `DELETE /api/pedidos/:protocolo`     → Exclui um pedido
- `POST   /api/pedidos/:protocolo/status`         → Adiciona um novo status ao pedido
- `GET    /api/pedidos/:protocolo/status/ultimo`  → Busca o status mais recente do pedido

## Combos
- `GET    /api/combos`                  → Lista todos os combos
- `GET    /api/admin/combos/listar`     → Lista combos (admin)
- `GET    /api/admin/combos`            → Lista combos (admin)
- `GET    /api/admin/combos/:id`        → Detalhe combo (admin)

## Códigos Tributários
- `GET    /api/codigos-tributarios?s=...` → Busca sugestões de códigos tributários
- `GET    /api/codigos-gratuitos?search=...` → Busca códigos gratuitos

## Clientes
- `GET    /api/clientes`                 → Lista todos os clientes
- `POST   /api/clientes`                 → Cria um novo cliente
- `GET    /api/clientes?search=...`      → Busca clientes por termo
- `GET    /api/clientes/:id`             → Busca detalhes de um cliente

## Atos
- `GET    /api/atos`                     → Lista todos os atos
- `GET    /api/atos?search=...`          → Busca atos por termo
- `GET    /api/atos?busca=...`           → Busca atos por busca
- `GET    /api/atos-tabela?data=...`     → Busca tabela de atos por data
- `GET    /api/atos-praticados?data=...` → Busca atos praticados por data
- `GET    /api/atos-praticados/:id`      → Busca ato praticado por id
- `DELETE /api/atos-praticados/:id`      → Remove ato praticado

## Declaração de Apuração (DAP)
- `POST   /api/dap/upload`               → Recebe o PDF da DAP, dispara parser e cria registro (retorna { dapId, status })
- `GET    /api/dap`                      → Lista DAPs (filtros: codigoServentia, ano, mes, retificadora, status)
- `POST   /api/dap`                      → Cria DAP manualmente (usar apenas em reprocessamentos sem upload)
- `GET    /api/dap/:id`                  → Retorna cabeçalho, períodos e atos snapshot
- `POST   /api/dap/:id/retificar`        → Cria DAP retificadora vinculada à original
- `DELETE /api/dap/:id`                  → Exclui DAP (validar impacto em retificadoras relacionadas)
- `GET    /api/dap/:id/download`         → (Opcional) devolve PDF armazenado do upload

## Relatórios
- `GET    /api/meus-relatorios`           → Lista relatórios do usuário
- `POST   /api/salvar-relatorio`          → Salva relatório
- `DELETE /api/excluir-relatorio/:id`     → Exclui relatório

## Caixa Diário
- `GET    /api/meus-fechamentos`          → Lista fechamentos do caixa diário

## Upload
- `POST   /api/upload`                    → Upload de arquivos

## Autenticação e Usuários
- `POST   /api/login`                     → Login
- `POST   /api/signup`                    → Cadastro
- `GET    /api/users`                     → Lista usuários

## Outros
- `GET    /api/importar-atos-pdf`         → Importa atos via PDF
- `GET    /api/busca-atos/pesquisa?...`   → Pesquisa de atos

---

> **Observação:**
> Esta lista foi atualizada automaticamente a partir dos componentes do frontend. Rotas duplicadas ou variantes podem ser ajustadas conforme a padronização do backend.

---

## Averbações Gratuitas


### IA - Análise de Mandado (Google Gemini 1.5 Flash)

- GET  /api/ia/health → Healthcheck simples (ok, modelo e stub)
- POST /api/ia/analise-mandado
	- Autenticação: Bearer token (mesmo esquema do app)
	- Consumo: multipart/form-data
		- file: PDF do mandado judicial (required)
		- metadata (opcional): JSON serializado em campo texto, ex.: { "tipoAto": "averbacao", "data": "2025-10-27" }
	- Processo no backend:
		1. Extrair texto do PDF (ex.: pdf-parse)
		2. Recuperar legislação relevante do Postgres via Full-Text Search (tsvector/tsquery) com base no texto
			 - Tabela de legislação e/ou regras definidas no DB
			 - Selecionar top N trechos (5–10) e montar contexto
		3. Chamar Google Gemini 1.5 Flash com prompt e contexto montado
		4. Validar e normalizar a saída (JSON)
	- Resposta 200 (exemplo):
		{
			"aprovado": true,
			"motivos": ["Todos os requisitos formais atendidos"],
			"checklist": [
				{ "requisito": "Assinatura do juiz", "ok": true },
				{ "requisito": "Identificação das partes", "ok": true }
			],
			"textoAverbacao": "Averba-se, por mandado judicial..."
		}
	- Erros: 400 (PDF inválido), 404 (legislação não encontrada), 422 (requisitos não atendidos), 502 (falha no provedor)

- POST /api/ia/analise-mandado-async → Inicia processamento assíncrono e retorna 202 { jobId }
	- Autenticação: Bearer token
	- Body: multipart/form-data (file, metadata)
	- Uso: iniciar no frontend e depois consultar status com a rota abaixo

- GET  /api/ia/status/:jobId → Consulta status do job assíncrono
	- Resposta 200: { id, state, step, message, progress, textPreview?, result? }
	- state: queued | processing | done | error
	- step exemplos: upload_received, extracting_text, text_extracted, retrieving_legislation, calling_llm, completed
	- textPreview: quando disponível, mostra parte do texto extraído do PDF
	- result: presente quando state=done (mesma estrutura da resposta síncrona)

Configuração necessária (backend):
- Variáveis de ambiente:
	- GEMINI_API_KEY: chave do Google AI Studio
	- IA_MAX_TRECHOS=8 (opcional)
	- IA_MODEL=gemini-1.5-flash-latest (default)
	- IA_STUB=true (opcional; retorna resposta simulada para destravar o frontend)
- Observações de privacidade:
	- Enviar apenas trechos relevantes da legislação (RAG) e, se necessário, reduzir/anonimizar dados sensíveis do PDF.

Registro rápido no server.js (recomendado):

const initIARoutes = require('./routes/ia');
// ensureAuth é opcional
initIARoutes(app, pool, { ensureAuth });

Dependências no backend (quando não usar IA_STUB):
- multer (upload de PDF)
- pdf-parse (extração de texto do PDF)
- @google/generative-ai (cliente da API Gemini)

Tratamento de PDFs problemáticos
- Se o PDF for protegido por senha ou apenas imagens (escaneado), a extração de texto pode falhar.
- O handler tenta um fallback com pdfjs-dist; se ainda assim não houver texto, retorna 422 com mensagem orientando a enviar PDF pesquisável.
- Com IA_STUB=true, mesmo nesses casos a rota devolve uma resposta simulada 200 para destravar o frontend.

Verificação rápida pós-deploy
- Acesse GET /api/ia/health e confirme { ok: true }
- Se POST /api/ia/analise-mandado-async retornar 404, o módulo de IA ainda não está registrado/deployado; o frontend cairá no fallback síncrono automaticamente.

### IA - Fluxo estruturado (3 passos)

1) POST /api/ia/extrair-texto (multipart/form-data)
- file: PDF obrigatório
- Respostas:
	- 200 { text }
	- 400 arquivo inválido | 422 sem texto extraível | 500 erro interno

2) POST /api/ia/identificar-tipo (application/json)
- body: { text }
- Respostas:
	- 200 { tipo: string, confidence: number }
	- 400 falta de texto | 501 chave GEMINI ausente (quando não estiver com IA_STUB) | 502 provedor

3) POST /api/ia/analisar-exigencia (application/json)
- body: { text, legislacao: Array<Legislacao>, tipo?: string }
- Respostas:
	- 200 { aprovado: boolean, motivos: string[], checklist: { requisito, ok }[], orientacao: string }
	- 400 payload inválido | 501/502 provedor | 500 erro interno

4) POST /api/ia/gerar-texto-averbacao (application/json)
- body: { text, legislacao: Array<Legislacao>, tipo?: string }
- Respostas:
	- 200 { textoAverbacao: string }
	- 400 payload inválido | 501/502 provedor | 500 erro interno

Observações:
- Com IA_STUB=true, as respostas são simuladas (heurística no identificar-tipo e checklist genérica na análise).
- A listagem de legislação correlata é obtida via GET /api/legislacao?indexador=<tipo>&ativo=true.

### Upload de PDF (Averbações)

- `POST   /api/averbacoes-gratuitas/upload-pdf` → Upload multipart/form-data (campo "file"). O backend renomeia para o padrão `AVERBACAO-XXX-MMMM.PDF` e retorna `{ filename, url }`.

### Selos vinculados à Averbação

- `GET    /api/averbacoes-gratuitas/:id/selos`              → Lista selos da averbação
- `POST   /api/averbacoes-gratuitas/:id/selos`              → Cria selo vinculado
- `PUT    /api/averbacoes-gratuitas/:id/selos/:seloId`      → Atualiza selo
- `DELETE /api/averbacoes-gratuitas/:id/selos/:seloId`      → Exclui selo

Payload sugerido (averbação):

```
{
	"data": "YYYY-MM-DD",
	"tipo": "string",
	"descricao": "string?",
	"ressarcivel": true,
	"observacoes": "string?",
	"livro": "string?",
	"folha": "string?",
	"termo": "string?",
	"nome1": "string?",
	"nome2": "string?",
	"codigo_tributario": "string?",
	"pdf": { "filename": "...", "url": "..." }
}
```

Payload sugerido (selo vinculado):

```
{
	"selo_consulta": "string",
	"codigo_seguranca": "string",
	"codigo_tributario": "string?",
	"origem": "averbacao",        // backend pode inferir por averbacao_id
	"execucao_servico_id": null,    // sempre null nos selos de averbação
	"averbacao_id": "<id>",
	"valores": "string?",
	"qtd_atos": "string?",
	"atos_praticados_por": "string?"
}
```

Notas de implementação:
- A coluna `execucao_servico_id` em `public.selos_execucao_servico` agora aceita NULL, permitindo selos apenas de averbação (com `averbacao_id`).
- Recomenda-se definir `origem = 'averbacao'` automaticamente quando `averbacao_id` for informado.
- Opcional (recomendado): adicionar um CHECK garantindo exclusividade entre `execucao_servico_id` e `averbacao_id`.

## Legislação (CRUD)

- `GET    /api/legislacao?q=termos&indexador=...&ativo=true|false` → Lista com filtros (busca textual no servidor ou delegada ao DB)
- `POST   /api/legislacao` → Cria item
	- body: { indexador, base_legal, texto, titulo?, artigo?, jurisdicao?, tags?: string[] | string, ativo?: boolean }
- `PUT    /api/legislacao/:id` → Atualiza item
- `DELETE /api/legislacao/:id` → Exclui item

Notas de implementação:
- Autorização por perfil (Registrador/Substituto) é aplicada no frontend (exibição do componente). O backend não realiza checagem de papel nestas rotas.
- Popular searchable com to_tsvector('portuguese', …) (já suportado pela migration)
- Filtros: se `q` informado, usar to_tsquery/plainto_tsquery; se `ativo` omitido, retornar ativos por padrão
- Ordenação sugerida: updated_at DESC, id DESC

### Integração no seu server.js (evitar ReferenceError)

Recomendado (modular):

const initLegislacaoRoutes = require('./routes/legislacao');
// ensureAuth é opcional; passe o seu middleware se houver
initLegislacaoRoutes(app, pool, { ensureAuth });

Se preferir copiar o código das rotas para dentro do server.js, lembre-se de incluir os helpers usados pelas rotas:

function normalizeTags(tags) {
	if (!tags) return [];
	if (Array.isArray(tags)) return tags.map(String).map((s) => s.trim()).filter(Boolean);
	return String(tags).split(',').map((s) => s.trim()).filter(Boolean);
}

function parseBooleanMaybe(v) {
	if (v === undefined || v === null || v === '') return undefined;
	if (typeof v === 'boolean') return v;
	const s = String(v).toLowerCase();
	if (s === 'true' || s === '1') return true;
	if (s === 'false' || s === '0') return false;
	return undefined;
}

function buildTsQuery(q) {
	if (!q) return null;
	const raw = String(q).trim();
	if (!raw) return null;
	const hasOps = /[&|!:]/.test(raw);
	return {
		text: hasOps
			? `searchable @@ to_tsquery('portuguese', $PARAM$${raw}$PARAM$)`
			: `searchable @@ plainto_tsquery('portuguese', $PARAM$${raw}$PARAM$)`
	};
}

Sem esses helpers, erros como "normalizeTags is not defined" ou similares ocorrerão ao criar/atualizar itens.
