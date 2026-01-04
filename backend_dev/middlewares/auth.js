// middlewares/auth.js
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'uma_chave_super_secreta';

function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) {
    return res.sendStatus(401);
  }

  const [, token] = auth.split(' ');

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.sendStatus(401);
  }
}

// Ensures requester is authenticated and has the Registrador role (admin privileges)
function authenticateAdmin(req, res, next) {
  authenticate(req, res, () => {
    if (req.user && req.user.cargo === 'Registrador') {
      return next();
    }

    res.status(403).json({ message: 'Acesso restrito ao Registrador.' });
  });
}

const ensureAuth = authenticateAdmin;

module.exports = { authenticate, authenticateAdmin, ensureAuth };