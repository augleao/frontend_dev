

const express = require('express');
const multer = require('multer');
const multer2 = require('multer');
const multer3 = require('multer');
const { Pool } = require('pg');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const fs = require('fs');
const fs2 = require('fs');
const fsp = require('fs/promises');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pdfParse = require('pdf-parse');
const path = require('path');
const app = express();
// Register modular routes
const { registerIaRoutes } = require('./routes/ia');
const { registerUploads } = require('./routes/uploads');
const { registerAverbacoesGratuitasRoutes } = require('./routes/averbacoes-gratuitas');
const { registerProcedimentosGratuitosRoutes } = require('./routes/procedimentos-gratuitos');
const { registerStorage } = require('./routes/storage');
const { registerLegislacaoRoutes } = require('./routes/legislacao');
const { registerTracker } = require('./routes/backend_tracker_routes');
const axios = require('axios');
const cron = require('node-cron');
const Tesseract = require('tesseract.js');
const RENDER_API_KEY = process.env.RENDER_API_KEY;
const onedriveConfigRouter = require('./routes/onedrive-config');
const { ensureAuth } = require('./middlewares/auth');
const initDapRoutes = require('./routes/dap');
// Matricula routes (register initializer)
const initMatriculaRoutes = require('./routes/matricula');
const initAtosTabelasRoutes = require('./routes/atosTabelas');

//const port = process.env.PORT || 3001;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // outras configs se necessário
});

// Criar tabela de conferências se não existir
const createConferenciasTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS conferencias (
        id SERIAL PRIMARY KEY,
        protocolo VARCHAR(255) NOT NULL,
        usuario VARCHAR(255) NOT NULL,
        status VARCHAR(255) NOT NULL,
        observacao TEXT,
        data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (error) {
    // erro removido: logs só na api/serventias
  }
}

// Se você já tiver um static configurado para /uploads, mantenha o seu.
// Exemplo opcional:
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configuração do upload (memória; escrevemos no disco com nosso nome final)
const uploadAverbacao = multer2({
  storage: multer2.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (req, file, cb) => {
    const isPdf =
      file.mimetype === 'application/pdf' ||
      path.extname(file.originalname).toLowerCase() === '.pdf';
    if (!isPdf) return cb(new Error('Apenas PDF é permitido.'), false);
    cb(null, true);
  },
});

// (upload3 moved to routes/ia)

function ensureDirSyncAverbacao(dirPath) {
  fs2.mkdirSync(dirPath, { recursive: true });
}


const PT_MONTHS = [
  'JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
];

// Gera/obtém o próximo sequencial XXX para um dado anoMes (YYYY-MM) e tipo
async function nextMonthlySeq(pool, anoMes, tipo) {
  const primaryTable = 'public.averbacoes_upload_seq';
  const backupTable = 'public.averbacoes_upload_seq_by_tipo';

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${primaryTable} (
        ano_mes VARCHAR(7) NOT NULL,
        tipo VARCHAR(50) NOT NULL,
        seq INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (ano_mes, tipo)
      )
    `);

    const upsert = await pool.query(
      `
      INSERT INTO ${primaryTable} (ano_mes, tipo, seq)
      VALUES ($1, $2, 1)
      ON CONFLICT (ano_mes, tipo)
      DO UPDATE SET seq = ${primaryTable}.seq + 1
      RETURNING seq
      `,
      [anoMes, tipo || '']
    );

    return upsert.rows[0].seq;
  } catch (err) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ${backupTable} (
          ano_mes VARCHAR(7) NOT NULL,
          tipo VARCHAR(50) NOT NULL,
          seq INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (ano_mes, tipo)
        )
      `);

      const upsert2 = await pool.query(
        `
        INSERT INTO ${backupTable} (ano_mes, tipo, seq)
        VALUES ($1, $2, 1)
        ON CONFLICT (ano_mes, tipo)
        DO UPDATE SET seq = ${backupTable}.seq + 1
        RETURNING seq
        `,
        [anoMes, tipo || '']
      );

      return upsert2.rows[0].seq;
    } catch (err2) {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS public.averbacoes_upload_seq (
          ano_mes VARCHAR(7) PRIMARY KEY,
          seq INTEGER NOT NULL DEFAULT 0
        )
      `);

      const upsertLegacy = await pool.query(
        `
        INSERT INTO public.averbacoes_upload_seq (ano_mes, seq)
        VALUES ($1, 1)
        ON CONFLICT (ano_mes)
        DO UPDATE SET seq = public.averbacoes_upload_seq.seq + 1
        RETURNING seq
        `,
        [anoMes]
      );

      return upsertLegacy.rows[0].seq;
    }
  }
}


cron.schedule('* * * * *', async () => {
  const RENDER_API_KEY = process.env.RENDER_API_KEY;
  const now = new Date();
  // Ajuste para fuso horário -3 (Brasília)
  const nowBRT = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const horaAtual = nowBRT.toTimeString().slice(0,5); // 'HH:MM' em Brasília
  let rows = [];
  let erroQuery = false;
  try {
    const result = await pool.query('SELECT postgres_id, horario, ativo FROM backup_agendado WHERE ativo = true');
    rows = result.rows;
  } catch (err) {
    erroQuery = true;
  }


  // Se não conseguiu buscar do banco ou não há linhas válidas, faz fallback para 00:01
  if (erroQuery || !rows.length) {
    if (horaAtual === '00:01') {
      try {
        // Busca todos os postgres_id ativos (se possível)
        let ids = [];
        if (!erroQuery) {
          ids = rows.map(r => r.postgres_id);
        } else {
          // Se nem conseguiu buscar, defina manualmente ou ignore
          // ids = ['id1', 'id2'];
        }
        for (const postgresId of ids) {
          try {
            const resp = await axios.post(`/api/admin/render/postgres/${postgresId}/export`);
          } catch (err) {
          }
        }
      } catch (err) {
      }
    }
    return;
  }

  // Comportamento normal: dispara backup conforme horário do banco
  for (const row of rows) {
    if (row.horario === horaAtual) {
      try {
        const resp = await axios.post(
          `https://api.render.com/v1/postgres/${row.postgres_id}/export`,
          {},
          {
      headers: {
        'Authorization': `Bearer ${RENDER_API_KEY}`,
        'Accept': 'application/json'
      }
          }
        );
      } catch (err) {
      }
    }
  }
});

  

  

  


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






const { preprocessImage } = require('./utils/imagePreprocess');

async function extrairDadosSeloPorOCR(imagePath) {
  try {
    // Pré-processa a imagem antes do OCR
    const preprocessedPath = await preprocessImage(imagePath);
    // Usar Tesseract com configurações melhoradas para OCR
    const { data: { text } } = await Tesseract.recognize(preprocessedPath, 'por', {
      logger: m => {},
      tessedit_pageseg_mode: Tesseract.PSM.AUTO,
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789áéíóúâêîôûãõçÁÉÍÓÚÂÊÎÔÛÃÕÇ:.,- ()',
    });
    // Usar a função melhorada de extração
    const dadosExtraidos = extrairDadosSeloMelhorado(text);
    // (Opcional) Remover arquivo temporário pré-processado
    try { require('fs').unlinkSync(preprocessedPath); } catch (e) {}
    return dadosExtraidos;
  } catch (error) {
    console.error('[BACKEND] Erro no OCR:', error);
    return {
      seloConsulta: '',
      codigoSeguranca: '',
      qtdAtos: null,
      atosPraticadosPor: '',
      valores: '',
      textoCompleto: ''
    };
  }
}



function extrairDadosSeloMelhorado(texto) {

  // ================= SELO DE CONSULTA =================
  const seloMatch = texto.match(/SELO\s+DE\s+CONSULTA[:\s]*([A-Z0-9]+)/i);
  const seloConsulta = seloMatch ? seloMatch[1] : '';

  // ================= CÓDIGO DE SEGURANÇA =================
  const codigoMatch = texto.match(/(\d{4}\.\d{4}\.\d{4}\.\d{4})/);
  const codigoSeguranca = codigoMatch ? codigoMatch[1] : '';

  // ================= QUANTIDADE DE ATOS =================
  let qtdAtosFinal = null;
  const qtdBaseMatch = texto.match(/Quantidade\s+de\s+atos\s+praticados[:\s]*(\d+)/i);
  if (qtdBaseMatch) {
    const qtdBase = qtdBaseMatch[1];
    const linhaAtosMatch = texto.match(new RegExp(qtdBase + "[^\\n]*\\)"));
    if (linhaAtosMatch) {
        qtdAtosFinal = linhaAtosMatch[0].replace(/\s+[a-z]{2,}\s*$/i, '').trim();
    } else {
      qtdAtosFinal = qtdBase;
    }
  }

  // ================= ATOS PRATICADOS POR =================
  let atosPraticadosPor = '';
  const atosPorMatch = texto.match(/por[:\s]*(.*?)(?:\s*-|\n|\r)/i);
  if (atosPorMatch && atosPorMatch[1]) {
    atosPraticadosPor = atosPorMatch[1].trim();
  }

  // ================= VALORES (LÓGICA FINAL PARA MÚLTIPLAS LINHAS) =================
  let valores = '';
  // Passo 1: Encontrar a primeira linha de valores (com "Emol:")
  const linha1Match = texto.match(/^.*Emol[:\s].*R\$.*$/im);
  
  // Passo 2: Encontrar a segunda linha de valores (com "Total:")
  const linha2Match = texto.match(/^.*Total[:\s].*R\$.*$/im);

  let linha1Limpa = '';
  let linha2Limpa = '';

  if (linha1Match) {
    linha1Limpa = linha1Match[0]
      .replace(/.*(Emol[:\s].*)/i, '$1') // Pega tudo a partir de "Emol"
      .replace(/- - fETEFGSTAS/i, '')    // Remove lixo específico
      .trim();
  }

  if (linha2Match) {
    linha2Limpa = linha2Match[0]
      .replace(/fsTetatras/i, '') // Remove lixo específico
      .trim();
  }
  
  // Passo 3: Juntar as linhas limpas
  if (linha1Limpa && linha2Limpa) {
    valores = `${linha1Limpa} - ${linha2Limpa}`;
  } else if (linha1Limpa) {
    valores = linha1Limpa; // Fallback se apenas a primeira linha for encontrada
  } else if (linha2Limpa) {
    valores = linha2Limpa; // Fallback se apenas a segunda linha for encontrada
  }

  // Passo 4: Limpeza final da string combinada
  valores = valores
    .replace(/- 188:/i, '- ISS:') // Corrige o erro de OCR "188"
    .replace(/\s\s+/g, ' ')       // Normaliza espaços
    .trim();


  // ================= RESULTADO FINAL =================
  const resultado = {
    seloConsulta,
    codigoSeguranca,
    qtdAtos: qtdAtosFinal,
    atosPraticadosPor,
    valores,
    textoCompleto: texto
  };

  console.log('[OCR] Resultado da extração (v6 - Final):', resultado);
  
  return resultado;
}





// Executar criação da tabela
//createConferenciasTable();

//const express = require('express');
//const router = express.Router();
//const pool = require('../db'); // ajuste para seu pool/conexão

const router = express.Router();

// ...existing code...
const gerarProtocolo = async () => {
  try {
    // Tenta criar a sequence se não existir
    await pool.query(`
      CREATE SEQUENCE IF NOT EXISTS protocolo_seq 
      START WITH 1 
      INCREMENT BY 1 
      NO MINVALUE 
      NO MAXVALUE 
      CACHE 1
    `);
    
    // Busca o próximo valor da sequência
    const seqRes = await pool.query('SELECT nextval(\'protocolo_seq\') as seq');
    const seq = seqRes.rows[0].seq;
    
    // Data/hora atual
    const agora = new Date();
    const dataStr = agora.toISOString().replace(/[-T:\.Z]/g, '').slice(0, 12); // YYYYMMDDHHMM
    
    // Protocolo: data + seq
    return `${dataStr}-${seq}`;
  } catch (error) {
    console.error('Erro ao gerar protocolo:', error);
    
    // Fallback: usar timestamp + número aleatório
    const agora = new Date();
    const dataStr = agora.toISOString().replace(/[-T:\.Z]/g, '').slice(0, 14); // YYYYMMDDHHMMSS
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    
    return `${dataStr}-${random}`;
  }
};


dotenv.config();
const port = process.env.PORT || 3001;
// global JSON parser will be registered later after tracker raw middleware

// Quick request logger for diagnosing matricula calls
// Optional request logger: enable with REQUEST_LOGGING=true in environment.
app.use((req, res, next) => {
  try {
    const enabled = String(process.env.REQUEST_LOGGING || '').toLowerCase() === 'true';
    if (!enabled) return next();
    // global API logger
    console.log(new Date().toISOString(), req.method, req.originalUrl);
    if (req.path === '/api/matriculas/generate') {
      console.log('matricula hit ->', new Date().toISOString(), req.method, req.originalUrl);
      try { console.log('body:', JSON.stringify(req.body)); } catch (e) { console.log('body: <unserializable>'); }
    }
    if (req.path === '/matriculas/generate') {
      console.log('matricula (no /api) hit ->', new Date().toISOString(), req.method, req.originalUrl);
      try { console.log('body:', JSON.stringify(req.body)); } catch (e) { console.log('body: <unserializable>'); }
    }
  } catch (e) {
    // swallow
  }
  next();
});

// Simple echo endpoint to test reachability and body parsing
app.post('/api/debug/echo', (req, res) => {
  return res.json({ ok: true, path: req.originalUrl, method: req.method, body: req.body || null });
});

// (IA routes will be registered after CORS middleware)



// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || '7a3dfb677e3250bb4584e40d672a7229';
//const jwt = require('jsonwebtoken');
// CORS
const allowedOrigins = [
  'https://frontend-0f8x.onrender.com',
  'https://www.bibliofilia.com.br',
  'https://frontend-dev-e7yt.onrender.com',
];

// allow overriding or adding a frontend origin via env
if (process.env.FRONTEND_ORIGIN) {
  allowedOrigins.push(process.env.FRONTEND_ORIGIN);
}

const corsOptions = {
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'O CORS não permite acesso deste domínio.';
      console.warn('[server] CORS blocked origin', origin);
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
// Cookie parser needed to read track_uid for tracker routes (works with raw body)
app.use(cookieParser());
// Preflight: accept raw body for tracker events before global JSON parser
try {
  app.use('/api/tracker/events', express.raw({ type: ['application/json', 'text/*'], limit: '64kb' }));
  // Accept raw body for login as well (some frontends send non-quoted JSON-like payloads)
  app.use('/api/login', express.raw({ type: ['application/json', 'text/*', 'application/x-www-form-urlencoded'], limit: '64kb' }));
  // Register tracker routes before the global JSON body parser so we can
  // capture raw requests (some clients send non-JSON payloads).
  registerTracker(app, { pool });
} catch (e) {
  console.warn('[server] failed to register tracker routes or raw middleware:', e && e.message ? e.message : e);
}
app.use(express.json());
// Parse URL-encoded bodies (e.g., HTML form posts)
app.use(express.urlencoded({ extended: true }));
// Parse text bodies for simple form submissions
app.use(express.text({ type: ['text/*', 'application/x-www-form-urlencoded'], limit: '64kb' }));

// Global error handler to catch JSON parse errors from body-parser
app.use(async (err, req, res, next) => {
  if (err && (err.type === 'entity.parse.failed' || err.status === 400) && err.body !== undefined) {
    console.warn('[server] body parse error for path', req.path, 'content-type:', req.headers['content-type']);
    try {
      console.debug('[server] body-parser error body (trim):', String(err.body).slice(0,200));
    } catch (e) {}
    // If this is the tracker endpoint, try a tolerant fallback parse and process
    if (req.path && req.path.startsWith('/api/tracker') && req.method === 'POST') {
      let raw = err.body;
      try {
        if (Buffer.isBuffer(raw)) raw = raw.toString('utf8');
      } catch (e) {}

      let parsed = null;
      const tryParse = (s) => {
        try {
          return JSON.parse(s);
        } catch (e) {
          return null;
        }
      };

      // Attempt direct parse
      parsed = tryParse(raw);
      // If raw is a JSON string containing JSON (double-encoded), try twice
      if (!parsed && typeof raw === 'string' && raw.trim().startsWith('"')) {
        try {
          const once = JSON.parse(raw);
          if (typeof once === 'string') parsed = tryParse(once);
        } catch (e) {}
      }
      // Tolerant transform (unquoted keys/values)
      if (!parsed && typeof raw === 'string') {
        const transform = (s) => {
          if (!s || typeof s !== 'string') return s;
          let t = s.replace(/([{,\n\r\s])([A-Za-z0-9_\-@\/\.]+)\s*:/g, '$1"$2":');
          t = t.replace(/:\s*([A-Za-z0-9_\-@\/\.:\+]+)(?=[,}\]])/g, ':"$1"');
          return t;
        };
        try {
          const attempted = transform(raw);
          parsed = tryParse(attempted);
          if (parsed) console.warn('[server] tolerant parse succeeded for tracker payload');
        } catch (e) {}
      }

      if (!parsed) {
        return res.status(400).json({ ok: false, error: 'invalid json', details: 'malformed JSON payload' });
      }

      try {
        const { processTrackerEvent } = require('./routes/tracker');
        const result = await processTrackerEvent(pool, parsed, req);
        return res.status(result.status).json(result.body);
      } catch (e) {
        console.error('[server] tracker fallback processing error', e && e.message ? e.message : e);
        return res.status(500).json({ ok: false, error: 'server error' });
      }
    }

    return res.status(400).send('Invalid JSON');
  }
  next(err);
});

