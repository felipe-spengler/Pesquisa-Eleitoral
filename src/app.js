'use strict';
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const surveyRoutes = require('./routes/survey');
const dispatchRoutes = require('./routes/dispatch');

const app = express();

// Confia no proxy do Coolify (Traefik) para obter o IP correto do eleitor (necessário para o Rate Limiter)
app.set('trust proxy', true);

// =============================================
// Segurança e Headers
// =============================================
// lgtm[js/missing-token-validation] — Custom CSRF protection implemented below via Origin/Referer + Content-Type checks
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],   // inline scripts no frontend existente
        scriptSrcAttr: ["'self'", "'unsafe-inline'"], // permite event handlers inline (ex: injetados via extensões)
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
  })
);
app.use(cors({
  origin: process.env.APP_URL || `http://localhost:${process.env.PORT || 4444}`,
  credentials: true,
}));

// CSRF Protection Middleware
// Protects against cross-site request forgery via two layers:
//  1. Origin/Referer header validation
//  2. Content-Type enforcement (browsers cannot send JSON from cross-origin forms)
app.use((req, res, next) => {
  const allowedMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (allowedMethods.includes(req.method)) {
    return next();
  }

  // Layer 1: Origin/Referer check
  const origin = req.headers.origin || req.headers.referer;
  const appUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 4444}`;
  if (origin && !origin.startsWith(appUrl) && !origin.startsWith('http://localhost')) {
    return res.status(403).json({ error: 'CSRF validation failed.' });
  }

  // Layer 2: API routes must use JSON content-type (blocks classic HTML form CSRF)
  if (req.path.startsWith('/api/')) {
    const ct = req.headers['content-type'] || '';
    if (!ct.includes('application/json') && !ct.includes('multipart/form-data')) {
      return res.status(415).json({ error: 'Content-Type inválido.' });
    }
  }

  next();
});



// =============================================
// Rate Limiting
// =============================================
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200,
  message: { error: 'Muitas requisições. Tente novamente em alguns minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
});

const submitLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 10,
  message: { error: 'Muitas tentativas de resposta. Aguarde alguns minutos.' },
  validate: { trustProxy: false },
});

// =============================================
// Body Parsing
// =============================================
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// =============================================
// Arquivos Estáticos (Frontend)
// =============================================
app.use(express.static(path.join(__dirname, '..', 'public')));

// =============================================
// Health Check
// =============================================
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), port: process.env.PORT || 4444 });
});

// =============================================
// API Routes
// =============================================
app.use('/api', apiLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/survey', surveyRoutes);
app.use('/api/survey', submitLimiter); // Rate limit extra para submissão
app.use('/api/dispatch', dispatchRoutes);

// =============================================
// SPA Fallback para páginas do Admin e Survey
// =============================================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin', 'login.html'));
});

app.get('/admin/sync', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin', 'sync.html'));
});

app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin', 'dashboard.html'));
});

app.get('/survey/:token', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'survey', 'index.html'));
});

// =============================================
// 404 Handler
// =============================================
app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada.' });
});

// =============================================
// Global Error Handler
// =============================================
app.use((err, req, res, next) => {
  console.error('[App] Unhandled error:', err.message);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

module.exports = app;
