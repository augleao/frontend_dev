# Fluxo Completo: Leitura de Livros com Agente de IA e Geração de XML

## 📋 Índice
1. [Visão Geral](#visão-geral)
2. [Arquitetura do Sistema](#arquitetura-do-sistema)
3. [Fluxo de Dados](#fluxo-de-dados)
4. [Componentes Principais](#componentes-principais)
5. [Processos Detalhados](#processos-detalhados)
6. [Geração de XML](#geração-de-xml)
7. [Diagrama de Fluxo](#diagrama-de-fluxo)

---

## Visão Geral

O sistema de **Leitura de Livros** processa documentos (imagens e PDFs de registros cartorários) para extrair informações estruturadas usando agentes de IA (Gemini) e OCR (Tesseract), gerando como resultado:

- **Registros estruturados** (nascimentos, casamentos, óbitos)
- **Arquivos XML** no formato CRC Nacional (Cartório de Registro Civil)
- **Matrículas** geradas automaticamente

### Casos de Uso Principais

1. **Digitalização de acervos**: Processar livros antigos/manuscritos
2. **Conversão de registros**: De imagem → dados estruturados → XML
3. **Integração com CRC**: Envio de registros ao sistema nacional de cartórios

---

## Arquitetura do Sistema

### 📊 Componentes Envolvidos

```
FRONTEND (React)
├── LeituraLivros.jsx (componente principal)
├── LeituraLivrosRegistro.jsx (OCR local com Tesseract.js)
├── LeituraLivrosService.js (cliente API)
└── PromptsService.js (gerenciamento de prompts IA)

BACKEND (Node.js/Express)
├── routes/leitura-livros.js (orquestra todo processamento)
├── services/ (processamento de IA, OCR, normalização)
└── Database (prompts, histórico de jobs)

SERVIÇOS EXTERNOS
├── Google Gemini API (análise de imagens e textos)
└── Tesseract.js (OCR local e servidor)
```

### 🗄️ Diretórios de Armazenamento

```
Server:
  JOBS_ROOT/
  ├── {jobId}/
  │   ├── status.json (metadados do job)
  │   ├── uploads/ (arquivos enviados)
  │   ├── result.json (resultado processado)
  │   └── fulltext/ (textos completos extraídos)
```

---

## Fluxo de Dados

### 🔄 Fluxo de Processamento de Upload

```
1. FRONTEND: Usuário seleciona arquivos (imagens/PDFs)
   ↓
2. FRONTEND: Carrega prompts de IA (tipo_escrita, leitura_manuscrito, leitura_digitado)
   ↓
3. FRONTEND: Envia arquivos para backend (/leitura-livros/upload)
   ↓
4. BACKEND: Cria job com ID único, salva metadados (status.json)
   ↓
5. BACKEND: Inicia processamento assíncrono
   ├─ Identifica tipo de escrita (manuscrito vs digitado)
   ├─ Extrai texto via OCR ou api-key do PDF
   ├─ Analisa com Gemini (extrai campos estruturados)
   ├─ Normaliza dados
   └─ Salva resultado em result.json
   ↓
6. FRONTEND: Faz polling para /leitura-livros/status/{jobId}
   ├─ Atualiza console com progresso
   ├─ Exibe mensagens do servidor
   └─ Quando ready=true, busca resultado
   ↓
7. FRONTEND: Busca resultado com /leitura-livros/result/{jobId}
   ↓
8. FRONTEND: Exibe registros em tabela editável
   ├─ Usuário pode editar campos
   ├─ Gera matrículas (backend)
   └─ Gera XML (client-side)
   ↓
9. FRONTEND: Usuário baixa XML (formato CRC Nacional)
```

---

## Componentes Principais

### 🎨 Frontend: LeituraLivros.jsx

**Responsabilidades:**
- Interface de upload (arquivos ou pasta via FileSystem API)
- Gerenciamento de estado (modo, parâmetros, progresso)
- Polling de status (backend)
- Exibição de console em tempo real
- Edição de registros extraídos
- Geração de XML (client-side)
- Download de resultados

**Estados Principais:**
```javascript
{
  mode: 'upload' | 'folder',           // modo de entrada
  folderPath: string,                   // caminho da pasta no servidor
  files: File[],                        // arquivos selecionados
  jobId: string,                        // ID do job em processamento
  running: boolean,                     // job em execução?
  progress: number,                     // percentual (0-100)
  results: Array<Record>,               // registros processados
  
  // Parâmetros CRC
  versao: '2.6',                        // versão do XML
  acao: 'CARGA',                        // ação (por enquanto apenas CARGA)
  cns: string,                          // código do cartório
  tipoRegistro: 'NASCIMENTO' | 'CASAMENTO' | 'OBITO',
  
  // UI
  consoleLines: string[],               // mensagens do console
  expanded: {},                         // quais registros estão expandidos
  activeCard: {}                        // card ativo no stack visual
}
```

**Funções Principais:**
- `startProcessing()` - Inicia upload ou folder processing
- `pollJob()` - Consulta status periodicamente
- `handleSaveChangesAsXml()` - Gera XML client-side
- `handleGenerateMatriculas()` - Gera matrículas via backend
- `serializeNascimentoXml()`, `serializeCasamentoXml()`, `serializeObitoXml()` - Serializam registros em XML

### 🌐 Service: LeituraLivrosService.js

**API Endpoints Utilizados:**

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/leitura-livros/process-folder` | POST | Inicia processamento de pasta no servidor |
| `/leitura-livros/upload` | POST | Upload de arquivos (multipart/form-data) |
| `/leitura-livros/extract-p7s` | POST | Extrai payloads de arquivos .p7s |
| `/leitura-livros/status/{jobId}` | GET | Consulta status do job |
| `/leitura-livros/result/{jobId}` | GET | Obtém resultado processado |
| `/leitura-livros/fulltext/{jobId}` | GET | Baixa texto completo extraído |

### 🔧 Backend: routes/leitura-livros.js

**Responsabilidades:**
- Receber uploads (multipart, .p7s)
- Criar/gerenciar jobs
- Orquestrar processamento (escrita → análise → normalização → resultado)
- Responder status e resultados ao frontend

**Prompts de IA Utilizados:**
```
tipo_escrita              → Classificação: manuscrito vs digitado
leitura_manuscrito        → Extração de campos em manuscritos
leitura_digitado          → Extração de campos em textos digitados
xml_nascimento            → Geração de XML para nascimentos
xml_casamento             → Geração de XML para casamentos
xml_obito                 → Geração de XML para óbitos
```

---

## Processos Detalhados

### 1️⃣ Identificação de Escrita

**Objetivo:** Determinar se o documento é manuscrito ou digitado

**Função:** `identifyEscritaWithGeminiImage(imagePath, status, ctx)`

**Processo:**
```
1. Enviar imagem para Gemini Vision
   → Retorna: writingType ('manuscript' ou 'printed') + confidence (0-1)

2. Se confiança baixa:
   - Executar OCR rápido (Tesseract)
   - Calcular métricas heurísticas:
     * wordCount
     * longWordRatio (palavras > 10 caracteres)
     * avgTokenLen (comprimento médio das tokens)
   
3. Aplicar regras de fallback:
   - Se IA confiante (>0.8): respeitar classificação
   - Se IA duvidosa (<0.5) e OCR indica qualidade baixa:
     → Forçar manuscrito (mais seguro)
```

**Output:**
```json
{
  "tipo": "manuscript" | "printed",
  "confianca": 0.0-1.0,
  "ocrMetrics": {
    "wordCount": number,
    "longWordRatio": number,
    "avgTokenLen": number
  }
}
```

### 2️⃣ Extração de Registros

**Duas Rotas Paralelas:**

#### 🖊️ Rota A: Documentos Digitados

```
1. Extrair texto:
   - Se PDF com texto: pdf-parse
   - Se imagem: Tesseract OCR
   
2. Analisar com Gemini:
   - Enviar texto completo
   - Chamar analyzeRecordWithGemini()
   - Usar prompt: leitura_digitado
   
3. Mapear e normalizar:
   - mapIaRegistroToNormalized()
   - normalizeRecordOutput()
   
4. Validar campos obrigatórios
```

**Resposta da IA (esperado):**
```json
{
  "nome": "João Silva",
  "data": "01/01/1990",
  "livro": "001",
  "folha": "042",
  "termo": "123",
  "pai": "José Silva",
  "mae": "Maria Silva",
  ...
}
```

#### 🖋️ Rota B: Documentos Manuscritos

```
1. Acumular imagens manuscritas
   (otimização: menos chamadas IA)
   
2. Analisar em batch com Gemini:
   - Enviar múltiplas imagens
   - Chamar analyzeRecordFromImageWithGemini()
   - Usar prompt: leitura_manuscrito
   
3. Mapear e normalizar
   (mesmo pipeline que digitado)
   
4. Validar campos
```

**Vantagem:** Reduz chamadas à API Gemini (custo)

### 3️⃣ Normalização de Dados

**Função:** `normalizeRecordOutput(record, tipoRegistro)`

**Transformações:**
```javascript
// Conversão de nomes de campos
'nome_completo' → 'nome'
'data_nascimento' → 'data'
'nomeMae' → 'mae'

// Formatação de datas
'01/01/1990' → mantém se válido
'1990-01-01' → converte para DD/MM/YYYY

// Limpeza de espaços
' João  Silva ' → 'João Silva'

// Validação de CPF (se presente)
'123.456.789-00' → remove pontuação
```

**Validações Obrigatórias:**
- Nascimento: nome, data, pai/mãe
- Casamento: cônjuges, data
- Óbito: nome falecido, data óbito

---

## Geração de XML

### 📝 Processo Client-Side

**Função:** `handleSaveChangesAsXml()` (LeituraLivros.jsx)

**Etapas:**

```
1. Validar registros
   - Todos possuem matrícula?
   - Se não: gerar matrículas antes
   
2. Enriquecer dados
   - Adicionar metadata (timestamp, versão)
   - Mapear campos para XML structure
   
3. Serializar por tipo
   - serializeNascimentoXml()
   - serializeCasamentoXml()
   - serializeObitoXml()
   
4. Criar Blob e baixar
```

### 📋 Estrutura XML (Nascimento)

```xml
<?xml version="1.0" encoding="utf-8"?>
<CARGAREGISTROS>
  <VERSAO>2.6</VERSAO>
  <ACAO>CARGA</ACAO>
  <CNS>000001</CNS>
  <MOVIMENTONASCIMENTOTN>
    <REGISTRONASCIMENTOINCLUSAO>
      <INDICEREGISTRO>1</INDICEREGISTRO>
      <NOMEREGISTRADO>João Silva da Costa</NOMEREGISTRADO>
      <DATANASCIMENTO>01/01/1990</DATANASCIMENTO>
      <SEXO>M</SEXO>
      <NOMEPAI>José Silva</NOMEPAI>
      <NOMEMAE>Maria Silva</NOMEMAE>
      <LIVRO>001</LIVRO>
      <FOLHA>042</FOLHA>
      <TERMO>123</TERMO>
      <MATRICULA>2024000000001</MATRICULA>
      ...
      <FILIACAONASCIMENTO>
        <!-- Genitores adicionais -->
      </FILIACAONASCIMENTO>
      <DOCUMENTOS>
        <!-- Documentos de identificação -->
      </DOCUMENTOS>
    </REGISTRONASCIMENTOINCLUSAO>
  </MOVIMENTONASCIMENTOTN>
</CARGAREGISTROS>
```

**Seções Principais:**
- **REGISTRONASCIMENTOINCLUSAO** / **REGISTROCASAMENTOINCLUSAO** / **REGISTROOBITOINCLUSAO** - Inclusões
- **REGISTRONASCIMENTOALTERACAO** / etc. - Alterações
- **FILIACAONASCIMENTO** - Genitores (apenas nascimento)
- **DOCUMENTOS** - Documentação de identidade

### 🔄 Integração com Backend (XML via IA)

Alternativamente, o backend pode gerar XML diretamente com Gemini:

**Função:** `buildXmlFilesViaIa(records, params, jobDir, status, ctx)`

```
1. Recuperar prompt IA:
   - xml_nascimento / xml_casamento / xml_obito
   
2. Chunkarizar registros:
   - Máximo 2500 por arquivo
   - Separar INCLUSÃO / ALTERAÇÃO
   
3. Para cada chunk:
   - Enviar para Gemini
   - Obter resposta XML
   - Validar conteúdo essencial
   
4. Se inválido:
   - Reforço com modelo secundário
   - Fallback para gerador de código
   
5. Retornar XMLs ao frontend
```

---

## Diagrama de Fluxo

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                         │
│                      LeituraLivros.jsx                           │
└────┬────────────────────────────────────────────────────────────┘
     │
     │ 1. Usuário seleciona arquivos ou pasta
     ├─→ [Modo: Upload vs Folder]
     │
     │ 2. Carrega prompts de IA
     ├─→ PromptsService.getManyByIndexadores()
     │   - tipo_escrita
     │   - leitura_manuscrito
     │   - leitura_digitado
     │
     │ 3. Envia ao backend
     ├─→ LeituraLivrosService.uploadFiles() ou startFolderProcessing()
     │   │
     │   ▼
     ├─────────────────────────────────────────────────────────────
     │                  BACKEND (Node.js)                          │
     │             routes/leitura-livros.js                        │
     │
     │  POST /leitura-livros/upload
     │  POST /leitura-livros/process-folder
     │   │
     │   └─→ createJob(jobId, inputs, params)
     │       │
     │       ├─→ Executar em background: runJob()
     │           │
     │           ├─ Loop por arquivo/imagem:
     │           │  │
     │           │  ├─ identifyEscritaWithGeminiImage()
     │           │  │  └─→ Tipo: manuscript vs printed
     │           │  │
     │           │  ├─ Se manuscrito (batch):
     │           │  │  └─→ analyzeRecordFromImageWithGemini()
     │           │  │      └─→ prompt: leitura_manuscrito
     │           │  │
     │           │  └─ Se digitado:
     │           │     └─→ Extrair texto (PDF/OCR)
     │           │         └─→ analyzeRecordWithGemini()
     │           │             └─→ prompt: leitura_digitado
     │           │
     │           ├─ Normalizar todos os registros
     │           │  └─→ normalizeRecordOutput()
     │           │
     │           ├─ Salvar resultado
     │           │  └─→ result.json
     │           │
     │           └─ Atualizar status (ready=true)
     │
     │  GET /leitura-livros/status/{jobId}
     │   ├─→ status.json + progresso
     │   └─→ messages (console)
     │
     │  GET /leitura-livros/result/{jobId}
     │   └─→ { records: [...], fulltext: "..." }
     │
     └─────────────────────────────────────────────────────────────
     │
     │ 4. Polling de status (Frontend)
     ├─→ LeituraLivrosService.getStatus(jobId)
     │   └─ Repete a cada 2-5 segundos
     │   └─ Atualiza console com messages
     │   └─ Quando ready=true: busca resultado
     │
     │ 5. Obter resultado
     ├─→ LeituraLivrosService.getResult(jobId)
     │   └─→ Carrega registros em state.results
     │
     │ 6. Usuário edita registros
     ├─→ Alterações em memória
     │
     │ 7. Gerar matrículas (opcional)
     ├─→ handleGenerateMatriculas()
     │   └─→ POST /matriculas/generate
     │       └─→ Retorna matrícula para cada registro
     │
     │ 8. Gerar XML
     ├─→ handleSaveChangesAsXml()
     │   ├─ Validar registros
     │   ├─ Enriquecer dados
     │   └─ serializeCargaXml()
     │       ├─ serializeNascimentoXml()
     │       ├─ serializeCasamentoXml()
     │       └─ serializeObitoXml()
     │   └─ Criar Blob + download
     │
     └─→ Usuário baixa XML (formato CRC)
```

---

## 🔐 Segurança & Autenticação

- **Token JWT:** Todos os endpoints requerem `Authorization: Bearer {token}`
- **Isolamento de Jobs:** jobId é aleatório, não previsível
- **Timeout:** Jobs expiram após período de inatividade
- **Validação:** Inputs sanitizados antes de processar

---

## 📊 Monitoramento & Debug

### Console em Tempo Real

O componente exibe logs com tags coloridas:
- `[title]` - Títulos (vermelho)
- `[success]` - Sucesso (verde)
- `[error]` - Erro (vermelho)
- `[info]` - Info (azul)
- `[warning]` - Aviso (laranja)

### Variáveis de Ambiente

```bash
# Backend
GEMINI_API_KEY=sk-xxx...
IA_MAX_TRECHOS=8
IA_STUB=false (usar respostas simuladas)
JOBS_ROOT=/tmp/jobs

# Frontend
REACT_APP_API_URL=http://localhost:5000
```

---

## 🚀 Fluxo Típico do Usuário

### Caso 1: Digitalizar Livro Antigo

1. Fotografar/escanear páginas do livro antigo
2. Acessar "Leitura de Livros" no admin
3. Selecionar imagens (JPG/PNG)
4. Preencher:
   - Versão XML: 2.6
   - Ação: CARGA
   - CNS: (código do cartório)
   - Tipo Registro: NASCIMENTO | CASAMENTO | ÓBITO
5. Clicar "Processar"
6. Aguardar extração e OCR (com console ao vivo)
7. Revisar registros (editar se necessário)
8. Gerar matrículas (automático)
9. Gerar XML e baixar

### Caso 2: Processar Pasta no Servidor

1. Criar pasta `/var/livros/cartorio_001` com subpastas de páginas
2. Preencher "Modo: Pasta" e caminho
3. Sistema processa em background
4. Resultado disponível em tempo real

---

## 📚 Referências de Código

### Arquivos Principais

| Arquivo | Localização | Responsabilidade |
|---------|-------------|------------------|
| LeituraLivros.jsx | frontend_dev/src/components/ia/ | Componente principal |
| LeituraLivrosService.js | frontend_dev/src/services/ | Cliente API |
| leitura-livros.js | backend_dev/routes/ | Orquestração backend |
| LeituraLivrosRegistro.jsx | frontend_dev/src/components/ia/ | OCR local (Tesseract) |

### Prompts de IA

Gerenciados via `PromptsService`:
- Indexador: `tipo_escrita` - Classifica manuscrito vs digitado
- Indexador: `leitura_manuscrito` - Extrai campos de manuscritos
- Indexador: `leitura_digitado` - Extrai campos de textos impressos
- Indexador: `xml_nascimento`, `xml_casamento`, `xml_obito` - Geram XML

---

## 🔄 Fluxo de Melhorias Futuras

1. **Cache de prompts:** Usar versionamento para comparar saídas
2. **OCR melhorado:** Integrar Paddle OCR (suporte melhor para português)
3. **Validação em duas fases:** Manual review antes de gerar matrícula
4. **Histórico de versões:** Rastrear alterações do usuário
5. **Batch processing:** Processar múltiplos jobs em paralelo

---

## ✅ Checklist de Implementação

- [x] Upload de arquivos (multipart/form-data)
- [x] Identificação de escrita (Gemini + OCR heurístico)
- [x] Extração de registros (manuscrito + digitado)
- [x] Normalização de dados
- [x] Geração de XML client-side
- [x] Matrículas (integração backend)
- [x] Polling de status em tempo real
- [x] Console com mensagens coloridas
- [x] Download de resultados
- [x] Edição de registros em tabela
- [ ] Validação em duas fases (review manual)
- [ ] Teste com documentos reais de cartório

---

**Última atualização:** Janeiro de 2025  
**Versão do documento:** 1.0  
**Autor:** Equipo Bibliofilia
