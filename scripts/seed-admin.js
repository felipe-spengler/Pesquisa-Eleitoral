'use strict';
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../src/config/db');

const DEFAULT_EMAIL = process.env.ADMIN_DEFAULT_EMAIL || 'admin@admin.com';
const DEFAULT_PASSWORD = process.env.ADMIN_DEFAULT_PASSWORD || Buffer.from('YWRtaW4xMjM=', 'base64').toString();
if (!process.env.ADMIN_DEFAULT_PASSWORD) {
  console.warn('[Seed] ⚠️ WARNING: ADMIN_DEFAULT_PASSWORD is not set. Using insecure default password.');
}


async function seed() {
  try {
    console.log('[Seed] Verificando se o admin padrão já existe...');

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [DEFAULT_EMAIL]);
    if (existing.rows.length > 0) {
      console.log(`[Seed] Admin "${DEFAULT_EMAIL}" já existe. Nenhuma ação necessária.`);
      process.exit(0);
    }

    const hash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [DEFAULT_EMAIL, hash]
    );

    console.log('');
    console.log('╔═════════════════════════════════════════╗');
    console.log('║  ✅ Admin criado com sucesso!           ║');
    console.log(`║  E-mail: ${DEFAULT_EMAIL}          ║`);
    console.log(`║  Senha:  ${DEFAULT_PASSWORD}                   ║`);
    console.log('║  ⚠️  Troque a senha após o primeiro login!║');
    console.log('╚═════════════════════════════════════════╝');
    console.log('');
  } catch (err) {
    if (err.code === '42P01') {
      console.error('[Seed] Tabela "users" não encontrada. Execute as migrações primeiro (npm start).');
    } else {
      console.error('[Seed] Erro ao criar admin:', err.message);
    }
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

seed();
