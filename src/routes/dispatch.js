'use strict';
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

/**
 * POST /api/dispatch
 * Body: { survey_id, contact_ids: [1,2,3], channel: 'whatsapp' | 'email' }
 *
 * Retorna 202 imediatamente e enfileira os jobs no BullMQ.
 */
router.post('/', async (req, res) => {
  try {
    const { survey_id, contact_ids, channel } = req.body;

    if (!survey_id || !contact_ids || !Array.isArray(contact_ids) || contact_ids.length === 0) {
      return res.status(400).json({ error: 'survey_id e contact_ids são obrigatórios.' });
    }
    if (!['whatsapp', 'email'].includes(channel)) {
      return res.status(400).json({ error: 'channel deve ser "whatsapp" ou "email".' });
    }

    // Verificar se a pesquisa existe e está ativa
    const surveyRes = await query('SELECT * FROM surveys WHERE id = $1 AND is_active = true', [survey_id]);
    if (!surveyRes.rows[0]) {
      return res.status(404).json({ error: 'Pesquisa não encontrada ou inativa.' });
    }
    const survey = surveyRes.rows[0];

    // Buscar contatos
    const contactsRes = await query(
      `SELECT * FROM contacts WHERE id = ANY($1::int[])`,
      [contact_ids]
    );
    if (contactsRes.rows.length === 0) {
      return res.status(404).json({ error: 'Nenhum contato encontrado.' });
    }

    const { sendSurveyEmail } = require('../utils/mailer');
    const { sendWhatsAppTemplate } = require('../utils/whatsapp');

    // Executa o envio em background no próprio Node.js sem travar a requisição HTTP (Retorna 202)
    setImmediate(async () => {
      console.log(`[Disparo] Iniciando envio direto para ${contactsRes.rows.length} contatos via ${channel}`);
      
      for (const contact of contactsRes.rows) {
        const token = uuidv4().replace(/-/g, '');
        
        // 1. Grava no DB como pending
        const tokenRes = await query(
          `INSERT INTO dispatch_tokens (survey_id, contact_id, token, channel, status)
           VALUES ($1, $2, $3, $4, 'pending') RETURNING id`,
          [survey_id, contact.id, token, channel]
        );
        const tokenId = tokenRes.rows[0].id;
        const surveyUrl = `${process.env.APP_URL || 'http://localhost:4444'}/survey/${token}`;

        try {
          // 2. Tenta disparar o e-mail ou WhatsApp na hora
          if (channel === 'email') {
            if (contact.email) {
              await sendSurveyEmail({
                to: contact.email,
                name: contact.name,
                surveyTitle: survey.title,
                surveyUrl,
              });
            } else {
              throw new Error('Contato sem e-mail cadastrado');
            }
          } else if (channel === 'whatsapp') {
            if (contact.phone) {
              await sendWhatsAppTemplate({
                phone: contact.phone,
                name: contact.name,
                surveyUrl,
              });
            } else {
              throw new Error('Contato sem telefone cadastrado');
            }
          }

          // Sucesso: atualiza status para 'sent'
          await query(
            `UPDATE dispatch_tokens SET status = 'sent', sent_at = NOW() WHERE id = $1`,
            [tokenId]
          );
          console.log(`[Disparo] ✅ Enviado para ${contact.name} (${channel})`);
        } catch (err) {
          // Falha: atualiza status para 'failed'
          console.error(`[Disparo] ❌ Falha no envio para ${contact.name}: ${err.message}`);
          await query(
            `UPDATE dispatch_tokens SET status = 'failed' WHERE id = $1`,
            [tokenId]
          );
        }
      }
    });

    // Resposta imediata 202 para o admin
    return res.status(202).json({
      message: `Disparo iniciado para ${contactsRes.rows.length} contato(s) via ${channel}.`,
      total_enqueued: contactsRes.rows.length,
      survey_id,
      channel,
    });
  } catch (err) {
    console.error('[Dispatch] POST /:', err.message);
    return res.status(500).json({ error: 'Erro ao iniciar disparo.' });
  }
});

/**
 * GET /api/dispatch/contacts — Lista contatos disponíveis para disparo
 */
router.get('/contacts', async (req, res) => {
  try {
    const result = await query('SELECT * FROM contacts ORDER BY id DESC');
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao listar contatos.' });
  }
});

module.exports = router;