// Registra as rotas de IA modularizadas (após CORS para incluir os headers)
registerIaRoutes(app);

// Relatórios obrigatórios
const relatoriosObrigatoriosRouter = require('./routes/relatoriosObrigatorios');
app.use('/api/relatorios-obrigatorios', relatoriosObrigatoriosRouter);
initDapRoutes(app, pool, { ensureAuth });
initAtosTabelasRoutes(app, pool, { ensureAuth });

// Storage browser routes (list/download/delete)
registerStorage(app);

// Register matricula routes (matricula generator)
try {
  initMatriculaRoutes(app);
  console.log('[server] matricula routes registered');
} catch (e) {
  console.warn('[server] failed to register matricula routes:', e && e.message ? e.message : e);
}

// Função para processar texto extraído e capturar os dados reais
function processarTextoExtraido(texto) {
  const parseValor = (str) => {
    if (!str) return 0;
    return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
  };

  const emolumentoMatch = texto.match(/Emolumento Apurado:\s*R\$\s*([\d\.,]+)/i);
  const tfjMatch = texto.match(/Taxa de Fiscalização Judiciária Apurada:\s*R\$\s*([\d\.,]+)/i);
  const recompeMatch = texto.match(/RECOMPE.*?Apurado:\s*R\$\s*([\d\.,]+)/i);
  const issqnMatch = texto.match(/ISSQN recebido dos usuários:\s*R\$\s*([\d\.,]+)/i);
  const totalDespesasMatch = texto.match(/Total de despesas do mês:\s*R\$\s*([\d\.,]+)/i);
  const recompeRecebidoMatch = texto.match(/Valores recebidos do RECOMPE:\s*R\$\s*([\d\.,]+)/i);

  const atosMatch = texto.match(/Total\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/i);

  const atosPraticados = atosMatch
    ? atosMatch.slice(1).reduce((acc, val) => acc + parseInt(val, 10), 0)
    : 0;

  return {
    atosPraticados,
    emolumentoApurado: emolumentoMatch ? parseValor(emolumentoMatch[1]) : 0,
    tfj: tfjMatch ? parseValor(tfjMatch[1]) : 0,
    valoresRecompe: recompeMatch ? parseValor(recompeMatch[1]) : 0,
    issqn: issqnMatch ? parseValor(issqnMatch[1]) : 0,
    recompeApurado: recompeMatch ? parseValor(recompeMatch[1]) : 0,
    recompeRecebido: recompeRecebidoMatch ? parseValor(recompeRecebidoMatch[1]) : 0,
    totalDespesas: totalDespesasMatch ? parseValor(totalDespesasMatch[1]) : 0,
  };
}

// Configuração do multer para upload de arquivos (single)
const upload = multer({
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/bmp',
      'image/gif',
      'image/webp',
      'text/plain' // permite a string do selo vinda da área de transferência'
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos de imagem, texto ou PDF são permitidos!'));
    }
  }
});

// Configuração do multer para upload de múltiplos arquivos (tabelas 07 e 08)
const uploadAtos = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/plain') {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos de texto (.txt) são permitidos!'));
    }
  },
});

async function extractTextWithPdfParse(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  console.log('Tamanho do buffer recebido:', dataBuffer.length);
  const data = await pdfParse(dataBuffer);
  return data.text;
}


//Configura o multer para múltiplos arquivos PDF

const uploadPdfMultiple = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos PDF são permitidos!'));
    }
  },
});

const campos = [
  { name: 'file0', maxCount: 1 },
  { name: 'file1', maxCount: 1 },
  { name: 'file2', maxCount: 1 },
  { name: 'file3', maxCount: 1 },
  { name: 'file4', maxCount: 1 },
  { name: 'file5', maxCount: 1 },
];

// Rota para importar e processar até 6 arquivos PDF
app.post('/api/importar-atos-pdf', authenticate, uploadPdfMultiple.fields(campos), async (req, res) => {
  try {
    const arquivos = [];
    for (let i = 0; i < 6; i++) {
      const campo = `file${i}`;
      if (req.files[campo] && req.files[campo][0]) {
        arquivos.push(req.files[campo][0]);
      }
    }

    if (arquivos.length !== 6) {
      return res.status(400).json({ error: 'É necessário enviar exatamente 6 arquivos PDF.' });
    }

    const resultados = [];

    for (const file of arquivos) {
      console.log(`Processando arquivo: ${file.originalname}`);
      const textoExtraido = await extractTextWithPdfParse(file.path);
      console.log('Tipo de textoExtraido:', typeof textoExtraido);
console.log('Conteúdo (início):', textoExtraido.slice(0, 100));
      const dadosProcessados = processarTextoExtraido(textoExtraido);

      resultados.push({
        nomeArquivo: file.originalname,
        ...dadosProcessados,
      });

      fs.unlink(file.path, (err) => {
        if (err) console.error('Erro ao deletar arquivo temporário:', err);
      });
    }

    res.json({
      sucesso: true,
      totalArquivos: arquivos.length,
      dadosIndividuais: resultados,
      totais: {
        atosPraticados: resultados.reduce((sum, r) => sum + r.atosPraticados, 0),
        arrecadacao: resultados.reduce((sum, r) => sum + r.emolumentoApurado + r.recompeRecebido + r.tfj + r.issqn, 0).toFixed(2),
        custeio: resultados.reduce((sum, r) => sum + r.totalDespesas, 0).toFixed(2),
        repasses: resultados.reduce((sum, r) => sum + r.recompeApurado + r.issqn + r.tfj, 0).toFixed(2),
      }
    });
  } catch (error) {
    console.error('Erro ao processar arquivos PDF:', error);
    res.status(500).json({ error: 'Erro interno ao processar arquivos PDF.', details: error.message });
  }
});


// Função para extrair texto do PDF usando pdf-parse
async function extrairDadosDoPdf(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const pdfData = await pdfParse(dataBuffer);
  // Aqui você pode processar pdfData.text para extrair os dados que precisa
  return {
    textoExtraido: pdfData.text,
    tamanho: pdfData.text.length,
  };
}


//rota protegida (com authenticate) para receber os arquivos, extrair os dados e responder CNJ
app.post('/api/importar-atos-pdf', authenticate, uploadPdfMultiple.array('files', 6), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Nenhum arquivo PDF enviado.' });
    }

    const resultados = [];

    for (const file of req.files) {
      const dadosExtraidos = await extrairDadosDoPdf(file.path);

      resultados.push({
        nomeArquivo: file.originalname,
        dados: dadosExtraidos,
      });

      // Remove arquivo temporário
      fs.unlink(file.path, (err) => {
        if (err) console.error('Erro ao deletar arquivo temporário:', err);
      });
    }

    res.json({
      sucesso: true,
      totalArquivos: req.files.length,
      resultados,
    });
  } catch (error) {
    console.error('Erro ao processar arquivos PDF:', error);
    res.status(500).json({ error: 'Erro interno ao processar arquivos PDF.' });
  }
});


// Função robusta para extrair atos do texto das tabelas


const codigosTabela07 = new Set([
  '7101', '7201', '7302', '7402', '7501', '7502', '7701', '7802', '7803', '7804',
  '7901', '7100', '7110', '7120', '7130', '7140', '7150', '7180', '7190', '7927'
]);

const codigosTabela08 = new Set(['8101', '8301', '8310']);

function extrairAtos(texto, origem) {
  if (origem === 'Tabela 07') {
    return extrairAtosTabela07(texto);
  } else if (origem === 'Tabela 08') {
    return extrairAtosTabela08(texto);
  } else {
    return [];
  }
}

function extrairAtosTabela07(texto) {
  const atos = [];
  const linhas = texto.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  let buffer = '';
  const isLinhaInicioAto = (linha) => /^\d+(\.\d+)?\s*-\s*/.test(linha);

  const linhasIgnorar = [
    'Tabela', 'Certidões', 'Revogado', 'VETADO', '---', 'Obs.', 'Nota', 'Item vetado', 'Expedição', 'Apostilamento'
  ];

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];

    if (linhasIgnorar.some(palavra => linha.includes(palavra))) {
      continue;
    }

    if (isLinhaInicioAto(linha)) {
      if (buffer) {
        const ato = processarAtoTabela07(buffer);
        if (ato) atos.push(ato);
      }
      buffer = linha;
    } else {
      buffer += ' ' + linha;
    }
  }

  if (buffer) {
    const ato = processarAtoTabela07(buffer);
    if (ato) atos.push(ato);
  }

  return atos.filter(ato => codigosTabela07.has(ato.codigo));
}

function processarAtoTabela07(textoAto) {
  textoAto = textoAto.replace(/\|/g, ' ').replace(/\s+/g, ' ').trim();

  // Regex para capturar valores e código no final, mais flexível para espaços e formatos
  const regex = /^(.*?)(?:R?\$?\s*[\d.,]+\s+){6}(\d+)$/;

  const match = textoAto.match(regex);
  if (!match) {
    console.warn('Não conseguiu extrair ato Tabela 07:', textoAto.substring(0, 100));
    return null;
  }

  const descricao = match[1].trim();

  const valoresRegex = /R?\$?\s*([\d.,]+)/g;
  const valores = [];
  let m;
  while ((m = valoresRegex.exec(textoAto)) !== null) {
    valores.push(m[1]);
  }

  if (valores.length < 6) {
    console.warn('Valores insuficientes para ato Tabela 07:', textoAto.substring(0, 100));
    return null;
  }

  const parseValor = v => parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0;

  return {
    descricao,
    emol_bruto: parseValor(valores[0]),
    recompe: parseValor(valores[1]),
    emol_liquido: parseValor(valores[2]),
    issqn: parseValor(valores[3]),
    taxa_fiscal: parseValor(valores[4]),
    valor_final: parseValor(valores[5]),
    codigo: match[2],
    origem: 'Tabela 07',
  };
}

function extrairAtosTabela08(texto) {
  const atos = [];
  const linhas = texto.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  const linhasIgnorar = ['VETADO', 'Nota', 'Notas', 'Tabela', '---'];

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];

    if (linhasIgnorar.some(palavra => linha.includes(palavra))) {
      continue;
    }

    if (!linha.includes('|')) {
      continue;
    }

    const partes = linha.split('|').map(s => s.trim()).filter(s => s.length > 0);

    if (partes.length < 8) {
      continue;
    }

    const codigo = partes[7];
    if (!codigosTabela08.has(codigo)) {
      continue;
    }

    const parseValor = v => parseFloat(v.replace(/[R$\s]/g, '').replace(',', '.')) || 0;

    atos.push({
      descricao: partes[0],
      emol_bruto: parseValor(partes[1]),
      recompe: parseValor(partes[2]),
      emol_liquido: parseValor(partes[3]),
      issqn: parseValor(partes[4]),
      taxa_fiscal: parseValor(partes[5]),
      valor_final: parseValor(partes[6]),
      codigo,
      origem: 'Tabela 08',
    });
  }

  return atos;
}

function processarAto(textoAto, origem) {
  // Remove pipes e múltiplos espaços
  textoAto = textoAto.replace(/\|/g, ' ').replace(/\s+/g, ' ').trim();

  // Regex mais flexível para capturar valores e código no final
  // Captura a descrição até o primeiro valor monetário, depois captura 6 valores monetários e o código no final
  const regex = /^(.*?)(?:R?\$?\s*[\d.,]+\s+){6}(\d+)$/;

  const match = textoAto.match(regex);
  if (!match) {
    console.warn('Não conseguiu extrair ato:', textoAto.substring(0, 100));
    return null;
  }

  const descricao = match[1].trim();

  // Extrair os valores monetários e código usando outra regex para pegar todos os números no final
  const valoresRegex = /R?\$?\s*([\d.,]+)/g;
  const valores = [];
  let m;
  while ((m = valoresRegex.exec(textoAto)) !== null) {
    valores.push(m[1]);
  }

  if (valores.length < 6) {
    console.warn('Valores insuficientes para ato:', textoAto.substring(0, 100));
    return null;
  }

  const parseValor = v => parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0;

  return {
    descricao,
    emol_bruto: parseValor(valores[0]),
    recompe: parseValor(valores[1]),
    emol_liquido: parseValor(valores[2]),
    issqn: parseValor(valores[3]),
    taxa_fiscal: parseValor(valores[4]),
    valor_final: parseValor(valores[5]),
    codigo: match[2],
    origem,
  };
}

//rota para listar os atos do tj

