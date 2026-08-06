'use strict';
require('dotenv').config();
const app = require('./src/app');
const { pool } = require('./src/config/db');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT, 10) || 4444;

async function runMigrationsAndSeed() {
  try {
    console.log('[DB] Executando migrações...');
    const migrationPath = path.join(__dirname, 'migrations', '001_init.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    await pool.query(sql);
    console.log('[DB] ✅ Migrações executadas com sucesso.');

    // Roda o seed de forma automática se a tabela de usuários existir
    console.log('[DB] Verificando semente (seed) do admin...');
    const bcrypt = require('bcryptjs');
    const defaultEmail = 'admin@admin.com';
    const defaultPassword = 'admin123';

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [defaultEmail]);
    if (existing.rows.length === 0) {
      const hash = await bcrypt.hash(defaultPassword, 12);
      await pool.query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2)',
        [defaultEmail, hash]
      );
      console.log('╔═════════════════════════════════════════╗');
      console.log('║  ✅ Admin criado de forma automática!   ║');
      console.log(`║  E-mail: ${defaultEmail}          ║`);
      console.log(`║  Senha:  ${defaultPassword}                   ║`);
      console.log('╚═════════════════════════════════════════╝');
    } else {
      console.log('[DB] Semente do admin já configurada.');
    }
  } catch (err) {
    console.error('[DB] ❌ Erro nas migrações ou seed:', err.message);
  }
}

async function start() {
  await runMigrationsAndSeed();

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('╔════════════════════════════════════════════╗');
    console.log('║     🗳️  PESQUISA ELEITORAL                 ║');
    console.log(`║     Servidor rodando na porta ${PORT}        ║`);
    console.log(`║     Admin: http://localhost:${PORT}/admin    ║`);
    console.log('╚════════════════════════════════════════════╝');
    console.log('');
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`\n[Server] Recebido ${signal}. Encerrando graciosamente...`);
    server.close(async () => {
      await pool.end();
      console.log('[Server] Conexões encerradas. Bye!');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  console.error('[Server] Falha fatal ao iniciar:', err.message);
  process.exit(1);
});
