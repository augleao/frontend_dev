const express = require('express');
const router = express.Router();
const pool = require('../db');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'uma_chave_super_secreta';

// Middleware de autenticação
const autenticar = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ erro: 'Token não fornecido' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // O payload do token deve conter o nome do usuário
    next();
  } catch (err) {
    return res.status(401).json({ erro: 'Token inválido' });
  }
};

// GET /meus-fechamentos
router.get('/meus-fechamentos', autenticar, async (req, res) => {
  try {
    const usuarioNome = req.user?.nome;
    const usuarios = req.query.usuarios; // Ex: "Ana,Beto,Carlos"
    console.log('--- [meus-fechamentos] INICIO ---');
    console.log('Usuário autenticado:', usuarioNome);
    console.log('Query usuarios:', usuarios);

    if (!usuarioNome) {
      console.log('Usuário não autenticado!');
      return res.status(401).json({ erro: 'Usuário não autenticado' });
    }

    let whereClause = '';
    let params = [];
    if (usuarios) {
      const listaUsuarios = usuarios.split(',').map(u => u.trim()).filter(Boolean);
      console.log('Lista de usuários recebida:', listaUsuarios);
      whereClause = `usuario = ANY($1::text[]) AND codigo IN ('0001','0005')`;
      params = [listaUsuarios];
    } else {
      whereClause = `usuario = $1 AND codigo IN ('0001','0005')`;
      params = [usuarioNome];
    }

    const query = `
      SELECT
        id,
        data,
        hora,
        codigo,
        descricao,
        quantidade AS total_quantidade,
        valor_unitario AS total_valor,
        total_entradas,
        total_saidas,
        pagamentos,
        usuario,
        serventia
      FROM
        public.atos_pagos
      WHERE
        ${whereClause}
      ORDER BY
        data DESC, hora DESC;
    `;
    console.log('Query executada:', query);
    console.log('Parâmetros:', params);

    const result = await pool.query(query, params);
    console.log('Fechamentos encontrados:', result.rowCount);

    // Normaliza números (opcional): garante que os campos numéricos venham como Number
    const rows = result.rows.map(r => ({
      ...r,
      total_valor: r.total_valor !== null ? Number(r.total_valor) : 0,
      total_entradas: r.total_entradas !== null ? Number(r.total_entradas) : 0,
      total_saidas: r.total_saidas !== null ? Number(r.total_saidas) : 0
    }));

    res.json({ fechamentos: rows });
    console.log('--- [meus-fechamentos] FIM ---');
  } catch (err) {
    console.error('Erro ao buscar fechamentos:', err);
    res.status(500).json({ erro: 'Erro ao buscar fechamentos', details: err.message });
  }
});

module.exports = router;