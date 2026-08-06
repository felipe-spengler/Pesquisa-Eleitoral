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

    // Apenas grava os tokens no DB com status 'pending' (A fila em background vai pegar)
    for (const contact of contactsRes.rows) {
      const token = uuidv4().replace(/-/g, '');
      
      await query(
        `INSERT INTO dispatch_tokens (survey_id, contact_id, token, channel, status)
         VALUES ($1, $2, $3, $4, 'pending')`,
        [survey_id, contact.id, token, channel]
      );
    }

    // Resposta imediata 202 para o admin
    return res.status(202).json({
      message: `Disparo de ${contactsRes.rows.length} mensagens agendado com sucesso.`,
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
