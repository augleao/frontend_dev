# Especificação DAP (Declaração de Apuração) – Schema, Períodos e Endpoints

Este documento consolida o modelo de dados, regras de períodos, validações e contratos de API para a DAP.

## 1) Tabela `dap` (cabeçalho)

Campos principais:
- id (PK)
- mes_referencia TINYINT (1..12)
- ano_referencia SMALLINT (YYYY)
- retificadora BOOLEAN
- retificadora_de_id (FK dap.id, NULLABLE)
- retificada_por_id (FK dap.id, NULLABLE)
- serventia_nome VARCHAR
- codigo_serventia VARCHAR
- cnpj CHAR(14)
- data_transmissao TIMESTAMP
- codigo_recibo VARCHAR
- observacoes TEXT

Valores apurados/pagos:
- emolumento_apurado DECIMAL(15,2)
- taxa_fiscalizacao_judiciaria_apurada DECIMAL(15,2)
- taxa_fiscalizacao_judiciaria_paga DECIMAL(15,2)
- recompe_apurado DECIMAL(15,2)
- recompe_depositado DECIMAL(15,2)
- data_deposito_recompe DATE NULL
- valores_recebidos_recompe DECIMAL(15,2)
- valores_recebidos_ferrfis DECIMAL(15,2)
- issqn_recebido_usuarios DECIMAL(15,2)
- repasses_responsaveis_anteriores DECIMAL(15,2)
- saldo_deposito_previo DECIMAL(15,2)
- total_despesas_mes DECIMAL(15,2)
- estoque_selos_eletronicos_transmissao INT

Índices sugeridos:
- INDEX (codigo_serventia, ano_referencia, mes_referencia)
- UNIQUE (mes_referencia, ano_referencia, codigo_serventia, retificadora) — regra: 1 original + 1 retificadora no máximo

## 2) Tabela `dap_periodo` (quatro períodos por DAP)

- id (PK)
- dap_id (FK dap.id ON DELETE CASCADE)
- ordem TINYINT (1..4)
- quantidade_total INT DEFAULT 0
- tfj_total DECIMAL(15,2) DEFAULT 0.00

Constraint: UNIQUE (dap_id, ordem)

Regra dos períodos (fixo por dia do mês):
- Período 1: 1 a 7
- Período 2: 8 a 14
- Período 3: 15 a 21
- Período 4: 22 ao último dia do mês

Utilitário criado (frontend): `src/utils/dapPeriods.js`

## 3) Tabela `dap_periodo_ato_snapshot`

Linhas que “constam da DAP” (snapshot imutável após transmissão/fechamento):
- id (PK)
- periodo_id (FK dap_periodo.id ON DELETE CASCADE)
- codigo CHAR(4) — 4 dígitos
- tributacao CHAR(2) — 1 ou 2 dígitos
- quantidade SMALLINT — 0..999
- tfj_valor DECIMAL(15,2) — total no período para a combinação

Índices e regras:
- UNIQUE (periodo_id, codigo, tributacao)
- CHECKs: codigo ~ '^[0-9]{4}$', tributacao ~ '^[0-9]{1,2}$', quantidade BETWEEN 0 AND 999, tfj_valor >= 0

Validações (frontend): `src/utils/dapValidation.js`

## 4) Geração de Snapshot (ETL)

Entrada: (mes, ano, codigo_serventia, retificadora_de_id?)

Passos (pseudo):
1. Selecionar atos fonte do mês: filtrar por data do ato e serventia.
2. Determinar período por dia do mês (1–7/8–14/15–21/22–fim).
3. Para cada combinação (periodo, codigo, tributacao), inserir 1 linha no snapshot com quantidade e tfj_valor total.
4. Atualizar agregados do período (quantidade_total, tfj_total).

Observações:
- TFJ: usar total da linha. Quando origem for unitário, multiplicar pela quantidade.
- Repetição no mesmo período com mesma (codigo, tributacao) NÃO deve ocorrer; a constraint UNIQUE garante.

## 5) Endpoints REST (sugestão)

- POST /api/dap
  - body: { mesReferencia, anoReferencia, codigoServentia, retificadoraDeId? }
  - efeito: cria `dap`, preenche 4 períodos e gera snapshot a partir da fonte.

- GET /api/dap
  - filtros: { codigoServentia?, ano?, mes?, tipo?, status? }
  - retorna lista resumida (para tabela).

