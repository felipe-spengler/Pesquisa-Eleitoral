'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    }

    const result = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Cookie httpOnly como fallback de segurança
    res.cookie('authToken', token, {
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 8 * 60 * 60 * 1000,
    });

    return res.json({ token, user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error('[Auth] Erro no login:', err.message);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('authToken');
  return res.json({ message: 'Logout realizado com sucesso.' });
});

module.exports = router;