app.get('/api/atos', authenticate, async (req, res) => {
  const search = req.query.search || '';
  try {
    const result = await pool.query(
      `SELECT id, codigo, descricao, emol_bruto, issqn, taxa_fiscal, valor_final
       FROM atos
       WHERE codigo ILIKE $1 OR descricao ILIKE $1
       ORDER BY codigo
       LIMIT 20`,
      [`%${search}%`]
    );
    res.json({ atos: result.rows });
  } catch (err) {
    console.error('Erro ao listar atos:', err);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});




// Middleware de autenticação (exemplo)
function authenticate(req, res, next) {
  // Sua lógica de autenticação aqui
  next();
}


// Rota para buscar atos pagos por data e usuário
app.get('/api/atos-pagos', authenticate, async (req, res) => {
  const data = req.query.data;
  const serventia = req.query.serventia;
  const usuario = req.user;

  console.log('[ATOS-PAGOS][GET] Parâmetros recebidos:', { data, serventia, usuario });

  if (!data) {
    console.warn('[ATOS-PAGOS][GET] Parâmetro data ausente');
    return res.status(400).json({ message: 'Parâmetro data é obrigatório.' });
  }
  if (!usuario) {
    console.warn('[ATOS-PAGOS][GET] Usuário não autenticado');
    return res.status(401).json({ message: 'Usuário não autenticado.' });
  }
  if (!serventia) {
    console.warn('[ATOS-PAGOS][GET] Parâmetro serventia ausente');
    return res.status(400).json({ message: 'Parâmetro serventia é obrigatório.' });
  }

  try {
    // 1. Verifica se a serventia está com caixa unificado
    const configResult = await pool.query(
      'SELECT caixaUnificado FROM serventia WHERE nome_abreviado = $1',
      [serventia]
    );
    console.log('[ATOS-PAGOS][GET] Resultado configResult:', configResult.rows);
    const caixaUnificado = configResult.rows[0]?.caixaunificado;

    let result;
    if (caixaUnificado) {
      // 2. Busca todos os usuários da serventia
      const usuariosResult = await pool.query(
        'SELECT nome FROM users WHERE serventia = $1',
        [serventia]
      );
      const nomesUsuarios = usuariosResult.rows.map(u => u.nome);
      console.log('[ATOS-PAGOS][GET] nomesUsuarios:', nomesUsuarios);

      if (nomesUsuarios.length === 0) {
        console.log('[ATOS-PAGOS][GET] Nenhum usuário encontrado para a serventia');
        return res.json({ CaixaDiario: [] });
      }

      // 3. Busca todos os atos do dia para esses usuários
      result = await pool.query(
        `SELECT id, data, hora, codigo, descricao, quantidade, valor_unitario, pagamentos, usuario
         FROM atos_pagos
         WHERE data = $1 AND usuario = ANY($2)
         ORDER BY hora`,
        [data, nomesUsuarios]
      );
      console.log('[ATOS-PAGOS][GET] Resultados atos pagos (unificado):', result.rows);
    } else {
      // 4. Apenas os atos do usuário logado
      result = await pool.query(
        `SELECT id, data, hora, codigo, descricao, quantidade, valor_unitario, pagamentos, usuario
         FROM atos_pagos
         WHERE data = $1 AND usuario = $2
         ORDER BY hora`,
        [data, usuario.nome]
      );
      console.log('[ATOS-PAGOS][GET] Resultados atos pagos (usuário):', result.rows);
    }
    res.json({ CaixaDiario: result.rows });
  } catch (err) {
    console.error('[ATOS-PAGOS][GET] Erro ao buscar atos pagos:', err);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});
/*
app.get('/api/atos-pagos', authenticate, async (req, res) => {
  const data = req.query.data; // espera 'YYYY-MM-DD'
  console.log('Data recebida do frontend:', data);
  const usuario = req.user; // middleware authenticate define req.user

  if (!data) {
    return res.status(400).json({ message: 'Parâmetro data é obrigatório.' });
  }
  if (!usuario) {
    return res.status(401).json({ message: 'Usuário não autenticado.' });
  }

  try {
    const result = await pool.query(
      `SELECT id, data, hora, codigo, descricao, quantidade, valor_unitario, pagamentos, usuario
       FROM atos_pagos
       WHERE (data) = $1 AND usuario = $2
       ORDER BY hora`,
      [data, usuario.nome]  // <-- aqui usamos apenas o id do usuário
    );
    res.json({ CaixaDiario: result.rows });
    } catch (err) {
    console.error('Erro ao buscar atos pagos:', err);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});
*/
// Rota para adicionar um ato pago com usuário
// POST /api/atos-pagos
app.post('/api/atos-pagos', authenticate, async (req, res) => {
  // Campos enviados pelo frontend
  const {
    data,
    hora,
    codigo,
    descricao,
    quantidade,
    valor_unitario,
    pagamentos,
    total_entradas,
    total_saidas
  } = req.body;

  // Usuário autenticado (definido pelo middleware `authenticate`)
  const usuarioAutenticado = req.user || {};
  const usuarioNome = usuarioAutenticado.nome || usuarioAutenticado.email || 'desconhecido';
  const usuarioId = usuarioAutenticado.id || usuarioNome;
  const serventiaUsuario = usuarioAutenticado.serventia || null;

  console.log('[ATOS-PAGOS][POST] Dados recebidos:', {
    data,
    hora,
    codigo,
    descricao,
    quantidade,
    valor_unitario,
    pagamentos,
    total_entradas,
    total_saidas,
    usuarioNome,
    serventiaUsuario
  });

  // Validações mínimas
  if (!data || !codigo) {
    return res.status(400).json({ message: 'Campos obrigatórios ausentes: data e/ou codigo.' });
  }

  // Para códigos únicos por dia/usuário (ex: 0001 fechamento, 0005 valor inicial)
  if (codigo === '0001' || codigo === '0005') {
    try {
      // Garantir unicidade por data + usuário + (opcionalmente) serventia
      const existeQuery = await pool.query(
        `SELECT 1 FROM atos_pagos WHERE data = $1 AND usuario = $2 AND codigo = $3 ${serventiaUsuario ? 'AND serventia = $4' : ''} LIMIT 1`,
        serventiaUsuario ? [data, usuarioNome, codigo, serventiaUsuario] : [data, usuarioNome, codigo]
      );
      if (existeQuery.rowCount > 0) {
        console.warn('[ATOS-PAGOS][POST] Já existe ato com código', codigo, 'para', data, usuarioNome, serventiaUsuario);
        return res.status(409).json({ message: `Já existe um ato com código ${codigo} para este dia e usuário.` });
      }
    } catch (err) {
      console.error('[ATOS-PAGOS][POST] Erro ao verificar duplicidade:', err);
      return res.status(500).json({ message: 'Erro ao verificar duplicidade.', details: err.message });
    }
  }

  // Prepara os valores para inserção
  const pagamentosParam = (pagamentos && typeof pagamentos === 'object') ? pagamentos : (pagamentos ? JSON.parse(pagamentos) : null);
  const quantidadeNum = quantidade ? Number(quantidade) : 1;
  const valorUnitarioNum = (valor_unitario !== undefined && valor_unitario !== null) ? Number(valor_unitario) : 0;
  const totalEntradasNum = (total_entradas !== undefined && total_entradas !== null) ? Number(total_entradas) : 0;
  const totalSaidasNum = (total_saidas !== undefined && total_saidas !== null) ? Number(total_saidas) : 0;

  try {
    // Inserir novos campos: `serventia`, `total_entradas`, `total_saidas`
    const insertQuery = `
      INSERT INTO atos_pagos
        (data, hora, codigo, descricao, quantidade, valor_unitario, pagamentos, usuario, serventia, total_entradas, total_saidas)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11)
      RETURNING *
    `;

    const params = [
      data,
      hora || null,
      codigo,
      descricao || null,
      quantidadeNum,
      valorUnitarioNum,
      pagamentosParam ? JSON.stringify(pagamentosParam) : null,
      usuarioNome,
      serventiaUsuario,
      totalEntradasNum,
      totalSaidasNum
    ];

    const result = await pool.query(insertQuery, params);

    console.log('[ATOS-PAGOS][POST] Sucesso ao inserir:', result.rows[0]);
    return res.status(201).json({ atoPago: result.rows[0], message: 'Ato pago cadastrado com sucesso!' });
  } catch (err) {
    console.error('[ATOS-PAGOS][POST] Erro ao cadastrar ato pago:', err);
    return res.status(500).json({ message: 'Erro interno ao cadastrar ato pago.', details: err.message });
  }
});

// Rota para deletar um ato pago pelo id
app.delete('/api/atos-pagos/:id', authenticate, async (req, res) => {
  const id = req.params.id;
  try {
    const result = await pool.query(`DELETE FROM atos_pagos WHERE id = $1`, [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Ato não encontrado.' });
    }
    res.status(204).send();
  } catch (err) {
    console.error('Erro ao deletar ato pago:', err);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});


// Importa selos dos pedidos para os atos praticados
app.post('/api/atos-praticados/importar-servicos', authenticateToken, async (req, res) => {
  try {
    const { data, usuarios, serventia, preview } = req.body;

    console.log('🔄 Iniciando importação de atos:', { data, usuarios: usuarios?.length, serventia, preview: !!preview });
    console.log('📅 Data recebida para busca:', data, 'Tipo:', typeof data);

    if (!data || !usuarios || !Array.isArray(usuarios) || usuarios.length === 0) {
      return res.status(400).json({
        message: 'Parâmetros inválidos: data e lista de usuários são obrigatórios'
      });
    }

    // Normalizar formato da data para YYYY-MM-DD
    let dataFormatada = data;
    if (typeof data === 'string' && data.includes('/')) {
      const partesData = data.split('/');
      if (partesData.length === 3) {
        dataFormatada = `${partesData[2]}-${partesData[1].padStart(2, '0')}-${partesData[0].padStart(2, '0')}`;
      }
    }
    console.log('📅 Data formatada para consulta:', dataFormatada);

    // 1. Buscar dados da tabela selos_execucao_servico com JOIN para pedido_pagamento
    console.log('📋 Buscando atos da tabela selos_execucao_servico...');

    const querySelosComPagamento = `
      SELECT 
        s.id,
        s.execucao_servico_id,
        DATE(s.criado_em) as data_execucao,
        TO_CHAR(s.criado_em, 'HH24:MI:SS') as hora_execucao,
        s.selo_consulta,
        s.codigo_seguranca,
        s.qtd_atos,
        s.atos_praticados_por as usuario_execucao,
        s.valores,
        s.criado_em,
        p.id as pagamento_id,
        p.protocolo as pagamento_protocolo,
        p.valor_atos,
        p.valor_adicional,
        p.total_adiantado,
        p.usuario as pagamento_usuario,
        p.data as pagamento_data,
        p.hora as pagamento_hora,
        p.complemento_pagamento,
        p.detalhes_pagamento
      FROM selos_execucao_servico s
      LEFT JOIN pedido_pagamento p ON p.protocolo = s.execucao_servico_id
      WHERE DATE(s.criado_em) = $1::date
        AND (
          s.atos_praticados_por = ANY($2::text[])
          OR UPPER(s.atos_praticados_por) LIKE ANY(
            SELECT UPPER('%' || usuario_busca || '%') 
            FROM unnest($2::text[]) AS usuario_busca
          )
          OR EXISTS (
            SELECT 1 FROM unnest($2::text[]) AS usuario_busca
            WHERE UPPER(usuario_busca) LIKE UPPER('%' || split_part(s.atos_praticados_por, ' ', 1) || '%')
               OR UPPER(usuario_busca) LIKE UPPER('%' || split_part(s.atos_praticados_por, ' ', 2) || '%')
          )
        )
      ORDER BY s.criado_em DESC
    `;

    console.log('🔍 Executando consulta com parâmetros:', { dataFormatada, usuarios });
    const resultSelos = await pool.query(querySelosComPagamento, [dataFormatada, usuarios]);
    const selosEncontrados = resultSelos.rows;

    console.log(`📊 Encontrados ${selosEncontrados.length} registros na tabela selos_execucao_servico`);

    if (selosEncontrados.length === 0) {
      return res.json({
        message: 'Nenhum ato encontrado na tabela selos_execucao_servico para os critérios informados',
        atosEncontrados: 0,
        atosImportados: 0,
        atosPreview: []
      });
    }

    // --- Reuso das suas funções de extração/mapeamento ---
    const extrairAtosDoTexto = (qtdAtosTexto) => {
      const atos = [];
      if (!qtdAtosTexto) return atos;
      const regex = /(\d+)\((\d+)\)/g;
      let match;
      while ((match = regex.exec(qtdAtosTexto)) !== null) {
        const quantidade = parseInt(match[1]);
        const codigo = match[2];
        atos.push({ codigo: codigo, quantidade: quantidade });
      }
      return atos;
    };

    const extrairFormasPagamento = (dadosPagamento) => {
      const pagamentos = {
        dinheiro: { quantidade: 0, valor: 0, manual: false },
        cartao: { quantidade: 0, valor: 0, manual: false },
        pix: { quantidade: 0, valor: 0, manual: false },
        crc: { quantidade: 0, valor: 0, manual: false },
        depositoPrevio: { quantidade: 0, valor: 0, manual: false }
      };
      if (!dadosPagamento) return pagamentos;
      try {
        const dadosProcessados = typeof dadosPagamento === 'string' ? JSON.parse(dadosPagamento) : dadosPagamento;
        if (Array.isArray(dadosProcessados)) {
          dadosProcessados.forEach(item => {
            if (item.valor && item.forma) {
              const mapeamento = {
                'dinheiro': 'dinheiro',
                'cartao': 'cartao',
                'cartão': 'cartao',
                'pix': 'pix',
                'crc': 'crc',
                'deposito_previo': 'depositoPrevio',
                'deposito previo': 'depositoPrevio',
                'depositoPrevio': 'depositoPrevio'
              };
              const chaveCorreta = mapeamento[item.forma.toLowerCase()];
              if (chaveCorreta) {
                pagamentos[chaveCorreta].quantidade += 1;
                pagamentos[chaveCorreta].valor += parseFloat(item.valor) || 0;
                pagamentos[chaveCorreta].manual = Boolean(item.complemento);
              }
            }
          });
        } else {
          Object.keys(dadosProcessados).forEach(chave => {
            const valor = dadosProcessados[chave];
            const mapeamento = {
              'dinheiro': 'dinheiro',
              'cartao': 'cartao',
              'cartão': 'cartao',
              'pix': 'pix',
              'crc': 'crc',
              'deposito_previo': 'depositoPrevio',
              'depositoPrevio': 'depositoPrevio'
            };
            const chaveCorreta = mapeamento[chave.toLowerCase()];
            if (chaveCorreta && typeof valor === 'object' && valor !== null) {
              pagamentos[chaveCorreta] = {
                quantidade: parseInt(valor.quantidade) || 0,
                valor: parseFloat(valor.valor) || 0,
                manual: Boolean(valor.manual)
              };
            }
          });
        }
      } catch (error) {
        console.error('❌ Erro ao processar dados de pagamento (preview/extract):', error);
      }
      return pagamentos;
    };

    // Criar mapeamento simples (reaproveita sua função)
    const criarMapeamentoUsuarios = (usuariosBanco, usuariosFrontend) => {
      const mapeamento = {};
      usuariosBanco.forEach(usuarioBanco => {
        let usuarioCorrespondente = usuariosFrontend.find(uf => uf === usuarioBanco);
        if (!usuarioCorrespondente) {
          const palavrasBanco = usuarioBanco.toUpperCase().split(' ').filter(p => p.length > 2);
          let melhorMatch = null;
          let maiorPontuacao = 0;
          usuariosFrontend.forEach(usuarioFrontend => {
            const palavrasFrontend = usuarioFrontend.toUpperCase().split(' ').filter(p => p.length > 2);
            let pontuacao = 0;
            if (palavrasBanco.length > 0 && palavrasFrontend.length > 0) {
              const primeiroNomeBanco = palavrasBanco[0];
              const primeiroNomeFrontend = palavrasFrontend[0];
              if (primeiroNomeBanco.includes(primeiroNomeFrontend) || primeiroNomeFrontend.includes(primeiroNomeBanco)) pontuacao += 10;
              if (palavrasBanco.length > 1 && palavrasFrontend.length > 1) {
                const ultimoNomeBanco = palavrasBanco[palavrasBanco.length - 1];
                const ultimoNomeFrontend = palavrasFrontend[palavrasFrontend.length - 1];
                if (ultimoNomeBanco.includes(ultimoNomeFrontend) || ultimoNomeFrontend.includes(ultimoNomeBanco)) pontuacao += 10;
              }
              palavrasBanco.forEach((pBanco, i) => {
                if (i !== 0 && i !== palavrasBanco.length - 1) {
                  palavrasFrontend.forEach(pFrontend => {
                    if (pBanco.includes(pFrontend) || pFrontend.includes(pBanco)) pontuacao += 2;
                  });
                }
              });
            }
            if (pontuacao > maiorPontuacao && pontuacao >= 10) {
              maiorPontuacao = pontuacao;
              melhorMatch = usuarioFrontend;
            }
          });
          usuarioCorrespondente = melhorMatch;
        }
        mapeamento[usuarioBanco] = usuarioCorrespondente || usuarioBanco;
      });
      return mapeamento;
    };

    // Mapear usuários do resultado
    const usuariosUnicos = [...new Set(selosEncontrados.map(s => s.usuario_execucao))];
    const mapeamentoUsuarios = criarMapeamentoUsuarios(usuariosUnicos, usuarios);
    console.log('📋 Mapeamento completo de usuários (preview):', mapeamentoUsuarios);

    // --- Montar array de atos no formato de preview/processado (mas sem persistir) ---
    const atosPreview = [];
    for (const selo of selosEncontrados) {
      try {
        const formasPagamento = extrairFormasPagamento(selo.detalhes_pagamento || selo.complemento_pagamento);
        const atosExtraidos = extrairAtosDoTexto(selo.qtd_atos);
        if (!atosExtraidos || atosExtraidos.length === 0) continue;

        const usuarioFrontend = mapeamentoUsuarios[selo.usuario_execucao] || selo.usuario_execucao;

        for (const ato of atosExtraidos) {
          // Buscar valor unitário canônico na tabela `atos` pelo código do ato.
          // Se não existir, usar o valor informado no selo (fallback).
          let valorUnitarioNum = parseFloat(selo.valor_atos) || 0;
          try {
            const r = await pool.query('SELECT valor_final FROM atos WHERE codigo = $1 LIMIT 1', [ato.codigo]);
            if (r && r.rowCount > 0) {
              const dbVal = r.rows[0].valor_final;
              if (dbVal !== null && dbVal !== undefined) {
                valorUnitarioNum = Number(dbVal) || valorUnitarioNum;
              }
            }
          } catch (err) {
            console.error('[IMPORT] Erro ao buscar valor_unitario em atos para código', ato.codigo, err);
          }

          const quantidadeNum = parseInt(ato.quantidade) || 1;
          const totalAto = Number((valorUnitarioNum * quantidadeNum).toFixed(2));

          // Formatar pagamentos no mesmo shape que o frontend espera
          const pagamentosShape = Object.keys(formasPagamento).reduce((acc, k) => {
            acc[k] = {
              quantidade: formasPagamento[k].quantidade || 0,
              valor: Number((formasPagamento[k].valor || 0).toFixed ? Number((formasPagamento[k].valor || 0).toFixed(2)) : (formasPagamento[k].valor || 0)),
              manual: !!formasPagamento[k].manual
            };
            return acc;
          }, {});

          const payloadAto = {
            data: selo.data_execucao || dataFormatada,
            hora: selo.hora_execucao || '00:00:00',
            codigo: ato.codigo,
            descricao: `Ato ${ato.codigo} importado do pedido ${selo.execucao_servico_id}`,
            quantidade: quantidadeNum,
            valor_unitario: Number(valorUnitarioNum || 0),
            // valor_final no preview representa o total do ato (unitário * quantidade)
            valor_final: Number(totalAto || 0),
            pagamentos: pagamentosShape,
            usuario: usuarioFrontend,
            origem_importacao: 'selos_execucao_servico',
            // Campos auxiliares para diagnóstico (não obrigatórios)
            _execucao_servico_id: selo.execucao_servico_id,
            _selo_id: selo.id,
            _pedido_protocolo: selo.pagamento_protocolo || null,
            _detalhes_brutos: selo.detalhes_pagamento || selo.complemento_pagamento || null
          };

          atosPreview.push(payloadAto);
        }
      } catch (e) {
        console.error('❌ Erro ao montar preview para selo:', selo, e);
      }
    }

    if (preview === true) {
      // Retornar preview sem persistir
      console.log(`📦 Preview solicitado - retornando ${atosPreview.length} atos (sem persistir)`);
      return res.json({
        message: 'Preview de importação gerado com sucesso',
        atosEncontrados: selosEncontrados.length,
        atosPreview,
      });
    }

    // ---------- Fluxo de inserção atual (mantive sua lógica aqui) ----------
    // 2. Verificar quais atos já existem na tabela atos_praticados
    console.log('🔍 Verificando atos já existentes...');
    const queryVerificar = `
      SELECT usuario, data 
      FROM atos_praticados 
      WHERE data = $1
        AND usuario = ANY($2::text[])
        AND origem_importacao = 'selos_execucao_servico'
    `;
    const resultVerificar = await pool.query(queryVerificar, [dataFormatada, usuarios]);
    const usuariosComImportacao = new Set(resultVerificar.rows.map(row => row.usuario));
    console.log(`📋 ${usuariosComImportacao.size} usuários já têm atos importados para esta data`);

    // 3. Filtrar apenas os atos de usuários que ainda não importaram
    const atosNovos = selosEncontrados.filter(selo => !usuariosComImportacao.has(selo.usuario_execucao));
    console.log(`✨ ${atosNovos.length} atos novos serão importados`);

    if (atosNovos.length === 0) {
      return res.json({
        message: 'Todos os usuários já importaram atos para esta data',
        atosEncontrados: selosEncontrados.length,
        atosImportados: 0
      });
    }

    // Reutiliza as funções extrairFormasPagamento/extrairAtosDoTexto e mapeamento
    console.log('💾 Inserindo novos atos na tabela atos_praticados...');

    let atosInseridos = 0;
    const queryInserir = `
      INSERT INTO atos_praticados (
        data, hora, codigo, tributacao, descricao, quantidade, valor_unitario, 
        pagamentos, detalhes_pagamentos, usuario, origem_importacao
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `;

    for (const selo of atosNovos) {
      try {
        const formasPagamento = extrairFormasPagamento(selo.detalhes_pagamento || selo.complemento_pagamento);
        const atosExtraidos = extrairAtosDoTexto(selo.qtd_atos);
        if (atosExtraidos.length === 0) {
          console.log(`⚠️ Nenhum ato válido encontrado em: "${selo.qtd_atos}"`);
          continue;
        }
        for (const ato of atosExtraidos) {
          const usuarioFrontend = mapeamentoUsuarios[selo.usuario_execucao] || selo.usuario_execucao;
          // Buscar valor unitário canônico na tabela `atos` pelo código do ato.
          // Se não existir, usar o valor informado no selo (fallback).
          let valorUnitarioNum = parseFloat(selo.valor_atos) || 0;
          try {
            const r = await pool.query('SELECT valor_final FROM atos WHERE codigo = $1 LIMIT 1', [ato.codigo]);
            if (r && r.rowCount > 0) {
              const dbVal = r.rows[0].valor_final;
              if (dbVal !== null && dbVal !== undefined) {
                valorUnitarioNum = Number(dbVal) || valorUnitarioNum;
              }
            }
          } catch (err) {
            console.error('[IMPORT] Erro ao buscar valor_unitario em atos para código', ato.codigo, err);
          }

          const quantidadeNum = parseInt(ato.quantidade) || 1;
          const valorTotalAto = Number((valorUnitarioNum * quantidadeNum).toFixed(2));

          const formasUtilizadas = Object.entries(formasPagamento || {})
            .filter(([_, v]) => (parseFloat(v?.valor) || 0) > 0 || (parseInt(v?.quantidade) || 0) > 0)
            .map(([k]) => k === 'depositoPrevio' ? 'deposito_previo' : k);

          const detalhesPadronizado = {
            valor_total: valorTotalAto,
            data_pagamento: selo.pagamento_data || null,
            formas_utilizadas: formasUtilizadas
          };

          const detalhesPagamentoStr = JSON.stringify(detalhesPadronizado);

          const totalFormasPagamento = Object.values(formasPagamento || {})
            .reduce((acc, fp) => acc + (parseFloat(fp?.valor) || 0), 0);
          const temPagamento = (valorUnitarioNum || 0) > 0 || totalFormasPagamento > 0;
          const tributacaoValor = temPagamento ? '01' : null;

          await pool.query(queryInserir, [
            selo.data_execucao,
            selo.hora_execucao || '00:00:00',
            ato.codigo,
            tributacaoValor,
            `Ato ${ato.codigo} importado do pedido ${selo.execucao_servico_id}`,
            ato.quantidade,
            valorUnitarioNum,
            JSON.stringify(formasPagamento),
            detalhesPagamentoStr,
            usuarioFrontend,
            'selos_execucao_servico'
          ]);

          atosInseridos++;
        }
      } catch (error) {
        console.error(`❌ Erro ao inserir ato ${selo.execucao_servico_id}:`, error);
      }
    }

    console.log(`🎉 Importação concluída: ${atosInseridos} atos inseridos de ${atosNovos.length} tentativas`);

    return res.json({
      message: `Importação concluída com sucesso! ${atosInseridos} atos foram importados.`,
      atosEncontrados: selosEncontrados.length,
      atosImportados: atosInseridos,
      detalhes: {
        usuariosComImportacaoPrevia: usuariosComImportacao.size,
        atosNovosEncontrados: atosNovos.length,
        atosInseridosComSucesso: atosInseridos
      }
    });

  } catch (error) {
    console.error('💥 Erro na importação de atos:', error);
    return res.status(500).json({
      message: 'Erro interno do servidor ao importar atos',
      erro: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});



//rota para obter um dado especifico por id atos do tj

app.get('/api/atos/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM atos WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Ato não encontrado.' });
    }
    res.json({ ato: result.rows[0] });
  } catch (err) {
    console.error('Erro ao obter ato:', err);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// GET /api/atos-praticados?data=YYYY-MM-DD
app.get('/api/atos-praticados', authenticate, async (req, res) => {
  const { data } = req.query;
  console.log('[GET] /api/atos-praticados chamada com data:', data);
  try {
    let query = 'SELECT * FROM atos_praticados';
    let params = [];
    if (data) {
      query += ' WHERE data = $1';
      params.push(data);
    }
    query += ' ORDER BY hora ASC, id ASC';
    const result = await pool.query(query, params);
    console.log('[GET] /api/atos-praticados - retornando', result.rows.length, 'atos');
    res.json({ atos: result.rows });
  } catch (err) {
    console.error('[GET] /api/atos-praticados - erro:', err);
    res.status(500).json({ error: 'Erro ao buscar atos praticados.' });
  }
});

// POST /api/atos-praticados
app.post('/api/atos-praticados', authenticate, async (req, res) => {
  console.log('[POST] /api/atos-praticados - body recebido:', req.body);
  const {
    data,
    hora,
    codigo,
    tributacao,
    descricao,
    quantidade,
    valor_unitario,
    pagamentos,
    usuario
  } = req.body;



  // Log dos campos recebidos
  console.log('[POST] Campos recebidos:', {
    data, hora, codigo, tributacao, descricao, quantidade, valor_unitario, pagamentos, usuario
  });

  const codigoTributacao = tributacao
  ? String(tributacao).trim().substring(0, 2)
  : null;

  const params = [
    data,
    hora,
    codigo,
    codigoTributacao, // Use só o código aqui!
    descricao,
    quantidade || 1,
    valor_unitario || 0,
    typeof pagamentos === 'object'
      ? JSON.stringify(pagamentos)
      : JSON.stringify({ valor: pagamentos }),
    detalhes_pagamentos || null
  ];

  const query = `
    INSERT INTO atos_praticados (
      data,
      hora,
      codigo,
      tributacao,
      descricao,
      quantidade,
      valor_unitario,
      detalhes_pagamentos,
      usuario
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `;

  const result = await pool.query(query, params);

  console.log('[POST] /api/atos-praticados - inserido com sucesso:', result.rows[0]);
  res.status(201).json({ ato: result.rows[0] });
});


// DELETE /api/s/:id
app.delete('/api/s/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  console.log('[DELETE] /api/atos-praticados chamada para id:', id);
  try {
    await pool.query('DELETE FROM atos_praticados WHERE id = $1', [id]);
    console.log('[DELETE] /api/atos-praticados - removido id:', id);
    res.status(204).send();
  } catch (err) {
    console.error('[DELETE] /api/atos-praticados - erro:', err);
    res.status(500).json({ error: 'Erro ao remover ato praticado.' });
  }
});


// ========== ROTAS DE ATOS PRATICADOS (VERSÃO CORRIGIDA) ==========

// GET /api/atos-tabela - Buscar atos por data
app.get('/api/atos-tabela', authenticateToken, async (req, res) => {
  const { data } = req.query;
  console.log('[atos-tabela][GET] Requisição recebida. Query:', req.query);

  try {
    let query = `
      SELECT 
        ap.id,
        ap.data,
        ap.hora,
        ap.codigo,
        ap.tributacao,
        cg.descricao as tributacao_descricao,
        ap.descricao,
        ap.quantidade,
        ap.valor_unitario,
        ap.pagamentos,
        ap.detalhes_pagamentos,
        ap.usuario,
        u.serventia as usuario_serventia
      FROM atos_praticados ap
      LEFT JOIN codigos_gratuitos cg ON ap.tributacao = cg.codigo
      LEFT JOIN public.users u ON ap.usuario = u.nome
    `;
    
    let params = [];
    if (data) {
      query += ' WHERE ap.data = $1';
      params.push(data);
    }
    query += ' ORDER BY ap.data DESC, ap.hora DESC, ap.id DESC';

    console.log('[atos-tabela][GET] Query:', query, 'Params:', params);

    const result = await pool.query(query, params);

    console.log('[atos-tabela][GET] Resultados encontrados:', result.rowCount);

    // Formatar os dados para o frontend
    const atosFormatados = result.rows.map((ato) => ({
      id: ato.id,
      data: ato.data,
      hora: ato.hora,
      codigo: ato.codigo,
      tributacao: ato.tributacao,
      tributacao_descricao: ato.tributacao_descricao,
      descricao: ato.descricao,
      quantidade: ato.quantidade,
      valor_unitario: parseFloat(ato.valor_unitario),
      pagamentos: ato.pagamentos,
      detalhes_pagamentos: ato.detalhes_pagamentos,
      usuario: ato.usuario,
      usuario_serventia: ato.usuario_serventia
    }));

    // LOG DO QUE SERÁ ENVIADO AO FRONTEND
    console.log('[atos-tabela][GET] Enviando ao frontend:', JSON.stringify(atosFormatados, null, 2));

    res.json({
      success: true,
      atos: atosFormatados,
      total: result.rowCount
    });

  } catch (error) {
    console.error('[atos-tabela][GET] Erro ao buscar atos:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Erro ao buscar atos'
    });
  }
});

// POST /api/atos-tabela - Adicionar novo ato
app.post('/api/atos-tabela', authenticateToken, async (req, res) => {
  console.log('[atos-tabela][POST] Body recebido:', req.body);

  const {
    data,
    hora,
    codigo,
    tributacao_codigo, // Código da tributação (ex: "01")
    descricao,
    quantidade,
    valor_unitario,
    pagamentos,
    detalhes_pagamentos,
    usuario
  } = req.body;

  // Validações básicas
  if (!data || !hora || !codigo || !descricao || !usuario) {
    console.log('[atos-tabela][POST] Campos obrigatórios faltando!');
    return res.status(400).json({
      error: 'Campos obrigatórios: data, hora, codigo, descricao, usuario'
    });
  }

  if (!tributacao_codigo) {
    return res.status(400).json({
      error: 'Campo obrigatório: tributacao_codigo'
    });
  }

  try {
    // Verificar se o código do ato existe na tabela atos
    const atoExiste = await pool.query('SELECT codigo FROM atos WHERE codigo = $1', [codigo]);
    if (atoExiste.rowCount === 0) {
      return res.status(400).json({
        error: `Código de ato '${codigo}' não encontrado na tabela atos`
      });
    }

    // Verificar se o código de tributação existe na tabela codigos_gratuitos
    const tributacaoExiste = await pool.query(
      'SELECT codigo FROM codigos_gratuitos WHERE codigo = $1',
      [tributacao_codigo]
    );
    if (tributacaoExiste.rowCount === 0) {
      return res.status(400).json({
        error: `Código de tributação '${tributacao_codigo}' não encontrado na tabela codigos_gratuitos`
      });
    }

    const query = `
      INSERT INTO atos_praticados (
        data,
        hora,
        codigo,
        tributacao,
        descricao,
        quantidade,
        valor_unitario,
        pagamentos,
        detalhes_pagamentos,
        usuario
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const params = [
      data,
      hora,
      codigo,
      tributacao_codigo, // Salvar apenas o código na coluna tributacao
      descricao,
      quantidade || 1,
      valor_unitario || 0,
      JSON.stringify(pagamentos || {}), // Sempre converter para JSON string
      JSON.stringify(detalhes_pagamentos || {}), // Sempre converter para JSON string
      usuario
    ];

    console.log('[atos-tabela][POST] Query INSERT:', query);
    console.log('[atos-tabela][POST] Params:', params);

    const result = await pool.query(query, params);

    console.log('[atos-tabela][POST] Ato inserido com sucesso:', result.rows[0]);

    res.status(201).json({
      success: true,
      message: 'Ato adicionado com sucesso',
      ato: {
        ...result.rows[0],
        valor_unitario: parseFloat(result.rows[0].valor_unitario),
      }
    });

  } catch (error) {
    console.error('[atos-tabela][POST] Erro ao inserir ato:', error);

    // Tratar erros específicos de chave estrangeira
    if (error.code === '23503') {
      if (error.constraint === 'fk_ato') {
        return res.status(400).json({
          error: `Código de ato '${codigo}' não é válido`
        });
      } else if (error.constraint === 'fk_tributacao') {
        return res.status(400).json({
          error: `Código de tributação '${tributacao_codigo}' não é válido`
        });
      }
    }

    res.status(500).json({
      error: 'Erro interno do servidor',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Erro ao adicionar ato'
    });
  }
});

// DELETE /api/atos-tabela/:id - Remover ato por ID
app.delete('/api/atos-tabela/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  console.log('[atos-tabela][DELETE] Requisição para remover ID:', id);

  if (!id || isNaN(id)) {
    console.log('[atos-tabela][DELETE] ID inválido!');
    return res.status(400).json({
      error: 'ID inválido'
    });
  }

  try {
    const query = 'DELETE FROM atos_praticados WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);

    if (result.rowCount === 0) {
      console.log('[atos-tabela][DELETE] Ato não encontrado para remoção.');
      return res.status(404).json({
        error: 'Ato não encontrado'
      });
    }

    console.log('[atos-tabela][DELETE] Ato removido:', result.rows[0]);

    res.json({
      success: true,
      message: 'Ato removido com sucesso',
      ato: {
        ...result.rows[0],
        valor_unitario: parseFloat(result.rows[0].valor_unitario),
      }
    });

  } catch (error) {
    console.error('[atos-tabela][DELETE] Erro ao remover ato:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Erro ao remover ato'
    });
  }
});

//rota para atualizar um ato existente do tj

app.put('/api/atos/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const { descricao, emol_bruto, recompe, emol_liquido, issqn, taxa_fiscal, valor_final, origem } = req.body;
  try {
    await pool.query(
      `UPDATE atos SET descricao = $1, emol_bruto = $2, recompe = $3, emol_liquido = $4,
       issqn = $5, taxa_fiscal = $6, valor_final = $7, origem = $8 WHERE id = $9`,
      [descricao, emol_bruto, recompe, emol_liquido, issqn, taxa_fiscal, valor_final, origem, id]
    );
    res.json({ message: 'Ato atualizado com sucesso.' });
  } catch (err) {
    console.error('Erro ao atualizar ato:', err);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

//rota para referencia

app.get('/api/atos', authenticate, async (req, res) => {
  const search = req.query.search || '';
  try {
    const result = await pool.query(
      `SELECT id, codigo, descricao FROM atos WHERE codigo ILIKE $1 OR descricao ILIKE $1 ORDER BY codigo LIMIT 20`,
      [`%${search}%`]
    );
    res.json({ atos: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao buscar atos.' });
  }
});

//rota para cadastrar atos via api

app.post('/api/atos', authenticate, requireRegistrador, async (req, res) => {
  const { codigo, descricao, emol_bruto, recompe, emol_liquido, issqn, taxa_fiscal, valor_final, origem } = req.body;

  if (!codigo || !descricao) {
    return res.status(400).json({ message: 'Código e descrição são obrigatórios.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO atos (codigo, descricao, emol_bruto, recompe, emol_liquido, issqn, taxa_fiscal, valor_final, origem)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [codigo, descricao, emol_bruto || null, recompe || null, emol_liquido || null, issqn || null, taxa_fiscal || null, valor_final || null, origem || null]
    );
    res.status(201).json({ ato: result.rows[0], message: 'Ato cadastrado com sucesso!' });
  } catch (err) {
    console.error('Erro ao cadastrar ato:', err);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// Middleware para autenticação
function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.sendStatus(401);
  const [, token] = auth.split(' ');
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.sendStatus(401);
  }
}

// Middleware para verificar se o usuário é Registrador (superuser)
function requireRegistrador(req, res, next) {
  if (req.user && req.user.cargo === 'Registrador') {
    return next();
  }
  return res.status(403).json({ message: 'Acesso restrito ao Registrador.' });
}

// ========== ROTAS DE AUTENTICAÇÃO ==========

// Cadastro de usuário
app.post('/api/signup', async (req, res) => {
  const { nome, email, password, serventia, cargo } = req.body;
  
  if (!nome ||!email || !password || !serventia || !cargo) {
    return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO public.users (nome, email, password, serventia, cargo) VALUES ($1, $2, $3, $4, $5)',
      [nome, email, hash, serventia, cargo]
    );
    return res.status(201).json({ message: 'Cadastro realizado com sucesso!' });
  } catch (err) {
    console.error('Erro no cadastro:', err);
    if (err.code === '23505') {
      return res.status(409).json({ message: 'E-mail já cadastrado.' });
    }
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// Login de usuário
app.post('/api/login', async (req, res) => {
  // Normalize body: support parsed JSON, urlencoded, or raw text like {email:Augusto,password:12qwas}
  let nome = null;
  let password = null;
  try {
    if (!req.body) {
      // nothing
    } else if (Buffer.isBuffer(req.body)) {
      const raw = req.body.toString('utf8');
      try { // try normal JSON
        const obj = JSON.parse(raw);
        nome = obj.nome || obj.email || obj.username || null;
        password = obj.password || null;
      } catch (e) {
        // tolerant transform: add quotes to keys/values
        const transform = (s) => {
          if (!s || typeof s !== 'string') return s;
          let t = s.replace(/([{,\n\r\s])([A-Za-z0-9_\-@\/\.]+)\s*:/g, '$1"$2":');
          t = t.replace(/:\s*([A-Za-z0-9_\-@\/\.:\+]+)(?=[,}\]])/g, ':"$1"');
          return t;
        };
        try {
          const attempted = transform(raw);
          const obj2 = JSON.parse(attempted);
          nome = obj2.nome || obj2.email || obj2.username || null;
          password = obj2.password || null;
          console.warn('[login] tolerated malformed body and parsed login payload');
        } catch (e2) {}
      }
    } else if (typeof req.body === 'string') {
      const raw = req.body;
      try { const obj = JSON.parse(raw); nome = obj.nome || obj.email || obj.username || null; password = obj.password || null; } catch (e) {
        const transform = (s) => {
          if (!s || typeof s !== 'string') return s;
          let t = s.replace(/([{,\n\r\s])([A-Za-z0-9_\-@\/\.]+)\s*:/g, '$1"$2":');
          t = t.replace(/:\s*([A-Za-z0-9_\-@\/\.:\+]+)(?=[,}\]])/g, ':"$1"');
          return t;
        };
        try { const attempted = transform(raw); const obj2 = JSON.parse(attempted); nome = obj2.nome || obj2.email || obj2.username || null; password = obj2.password || null; console.warn('[login] tolerated malformed body and parsed login payload'); } catch (e2) {}
      }
    } else if (typeof req.body === 'object') {
      nome = req.body.nome || req.body.email || req.body.username || null;
      password = req.body.password || null;
    }
  } catch (e) {
    console.error('[login] error normalizing body', e && e.message ? e.message : e);
  }

  if (!nome || !password) {
    return res.status(400).json({ message: 'Nome de Usuário e senha são obrigatórios.' });
  }

  try {
    const result = await pool.query('SELECT * FROM public.users WHERE nome = $1', [nome]);
    
    if (!result.rowCount) {
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    const user = result.rows[0];

    // Verifica se o usuário está ativo
    if (user.status !== 'ativo') {
      return res.status(403).json({ message: 'Usuário inativo. Contate o administrador.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    const token = jwt.sign(
      { id: user.id, nome: user.nome, cargo: user.cargo }, 
      JWT_SECRET, 
      { expiresIn: '8h' }
    );
    // Set track_uid cookie for client-side tracking (HttpOnly)
    try {
      const { v4: uuidv4 } = require('uuid');
      const trackUid = uuidv4();
      res.cookie('track_uid', trackUid, {
        httpOnly: true,
        secure: (process.env.NODE_ENV === 'production'),
        sameSite: 'lax',
        maxAge: 31536000 * 1000
      });
      try { console.info('[login] set track_uid (masked)', { userId: user.id, masked: String(trackUid).slice(0,6)+'...' }); } catch (e) {}
    } catch (e) {}

    res.json({ 
      token, 
      user: { 
        id: user.id,
        nome: user.nome,
        email: user.email, 
        serventia: user.serventia, 
        cargo: user.cargo 
      } 
    });
  } catch (err) {
    console.error('Erro no login:', err);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// Rota para obter perfil do usuário (protegida)
app.get('/api/profile', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, nome, email, serventia, cargo FROM public.users WHERE id = $1', 
      [req.user.id]
    );
    
    if (!result.rowCount) {
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }
    
    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Erro ao buscar perfil:', err);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// ========== ROTAS DE UPLOAD (PROTEGIDAS) ==========

// Upload de PDF (single, protegido por autenticação)
app.post('/api/upload', authenticate, (req, res) => {
  const uploadMiddleware = upload.single('file');

  uploadMiddleware(req, res, async (err) => {
    if (err) {
      console.error('Erro no upload:', err);
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Arquivo não enviado' });
    }

    try {
      const textoExtraido = await extractTextWithPdfParse(req.file.path);

      // Remove o arquivo temporário
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr) console.error('Erro ao deletar arquivo temporário:', unlinkErr);
      });

      return res.json({
        message: 'Upload e extração de dados do PDF concluídos',
        texto: textoExtraido,
      });

    } catch (processErr) {
      console.error('Erro ao processar o arquivo:', processErr);
      return res.status(500).json({ 
        error: 'Erro ao processar o upload do PDF', 
        details: processErr.message 
      });
    }
  });
});

// Rota de upload e extração dos atos das tabelas 07 e 08
app.post('/api/upload', authenticate, (req, res) => {
  const uploadMiddleware = upload.single('file');

  uploadMiddleware(req, res, async (err) => {
    if (err) {
      console.error('Erro no upload:', err);
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Arquivo não enviado' });
    }

    try {
      const textoExtraido = await pdfToTextWithOCR(req.file.path);

      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr) console.error('Erro ao deletar arquivo temporário:', unlinkErr);
      });

      return res.json({
        message: 'Upload e extração OCR do PDF concluídos',
        texto: textoExtraido,
      });

    } catch (processErr) {
      console.error('Erro ao processar o arquivo:', processErr);
      return res.status(500).json({ 
        error: 'Erro ao processar o upload do PDF', 
        details: processErr.message 
      });
    }
  });
});

// Rota para salvar relatório (protegida)
app.post('/api/salvar-relatorio', authenticate, async (req, res) => {
  const { dadosRelatorio } = req.body;
  
  if (!dadosRelatorio) {
    return res.status(400).json({ message: 'Dados do relatório são obrigatórios.' });
  }

  try {
    // Busca os dados do usuário logado
    const userResult = await pool.query(
      'SELECT email, cargo, serventia FROM public.users WHERE id = $1', 
      [req.user.id]
    );
    
    if (!userResult.rowCount) {
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }
    
    const user = userResult.rows[0];
    
    // Salva o relatório no banco
    const dataGeracao = req.body.data_geracao || new Date().toISOString();

    const result = await pool.query(
      `INSERT INTO relatorios (user_id, email, cargo, serventia, dados_relatorio, data_geracao) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, data_geracao`,
      [req.user.id, user.email, user.cargo, user.serventia, JSON.stringify(dadosRelatorio), dataGeracao]
    );
    
    res.json({ 
      message: 'Relatório salvo com sucesso!',
      relatorio_id: result.rows[0].id,
      data_geracao: result.rows[0].data_geracao
    });
    
  } catch (err) {
    console.error('Erro ao salvar relatório:', err);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// Rota para listar relatórios do usuário (protegida)
app.get('/api/meus-relatorios', authenticate, async (req, res) => {
  try {
    let query = '';
    let params = [];

    // Se veio o parâmetro de serventia, retorna todos os relatórios da serventia
    if (req.query.serventia) {
      query = 'SELECT * FROM relatorios WHERE serventia = $1 ORDER BY data_geracao DESC';
      params = [req.query.serventia];
    } else if (req.user.cargo === 'Registrador') {
      // Retorna todos os relatórios
      query = 'SELECT * FROM relatorios ORDER BY data_geracao DESC';
    } else {
      // Retorna apenas os relatórios do usuário logado
      query = 'SELECT * FROM relatorios WHERE user_id = $1 ORDER BY data_geracao DESC';
      params = [req.user.id];
    }

    const result = await pool.query(query, params);
    res.json({ relatorios: result.rows });
  } catch (error) {
    console.error('Erro ao buscar relatórios:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// rota para buscar usuários (protegida)
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, nome, email, serventia FROM public.users ORDER BY nome');
    res.json({ usuarios: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar usuários' });
  }
});

// Rota para excluir relatório (protegida)
app.delete('/api/excluir-relatorio/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  try {
    // Registrador pode excluir qualquer relatório; demais só os próprios
    let query = 'DELETE FROM relatorios WHERE id = $1 AND user_id = $2';
    let params = [id, req.user.id];

    if (req.user && req.user.cargo === 'Registrador') {
      query = 'DELETE FROM relatorios WHERE id = $1';
      params = [id];
    }

    const result = await pool.query(query, params);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Relatório não encontrado ou não pertence a este usuário.' });
    }
    res.json({ message: 'Relatório excluído com sucesso.' });
  } catch (error) {
    console.error('Erro ao excluir relatório:', error);
    res.status(500).json({ message: 'Erro ao excluir relatório.' });
  }
});

// ========== ROTA EXCLUSIVA PARA REGISTRADOR ==========

app.get('/api/relatorios-todos', authenticate, requireRegistrador, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email, cargo, serventia, data_geracao, dados_relatorio 
       FROM relatorios 
       ORDER BY data_geracao DESC`
    );
    res.json({ relatorios: result.rows });
  } catch (err) {
    console.error('Erro ao buscar todos os relatórios:', err);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

const fechamentosRouter = require('./routes/fechamentos');
app.use('/api', fechamentosRouter);
app.use('/api/onedrive-config', onedriveConfigRouter);
// Also expose admin-prefixed endpoints as requested
app.use('/admin/onedrive-config', onedriveConfigRouter);

//rota para para importar atos

app.post('/api/importar-atos', authenticate, requireRegistrador, uploadAtos.fields([
  { name: 'tabela07', maxCount: 1 },
  { name: 'tabela08', maxCount: 1 }
]), async (req, res) => {
  try {
    console.log('Recebendo arquivos para importação de atos...');
    console.log('Arquivos recebidos:', req.files);

    if (!req.files || !req.files.tabela07 || !req.files.tabela08) {
      console.log('Arquivos de texto não enviados corretamente.');
      return res.status(400).json({ message: 'Envie os dois arquivos de texto.' });
    }

    const caminhoTabela07 = req.files.tabela07[0].path;
    const caminhoTabela08 = req.files.tabela08[0].path;

    console.log('Lendo arquivo tabela07 em:', caminhoTabela07);
    const texto07 = fs.readFileSync(caminhoTabela07, 'utf8');
    console.log('Conteúdo tabela07 (primeiros 200 caracteres):', texto07.substring(0, 200));

    console.log('Lendo arquivo tabela08 em:', caminhoTabela08);
    const texto08 = fs.readFileSync(caminhoTabela08, 'utf8');
    console.log('Conteúdo tabela08 (primeiros 200 caracteres):', texto08.substring(0, 200));

    const atos07 = extrairAtos(texto07, 'Tabela 07');
    const atos08 = extrairAtos(texto08, 'Tabela 08');

    const atos = [...atos07, ...atos08];

    // Deletar arquivos temporários
    fs.unlink(caminhoTabela07, (err) => {
      if (err) console.error('Erro ao deletar arquivo Tabela 07:', err);
      else console.log('Arquivo Tabela 07 deletado.');
    });
    fs.unlink(caminhoTabela08, (err) => {
      if (err) console.error('Erro ao deletar arquivo Tabela 08:', err);
      else console.log('Arquivo Tabela 08 deletado.');
    });

    console.log('Atos extraídos:', atos.length);
    return res.json({ atos });

  } catch (err) {
    console.error('Erro ao importar atos:', err);
    return res.status(500).json({ message: 'Erro ao processar os arquivos.' });
  }
});

// ========== ROTA DE TESTE ==========

app.get('/api/test', (req, res) => {
  res.json({ message: 'API funcionando!', timestamp: new Date().toISOString() });
});

// ========== LISTAR TODOS USUARIOS ==========
app.get('/api/admin/usuarios', authenticate, requireRegistrador, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, nome, email, serventia, cargo, status FROM public.users ORDER BY nome'
    );
    res.json({ usuarios: result.rows });
  } catch (err) {
    console.error('Erro ao listar usuários:', err);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// Nova rota: lista usuários da mesma serventia do usuário autenticado
app.get('/api/usuarios/mesma-serventia', authenticate, async (req, res) => {
  try {
    // Prioriza a query string, mas pode cair no token se quiser manter compatibilidade
    const serventia = req.query.serventia || req.user.serventia;
    if (!serventia) {
      return res.status(400).json({ message: 'Serventia não informada.' });
    }
    console.log(`[API] Listando usuários da serventia: ${serventia} | Usuário: ${req.user.nome} (ID: ${req.user.id})`);
    const result = await pool.query(
      'SELECT id, nome, email, serventia, cargo, status FROM public.users WHERE serventia = $1 ORDER BY nome',
      [serventia]
    );
    res.json({ usuarios: result.rows });
  } catch (err) {
    console.error('Erro ao listar usuários da mesma serventia:', err);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// ========== EDITAR USUARIOS ==========

app.put('/api/admin/usuarios/:id', authenticate, requireRegistrador, async (req, res) => {
  const { id } = req.params;
  const { email, password, serventia, cargo, nome, status } = req.body;

  // Monta dinamicamente os campos a serem atualizados
  const fields = [];
  const values = [];
  let idx = 1;

  if (email !== undefined) {
    fields.push(`email = $${idx++}`);
    values.push(email);
  }
  if (password !== undefined && password !== '') {
    fields.push(`password = crypt($${idx++}, gen_salt('bf'))`);
    values.push(password);
  }
  if (serventia !== undefined) {
    fields.push(`serventia = $${idx++}`);
    values.push(serventia);
  }
  if (cargo !== undefined) {
    fields.push(`cargo = $${idx++}`);
    values.push(cargo);
  }
  if (nome !== undefined) {
    fields.push(`nome = $${idx++}`);
    values.push(nome);
  }
  if (status !== undefined) {
    if (!['ativo', 'inativo'].includes(status)) {
      return res.status(400).json({ message: 'Status inválido.' });
    }
    fields.push(`status = $${idx++}`);
    values.push(status);
  }

  if (fields.length === 0) {
    return res.status(400).json({ message: 'Nenhum campo para atualizar.' });
  }

  values.push(id);

  try {
    const result = await pool.query(
      `UPDATE public.users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }
    res.json({ message: 'Usuário atualizado com sucesso.', usuario: result.rows[0] });
  } catch (err) {
    console.error('Erro ao atualizar usuário:', err);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});



// ========== INICIALIZAÇÃO DO SERVIDOR ==========

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
  console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
});

// Middleware para autenticação de token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Token de acesso requerido' });
  }
  // Se quiser validar o JWT, descomente abaixo:
  // try {
  //   req.user = jwt.verify(token, JWT_SECRET);
  // } catch {
  //   return res.status(401).json({ error: 'Token inválido' });
  // }
  next();
}

// Buscar atos praticados por data
app.get('/api/atos-praticados', authenticate, async (req, res) => {
  const { data } = req.query;
  console.log('[GET] /api/atos-praticados chamada com data:', data);
  try {
    let query = 'SELECT * FROM atos_praticados';
    let params = [];
    if (data) {
      query += ' WHERE data = $1';
      params.push(data);
    }
    query += ' ORDER BY hora ASC, id ASC';
    const result = await pool.query(query, params);
    console.log('[GET] /api/atos-praticados - retornando', result.rows.length, 'atos');
    res.json({ atos: result.rows });
  } catch (err) {
    console.error('[GET] /api/atos-praticados - erro:', err);
    res.status(500).json({ error: 'Erro ao buscar atos praticados.' });
  }
});

// Adicionar ato praticado
app.post('/api/atos-praticados', authenticate, async (req, res) => {
  console.log('[POST] /api/atos-praticados - body recebido:', req.body);
  const {
    data,
    hora,
    codigo,
    tributacao,
    descricao,
    quantidade,
    valor_unitario,
    pagamentos,
    usuario
  } = req.body;

  // Log dos campos recebidos
  console.log('[POST] Campos recebidos:', {
    data, hora, codigo, tributacao, descricao, quantidade, valor_unitario, pagamentos, usuario
  });

  const codigoTributacao = tributacao
  ? String(tributacao).trim().substring(0, 2)
  : null;

  const params = [
    data,
    hora,
    codigo,
    codigoTributacao, // Use só o código aqui!
    descricao,
    quantidade || 1,
    valor_unitario || 0,
    typeof pagamentos === 'object'
      ? JSON.stringify(pagamentos)
      : JSON.stringify({ valor: pagamentos }),
    detalhes_pagamentos || null
  ];

  const query = `
    INSERT INTO atos_praticados (
      data,
      hora,
      codigo,
      tributacao,
      descricao,
      quantidade,
      valor_unitario,
      detalhes_pagamentos,
      usuario
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `;

  const result = await pool.query(query, params);

  console.log('[POST] /api/atos-praticados - inserido com sucesso:', result.rows[0]);
  res.status(201).json({ ato: result.rows[0] });
});

// Deletar ato praticado
app.delete('/api/atos-praticados/:id', authenticate, async (req, res) => {
  const id = req.params.id;
  try {
    const result = await pool.query(`DELETE FROM atos_praticados WHERE id = $1`, [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Ato não encontrado.' });
    }
    res.status(204).send();
  } catch (err) {
    console.error('Erro ao deletar ato pago:', err);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// Buscar atos da tabela por data
app.get('/', authenticateToken, async (req, res) => {
  const { data } = req.query;
  console.log('[atos-tabela][GET] Requisição recebida. Query:', req.query);

  try {
    let query = `
      SELECT 
        ap.id,
        ap.data,
        ap.hora,
        ap.codigo,
        ap.tributacao,
        cg.descricao as tributacao_descricao,
        ap.descricao,
        ap.quantidade,
        ap.valor_unitario,
        ap.pagamentos,
        ap.detalhes_pagamentos,
        ap.usuario,
        u.serventia as usuario_serventia
      FROM atos_praticados ap
      LEFT JOIN codigos_gratuitos cg ON ap.tributacao = cg.codigo
      LEFT JOIN public.users u ON ap.usuario = u.nome
    `;
    
    let params = [];
    if (data) {
      query += ' WHERE ap.data = $1';
      params.push(data);
    }
    query += ' ORDER BY ap.data DESC, ap.hora DESC, ap.id DESC';

    console.log('[atos-tabela][GET] Query:', query, 'Params:', params);

    const result = await pool.query(query, params);

    console.log('[atos-tabela][GET] Resultados encontrados:', result.rowCount);

    // Formatar os dados para o frontend
    const atosFormatados = result.rows.map((ato) => ({
      id: ato.id,
      data: ato.data,
      hora: ato.hora,
      codigo: ato.codigo,
      tributacao: ato.tributacao,
      tributacao_descricao: ato.tributacao_descricao,
      descricao: ato.descricao,
      quantidade: ato.quantidade,
      valor_unitario: parseFloat(ato.valor_unitario),
      pagamentos: ato.pagamentos,
      detalhes_pagamentos: ato.detalhes_pagamentos,
      usuario: ato.usuario,
      usuario_serventia: ato.usuario_serventia
    }));

    // LOG DO QUE SERÁ ENVIADO AO FRONTEND
    console.log('[atos-tabela][GET] Enviando ao frontend:', JSON.stringify(atosFormatados, null, 2));

    res.json({
      success: true,
      atos: atosFormatados,
      total: result.rowCount
    });

  } catch (error) {
    console.error('[atos-tabela][GET] Erro ao buscar atos:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Erro ao buscar atos'
    });
  }
});

// Adicionar ato na tabela
app.post('/api/atos-tabela', authenticateToken, async (req, res) => {
  console.log('[atos-tabela][POST] Body recebido:', req.body);

  const {
    data,
    hora,
    codigo,
    tributacao,
    descricao,
    quantidade,
    valor_unitario,
    pagamentos,
    detalhes_pagamentos
  } = req.body;

  // Validações básicas
  if (!data || !hora || !codigo || !descricao) {
    console.log('[busca-atos][POST] Campos obrigatórios faltando!');
    return res.status(400).json({
      error: 'Campos obrigatórios: data, hora, codigo, descricao'
    });
  }

  try {
    const query = `
      INSERT INTO atos_praticados (
        data,
        hora,
        codigo,
        tributacao,
        descricao,
        quantidade,
        valor_unitario,
        detalhes_pagamentos,
        usuario
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const params = [
      data,
      hora,
      codigo,
      tributacao || null,
      descricao,
      quantidade || 1,
      valor_unitario || 0,
      // Garante que pagamentos seja sempre um JSON válido
      typeof pagamentos === 'object'
        ? JSON.stringify(pagamentos)
        : JSON.stringify({ valor: pagamentos }),
      detalhes_pagamentos || null
    ];

    console.log('[busca-atos][POST] Query INSERT:', query);
    console.log('[busca-atos][POST] Params:', params);

    const result = await pool.query(query, params);

    console.log('[busca-atos][POST] Ato inserido com sucesso:', result.rows[0]);

    res.status(201).json({
      success: true,
      message: 'Ato adicionado com sucesso',
      ato: result.rows[0]
    });

  } catch (error) {
    console.error('[busca-atos][POST] Erro ao inserir ato:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Erro ao adicionar ato'
    });
  }
});

app.get('/api/admin/combos/listar', async (req, res) => {
  try {
    const combos = await pool.query(`
      SELECT c.id, c.nome, 
        COALESCE(json_agg(json_build_object(
          'id', a.id, 
          'codigo', a.codigo, 
          'descricao', a.descricao,
          'valor_final', a.valor_final
        ) ) FILTER (WHERE a.id IS NOT NULL), '[]') AS atos
      FROM combos c
      LEFT JOIN combo_atos ca ON ca.combo_id = c.id
      LEFT JOIN atos a ON ca.ato_id = a.id
      GROUP BY c.id
      ORDER BY c.id
    `);
    res.json({ combos: combos.rows });
  } catch (err) {
    console.error('Erro ao buscar combos:', err);
    res.status(500).json({ error: 'Erro ao buscar combos.', details: err.message });
  }
});

app.get('/api/admin/combos', async (req, res) => {
  try {
    const combos = await pool.query(`
      SELECT c.id, c.nome, 
        COALESCE(json_agg(json_build_object('id', a.id, 'codigo', a.codigo, 'descricao', a.descricao)) FILTER (WHERE a.id IS NOT NULL), '[]') AS atos
      FROM combos c
      LEFT JOIN combo_atos ca ON ca.combo_id = c.id
      LEFT JOIN atos a ON ca.ato_id = a.id
      GROUP BY c.id
      ORDER BY c.id
    `);
    res.json({ combos: combos.rows });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar combos.' });
  }
});


// rota para buscar o status do pedido


// rota Express para sugestões de códigos tributários
app.get('/api/codigos-tributarios', async (req, res) => {
  const termo = req.query.s || '';
  if (termo.length < 2) return res.json({ sugestoes: [] });

  // Exemplo usando PostgreSQL (ajuste para seu banco)
  const query = `
    SELECT codigo, descricao
    FROM codigos_gratuitos
    WHERE codigo ILIKE $1 OR descricao ILIKE $1
    ORDER BY codigo
    LIMIT 10
  `;
  const values = [`%${termo}%`];
  try {
    const { rows } = await pool.query(query, values);
    res.json({ sugestoes: rows });
  } catch (err) {
    console.error('Erro ao buscar códigos tributários:', err);
    res.status(500).json({ sugestoes: [] });
  }
});

//busca de atos praticados
app.get('/api/busca-atos/pesquisa', authenticateToken, async (req, res) => {
  try {
    const { 
      dataInicial, 
      dataFinal, 
      usuario, 
      codigo, 
      tributacao 
    } = req.query;

    console.log('🔍 [Busca Atos] Parâmetros recebidos:', req.query);

    // Validação básica - pelo menos um filtro deve ser fornecido
    if (!dataInicial && !dataFinal && !usuario && !codigo && !tributacao) {
      return res.status(400).json({
        success: false,
        message: 'Por favor, forneça pelo menos um filtro de busca.'
      });
    }

    // Construir query SQL dinamicamente com todas as colunas disponíveis
    let sqlQuery = `
      SELECT 
        id,
        data,
        hora,
        codigo,
        tributacao,
        descricao,
        quantidade,
        valor_unitario,
        pagamentos,
        usuario,
        detalhes_pagamentos,
        selo_final,
        origem_importacao,
        selo_inicial
      FROM atos_praticados 
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;

    // Filtro por período de datas
    if (dataInicial) {
      sqlQuery += ` AND data >= $${paramIndex}`;
      params.push(dataInicial);
      paramIndex++;
    }

    if (dataFinal) {
      sqlQuery += ` AND data <= $${paramIndex}`;
      params.push(dataFinal);
      paramIndex++;
    }

    // Filtro por usuário (nome do escrevente) - busca parcial
    if (usuario && usuario.trim()) {
      sqlQuery += ` AND UPPER(usuario) LIKE UPPER($${paramIndex})`;
      params.push(`%${usuario.trim()}%`);
      paramIndex++;
    }

    // Filtro por código do ato - busca exata
    if (codigo && codigo.trim()) {
      sqlQuery += ` AND codigo = $${paramIndex}`;
      params.push(codigo.trim());
      paramIndex++;
    }

    // Filtro por tributação - busca exata
    if (tributacao && tributacao.trim()) {
      sqlQuery += ` AND tributacao = $${paramIndex}`;
      params.push(tributacao.trim());
      paramIndex++;
    }

    // Ordenar por data e hora mais recentes
    sqlQuery += ` ORDER BY data DESC, hora DESC`;

    console.log('📊 [Busca Atos] Query SQL:', sqlQuery);
    console.log('📊 [Busca Atos] Parâmetros:', params);

    // Executar query
    const result = await pool.query(sqlQuery, params);
    const atos = result.rows;

    console.log('✅ [Busca Atos] Atos encontrados:', atos.length);

    // Processar dados dos atos para garantir formato correto
    const atosProcessados = atos.map(ato => ({
      ...ato,
      // Garantir que pagamentos seja um objeto
      pagamentos: typeof ato.pagamentos === 'string' 
        ? JSON.parse(ato.pagamentos || '{}') 
        : (ato.pagamentos || {}),
      // Garantir que detalhes_pagamentos seja um objeto
      detalhes_pagamentos: typeof ato.detalhes_pagamentos === 'string'
        ? JSON.parse(ato.detalhes_pagamentos || '{}')
        : (ato.detalhes_pagamentos || {}),
      // Garantir formato numérico
      quantidade: Number(ato.quantidade || 0),
      valor_unitario: Number(ato.valor_unitario || 0),
      // Adicionar tributacao_descricao vazio (para compatibilidade com frontend)
      tributacao_descricao: '',
      // Garantir que campos opcionais existam
      selo_final: ato.selo_final || null,
      origem_importacao: ato.origem_importacao || null,
      selo_inicial: ato.selo_inicial || null
    }));

    res.json({
      success: true,
      atos: atosProcessados,
      total: atosProcessados.length,
      filtros: {
        dataInicial,
        dataFinal,
        usuario,
        codigo,
        tributacao
      }
    });

  } catch (error) {
    console.error('❌ [Busca Atos] Erro na pesquisa:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao buscar atos.',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erro interno'
    });
  }
});


// GET /api/atos-tabela/usuarios - Buscar usuários únicos para sugestões
app.get('/api/busca-atos/usuarios', authenticateToken, async (req, res) => {
  const { search } = req.query;
  console.log('[busca-atos][USUARIOS] Termo de busca:', search);

  try {
    let query = `
      SELECT DISTINCT usuario 
      FROM atos_praticados 
      WHERE usuario IS NOT NULL
    `;
    
    const params = [];
    
    if (search) {
      query += ` AND usuario ILIKE $1`;
      params.push(`%${search}%`);
    }
    
    query += ` ORDER BY usuario LIMIT 10`;

    console.log('[busca-atos][USUARIOS] Query:', query);
    console.log('[busca-atos][USUARIOS] Params:', params);

    const result = await pool.query(query, params);
    
    const usuarios = result.rows.map(row => row.usuario);

    console.log('[busca-atos][USUARIOS] Usuários encontrados:', usuarios.length);

    res.json({
      usuarios: usuarios
    });

  } catch (error) {
    console.error('[busca-atos][USUARIOS] Erro:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      message: error.message
    });
  }
});
// Deletar ato da tabela
app.delete('/api/busca-atos/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  console.log('[busca-atos][DELETE] Requisição para remover ID:', id);

  if (!id || isNaN(id)) {
    console.log('[busca-atos][DELETE] ID inválido!');
    return res.status(400).json({
      error: 'ID inválido'
    });
  }

  try {
    const query = 'DELETE FROM atos_praticados WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);

    if (result.rowCount === 0) {
      console.log('[busca-atos][DELETE] Ato não encontrado para remoção.');
      return res.status(404).json({
        error: 'Ato não encontrado'
      });
    }

    console.log('[busca-atos][DELETE] Ato removido:', result.rows[0]);

    res.json({
      success: true,
      message: 'Ato removido com sucesso',
      ato: result.rows[0]
    });

  } catch (error) {
    console.error('[busca-atos][DELETE] Erro ao remover ato:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Erro ao remover ato'
    });
  }
});

app.delete('/api/admin/combos/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM combos WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao excluir combo:', err);
    res.status(500).json({ error: 'Erro ao excluir combo.' });
  }
});



app.post('/api/admin/combos', async (req, res) => {
  const { nome, atos } = req.body;
  if (!nome || !Array.isArray(atos)) {
    return res.status(400).json({ error: 'Nome e atos são obrigatórios.' });
  }

  try {
    // Insere combo
    const comboResult = await pool.query(
      'INSERT INTO combos (nome) VALUES ($1) RETURNING id',
      [nome]
    );
    const comboId = comboResult.rows[0].id;

    // Insere relação combo-atos
    for (const atoId of atos) {
      await pool.query(
        'INSERT INTO combo_atos (combo_id, ato_id) VALUES ($1, $2)',
        [comboId, atoId]
      );
    }

    res.status(201).json({ success: true, comboId });
  } catch (err) {
    console.error('Erro ao criar combo:', err);
    res.status(500).json({ error: 'Erro ao criar combo.' });
  }
});

// Rota para criar pedido
app.post('/api/pedidos-criar', authenticate, async (req, res) => {
  try {
    const { 
      protocolo, tipo, descricao, prazo, clienteId, valorAdiantado, valorAdiantadoDetalhes, observacao, 
      combos, usuario, origem, origemInfo 
    } = req.body;

    console.log('[POST] /api/pedidos - dados recebidos:', {
      protocolo, tipo, descricao, prazo, clienteId, valorAdiantado, observacao, 
      combos, usuario, origem, origemInfo
    });

    // Se há protocolo, verifica se é uma atualização
    if (protocolo && protocolo.trim() !== '') {
      // Verifica se o pedido já existe
      const pedidoExistente = await pool.query('SELECT id FROM pedidos WHERE protocolo = $1', [protocolo]);
      
      if (pedidoExistente.rows.length > 0) {
        // É uma atualização
        const pedidoId = pedidoExistente.rows[0].id;
        
        // Atualiza o pedido
        await pool.query(`
          UPDATE pedidos 
          SET tipo = $1, descricao = $2, prazo = $3, cliente_id = $4, valor_adiantado = $5, valor_adiantado_detalhes = $6, observacao = $7, usuario = $8, origem = $9, origem_info = $10
          WHERE id = $11
        `, [tipo, descricao, prazo, clienteId, valorAdiantado, JSON.stringify(valorAdiantadoDetalhes), observacao, usuario, origem, origemInfo, pedidoId]);

        // Remove combos antigos
        await pool.query('DELETE FROM pedido_combos WHERE pedido_id = $1', [pedidoId]);
        
        // Adiciona novos combos
        if (Array.isArray(combos)) {
  for (const combo of combos) {
    // Busca valor_final e issqn do ato no banco
    const atoRes = await pool.query(
      'SELECT valor_final, issqn FROM atos WHERE id = $1',
      [combo.ato_id]
    );
    const ato = atoRes.rows[0] || {};
    await pool.query(`
      INSERT INTO pedido_combos (
        pedido_id, combo_id, ato_id, quantidade, codigo_tributario,
        tipo_registro, nome_registrados, livro, folha, termo,
        valor_final, issqn
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      pedidoId, combo.combo_id, combo.ato_id, combo.quantidade, combo.codigo_tributario,
      combo.tipo_registro || null, combo.nome_registrados || null, combo.livro || null, combo.folha || null, combo.termo || null,
      ato.valor_final, ato.issqn
    ]);
  }
}
        
        res.json({ message: 'Pedido atualizado com sucesso', protocolo, id: pedidoId });
        return;
      }
    }

    // Se não há protocolo ou não existe, cria um novo
    console.log('[POST] /api/pedidos - gerando protocolo...');
    const novoProtocolo = protocolo || await gerarProtocolo();
    console.log('[POST] /api/pedidos - protocolo gerado:', novoProtocolo);

    // Criação do novo pedido com os novos campos
    const result = await pool.query(`
      INSERT INTO pedidos (protocolo, tipo, descricao, prazo, cliente_id, valor_adiantado, valor_adiantado_detalhes, observacao, usuario, origem, origem_info)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id
    `, [novoProtocolo, tipo, descricao, prazo, clienteId, valorAdiantado, JSON.stringify(valorAdiantadoDetalhes), observacao, usuario, origem, origemInfo]);
    const pedidoId = result.rows[0].id;

    // Inserir combos se houver
    if (Array.isArray(combos)) {
      for (const combo of combos) {
        // Busca valor_final e issqn do ato no banco
        const atoRes = await pool.query(
          'SELECT valor_final, issqn FROM atos WHERE id = $1',
          [combo.ato_id]
        );
        const ato = atoRes.rows[0] || {};
        await pool.query(`
          INSERT INTO pedido_combos (
            pedido_id, combo_id, ato_id, quantidade, codigo_tributario,
            tipo_registro, nome_registrados, livro, folha, termo,
            valor_final, issqn
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [
          pedidoId, combo.combo_id, combo.ato_id, combo.quantidade, combo.codigo_tributario,
          combo.tipo_registro || null, combo.nome_registrados || null, combo.livro || null, combo.folha || null, combo.termo || null,
          ato.valor_final, ato.issqn
        ]);
      }
    }

    res.json({ 
      success: true, 
      message: 'Pedido criado com sucesso', 
      protocolo: novoProtocolo, 
      id: pedidoId 
    });

  } catch (err) {
    console.error('Erro ao criar/atualizar pedido:', err);
    res.status(500).json({ error: 'Erro ao criar/atualizar pedido.' });
  }
});

// Exemplo: busca todos os status em uma query só
app.post('/api/pedidos/status-multiplos', authenticate, async (req, res) => {
  try {
    const { protocolos } = req.body;
    if (!Array.isArray(protocolos) || protocolos.length === 0) {
      return res.status(400).json({ error: 'protocolos deve ser um array não vazio' });
    }

    // Busca o status mais recente de cada protocolo
    const result = await pool.query(`
      SELECT protocolo, status
      FROM pedido_status
      WHERE protocolo = ANY($1)
    `, [protocolos]);

    // Monta o objeto de resposta
    const statusMap = {};
    result.rows.forEach(row => {
      statusMap[row.protocolo] = row.status;
    });

    // Preenche com '-' para protocolos sem status
    protocolos.forEach(p => {
      if (!statusMap[p]) statusMap[p] = '-';
    });

    res.json({ status: statusMap });
  } catch (err) {
    console.error('Erro ao buscar status múltiplos:', err);
    res.status(500).json({ error: 'Erro ao buscar status múltiplos.' });
  }
});

// Rota para listar pedidos
app.get('/api/pedidos', authenticate, async (req, res) => {
  try {
    const pedidosRes = await pool.query(`
      SELECT p.id, p.protocolo, p.tipo, p.descricao, p.prazo, p.criado_em, 
             p.valor_adiantado, p.valor_adiantado_detalhes, p.usuario, p.observacao,
             p.origem, p.origem_info,
             c.nome as cliente_nome
      FROM pedidos p
      LEFT JOIN clientes c ON p.cliente_id = c.id
      ORDER BY p.id DESC
    `);
    console.log('pedidos listados no DB:', pedidosRes);
    console.log('[DEBUG] Primeiro pedido raw:', pedidosRes.rows[0]);
    console.log('[DEBUG] valor_adiantado_detalhes do primeiro pedido:', pedidosRes.rows[0]?.valor_adiantado_detalhes);
    console.log('[DEBUG] Tipo do valor_adiantado_detalhes:', typeof pedidosRes.rows[0]?.valor_adiantado_detalhes);

    const pedidos = pedidosRes.rows.map(p => {
      // Processar valor_adiantado_detalhes
      let valorAdiantadoDetalhes = [];
      if (p.valor_adiantado_detalhes) {
        try {
          // Como é JSONB, pode vir já como objeto ou string
          if (typeof p.valor_adiantado_detalhes === 'object') {
            valorAdiantadoDetalhes = p.valor_adiantado_detalhes;
          } else if (typeof p.valor_adiantado_detalhes === 'string') {
            valorAdiantadoDetalhes = JSON.parse(p.valor_adiantado_detalhes);
          }
        } catch (e) {
          console.error('Erro ao processar valor_adiantado_detalhes:', e);
          valorAdiantadoDetalhes = [];
        }
      }
      
      return {
        protocolo: p.protocolo,
        tipo: p.tipo,
        cliente: { nome: p.cliente_nome },
        prazo: p.prazo,
        criado_em: p.criado_em,
        descricao: p.descricao,
        valor_adiantado: p.valor_adiantado,
        valorAdiantadoDetalhes: valorAdiantadoDetalhes,
        usuario: p.usuario,
        observacao: p.observacao,
        origem: p.origem,
        origemInfo: p.origem_info,
        execucao: { status: '' },
        pagamento: { status: '' },
        entrega: { data: '', hora: '' }
      };
    });

    res.json({ pedidos });
  } catch (err) {
    console.error('Erro ao listar pedidos:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Erro ao listar pedidos.', details: err && err.message ? err.message : String(err) });
    }
  }
});

// rota para apagar pedido

app.delete('/api/pedidos/:protocolo', authenticate, async (req, res) => {
  try {
    const { protocolo } = req.params;
    // Primeiro, busca o ID do pedido
    const pedidoRes = await pool.query('SELECT id FROM pedidos WHERE protocolo = $1', [protocolo]);
    if (pedidoRes.rows.length === 0) {
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }
    const pedidoId = pedidoRes.rows[0].id;
    // Remove os combos associados primeiro (devido à foreign key)
    await pool.query('DELETE FROM pedido_combos WHERE pedido_id = $1', [pedidoId]);
    // Remove o pedido
    await pool.query('DELETE FROM pedidos WHERE id = $1', [pedidoId]);
    res.json({ message: 'Pedido excluído com sucesso.' });
  } catch (err) {
    console.error('Erro ao excluir pedido:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Erro ao excluir pedido.', details: err && err.message ? err.message : String(err) });
    }
  }
});

//rota para buscar pedido por protocolo - inclui valor_adiantado, usuario e observacao
app.get('/api/pedidos/:protocolo', authenticate, async (req, res) => {
  try {
    const { protocolo } = req.params;
    const pedidoRes = await pool.query(`
      SELECT p.id, p.protocolo, p.tipo, p.descricao, p.prazo, p.criado_em,
             p.valor_adiantado, p.valor_adiantado_detalhes, p.usuario, p.observacao, p.cliente_id,
             p.origem, p.origem_info,
             c.nome as cliente_nome, c.cpf, c.endereco, c.telefone, c.email
      FROM pedidos p
      LEFT JOIN clientes c ON p.cliente_id = c.id
      WHERE p.protocolo = $1
      LIMIT 1
    `, [protocolo]);
    if (pedidoRes.rows.length === 0) {
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }
    const p = pedidoRes.rows[0];

    // Buscar o último status do pedido
    const statusRes = await pool.query(
      `SELECT status FROM pedido_status WHERE protocolo = $1 ORDER BY data_hora DESC LIMIT 1`,
      [protocolo]
    );
    const ultimoStatus = statusRes.rows.length > 0 ? statusRes.rows[0].status : '';

    // Buscar combos e atos do pedido, incluindo campos extras
    const combosRes = await pool.query(`
      SELECT pc.combo_id, pc.ato_id, pc.quantidade, pc.codigo_tributario,
             pc.tipo_registro, pc.nome_registrados, pc.livro, pc.folha, pc.termo,
             pc.valor_final, pc.issqn,
             c.nome as combo_nome,
             a.codigo as ato_codigo, a.descricao as ato_descricao
      FROM pedido_combos pc
      LEFT JOIN combos c ON pc.combo_id = c.id
      LEFT JOIN atos a ON pc.ato_id = a.id
      WHERE pc.pedido_id = $1
    `, [p.id]);
    console.log('[PEDIDOS][GET] Combos retornados do banco:', combosRes.rows);
    const combos = combosRes.rows.map(row => ({
      combo_id: row.combo_id,
      combo_nome: row.combo_nome,
      ato_id: row.ato_id,
      ato_codigo: row.ato_codigo,
      ato_descricao: row.ato_descricao,
      valor_final: row.valor_final,
      issqn: row.issqn,
      quantidade: row.quantidade,
      codigo_tributario: row.codigo_tributario,
      tipo_registro: row.tipo_registro,
      nome_registrados: row.nome_registrados,
      livro: row.livro,
      folha: row.folha,
      termo: row.termo
    }));

    let detalhes = [];
    if (p.valor_adiantado_detalhes) {
      try {
        // Como é JSONB, pode vir já como objeto ou string
        if (typeof p.valor_adiantado_detalhes === 'object') {
          detalhes = p.valor_adiantado_detalhes;
        } else if (typeof p.valor_adiantado_detalhes === 'string') {
          detalhes = JSON.parse(p.valor_adiantado_detalhes);
        }
      } catch (e) {
        console.error('Erro ao processar valor_adiantado_detalhes:', e);
        detalhes = [];
      }
    }
    // Buscar entrega_servico pelo protocolo
    let entrega = null;
    try {
      const entregaRes = await pool.query(
        'SELECT id, protocolo, data, hora, retirado_por, usuario, criado_em FROM entrega_servico WHERE protocolo = $1 ORDER BY criado_em DESC LIMIT 1',
        [p.protocolo]
      );
      if (entregaRes.rows.length > 0) {
        entrega = entregaRes.rows[0];
      }
    } catch (e) {
      entrega = null;
    }

    const pedido = {
      protocolo: p.protocolo,
      tipo: p.tipo,
      descricao: p.descricao,
      prazo: p.prazo,
      criado_em: p.criado_em,
      valor_adiantado: p.valor_adiantado,
      valorAdiantadoDetalhes: detalhes,
      usuario: p.usuario,
      observacao: p.observacao,
      origem: p.origem,
      origemInfo: p.origem_info,
      status: ultimoStatus,
      cliente_id: p.cliente_id,
      cliente: {
        id: p.cliente_id,
        nome: p.cliente_nome,
        cpf: p.cpf,
        endereco: p.endereco,
        telefone: p.telefone,
        email: p.email
      },
      combos,
      execucao: { status: '' },
      pagamento: { status: '' },
      entrega
    };
    res.json({ pedido });
  } catch (err) {
    console.error('Erro ao buscar pedido:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Erro ao buscar pedido.', details: err && err.message ? err.message : String(err) });
    }
  }
});




// GET: busca configurações da serventia
app.get('/api/configuracoes-serventia', async (req, res) => {
  const { serventia } = req.query;
  if (!serventia) return res.status(400).json({ error: 'serventia obrigatória' });

  try {
    console.log('[CONFIGURACOES SERVENTIA][GET] Valor recebido:', serventia, '| Length:', String(serventia).length);

    const result = await pool.query(
      `SELECT caixaunificado, ia_agent, ia_agent_fallback1, ia_agent_fallback2
       FROM serventia
       WHERE nome_abreviado = $1
       LIMIT 1`,
      [serventia]
    );

    console.log('[CONFIGURACOES SERVENTIA][GET] Resultado da query:', result.rows);

    if (!result.rows || result.rows.length === 0) return res.json({});

    const row = result.rows[0];
    return res.json({
      caixa_unificado: !!row.caixaunificado,
      ia_agent: row.ia_agent ?? null,
      ia_agent_fallback1: row.ia_agent_fallback1 ?? null,
      ia_agent_fallback2: row.ia_agent_fallback2 ?? null
    });
  } catch (err) {
    console.error('[CONFIGURACOES SERVENTIA][GET] Erro:', err);
    return res.status(500).json({ error: 'Erro ao buscar configuração', details: err.message });
  }
});

// POST: atualiza (ou insere) config da serventia
app.post('/api/configuracoes-serventia', async (req, res) => {
  const { serventia, caixa_unificado, ia_agent, ia_agent_fallback1, ia_agent_fallback2 } = req.body;
  if (!serventia) return res.status(400).json({ error: 'serventia obrigatória' });

  try {
    console.log('[CONFIGURACOES SERVENTIA][POST] Body recebido:', req.body);

    const updateResult = await pool.query(
      `UPDATE serventia
       SET caixaunificado = $1,
           ia_agent = $2,
           ia_agent_fallback1 = $3,
           ia_agent_fallback2 = $4
       WHERE nome_abreviado = $5
       RETURNING id, nome_abreviado`,
      [!!caixa_unificado, ia_agent ?? null, ia_agent_fallback1 ?? null, ia_agent_fallback2 ?? null, serventia]
    );

    if (updateResult.rowCount === 0) {
      // Se não encontrou a serventia, insere um registro mínimo
      await pool.query(
        `INSERT INTO serventia (nome_abreviado, caixaunificado, ia_agent, ia_agent_fallback1, ia_agent_fallback2)
         VALUES ($1, $2, $3, $4, $5)`,
        [serventia, !!caixa_unificado, ia_agent ?? null, ia_agent_fallback1 ?? null, ia_agent_fallback2 ?? null]
      );
      console.log('[CONFIGURACOES SERVENTIA][POST] Inserido novo registro para:', serventia);
    } else {
      console.log('[CONFIGURACOES SERVENTIA][POST] Atualização realizada para:', serventia);
    }

    // Opcional: retornar os valores efetivamente salvos
    return res.json({ ok: true });
  } catch (err) {
    console.error('[CONFIGURACOES SERVENTIA][POST] Erro:', err);
    return res.status(500).json({ error: 'Erro ao atualizar configuração', details: err.message });
  }
});



//rota para obter lista dos pedidos com o ultimo status
app.get('/api/pedidos/:protocolo/status/ultimo', async (req, res) => {
  const { protocolo } = req.params;
  try {
    const result = await pool.query(
      `SELECT status FROM pedido_status
       WHERE protocolo = $1
       ORDER BY data_hora DESC, id DESC
       LIMIT 1`,
      [protocolo]
    );
    if (result.rows.length > 0) {
      res.json({ status: result.rows[0].status });
    } else {
      res.json({ status: '-' });
    }
  } catch (err) {
    console.error('Erro ao buscar último status:', err);
    res.status(500).json({ error: 'Erro ao buscar status' });
  }
});


// rota para salvar o status do pedido
// Certifique-se de importar ou definir o pool corretamente no topo do seu arquivo:
// const { pool } = require('./db'); // ou conforme seu projeto

app.post('/api/pedidos/:protocolo/status', async (req, res) => {
  const { status, usuario } = req.body;
  const protocolo = req.params.protocolo;
  console.log('[STATUS API] Protocolo:', protocolo);
  console.log('[STATUS API] Body:', req.body);
  if (!status || !usuario) {
    console.log('[STATUS API] Faltando status ou usuario');
    return res.status(400).json({ error: 'Campos status e usuario são obrigatórios.' });
  }
  try {
    console.log('[STATUS API] Executando INSERT em pedido_status');
    const result = await pool.query(
      'INSERT INTO pedido_status (protocolo, status, usuario, data_hora) VALUES ($1, $2, $3, NOW()) RETURNING *',
      [protocolo, status, usuario]
    );
    console.log('[STATUS API] INSERT result:', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[STATUS API] Erro ao salvar status:', err);
    res.status(500).json({ error: 'Erro ao salvar status' });
  }
});

// Criação do registro de pagamento
app.post('/api/pedido_pagamento', async (req, res) => {
  try {
    const {
      protocolo,
      valorAtos,
      valorAdicional,
      totalAdiantado,
      usuario,
      data,
      hora,
      detalhes_pagamento // novo nome do campo JSON vindo do frontend
    } = req.body;

    // Loga o valor recebido do frontend
    console.log('[API] detalhes_pagamento recebido:', detalhes_pagamento);

    // Garante que sempre salva um array (mesmo vazio) e serializa corretamente
    const detalhesPagamentoSerializado = Array.isArray(detalhes_pagamento)
      ? JSON.stringify(detalhes_pagamento)
      : JSON.stringify([]);

    console.log('[API] detalhes_pagamento serializado para o banco:', detalhesPagamentoSerializado);

    await pool.query(
      `INSERT INTO pedido_pagamento
        (protocolo, valor_atos, valor_adicional, total_adiantado, usuario, data, hora, detalhes_pagamento)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [protocolo, valorAtos, valorAdicional, totalAdiantado, usuario, data, hora, detalhesPagamentoSerializado]
    );

    console.log('[API] Pagamento salvo com sucesso para protocolo:', protocolo);

    res.status(201).json({ success: true });
  } catch (err) {
    console.error('Erro ao salvar pedido_pagamento:', err);
    res.status(500).json({ error: 'Erro ao salvar pagamento' });
  }
});

// GET /pedido_pagamento/:protocolo
app.get('/api/pedido_pagamento/:protocolo', async (req, res) => {
  const { protocolo } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM pedido_pagamento WHERE protocolo = $1 LIMIT 1',
      [protocolo]
    );
    if (result.rows.length > 0) {
      const pagamento = result.rows[0];
      // Padronizar para sempre retornar no campo complementos_pagamento (plural)
      if (pagamento.detalhes_pagamento) {
        try {
          pagamento.complementos_pagamento = typeof pagamento.detalhes_pagamento === 'string'
            ? JSON.parse(pagamento.detalhes_pagamento)
            : pagamento.detalhes_pagamento;
        } catch (e) {
          pagamento.complementos_pagamento = null;
        }
      } else {
        pagamento.complementos_pagamento = null;
      }
      res.json(pagamento);
    } else {
      res.status(404).json({ error: 'Pagamento não encontrado' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar pagamento' });
  }
});

// DELETE /pedido_pagamento/:protocolo
app.delete('/api/pedido_pagamento/:protocolo', async (req, res) => {
  const { protocolo } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM pedido_pagamento WHERE protocolo = $1',
      [protocolo]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao excluir pagamento' });
  }
});




//rota para buscar recibo do pedido
app.get('/api/recibo/:protocolo', async (req, res) => {
  const { protocolo } = req.params;
  try {
    console.log(`[RECIBO] Buscando recibo para protocolo: ${protocolo}`);
    const pedidoRes = await pool.query(
      `SELECT 
         p.protocolo, p.descricao, p.prazo, p.criado_em, p.cliente_id, 
         p.valor_adiantado_detalhes,
         c.nome as cliente_nome, c.telefone, c.cpf,
         u.serventia as usuario_serventia,
         s.nome_abreviado, s.nome_completo, s.endereco, s.cnpj, 
         s.telefone as telefone_cartorio, s.email, s.whatsapp, s.cns
       FROM pedidos p
       LEFT JOIN clientes c ON p.cliente_id = c.id
       LEFT JOIN users u ON p.usuario = u.nome
       LEFT JOIN serventia s ON s.nome_abreviado = u.serventia
       WHERE p.protocolo = $1`, [protocolo]
    );
    console.log('[RECIBO] Resultado do SELECT:', pedidoRes.rows);
    if (pedidoRes.rows.length === 0) {
      console.log('[RECIBO] Pedido não encontrado para protocolo:', protocolo);
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }
    const pedido = pedidoRes.rows[0];
    console.log('[RECIBO] Campos retornados:', Object.keys(pedido));
    console.log('[RECIBO] valor_adiantado_detalhes (raw):', pedido.valor_adiantado_detalhes);
    console.log('[RECIBO] Tipo do valor_adiantado_detalhes:', typeof pedido.valor_adiantado_detalhes);
    
    let detalhes = [];
    
    // Como é JSONB, pode vir já como objeto ou string
    if (pedido.valor_adiantado_detalhes) {
      if (typeof pedido.valor_adiantado_detalhes === 'object') {
        // Já é um objeto (JSONB retorna como objeto)
        detalhes = pedido.valor_adiantado_detalhes;
        console.log('[RECIBO] valor_adiantado_detalhes já é objeto:', detalhes);
      } else if (typeof pedido.valor_adiantado_detalhes === 'string') {
        // É string, precisa fazer parse
        try {
          detalhes = JSON.parse(pedido.valor_adiantado_detalhes);
          console.log('[RECIBO] valor_adiantado_detalhes parseado:', detalhes);
        } catch (e) {
          console.log('[RECIBO] Erro ao fazer parse de valor_adiantado_detalhes:', e);
          detalhes = [];
        }
      }
    } else {
      console.log('[RECIBO] valor_adiantado_detalhes está null/undefined/empty');
    }
    res.json({
      pedido: {
        protocolo: pedido.protocolo,
        descricao: pedido.descricao,
        prazo: pedido.prazo,
        criado_em: pedido.criado_em,
        valorAdiantadoDetalhes: detalhes,
  cliente: { nome: pedido.cliente_nome, telefone: pedido.telefone, cpf: pedido.cpf },
        serventia: {
          nome_abreviado: pedido.nome_abreviado,
          nome_completo: pedido.nome_completo,
          endereco: pedido.endereco,
          cnpj: pedido.cnpj,
          telefone: pedido.telefone_cartorio,
          email: pedido.email,
          whatsapp: pedido.whatsapp,
          cns: pedido.cns
        }
      }
    });
  } catch (err) {
    console.log('[RECIBO] Erro ao buscar pedido:', err);
    res.status(500).json({ error: 'Erro ao buscar pedido.' });
  }
});

// Buscar todas as conferências de um protocolo
app.get('/api/conferencias', async (req, res) => {
  try {
    const { protocolo } = req.query;
    if (!protocolo) return res.status(400).json({ error: 'Protocolo obrigatório' });
    
    const result = await pool.query(
      'SELECT * FROM conferencias WHERE protocolo = $1 ORDER BY data_hora DESC',
      [protocolo]
    );
    
    res.json({ conferencias: result.rows });
  } catch (error) {
    console.error('Erro ao buscar conferências:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});


// GET /api/minha-serventia-cns
app.get('/api/minha-serventia-cns', async (req, res) => {
  try {
    // 1) Extrai o usuário do Bearer token
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: 'Token ausente.' });
    }

    let payload;
    try {
      const secret = process.env.JWT_SECRET || process.env.JWT_KEY || '';
      if (!secret) {
        return res.status(500).json({ error: 'JWT_SECRET não configurado.' });
      }
      payload = jwt.verify(token, secret);
    } catch (e) {
      return res.status(401).json({ error: 'Token inválido.' });
    }

    const userId = payload?.id;
    const userNome =
      payload?.nome ||
      payload?.username ||
      (payload?.user && payload.user.nome) ||
      null;

    if (!userId && !userNome) {
      return res.status(400).json({ error: 'Usuário não identificado no token.' });
    }

    // Helper para tentar consultas em sequência
    const tryGetCns = async (sql, param) => {
      const r = await pool.query(sql, [param]);
      if (r.rows && r.rows[0] && r.rows[0].cns) return r.rows[0].cns;
      return null;
    };

    let cns = null;

    // 2) Consultar por id (u.id), usando apenas o vínculo textual users.serventia -> serventia.nome_abreviado
    if (userId) {
      cns = await tryGetCns(
        `SELECT s.cns
           FROM users u
           LEFT JOIN serventia s ON s.nome_abreviado = u.serventia
          WHERE u.id = $1
          LIMIT 1`,
        userId
      );
    }

    // 3) Se ainda não achou, tenta por nome (u.nome), também apenas via vínculo textual
    if (!cns && userNome) {
      cns = await tryGetCns(
        `SELECT s.cns
           FROM users u
           LEFT JOIN serventia s ON s.nome_abreviado = u.serventia
          WHERE u.nome = $1
          LIMIT 1`,
        userNome
      );
    }

    if (!cns) {
      return res.status(404).json({ error: 'CNS não encontrado para o usuário logado.' });
    }

    return res.json({ cns });
  } catch (error) {
    console.error('[minha-serventia-cns] Erro ao obter CNS:', error);
    return res.status(500).json({ error: 'Erro ao obter CNS.' });
  }
});

// Adicionar uma nova conferência
app.post('/api/conferencias', async (req, res) => {
  try {
    const { protocolo, usuario, status, observacao } = req.body;
    if (!protocolo || !usuario || !status) {
      return res.status(400).json({ error: 'Campos obrigatórios: protocolo, usuario, status' });
    }
    
    const result = await pool.query(
      'INSERT INTO conferencias (protocolo, usuario, status, observacao, data_hora) VALUES ($1, $2, $3, $4, NOW()) RETURNING *',
      [protocolo, usuario, status, observacao]
    );
    
    res.status(201).json({ conferencia: result.rows[0] });
  } catch (error) {
    console.error('Erro ao criar conferência:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Atualizar uma conferência existente (PUT)
app.put('/api/conferencias/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, observacao } = req.body;
    
    const result = await pool.query(
      'UPDATE conferencias SET status = COALESCE($1, status), observacao = COALESCE($2, observacao) WHERE id = $3 RETURNING *',
      [status, observacao, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Conferência não encontrada' });
    }
    
    res.json({ conferencia: result.rows[0] });
  } catch (error) {
    console.error('Erro ao atualizar conferência:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Apagar uma conferência (DELETE)
app.delete('/api/conferencias/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'DELETE FROM conferencias WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Conferência não encontrada' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao deletar conferência:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});


//rota para listar combos
app.get('/api/combos', async (req, res) => {
  try {
    const combos = await pool.query(`
      SELECT c.id, c.nome, 
        COALESCE(json_agg(json_build_object('id', a.id, 'codigo', a.codigo, 'descricao', a.descricao)) FILTER (WHERE a.id IS NOT NULL), '[]') AS atos
      FROM combos c
      LEFT JOIN combo_atos ca ON ca.combo_id = c.id
      LEFT JOIN atos a ON ca.ato_id = a.id
      GROUP BY c.id
      ORDER BY c.id
    `);
    res.json({ combos: combos.rows });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar combos.' });
  }
});

// Middleware para verificar se o usuário é admin
const authenticateAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'Token não fornecido' });
    }
    
    // Logar o valor do segredo JWT para depuração
    //console.log('JWT_SECRET em uso:', process.env.JWT_SECRET);
    // Verificar e decodificar o token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Por enquanto, assumir que qualquer token válido tem acesso de admin
    // Aqui você pode adicionar verificações mais específicas conforme necessário
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Erro na autenticação:', error);
    res.status(401).json({ message: 'Token inválido' });
  }
};

// GET /admin/render/services
app.get('/api/admin/render/services', authenticateAdmin, async (req, res) => {
  try {
    const response = await fetch('https://api.render.com/v1/services', {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${process.env.RENDER_API_KEY}`
      }
    });
    if (response.ok) {
      const data = await response.json();
      console.log('[RENDER][GET /services] Resposta:', JSON.stringify(data, null, 2));
      // Filtrar apenas serviços PostgreSQL
      const dbServices = data.filter(service => 
        service.type === 'postgresql' || service.type === 'database'
      );
      res.json({ services: dbServices });
    } else {
      let rawBody = await response.text();
      console.log('[RENDER][GET /services] Erro resposta:', rawBody);
      let errorData;
      try {
        errorData = JSON.parse(rawBody);
      } catch (e) {
        errorData = { raw: rawBody };
      }
      res.status(response.status).json({ 
        message: 'Erro ao buscar serviços do Render', 
        error: errorData 
      });
    }
  } catch (error) {
    console.error('Erro ao buscar serviços:', error);
    res.status(500).json({ message: 'Erro interno do servidor', error: error.message });
  }
});

// POST /admin/render/services/:serviceId/backup
app.post('/api/admin/render/services/:serviceId/backup', authenticateAdmin, async (req, res) => {
  try {
    const { serviceId } = req.params;
    
    const response = await fetch(`https://api.render.com/v1/services/${serviceId}/backups`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${process.env.RENDER_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('[RENDER][POST /services/:serviceId/backup] Resposta:', JSON.stringify(data, null, 2));
      res.json({ message: 'Backup criado com sucesso', data });
    } else {
      const errorData = await response.json();
      console.log('[RENDER][POST /services/:serviceId/backup] Erro resposta:', JSON.stringify(errorData, null, 2));
      res.status(response.status).json({ 
        message: 'Erro ao criar backup', 
        error: errorData 
      });
    }
  } catch (error) {
    console.error('Erro ao criar backup:', error);
    res.status(500).json({ message: 'Erro interno do servidor', error: error.message });
  }
});

app.get('/api/admin/render/postgres', authenticateAdmin, async (req, res) => {
  try {
    const response = await fetch('https://api.render.com/v1/postgres', {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${RENDER_API_KEY}`
      }
    });
    if (response.ok) {
      const data = await response.json();
      res.json({ bancos: data }); // data é um array de bancos postgres
    } else {
      let rawBody = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(rawBody);
      } catch (e) {
        errorData = { raw: rawBody };
      }
      res.status(response.status).json({ 
        message: 'Erro ao buscar bancos postgres do Render', 
        error: errorData 
      });
    }
  } catch (error) {
    console.error('Erro ao buscar bancos postgres:', error);
    res.status(500).json({ message: 'Erro interno do servidor', error: error.message });
  }
});

app.get('/api/admin/render/postgres/:postgresId/recovery', authenticateAdmin, async (req, res) => {
  const { postgresId } = req.params;
  try {
    const response = await fetch(`https://api.render.com/v1/postgres/${postgresId}/recovery`, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${process.env.RENDER_API_KEY}`
      }
    });
    if (response.ok) {
      const data = await response.json();
      res.json(data);
    } else {
      let rawBody = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(rawBody);
      } catch (e) {
        errorData = { raw: rawBody };
      }
      res.status(response.status).json({ 
        message: 'Erro ao buscar recovery info do banco Postgres', 
        error: errorData 
      });
    }
  } catch (error) {
    console.error('Erro ao buscar recovery info:', error);
    res.status(500).json({ message: 'Erro interno do servidor', error: error.message });
  }
});

app.get('/api/admin/render/postgres/:postgresId/exports', authenticateAdmin, async (req, res) => {
  const { postgresId } = req.params;
  try {
    const response = await fetch(`https://api.render.com/v1/postgres/${postgresId}/export`, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${process.env.RENDER_API_KEY}`
      }
    });
    if (response.ok) {
      const data = await response.json();
      res.json({ exports: data });
    } else {
      let rawBody = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(rawBody);
      } catch (e) {
        errorData = { raw: rawBody };
      }
      res.status(response.status).json({ 
        message: 'Erro ao buscar exports do banco Postgres', 
        error: errorData 
      });
    }
  } catch (error) {
    console.error('Erro ao buscar exports:', error);
    res.status(500).json({ message: 'Erro interno do servidor', error: error.message });
  }
});

//rota para disparaar backup automatico
app.post('/admin/render/postgres/:postgresId/recovery', authenticateAdmin, async (req, res) => {
  const { postgresId } = req.params;
  const { restoreTime } = req.body;
  console.log('[RECOVERY][POSTGRES] Iniciando backup automático para postgresId:', postgresId, 'restoreTime:', restoreTime);
  if (!restoreTime) {
    console.warn('[RECOVERY][POSTGRES] restoreTime não informado');
    return res.status(400).json({ error: 'restoreTime é obrigatório' });
  }
  try {
    const response = await fetch(`${RENDER_API_URL}/postgres/${postgresId}/recovery`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RENDER_API_KEY}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ restoreTime })
    });
    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (e) {
      data = { raw: text };
    }
    console.log('[RECOVERY][POSTGRES] Status:', response.status);
    console.log('[RECOVERY][POSTGRES] Resposta:', data);
    if (!response.ok) {
      return res.status(response.status).json(data);
    }
    return res.json(data);
  } catch (err) {
    console.error('[RECOVERY][POSTGRES] Erro ao disparar recovery:', err);
    return res.status(500).json({ error: 'Erro ao disparar recovery', details: err.message });
  }
});

// POST /admin/render/postgres/:postgresId/export
app.post('/api/admin/render/postgres/:postgresId/export', authenticateAdmin, async (req, res) => {
  const { postgresId } = req.params;
  const RENDER_API_KEY = process.env.RENDER_API_KEY;
  if (!RENDER_API_KEY) {
    return res.status(500).json({ error: 'RENDER_API_KEY não configurado no backend.' });
  }
  try {
    console.log('[EXPORT][POSTGRES] Iniciando exportação para postgresId:', postgresId);
    const response = await fetch(`https://api.render.com/v1/postgres/${postgresId}/export`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RENDER_API_KEY}`,
        'Accept': 'application/json'
      }
    });
    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (e) {
      data = { raw: text };
    }
    console.log('[EXPORT][POSTGRES] Status:', response.status);
    console.log('[EXPORT][POSTGRES] Resposta:', data);
    if (!response.ok) {
      return res.status(response.status).json(data);
    }
    return res.json(data);
  } catch (err) {
    console.error('[EXPORT][POSTGRES] Erro ao solicitar exportação:', err);
    return res.status(500).json({ message: 'internal server error', details: err.message });
  }
});

// Admin Render Postgres routes moved to routes/admin-render-postgres.js

// Rotas para entrega-servico
app.post('/api/entrega-servico', authenticateAdmin, async (req, res) => {
  const { protocolo, data, hora, retiradoPor, usuario } = req.body;
  console.log('REQ BODY ENTREGA:', req.body);
  try {
    const result = await pool.query(
      `INSERT INTO entrega_servico (protocolo, data, hora, retirado_por, usuario)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [protocolo, data, hora, retiradoPor, usuario]
    );
    res.json({ entrega: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao salvar entrega', details: err.message });
  }
});


// Rota GET para buscar entrega_servico por protocolo
app.get('/api/entrega-servico/:protocolo', authenticateAdmin, async (req, res) => {
  const { protocolo } = req.params;
  console.log('[ENTREGA][GET] Protocolo recebido:', protocolo);
  try {
    const result = await pool.query(
      'SELECT * FROM entrega_servico WHERE protocolo = $1',
      [protocolo]
    );
    console.log('[ENTREGA][GET] Resultado da query:', result.rows);
    if (result.rows.length === 0) {
      console.log('[ENTREGA][GET] Nenhuma entrega encontrada para o protocolo:', protocolo);
      return res.status(404).json({ error: 'Entrega não encontrada' });
    }
    console.log('[ENTREGA][GET] Entrega encontrada:', result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[ENTREGA][GET] Erro ao buscar entrega:', err);
    res.status(500).json({ error: 'Erro ao buscar entrega', details: err.message });
  }
});

app.put('/api/entrega-servico/:id', authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  const { data, hora, retiradoPor, usuario } = req.body;
  try {
    const result = await pool.query(
      `UPDATE entrega_servico SET data=$1, hora=$2, retirado_por=$3, usuario=$4 WHERE id=$5 RETURNING *`,
      [data, hora, retiradoPor, usuario, id]
    );
    res.json({ entrega: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar entrega', details: err.message });
  }
});

app.delete('/api/entrega-servico/:id', authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `DELETE FROM entrega_servico WHERE id=$1 RETURNING *`,
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Entrega não encontrada' });
    }
    res.json({ message: 'Entrega removida com sucesso', entrega: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover entrega', details: err.message });
  }
});

// Execução de serviço routes moved to routes/execucao-servico.js

// Selos execucao routes moved to routes/execucao-servico.js

// Execucao-servico selo upload moved to routes/execucao-servico.js

// Execucao-servico selos list/delete moved to routes/execucao-servico.js

// OCR test route moved to routes/execucao-servico.js

// Rota para buscar histórico de status de um pedido
app.get('/api/pedidoshistoricostatus/:protocolo/historico-status', async (req, res) => {
  const { protocolo } = req.params;
  try {
    const result = await pool.query(
      `SELECT status, usuario AS responsavel, data_hora
         FROM pedido_status
        WHERE protocolo = $1
        ORDER BY data_hora ASC`,
      [protocolo]
    );
    // Adiciona campo observacoes vazio para compatibilidade com o frontend
    const historico = result.rows.map(row => ({
      ...row,
      observacoes: ''
    }));
    res.json({ historico });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar histórico de status', details: err.message });
  }
});

// Exemplo de rota para retornar dados completos da serventia
app.get('/api/serventias/:nome_abreviado', async (req, res) => {
  const { nome_abreviado } = req.params;
  console.log(`[API][serventias] Requisição recebida para nome_abreviado: ${nome_abreviado}`);
  try {
    const result = await pool.query(
      `SELECT nome_completo, endereco, cnpj, telefone, email FROM serventia WHERE LOWER(nome_abreviado) = LOWER($1)`,
      [nome_abreviado]
    );
    console.log(`[API][serventias] Resultado da consulta:`, result.rows);
    if (result.rows.length === 0) {
      console.warn(`[API][serventias] Nenhuma serventia encontrada para nome_abreviado: ${nome_abreviado}`);
      return res.status(404).json({ error: 'Não encontrada' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(`[API][serventias] Erro ao buscar serventia para nome_abreviado ${nome_abreviado}:`, err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Postgres routes moved to routes/postgres.js


// Clientes routes moved to routes/clientes.js
const { registerClientesRoutes } = require('./routes/clientes');
registerClientesRoutes(app);

// Execução de serviço routes moved to routes/execucao-servico.js
const { registerExecucaoServicoRoutes } = require('./routes/execucao-servico');
registerExecucaoServicoRoutes(app, { authenticateAdmin });

// Postgres (backup agendado) routes moved to routes/postgres.js
const { registerPostgresRoutes } = require('./routes/postgres');
registerPostgresRoutes(app);

// Admin Render Postgres routes moved to routes/admin-render-postgres.js
const { registerAdminRenderPostgresRoutes } = require('./routes/admin-render-postgres');
registerAdminRenderPostgresRoutes(app, { authenticateAdmin });

// Leitura de livros (OCR -> CRC XML) routes
const { registerLeituraLivrosRoutes } = require('./routes/leitura-livros');
registerLeituraLivrosRoutes(app);

// Utils simples
function parseBooleanQuery(value) {
  if (value === undefined || value === null) return null;
  const v = String(value).trim().toLowerCase();
  if (v === 'true') return true;
  if (v === 'false') return false;
  return null; // 'todos' ou qualquer outra coisa -> sem filtro
}

function isValidDateISO(s) {
  if (!s) return false;
  // Aceita YYYY-MM-DD
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// Averbacoes Gratuitas routes moved to routes/averbacoes-gratuitas.js
registerAverbacoesGratuitasRoutes(app);
// Procedimentos Gratuitos (same behavior as averbacoes-gratuitas)
registerProcedimentosGratuitosRoutes(app);

  // Moved legislação routes into routes/legislacao.js
  registerLegislacaoRoutes(app);
  registerUploads(app);
  // Healthcheck de IA movido para routes/ia.js

  
 


    // New structured flow endpoints
  // 1) Rotas de IA foram movidas para routes/ia.js

  

  

  

  

  


// Middleware global para erros não tratados
app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Erro interno do servidor', details: err && err.message ? err.message : String(err) });
  }
});

// server.js não exporta Router; inicializa e expõe HTTP diretamente