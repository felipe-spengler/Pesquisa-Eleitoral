'use strict';
const express = require('express');
const multer = require('multer');
const { parse } = require('csv-parse');
const { stringify } = require('csv-stringify/sync');
const { query } = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Todas as rotas de admin requerem autenticação
router.use(auth);

// =============================================
// SURVEYS — CRUD
// =============================================

// GET /api/admin/surveys
router.get('/surveys', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM surveys ORDER BY created_at DESC'
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[Admin] GET surveys:', err.message);
    return res.status(500).json({ error: 'Erro ao listar pesquisas.' });
  }
});

// GET /api/admin/surveys/:id
router.get('/surveys/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const surveyRes = await query('SELECT * FROM surveys WHERE id = $1', [id]);
    if (!surveyRes.rows[0]) return res.status(404).json({ error: 'Pesquisa não encontrada.' });

    const questionsRes = await query(
      'SELECT * FROM questions WHERE survey_id = $1 ORDER BY order_index ASC',
      [id]
    );

    const questions = await Promise.all(
      questionsRes.rows.map(async (q) => {
        const optionsRes = await query(
          'SELECT * FROM options WHERE question_id = $1 ORDER BY id ASC',
          [q.id]
        );
        return { ...q, options: optionsRes.rows };
      })
    );

    return res.json({ ...surveyRes.rows[0], questions });
  } catch (err) {
    console.error('[Admin] GET survey/:id:', err.message);
    return res.status(500).json({ error: 'Erro ao buscar pesquisa.' });
  }
});

// POST /api/admin/surveys
router.post('/surveys', async (req, res) => {
  try {
    const { title, is_active = true } = req.body;
    if (!title || title.trim() === '') {
      return res.status(400).json({ error: 'Título é obrigatório.' });
    }
    const result = await query(
      'INSERT INTO surveys (title, is_active) VALUES ($1, $2) RETURNING *',
      [title.trim(), is_active]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[Admin] POST surveys:', err.message);
    return res.status(500).json({ error: 'Erro ao criar pesquisa.' });
  }
});

// PUT /api/admin/surveys/:id
router.put('/surveys/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, is_active } = req.body;
    const result = await query(
      'UPDATE surveys SET title = COALESCE($1, title), is_active = COALESCE($2, is_active) WHERE id = $3 RETURNING *',
      [title, is_active, id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Pesquisa não encontrada.' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[Admin] PUT surveys/:id:', err.message);
    return res.status(500).json({ error: 'Erro ao atualizar pesquisa.' });
  }
});

// DELETE /api/admin/surveys/:id
router.delete('/surveys/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM surveys WHERE id = $1', [id]);
    return res.json({ message: 'Pesquisa excluída com sucesso.' });
  } catch (err) {
    console.error('[Admin] DELETE surveys/:id:', err.message);
    return res.status(500).json({ error: 'Erro ao excluir pesquisa.' });
  }
});

// =============================================
// QUESTIONS
// =============================================

// POST /api/admin/surveys/:surveyId/questions
router.post('/surveys/:surveyId/questions', async (req, res) => {
  try {
    const { surveyId } = req.params;
    const { question_text, type, order_index = 0, options = [] } = req.body;

    if (!question_text || !type) {
      return res.status(400).json({ error: 'question_text e type são obrigatórios.' });
    }
    if (!['single_choice', 'multiple_choice', 'text'].includes(type)) {
      return res.status(400).json({ error: 'Tipo inválido. Use: single_choice, multiple_choice, text.' });
    }

    const qRes = await query(
      'INSERT INTO questions (survey_id, question_text, type, order_index) VALUES ($1, $2, $3, $4) RETURNING *',
      [surveyId, question_text, type, order_index]
    );
    const question = qRes.rows[0];

    if (options.length > 0 && type !== 'text') {
      for (const opt of options) {
        if (opt.option_text && opt.option_text.trim()) {
          await query(
            'INSERT INTO options (question_id, option_text) VALUES ($1, $2)',
            [question.id, opt.option_text.trim()]
          );
        }
      }
    }

    const optionsRes = await query('SELECT * FROM options WHERE question_id = $1', [question.id]);
    return res.status(201).json({ ...question, options: optionsRes.rows });
  } catch (err) {
    console.error('[Admin] POST questions:', err.message);
    return res.status(500).json({ error: 'Erro ao criar pergunta.' });
  }
});

