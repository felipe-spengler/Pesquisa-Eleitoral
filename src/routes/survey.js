'use strict';
const express = require('express');
const { query, getClient } = require('../config/db');

const router = express.Router();

// GET /api/survey/:token — Validar token e retornar pesquisa
router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const tokenRes = await query(
      `SELECT dt.*, s.title AS survey_title, s.is_active
       FROM dispatch_tokens dt
       JOIN surveys s ON s.id = dt.survey_id
       WHERE dt.token = $1`,
      [token]
    );

    if (!tokenRes.rows[0]) {
      return res.status(404).json({
        error: 'Pesquisa não encontrada.',
        code: 'NOT_FOUND',
      });
    }

    const tokenRow = tokenRes.rows[0];

    if (tokenRow.status === 'answered') {
      return res.status(200).json({
        status: 'answered',
        message: 'Sua resposta já foi registrada. Obrigado pela participação!',
      });
    }

    if (!tokenRow.is_active) {
      return res.status(403).json({
        error: 'Esta pesquisa está encerrada.',
        code: 'SURVEY_INACTIVE',
      });
    }

    // Buscar perguntas e opções
    const questionsRes = await query(
      'SELECT * FROM questions WHERE survey_id = $1 ORDER BY order_index ASC',
      [tokenRow.survey_id]
    );

    const questions = await Promise.all(
      questionsRes.rows.map(async (q) => {
        if (q.type !== 'text') {
          const optionsRes = await query(
            'SELECT * FROM options WHERE question_id = $1 ORDER BY id ASC',
            [q.id]
          );
          return { ...q, options: optionsRes.rows };
        }
        return { ...q, options: [] };
      })
    );

    return res.json({
      status: 'pending',
      survey: {
        id: tokenRow.survey_id,
        title: tokenRow.survey_title,
      },
      questions,
    });
  } catch (err) {
    console.error('[Survey] GET /:token:', err.message);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// POST /api/survey/:token/submit — Submeter respostas
router.post('/:token/submit', async (req, res) => {
  const client = await getClient();
  try {
    const { token } = req.params;
    const { answers } = req.body; // Array de { question_id, option_id?, text_answer? }
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;

    if (!answers || !Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ error: 'Nenhuma resposta fornecida.' });
    }

    await client.query('BEGIN');

    // Verificação com lock para prevenir race condition
    const tokenRes = await client.query(
      `SELECT dt.*, s.is_active
       FROM dispatch_tokens dt
       JOIN surveys s ON s.id = dt.survey_id
       WHERE dt.token = $1
       FOR UPDATE`,
      [token]
    );

    if (!tokenRes.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Token inválido.', code: 'NOT_FOUND' });
    }

    const tokenRow = tokenRes.rows[0];

    if (tokenRow.status === 'answered') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        status: 'answered',
        error: 'Este token já foi respondido.',
        message: 'Sua resposta já foi registrada. Obrigado pela participação!',
      });
    }

    if (!tokenRow.is_active) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Esta pesquisa está encerrada.' });
    }

    // Inserir respostas
    for (const answer of answers) {
      const { question_id, option_id = null, text_answer = null } = answer;
      if (!question_id) continue;

      await client.query(
        `INSERT INTO responses (survey_id, question_id, option_id, text_answer, token_id, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [tokenRow.survey_id, question_id, option_id, text_answer, tokenRow.id, clientIp]
      );
    }

    // Atualizar token como respondido
    await client.query(
      `UPDATE dispatch_tokens
       SET status = 'answered', answered_at = NOW(), client_ip = $1
       WHERE id = $2`,
      [clientIp, tokenRow.id]
    );

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: 'Sua resposta foi registrada com sucesso. Obrigado pela participação!',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Survey] POST /:token/submit:', err.message);
    return res.status(500).json({ error: 'Erro ao registrar resposta.' });
  } finally {
    client.release();
  }
});

module.exports = router;
