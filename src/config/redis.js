'use strict';
require('dotenv').config();
const { Queue } = require('bullmq');
const IORedis = require('ioredis');

const redisUrlStr = process.env.REDIS_URL || 'redis://localhost:6379';
const redisUrl = new URL(redisUrlStr);

const redisOptions = {
  host: redisUrl.hostname,
  port: parseInt(redisUrl.port, 10) || 6379,
  maxRetriesPerRequest: null, // Necessário para BullMQ
  maxLoadingRetryTime: 5000,
};

// Só passa password se existir na URL para evitar erro NOAUTH
if (redisUrl.password) {
  redisOptions.password = redisUrl.password;
}

const redisConnection = new IORedis(redisOptions);

// Captura erros de forma robusta e amigável
redisConnection.on('connect', () => console.log('[Redis] Conectado com sucesso'));
redisConnection.on('error', (err) => {
  if (err.message.includes('WRONGPASS') || err.message.includes('NOAUTH')) {
    console.warn('[Redis] Alerta: Problema de autenticação no Redis. O motor de disparo assíncrono pode falhar.');
  } else {
    console.error('[Redis] Erro de conexão:', err.message);
  }
});

// Inicialização segura da fila
let dispatchQueue = null;
try {
  dispatchQueue = new Queue('dispatch', {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 500,
      removeOnFail: 200,
    },
  });
  
  // Evita crash global por erro de conexão da fila
  dispatchQueue.on('error', (err) => {
    console.warn('[BullMQ] Erro na fila:', err.message);
  });
} catch (e) {
  console.error('[BullMQ] Falha crítica ao inicializar fila:', e.message);
}

module.exports = { redisConnection, dispatchQueue };
