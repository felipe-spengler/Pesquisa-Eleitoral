'use strict';
require('dotenv').config();
const { Queue } = require('bullmq');
const IORedis = require('ioredis');

const redisUrl = new URL(process.env.REDIS_URL || 'redis://localhost:6379');

const redisConnection = new IORedis({
  host: redisUrl.hostname,
  port: parseInt(redisUrl.port, 10) || 6379,
  password: redisUrl.password || undefined,
  maxRetriesPerRequest: null, // necessário para BullMQ
});

redisConnection.on('connect', () => console.log('[Redis] Conectado'));
redisConnection.on('error', (err) => console.error('[Redis] Erro:', err.message));

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
