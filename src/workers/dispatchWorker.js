'use strict';
require('dotenv').config();
const { Worker } = require('bullmq');
const { redisConnection } = require('../config/redis');
const { query } = require('../config/db');
const { sendSurveyEmail } = require('../utils/mailer');
const { sendWhatsAppTemplate } = require('../utils/whatsapp');

console.log('[Worker] Iniciando BullMQ Dispatch Worker...');

const worker = new Worker(
  'dispatch',
  async (job) => {
    const { tokenId, token, channel, contact, survey, surveyUrl } = job.data;

    console.log(`[Worker] Processando job ${job.id}: ${channel} → ${contact.email || contact.phone}`);

    try {
      if (channel === 'email') {
        if (!contact.email) {
          throw new Error(`Contato ${contact.id} não tem e-mail cadastrado.`);
        }
        await sendSurveyEmail({
          to: contact.email,
          name: contact.name,
          surveyTitle: survey.title,
          surveyUrl,
        });
      } else if (channel === 'whatsapp') {
        if (!contact.phone) {
          throw new Error(`Contato ${contact.id} não tem telefone cadastrado.`);
        }
        await sendWhatsAppTemplate({
          phone: contact.phone,
          name: contact.name,
          surveyUrl,
        });
      } else {
        throw new Error(`Canal inválido: ${channel}`);
      }

      // Sucesso: atualiza status para 'sent'
      await query(
        `UPDATE dispatch_tokens SET status = 'sent', sent_at = NOW() WHERE id = $1`,
        [tokenId]
      );
      console.log(`[Worker] ✅ Job ${job.id} concluído com sucesso.`);
    } catch (err) {
      // Falha: atualiza status para 'failed'
      console.error(`[Worker] ❌ Job ${job.id} falhou: ${err.message}`);
      await query(
        `UPDATE dispatch_tokens SET status = 'failed' WHERE id = $1`,
        [tokenId]
      );
      // Re-lançar para que o BullMQ registre a falha e aplique retry policy
      throw err;
    }
  },
  {
    connection: redisConnection,
    concurrency: 5, // Processa até 5 envios simultâneos
  }
);

worker.on('completed', (job) => {
  console.log(`[Worker] Job completed: ${job.id}`);
});

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job failed: ${job?.id} — ${err.message}`);
});

worker.on('error', (err) => {
  console.error('[Worker] Worker error:', err.message);
});

// Graceful shutdown
async function shutdown() {
  console.log('[Worker] Encerrando worker...');
  await worker.close();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
