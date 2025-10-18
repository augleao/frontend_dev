# Modificação na Importação de Atos - Descrição da Tabela Atos

## Alterações Implementadas

### 1. **Nova Função: `buscarDescricaoAto(codigo, execucaoServicoId)`**

Criada uma função para buscar a descrição oficial do ato na tabela `atos`:

```javascript
const buscarDescricaoAto = async (codigo, execucaoServicoId) => {
  const queryAto = `
    SELECT descricao 
    FROM atos 
    WHERE codigo = $1
    LIMIT 1
  `;
  
  const resultAto = await pool.query(queryAto, [codigo]);
  
  if (resultAto.rows.length > 0) {
    const descricaoOriginal = resultAto.rows[0].descricao;
    // Adicionar prefixo "Importado: " à descrição encontrada
    return `Importado: ${descricaoOriginal}`;
  }
  
  // Se não encontrar, retornar descrição padrão com número do pedido
  return `Importado: Ato ${codigo} importado do pedido ${execucaoServicoId}`;
};
```

### 2. **Campo Descrição Atualizado**

#### **Antes:**
- **Descrição:** `"Ato ${codigo} importado do sistema de selos"` (texto fixo)

#### **Agora:**
- **Descrição:** `"Importado: " + {descricao da tabela atos}` (descrição oficial + prefixo)
- **Fallback:** `"Importado: Ato ${codigo} importado do pedido ${execucaoServicoId}"` (com número do pedido)

### 3. **Lógica de Busca e Prefixo**

1. **Busca a descrição:** Na tabela `atos` onde `codigo = ato.codigo`
2. **Adiciona prefixo:** "Importado: " a todas as descrições
3. **Fallback:** Se não encontrar, usa `"Ato ${codigo} importado do pedido ${execucaoServicoId}"`

### 4. **Exemplos de Saída**

#### **Cenário A: Código Encontrado na Tabela**
- **Input:** `codigo = "01"`
- **Tabela atos:** `descricao = "Certidão de Nascimento"`
- **Output:** `"Importado: Certidão de Nascimento"`

#### **Cenário B: Código Não Encontrado**
- **Input:** `codigo = "99"`, `execucaoServicoId = "PED123456"`
- **Tabela atos:** (não encontrado)
- **Output:** `"Importado: Ato 99 importado do pedido PED123456"`

### 5. **Fluxo de Importação Atualizado**

```javascript
// Para cada ato extraído do campo qtd_atos
for (const ato of atosExtraidos) {
  // 1. Buscar descrição na tabela atos (passando também o execucaoServicoId)
  const descricaoAto = await buscarDescricaoAto(ato.codigo, execucaoServicoId);
  
  // 2. Inserir na tabela atos_praticados
  await pool.query(queryInserir, [
    // ... outros campos ...
    descricaoAto,  // "Importado: Certidão de Nascimento" ou "Importado: Ato XX importado do pedido YYYYYY"
    // ... outros campos ...
  ]);
}
```

### 6. **Logs de Debug**

Durante a importação, você verá:

```
📝 Inserindo ato ABC123 - Código: 01, Quantidade: 1: {
  codigo: '01',
  descricao: 'Importado: Certidão de Nascimento',
  valor_unitario: 45.67,
  quantidade: 1,
  usuario_frontend: 'João Silva',
  formasPagamento: {...},
  detalhes_pagamento: '[{...}]'
}
```

### 7. **Tratamento de Erros**

- **Código não encontrado:** Log de aviso + descrição padrão com prefixo
- **Erro na query:** Log de erro + descrição padrão com prefixo
- **Descrição nula:** Usa código do ato como fallback

### 8. **Exemplo Completo**

#### **Input da Importação:**
```
qtd_atos: "1(7802), 2(1234)"
```

#### **Processamento:**
1. Extrai códigos: `["7802", "1234"]`
2. Para código "7802":
   - Busca: `SELECT descricao FROM atos WHERE codigo = '7802'`
   - Resultado: `"Certidão de Óbito"`
   - Descrição final: `"Importado: Certidão de Óbito"`
3. Para código "1234":
   - Busca: `SELECT descricao FROM atos WHERE codigo = '1234'`
   - Não encontrado
   - Descrição final: `"Importado: Ato 1234 importado do pedido ABC789123"`

#### **Output na tabela atos_praticados:**
```sql
INSERT INTO atos_praticados (codigo, descricao, quantidade) VALUES 
('7802', 'Importado: Certidão de Óbito', 1),
('1234', 'Importado: Ato 1234 importado do pedido ABC789123', 2);
```

## Benefícios

✅ **Descrições oficiais:** Usa a descrição cadastrada na tabela `atos`  
✅ **Identificação clara:** Prefixo "Importado: " para distinguir atos importados  
✅ **Robustez:** Fallback para códigos não encontrados  
✅ **Rastreabilidade:** Logs detalhados para debug  
✅ **Compatibilidade:** Mantém estrutura existente  

## Resultado

Na tabela renderizada do frontend, você verá descrições como:
- "Importado: Certidão de Nascimento"
- "Importado: Certidão de Casamento"
- "Importado: Reconhecimento de Firma"

Tornando claro que são atos importados do sistema de selos com suas descrições oficiais!