# DAP – Parser do PDF e ETL para Snapshot

Este documento detalha como extrair os 4 períodos e as linhas de atos diretamente do PDF da DAP e salvar no snapshot (imutável) da DAP.

## Entradas
- PDF da DAP (upload em `POST /api/dap/upload`)
- Metadados opcionais: { mesReferencia, anoReferencia, retificadoraDeId?, codigoServentia, ... }

## Saídas
- Registro em `dap` (cabeçalho)
- 4 registros em `dap_periodo` (ordem 1..4)
- N linhas em `dap_periodo_ato_snapshot` (uma por (periodo, codigo, tributacao))

## Regras de Período
- Período 1: dias 1 a 7
- Período 2: dias 8 a 14
- Período 3: dias 15 a 21
- Período 4: dias 22 ao último dia do mês

Obs.: No PDF, os períodos costumam aparecer em quatro colunas (lado a lado) com o cabeçalho “Período X (faixa)”. O parser deve identificar cada bloco e associar as linhas ao período correto.

## Padrão das Linhas de Atos
- Formato (texto):
  - `codigo` — 4 dígitos (ex.: 7101)
  - `tributacao` — 1 ou 2 dígitos (ex.: 1, 46)
  - `quantidade` — 1 a 3 dígitos (0..999)
  - `tfj` — número com vírgula e duas casas (ex.: 615,00)
- Regex sugerida (texto já com espaços normalizados):
  - `^(\d{4})\s+(\d{1,2})\s+(\d{1,3})\s+(\d+[.,]\d{2})$`

## Normalização
- `codigo`: manter como string de 4 dígitos (zero‑padded)
- `tributacao`: string com 1–2 dígitos; armazenar em CHAR(2) ou VARCHAR(2)
- `quantidade`: inteiro (0..999)
- `tfjValor`: converter vírgula para ponto e parsear `DECIMAL(15,2)`

## Pipeline (Backend)
1) Receber upload (multipart) e armazenar arquivo (S3, disco, etc.) com referência em `dap_upload`.
2) Extrair texto com PDF.js (ou lib equivalente). Para páginas com múltiplas colunas:
   - Opção simples: ordenar por coordenadas X/Y e segmentar a página em 4 regiões horizontais (colunas) para capturar os blocos de cada período.
   - Alternativa: procurar pelos títulos “Período 1 (1 a 7)”, “Período 2 (8 a 14)”, etc., e capturar as linhas subsequentes até o próximo cabeçalho.
3) Normalizar linhas (remover espaços duplicados, ajustar vírgula/ponto) e validar com `src/utils/dapValidation.js`.
4) Criar `dap` e 4 entradas em `dap_periodo`.
5) Inserir em `dap_periodo_ato_snapshot` uma linha por (periodo, codigo, tributacao). Caso o PDF repita a mesma combinação dentro do período, somar quantidade e tfjValor antes de persistir para respeitar a UNIQUE (periodo_id, codigo, tributacao).
6) Atualizar agregados em `dap_periodo` (quantidade_total, tfj_total).
7) Atualizar `dap_upload.status` para `processed` e vincular `dap_id` resultante.

## Tabelas de Apoio (opcional)
- `dap_upload`: { id, filename, size, sha256, status: queued|processing|processed|error, message?, dap_id?, created_at }
- `dap_pdf_ato_raw`: { upload_id, page, line_no, period_hint?, text }

## Tratamento de Erros
- Linhas inválidas: registrar em log e prosseguir (ou abortar, conforme configuração).
- Páginas sem cabeçalho de período: tentar fallback por posição (colunas X/Y) ou marcar como erro.
- Números com formatação inconsistente: aplicar heurística (ex.: “82,00” e “82.00” aceitos; normalizar para ponto no armazenamento).

## Exemplo (com base no PDF do usuário)
Entrada (texto do bloco “Período 1 (1 a 7) \n ...”):
```
7101 1 1 45,08
7140 1 11 112,75
7402 46 13 0,00
...
```
Após normalização:
```
{ codigo: '7101', tributacao: '1',  quantidade: 1,  tfjValor: 45.08 }
{ codigo: '7140', tributacao: '1',  quantidade: 11, tfjValor: 112.75 }
{ codigo: '7402', tributacao: '46', quantidade: 13, tfjValor: 0.00 }
```
Persistência: 1 linha por combinação (periodo_id, codigo, tributacao); agregar se houver repetição.

## Endpoints Envolvidos
- `POST /api/dap/upload` → recebe PDF, retorna `{ dapId, status }` quando concluir (ou `{ jobId }` para assíncrono)
- `GET /api/dap/:id` → retorna cabeçalho, períodos e snapshot
- `POST /api/dap/:id/retificar` → cria DAP retificadora (reprocessa novo PDF ou reutiliza PDF + ajustes conforme regra)

## Observações
- Parser deve ser resiliente a variações de layout (espaçamento, quebra de linha, colunas desalinhadas).
- Guardar o PDF original vinculado à DAP (para auditoria).
- Logs do parse devem ajudar a explicar divergências (por exemplo, linhas ignoradas por não bater regex).
