
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

- `GET    /api/averbacoes-gratuitas?dataInicial=YYYY-MM-DD&dataFinal=YYYY-MM-DD&ressarcivel=true|false|todos&tipo=...`  → Lista com filtros
- `POST   /api/averbacoes-gratuitas`        → Cria uma nova averbação gratuita
- `GET    /api/averbacoes-gratuitas/:id`    → Detalhe da averbação
- `PUT    /api/averbacoes-gratuitas/:id`    → Atualiza averbação
- `DELETE /api/averbacoes-gratuitas/:id`    → Exclui averbação

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
