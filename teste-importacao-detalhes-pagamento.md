# Teste de Importação com Detalhes de Pagamento

## Modificações Implementadas

### 1. **Query SQL Atualizada**
- Adicionado campo `p.detalhes_pagamento` na consulta JOIN entre `selos_execucao_servico` e `pedido_pagamento`
- Agora busca tanto `complemento_pagamento` quanto `detalhes_pagamento`

### 2. **Inserção na Tabela atos_praticados**
- Campo `detalhes_pagamentos` agora é preenchido durante a importação
- Query de inserção atualizada: 
  ```sql
  INSERT INTO atos_praticados (
    data, hora, codigo, descricao, quantidade, valor_unitario, 
    pagamentos, detalhes_pagamentos, usuario, origem_importacao
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
  ```

### 3. **Função extrairFormasPagamento Melhorada**
- Agora processa 2 formatos:
  - **Array** (detalhes_pagamento): `[{valor: 100, forma: "Dinheiro", complemento: false}]`
  - **Objeto** (complemento_pagamento): `{dinheiro: {quantidade: 1, valor: 100, manual: false}}`
- Prioriza `detalhes_pagamento` quando disponível

### 4. **Lógica de Priorização**
```javascript
// Prioriza detalhes_pagamento da tabela pedido_pagamento
const formasPagamento = extrairFormasPagamento(selo.detalhes_pagamento || selo.complemento_pagamento);

// Prepara string JSON dos detalhes_pagamento para salvar
let detalhesPagamentoStr = null;
if (selo.detalhes_pagamento) {
  detalhesPagamentoStr = typeof selo.detalhes_pagamento === 'string' 
    ? selo.detalhes_pagamento 
    : JSON.stringify(selo.detalhes_pagamento);
}
```

## Como Testar

1. **Cenário 1: Ato com detalhes_pagamento**
   - Importar ato que tem registro na tabela `pedido_pagamento` com campo `detalhes_pagamento` preenchido
   - Verificar se `atos_praticados.detalhes_pagamentos` contém os dados corretos

2. **Cenário 2: Ato sem detalhes_pagamento**
   - Importar ato que só tem `complemento_pagamento`
   - Verificar se ainda funciona com fallback para `complemento_pagamento`

3. **Cenário 3: Ato sem dados de pagamento**
   - Importar ato sem nenhum dado de pagamento
   - Verificar se `detalhes_pagamentos` fica como `null`

## Exemplo de Dados Esperados

### Input (detalhes_pagamento):
```json
[
  {"valor": 62.40, "forma": "Dinheiro", "complemento": false},
  {"valor": 37.60, "forma": "PIX", "complemento": true}
]
```

### Output (atos_praticados.detalhes_pagamentos):
```json
"[{\"valor\":62.40,\"forma\":\"Dinheiro\",\"complemento\":false},{\"valor\":37.60,\"forma\":\"PIX\",\"complemento\":true}]"
```

### Output (atos_praticados.pagamentos):
```json
{
  "dinheiro": {"quantidade": 1, "valor": 62.40, "manual": false},
  "pix": {"quantidade": 1, "valor": 37.60, "manual": true},
  "cartao": {"quantidade": 0, "valor": 0, "manual": false},
  "crc": {"quantidade": 0, "valor": 0, "manual": false},
  "depositoPrevio": {"quantidade": 0, "valor": 0, "manual": false}
}
```

## Log de Debug

Durante a importação, você verá logs como:
```
💳 Dados de pagamento extraídos: [{"valor":62.40,"forma":"Dinheiro","complemento":false}]
💳 Processando formato detalhes_pagamento (array)
📝 Inserindo ato XXX - Código: 01, Quantidade: 1: {
  detalhes_pagamento: "[{\"valor\":62.40,\"forma\":\"Dinheiro\",\"complemento\":false}]"
}
```