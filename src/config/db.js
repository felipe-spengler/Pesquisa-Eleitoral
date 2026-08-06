'use strict';
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client:', err.message);
});

/**
 * Executa uma query no pool de conexões.
 * @param {string} text - SQL query
 * @param {Array} params - Parâmetros parametrizados
 */
async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV !== 'production') {
    console.debug(`[DB] query(${duration}ms): ${text.substring(0, 80)}`);
  }
  return res;
}

/**
 * Obtém um client do pool para transações manuais.
 */
async function getClient() {
  return pool.connect();
}

module.exports = { query, getClient, pool };
