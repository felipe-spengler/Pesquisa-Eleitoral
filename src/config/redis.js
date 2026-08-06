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

redisConnection.on('connect', () => console.log('[Redis] Conectado com sucesso'));
redisConnection.on('error', (err) => {
  // Evita poluir o console com loops infinitos de auth
  if (err.message.includes('NOAUTH')) {
    console.error('[Redis] Erro Crítico: Exige senha de autenticação.');
  } else {
    console.error('[Redis] Erro de conexão:', err.message);
  }
});

const dispatchQueue = new Queue('dispatch', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 500,
    removeOnFail: 200,
  },
});

module.exports = { redisConnection, dispatchQueue };