// PUT /api/admin/questions/:id
router.put('/questions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { question_text, type, order_index } = req.body;
    const result = await query(
      `UPDATE questions SET
        question_text = COALESCE($1, question_text),
        type = COALESCE($2, type),
        order_index = COALESCE($3, order_index)
       WHERE id = $4 RETURNING *`,
      [question_text, type, order_index, id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Pergunta não encontrada.' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[Admin] PUT questions/:id:', err.message);
    return res.status(500).json({ error: 'Erro ao atualizar pergunta.' });
  }
});

// DELETE /api/admin/questions/:id
router.delete('/questions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM questions WHERE id = $1', [id]);
    return res.json({ message: 'Pergunta excluída.' });
  } catch (err) {
    console.error('[Admin] DELETE questions/:id:', err.message);
    return res.status(500).json({ error: 'Erro ao excluir pergunta.' });
  }
});

// =============================================
// OPTIONS
// =============================================

// POST /api/admin/questions/:questionId/options
router.post('/questions/:questionId/options', async (req, res) => {
  try {
    const { questionId } = req.params;
    const { option_text } = req.body;
    if (!option_text || option_text.trim() === '') {
      return res.status(400).json({ error: 'option_text é obrigatório.' });
    }
    const result = await query(
      'INSERT INTO options (question_id, option_text) VALUES ($1, $2) RETURNING *',
      [questionId, option_text.trim()]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[Admin] POST options:', err.message);
    return res.status(500).json({ error: 'Erro ao criar opção.' });
  }
});

// DELETE /api/admin/options/:id
router.delete('/options/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM options WHERE id = $1', [id]);
    return res.json({ message: 'Opção excluída.' });
  } catch (err) {
    console.error('[Admin] DELETE options/:id:', err.message);
    return res.status(500).json({ error: 'Erro ao excluir opção.' });
  }
});

// =============================================
// CONTACTS — Import CSV
// =============================================

// GET /api/admin/contacts
router.get('/contacts', async (req, res) => {
  try {
    const result = await query('SELECT * FROM contacts ORDER BY id DESC LIMIT 500');
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao listar contatos.' });
  }
});

// POST /api/admin/contacts/import
router.post('/contacts/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Arquivo CSV não enviado.' });
    }

    const csvContent = req.file.buffer.toString('utf-8');
    const records = await new Promise((resolve, reject) => {
      parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });

    let imported = 0;
    let errors = 0;

    for (const row of records) {
      try {
        const name = row.nome || row.name || null;
        const email = row.email || null;
        const phone = row.telefone || row.phone || null;

        if (!name && !email && !phone) continue;

        await query(
          'INSERT INTO contacts (name, email, phone) VALUES ($1, $2, $3)',
          [name, email, phone]
        );
        imported++;
      } catch (e) {
        errors++;
      }
    }

    return res.json({
      message: `Importação concluída. ${imported} contatos importados, ${errors} erros.`,
      imported,
      errors,
    });
  } catch (err) {
    console.error('[Admin] CSV import:', err.message);
    return res.status(500).json({ error: `Erro ao processar CSV: ${err.message}` });
  }
});

// =============================================
// DASHBOARD — Resultados e Exportação
// =============================================

