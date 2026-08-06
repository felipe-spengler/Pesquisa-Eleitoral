'use strict';
require('dotenv').config();
const app = require('./src/app');
const { pool } = require('./src/config/db');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT, 10) || 4444;

async function runMigrations() {
  try {
    console.log('[DB] Executando migrações...');
    const migrationPath = path.join(__dirname, 'migrations', '001_init.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    await pool.query(sql);
    console.log('[DB] ✅ Migrações executadas com sucesso.');
  } catch (err) {
    console.error('[DB] ❌ Erro nas migrações:', err.message);
    // Não aborta o processo — tabelas podem já existir
  }
}

async function start() {
  await runMigrations();

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
