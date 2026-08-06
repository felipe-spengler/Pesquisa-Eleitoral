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

// =============================================
// Segurança e Headers
// =============================================
app.use(
  helmet({
    contentSecurityPolicy: false, // Desabilitado para facilitar o desenvolvimento do frontend inline
  })
);
app.use(cors({
  origin: process.env.APP_URL || `http://localhost:${process.env.PORT || 4444}`,
  credentials: true,
}));

// =============================================
// Rate Limiting
// =============================================
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200,
  message: { error: 'Muitas requisições. Tente novamente em alguns minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const submitLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 10,
  message: { error: 'Muitas tentativas de resposta. Aguarde alguns minutos.' },
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
  res.redirect('/admin');
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin', 'login.html'));
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
