'use strict';
const express = require('express');
const { query, getClient } = require('../config/db');

const router = express.Router();

// GET /api/survey/public/:id — Retornar pesquisa pública
router.get('/public/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const surveyRes = await query(
      `SELECT * FROM surveys WHERE id = $1`,
      [id]
    );

    if (!surveyRes.rows[0]) {
      return res.status(404).json({
        error: 'Pesquisa não encontrada.',
        code: 'NOT_FOUND',
      });
    }

    const survey = surveyRes.rows[0];

    if (!survey.is_active) {
      return res.status(403).json({
        error: 'Esta pesquisa está encerrada.',
        code: 'SURVEY_INACTIVE',
      });
    }

    // Buscar perguntas e opções
    const questionsRes = await query(
      'SELECT * FROM questions WHERE survey_id = $1 ORDER BY order_index ASC',
      [survey.id]
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
        id: survey.id,
        title: survey.title,
      },
      questions,
    });
  } catch (err) {
    console.error('[Survey] GET /public/:id:', err.message);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// POST /api/survey/public/:id/submit — Submeter respostas de link público com fingerprint
router.post('/public/:id/submit', async (req, res) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    const { answers, visitorId } = req.body;
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;

    if (!answers || !Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ error: 'Nenhuma resposta fornecida.' });
    }

    if (!visitorId || typeof visitorId !== 'string' || visitorId.length > 64) {
      return res.status(400).json({ error: 'Identificação de dispositivo inválida (Fingerprint necessário).' });
    }

    await client.query('BEGIN');

    const surveyRes = await client.query(
      `SELECT * FROM surveys WHERE id = $1 FOR SHARE`,
      [id]
    );

    if (!surveyRes.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pesquisa não encontrada.', code: 'NOT_FOUND' });
    }

    const survey = surveyRes.rows[0];

    if (!survey.is_active) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Esta pesquisa está encerrada.' });
    }

    // Verificar se visitorId já votou
    const checkRes = await client.query(
      `SELECT id FROM responses WHERE survey_id = $1 AND visitor_id = $2 LIMIT 1`,
      [id, visitorId]
    );

    if (checkRes.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        status: 'answered',
        error: 'Este aparelho já registrou uma resposta.',
        message: 'Sua resposta já foi registrada. Obrigado pela participação!',
      });
    }

    // Inserir respostas
    for (const answer of answers) {
      const { question_id, option_id = null, text_answer = null } = answer;
      if (!question_id) continue;

      await client.query(
        `INSERT INTO responses (survey_id, question_id, option_id, text_answer, visitor_id, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, question_id, option_id, text_answer, visitorId, clientIp]
      );
    }

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: 'Sua resposta foi registrada com sucesso. Obrigado pela participação!',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Survey] POST /public/:id/submit:', err.message);
    return res.status(500).json({ error: 'Erro ao registrar resposta.' });
  } finally {
    client.release();
  }
});

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