// GET /api/admin/surveys/:id/results
router.get('/surveys/:id/results', async (req, res) => {
  try {
    const { id } = req.params;

    const surveyRes = await query('SELECT * FROM surveys WHERE id = $1', [id]);
    if (!surveyRes.rows[0]) return res.status(404).json({ error: 'Pesquisa não encontrada.' });

    const totalTokensRes = await query(
      `SELECT COUNT(*) as total FROM dispatch_tokens WHERE survey_id = $1 AND status = 'answered'`,
      [id]
    );
    const totalAnswered = parseInt(totalTokensRes.rows[0].total, 10);

    const questionsRes = await query(
      'SELECT * FROM questions WHERE survey_id = $1 ORDER BY order_index ASC',
      [id]
    );

    const results = await Promise.all(
      questionsRes.rows.map(async (q) => {
        if (q.type === 'text') {
          const textRes = await query(
            'SELECT text_answer FROM responses WHERE question_id = $1 AND text_answer IS NOT NULL ORDER BY created_at DESC LIMIT 100',
            [q.id]
          );
          return {
            question: q,
            type: 'text',
            answers: textRes.rows.map((r) => r.text_answer),
          };
        }

        const optionsRes = await query(
          `SELECT o.id, o.option_text,
                  COUNT(r.id) AS votes
           FROM options o
           LEFT JOIN responses r ON r.option_id = o.id AND r.question_id = $1
           WHERE o.question_id = $1
           GROUP BY o.id, o.option_text
           ORDER BY votes DESC`,
          [q.id]
        );

        const totalVotes = optionsRes.rows.reduce((acc, o) => acc + parseInt(o.votes, 10), 0);

        const options = optionsRes.rows.map((o) => ({
          id: o.id,
          option_text: o.option_text,
          votes: parseInt(o.votes, 10),
          percentage: totalVotes > 0 ? ((parseInt(o.votes, 10) / totalVotes) * 100).toFixed(1) : '0.0',
        }));

        return { question: q, type: q.type, total_votes: totalVotes, options };
      })
    );

    const dispatchStatsRes = await query(
      `SELECT status, COUNT(*) as count FROM dispatch_tokens WHERE survey_id = $1 GROUP BY status`,
      [id]
    );

    return res.json({
      survey: surveyRes.rows[0],
      total_answered: totalAnswered,
      dispatch_stats: dispatchStatsRes.rows,
      questions: results,
    });
  } catch (err) {
    console.error('[Admin] GET results:', err.message);
    return res.status(500).json({ error: 'Erro ao buscar resultados.' });
  }
});

// GET /api/admin/surveys/:id/export
router.get('/surveys/:id/export', async (req, res) => {
  try {
    const { id } = req.params;

    const surveyRes = await query('SELECT title FROM surveys WHERE id = $1', [id]);
    if (!surveyRes.rows[0]) return res.status(404).json({ error: 'Pesquisa não encontrada.' });

    const rows = await query(
      `SELECT
         dt.token,
         c.name AS contact_name,
         c.email AS contact_email,
         c.phone AS contact_phone,
         dt.channel,
         dt.status,
         dt.sent_at,
         dt.answered_at,
         q.question_text,
         o.option_text,
         r.text_answer,
         r.ip_address,
         r.created_at AS response_at
       FROM responses r
       JOIN dispatch_tokens dt ON dt.id = r.token_id
       LEFT JOIN contacts c ON c.id = dt.contact_id
       JOIN questions q ON q.id = r.question_id
       LEFT JOIN options o ON o.id = r.option_id
       WHERE r.survey_id = $1
       ORDER BY dt.token, q.order_index`,
      [id]
    );

    const csvData = stringify(rows.rows, { header: true });

    const filename = `pesquisa_${id}_respostas_${Date.now()}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('BOM', '\uFEFF');
    return res.send('\uFEFF' + csvData);
  } catch (err) {
    console.error('[Admin] GET export:', err.message);
    return res.status(500).json({ error: 'Erro ao exportar respostas.' });
  }
});

// GET /api/admin/dispatch/status/:surveyId
router.get('/dispatch/status/:surveyId', async (req, res) => {
  try {
    const { surveyId } = req.params;
    const result = await query(
      `SELECT status, COUNT(*) as count FROM dispatch_tokens WHERE survey_id = $1 GROUP BY status`,
      [surveyId]
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao buscar status de disparo.' });
  }
});

module.exports = router;
