// routes/auth.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'uma_chave_super_secreta';
const { authenticate } = require('../middlewares/auth');

// Cadastro de usuário
router.post('/signup', async (req, res) => {
  const { nome, email, password, serventia, cargo } = req.body;
  
  if (!nome || !email || !password || !serventia || !cargo) {
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
router.post('/login', async (req, res) => {
  // Accept either JSON or form submissions: email or username
  const body = req.body || {};
  const email = body.email || body.username || body.login || null;
  const password = body.password || null;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email/username e senha são obrigatórios.' });
  }

  try {
    // try lookup by email first, then by username/login fields
    let result = await pool.query('SELECT * FROM public.users WHERE email = $1', [email]);
    if (!result.rowCount) {
      result = await pool.query('SELECT * FROM public.users WHERE nome = $1 OR email = $1', [email]);
    }
    
    if (!result.rowCount) {
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);
    
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    const tokenPayload = {
      id: user.id,
      email: user.email,
      cargo: user.cargo,
      serventia: user.serventia,
      codigo_serventia: user.codigo_serventia || user.serventia_codigo || null,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '8h' });

    // generate or reuse a tracking cookie
    const { v4: uuidv4 } = require('uuid');
    let trackUid = null;
    // prefer existing session-like cookie if present
    if (req.cookies && (req.cookies['connect.sid'] || req.cookies.session || req.cookies.session_id)) {
      trackUid = req.cookies['connect.sid'] || req.cookies.session || req.cookies.session_id;
    } else {
      trackUid = uuidv4();
    }

    // Set cookie; choose SameSite based on env to allow cross-site POSTs when needed
    const TRACKER_DEBUG = String(process.env.TRACKER_DEBUG || '') === '1';
    const cookieSameSite = process.env.TRACKER_SAMESITE || (process.env.NODE_ENV === 'production' ? 'none' : 'lax');
    const cookieSecure = process.env.COOKIE_SECURE === '1' || (process.env.NODE_ENV === 'production');
    const cookieOptions = {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: cookieSameSite,
      maxAge: 31536000 * 1000 // 1 year in ms
    };

    // NOTE: SameSite='none' requires Secure=true in modern browsers
    if (cookieSameSite === 'none' && !cookieSecure) {
      // force secure when sameSite none to comply with browsers
      cookieOptions.secure = true;
    }

    res.cookie('track_uid', trackUid, cookieOptions);

    if (TRACKER_DEBUG) {
      try {
        console.info('[login] set track_uid (masked)', { userId: user.id, masked: String(trackUid).slice(0,6) + '...', cookieOptions });
      } catch (e) {}
    }

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

// Perfil do usuário (protegido)
router.get('/profile', authenticate, async (req, res) => {
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

module.exports = router;