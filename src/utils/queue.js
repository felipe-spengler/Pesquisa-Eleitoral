'use strict';
const { query } = require('../config/db');
const { sendSurveyEmail } = require('./mailer');
const { sendWhatsAppTemplate } = require('./whatsapp');

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[m]));
}

let isProcessing = false;
const BATCH_SIZE = 10; // Processa de 10 em 10 por vez
const CHECK_INTERVAL = 10000; // A cada 10 segundos

/**
 * Processa um lote de disparos pendentes.
 */
async function processQueueBatch() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    // Busca os próximos disparos pendentes ordenados pelo ID
    const pendingRes = await query(
      `SELECT dt.*, c.name, c.email, c.phone, s.title AS survey_title
       FROM dispatch_tokens dt
       JOIN contacts c ON c.id = dt.contact_id
       JOIN surveys s ON s.id = dt.survey_id
       WHERE dt.status = 'pending'
       ORDER BY dt.id ASC
       LIMIT $1`,
      [BATCH_SIZE]
    );

    if (pendingRes.rows.length === 0) {
      isProcessing = false;
      return;
    }

    console.log(`[Queue] Processando lote de ${pendingRes.rows.length} disparo(s)...`);

    for (const job of pendingRes.rows) {
      const rawUrl = `${process.env.APP_URL || 'http://localhost:4444'}/survey/${job.token}`;
      // Validate URL scheme to prevent javascript: or data: injection into email HTML
      let surveyUrl;
      try {
        const parsed = new URL(rawUrl);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          throw new Error(`Invalid URL scheme: ${parsed.protocol}`);
        }
        surveyUrl = parsed.href;
      } catch (urlErr) {
        console.error(`[Queue] ❌ URL inválida para job #${job.id}: ${urlErr.message}`);
        await query(`UPDATE dispatch_tokens SET status = 'failed' WHERE id = $1`, [job.id]);
        continue;
      }

      
      try {
        if (job.channel === 'email') {
          if (job.email) {
            await sendSurveyEmail({
              to: job.email,
              name: escapeHtml(job.name),
              surveyTitle: escapeHtml(job.survey_title),
              surveyUrl,
            });
          } else {
            throw new Error('Contato sem e-mail cadastrado');
          }
        } else if (job.channel === 'whatsapp') {
          if (job.phone) {
            await sendWhatsAppTemplate({
              phone: job.phone,
              name: job.name,
              surveyUrl,
            });
          } else {
            throw new Error('Contato sem telefone cadastrado');
          }
        }

        // Sucesso
        await query(
          `UPDATE dispatch_tokens SET status = 'sent', sent_at = NOW() WHERE id = $1`,
          [job.id]
        );
        console.log(`[Queue] ✅ Enviado: #${job.id} para ${job.name} (${job.channel})`);
      } catch (err) {
        // Falha
        console.error(`[Queue] ❌ Erro: #${job.id} para ${job.name}: ${err.message}`);
        await query(
          `UPDATE dispatch_tokens SET status = 'failed' WHERE id = $1`,
          [job.id]
        );
      }
    }
  } catch (err) {
    console.error('[Queue] Falha ao processar lote:', err.message);
  } finally {
    isProcessing = false;
  }
}

/**
 * Inicializa a fila em segundo plano.
 */
function initQueue() {
  console.log('[Queue] Inicializando motor de disparos persistente...');
  // Executa imediatamente no boot e depois a cada 10 segundos
  processQueueBatch();
  setInterval(processQueueBatch, CHECK_INTERVAL);
}

module.exports = { initQueue };