- GET /api/dap/:id
  - retorna cabeçalho + períodos + linhas snapshot por período.

- POST /api/dap/:id/retificar
  - cria uma nova DAP retificadora ligada à original e regenera snapshot a partir da fonte.

### Retificação – Comportamento Específico

Uma DAP retificadora:
- Possui exatamente os mesmos campos da DAP original (nenhum campo extra é removido ou renomeado).
- É persistida na mesma tabela `dap` com `retificadora = TRUE`.
- Guarda snapshot completo dos 4 períodos em `dap_periodo_ato_snapshot` da mesma forma que a original.
- Usa `retificadora_de_id` apontando para a DAP original; a original recebe opcionalmente `retificada_por_id`.
- Pode coexistir com a original (regra de unicidade recomenda permitir no máximo 1 retificadora por (mes, ano, codigo_serventia)).
- PDF da retificadora deve ser armazenado e parseado novamente (não reaproveitar o PDF da original para preservar trilha de auditoria).

Diferenças funcionais:
- Na UI, indicar claramente relação ("Retifica #<id>").
- Cálculos, agregados e exportações tratam retificadora como versão alternativa, não substituição física da original.
- Exclusão: preferir proteger original se existir retificadora (ou exigir exclusão em cadeia explícita).

## 6) Fonte dos Atos (PDF da DAP)

Ponto de verdade: o PDF da DAP enviado pelo usuário.

Fluxo de ingestão:
1. Upload do PDF via `POST /api/dap/upload` (já utilizado no frontend por `DapUploadModal.jsx`).
2. Backend executa o parse do PDF (pdf.js ou biblioteca equivalente) e extrai:
   - Cabeçalho (mes/ano, retificadora, dados da serventia, valores apurados/pagos, etc.).
   - As quatro seções de períodos, com linhas no formato:
     `codigo(4d) trib(1..2d) qtde(1..3d) tfj(duas casas, vírgula)`
3. Converter números para formato canônico: `tfj` com ponto decimal (ex.: "615,00" → 615.00), `codigo` zero‑padded (4 dígitos), `tributacao` como 1–2 dígitos.
4. Persistir snapshot diretamente em `dap_periodo_ato_snapshot`, garantindo a constraint UNIQUE (periodo_id, codigo, tributacao).

Tabelas auxiliares (opcional, recomendadas para auditoria):
- `dap_upload` (id, filename, tamanho, hash, status, mensagens_erro, created_at)
- `dap_pdf_ato_raw` (upload_id, pagina, linha, texto_bruto) – apoio a troubleshooting do parser

Validações aplicadas durante o parse (frontend utilitário já disponível):
- `src/utils/dapValidation.js` – regex e normalização de `codigo`, `tributacao`, `quantidade`, `tfjValor`.

## 7) Exemplo de payload (GET /api/dap/:id)

```json
{
  "id": "uuid-123",
  "mesReferencia": 10,
  "anoReferencia": 2025,
  "retificadora": false,
  "serventiaNome": "Registro Civil das Pessoas Naturais de ABC",
  "codigoServentia": "RC123",
  "cnpj": "12345678000199",
  "dataTransmissao": "2025-11-08T18:23:41.000Z",
  "codigoRecibo": "DAP-2025-10-RC123",
  "observacoes": "...",
  "periodos": [
    {
      "ordem": 1,
      "quantidadeTotal": 300,
      "tfjTotal": 1234.56,
      "atos": [
        { "codigo": "7101", "tributacao": "01", "quantidade": 1,  "tfjValor": 45.08 },
        { "codigo": "7140", "tributacao": "01", "quantidade": 11, "tfjValor": 112.75 }
      ]
    },
    { "ordem": 2, "quantidadeTotal": 0, "tfjTotal": 0.00, "atos": [] },
    { "ordem": 3, "quantidadeTotal": 0, "tfjTotal": 0.00, "atos": [] },
    { "ordem": 4, "quantidadeTotal": 0, "tfjTotal": 0.00, "atos": [] }
  ]
}
```

## 8) Formatação e validação no Frontend

- Formatação monetária: exibição com vírgula/pt-BR; armazenamento com ponto/duas casas.
- Validações de linha snapshot: `src/utils/dapValidation.js` (regex e normalização).
- Cálculos agregados: preferir derivar com SUM no backend; armazenar em `dap_periodo` se performance exigir.

---

Qualquer alteração de nomes/colunas no backend, atualizar a seção 6) para manter o ETL coerente.