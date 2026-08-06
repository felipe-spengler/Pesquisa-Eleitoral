'use strict';
const jwt = require('jsonwebtoken');

/**
 * Middleware de autenticação JWT.
 * Aceita token via header Authorization: Bearer <token> ou cookie authToken.
 */
function authMiddleware(req, res, next) {
  try {
    let token = null;

    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    } else if (req.cookies && req.cookies.authToken) {
      token = req.cookies.authToken;
    } else if (req.query && req.query.token) {
      // Permite JWT via query param para downloads de arquivos pelo browser
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({ error: 'Token de autenticação não fornecido.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
}

module.exports = authMiddleware;
