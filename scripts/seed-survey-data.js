'use strict';
require('dotenv').config();
const { pool } = require('./src/config/db');
const crypto = require('crypto');

async function run() {
  try {
    const surveyId = 1;
    // 1. Check if survey exists
    const surveyCheck = await pool.query('SELECT id FROM surveys WHERE id = $1', [surveyId]);
    if (surveyCheck.rows.length === 0) {
      console.error('Erro: Pesquisa com ID 1 não existe.');
      process.exit(1);
    }

    console.log('Inserindo perguntas para a pesquisa Toledo 2026 (ID 1)...');

    // Clean up existing questions and options for this survey to start fresh/avoid duplication
    await pool.query('DELETE FROM questions WHERE survey_id = $1', [surveyId]);

    // Question 1: Região / Bairro (single_choice)
    const q1 = await pool.query(
      'INSERT INTO questions (survey_id, question_text, type, order_index) VALUES ($1, $2, $3, $4) RETURNING id',
      [surveyId, 'Em qual região ou bairro da cidade você mora?', 'single_choice', 1]
    );
    const q1Id = q1.rows[0].id;
    const q1Options = [
      'Centro', 'Jardim La Salle', 'Vila Industrial', 'Jardim Coopagro',
      'Jardim Porto Alegre', 'Jardim Panorama', 'Jardim Santa Maria',
      'Jardim Gisela', 'Jardim América', 'Vila Pionera', 'Jardim Europa',
      'Jardim Maracanã', 'Jardim Concórdia', 'Jardim Bressan', 'Jardim Pancera',
      'Vila Operária', 'Jardim São Francisco', 'Tocantins', 'Grande Pioneiro',
      'Distrito de Novo Sarandi', 'Distrito de Vila Nova', 'Distrito de Novo Sobradinho',
      'Distrito de São Luiz do Oeste', 'Distrito de Dez de Maio'
    ];
    const q1OptIds = {};
    for (const opt of q1Options) {
      const res = await pool.query('INSERT INTO options (question_id, option_text) VALUES ($1, $2) RETURNING id', [q1Id, opt]);
      q1OptIds[opt] = res.rows[0].id;
    }

    // Question 2: Avaliação da Gestão Atual (single_choice)
    const q2 = await pool.query(
      'INSERT INTO questions (survey_id, question_text, type, order_index) VALUES ($1, $2, $3, $4) RETURNING id',
      [surveyId, 'Como você avalia a atual administração da prefeitura?', 'single_choice', 2]
    );
    const q2Id = q2.rows[0].id;
    const q2Options = ['Ótima', 'Boa', 'Regular', 'Ruim', 'Péssima', 'Não sei / Não quero responder'];
    const q2OptIds = {};
    for (const opt of q2Options) {
      const res = await pool.query('INSERT INTO options (question_id, option_text) VALUES ($1, $2) RETURNING id', [q2Id, opt]);
      q2OptIds[opt] = res.rows[0].id;
    }

    // Question 3: Intenção de Voto Estimulada (Prefeito) (single_choice)
    const q3 = await pool.query(
      'INSERT INTO questions (survey_id, question_text, type, order_index) VALUES ($1, $2, $3, $4) RETURNING id',
      [surveyId, 'Se as eleições para Prefeito fossem hoje, em qual destes candidatos você votaria?', 'single_choice', 3]
    );
    const q3Id = q3.rows[0].id;
    const q3Options = [
      'Candidato Alfa (Partido do Sol)',
      'Candidato Beta (Partido da União)',
      'Candidata Gama (Partido do Futuro)',
      'Candidato Delta (Partido Renovação)',
      'Branco / Nulo',
      'Indeciso / Não sei'
    ];
    const q3OptIds = {};
    for (const opt of q3Options) {
      const res = await pool.query('INSERT INTO options (question_id, option_text) VALUES ($1, $2) RETURNING id', [q3Id, opt]);
      q3OptIds[opt] = res.rows[0].id;
    }

    // Question 4: Principais Problemas da Cidade (multiple_choice)
    const q4 = await pool.query(
      'INSERT INTO questions (survey_id, question_text, type, order_index) VALUES ($1, $2, $3, $4) RETURNING id',
      [surveyId, 'Na sua opinião, quais são as áreas prioritárias que precisam de investimento urgente? (Selecione até 2 opções)', 'multiple_choice', 4]
    );
    const q4Id = q4.rows[0].id;
    const q4Options = [
      'Saúde e Postos de Atendimento',
      'Segurança Pública',
      'Educação e Creches',
      'Asfalto, Buracos e Transporte Público',
      'Geração de Emprego e Renda',
      'Iluminação e Limpeza Urbana'
    ];
    const q4OptIds = {};
    for (const opt of q4Options) {
      const res = await pool.query('INSERT INTO options (question_id, option_text) VALUES ($1, $2) RETURNING id', [q4Id, opt]);
      q4OptIds[opt] = res.rows[0].id;
    }

    // Question 5: Sugestão Aberta (text)
    const q5 = await pool.query(
      'INSERT INTO questions (survey_id, question_text, type, order_index) VALUES ($1, $2, $3, $4) RETURNING id',
      [surveyId, 'Qual é a sua principal sugestão de melhoria para o seu bairro?', 'text', 5]
    );
    const q5Id = q5.rows[0].id;

    console.log('Perguntas e opções inseridas com sucesso!');

    // 4. Inserir contatos de teste e respostas
    console.log('Inserindo duas respostas de exemplo...');

    // Resposta 1: Maria da Silva
    const contact1 = await pool.query(
      'INSERT INTO contacts (name, email, phone) VALUES ($1, $2, $3) RETURNING id',
      ['Maria da Silva', 'maria.silva@example.com', '+5545999991111']
    );
    const c1Id = contact1.rows[0].id;
    const token1 = crypto.randomBytes(16).toString('hex');
    const tok1 = await pool.query(
      `INSERT INTO dispatch_tokens (survey_id, contact_id, token, channel, status, sent_at, answered_at, client_ip)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), $6) RETURNING id`,
      [surveyId, c1Id, token1, 'whatsapp', 'answered', '127.0.0.1']
    );
    const t1Id = tok1.rows[0].id;

    // Resposta 1 - Q1: Centro
    await pool.query('INSERT INTO responses (survey_id, question_id, option_id, text_answer, token_id, ip_address) VALUES ($1, $2, $3, $4, $5, $6)',
      [surveyId, q1Id, q1OptIds['Centro'], null, t1Id, '127.0.0.1']);
    // Resposta 1 - Q2: Ótima
    await pool.query('INSERT INTO responses (survey_id, question_id, option_id, text_answer, token_id, ip_address) VALUES ($1, $2, $3, $4, $5, $6)',
      [surveyId, q2Id, q2OptIds['Ótima'], null, t1Id, '127.0.0.1']);
    // Resposta 1 - Q3: Candidato Alfa (Partido do Sol)
    await pool.query('INSERT INTO responses (survey_id, question_id, option_id, text_answer, token_id, ip_address) VALUES ($1, $2, $3, $4, $5, $6)',
      [surveyId, q3Id, q3OptIds['Candidato Alfa (Partido do Sol)'], null, t1Id, '127.0.0.1']);
    // Resposta 1 - Q4: Saúde e Postos de Atendimento e Educação e Creches
    await pool.query('INSERT INTO responses (survey_id, question_id, option_id, text_answer, token_id, ip_address) VALUES ($1, $2, $3, $4, $5, $6)',
      [surveyId, q4Id, q4OptIds['Saúde e Postos de Atendimento'], null, t1Id, '127.0.0.1']);
    await pool.query('INSERT INTO responses (survey_id, question_id, option_id, text_answer, token_id, ip_address) VALUES ($1, $2, $3, $4, $5, $6)',
      [surveyId, q4Id, q4OptIds['Educação e Creches'], null, t1Id, '127.0.0.1']);
    // Resposta 1 - Q5: Mais médicos nos postos de saúde.
    await pool.query('INSERT INTO responses (survey_id, question_id, option_id, text_answer, token_id, ip_address) VALUES ($1, $2, $3, $4, $5, $6)',
      [surveyId, q5Id, null, 'Mais médicos nos postos de saúde.', t1Id, '127.0.0.1']);


    // Resposta 2: José dos Santos
    const contact2 = await pool.query(
      'INSERT INTO contacts (name, email, phone) VALUES ($1, $2, $3) RETURNING id',
      ['José dos Santos', 'jose.santos@example.com', '+5545999992222']
    );
    const c2Id = contact2.rows[0].id;
    const token2 = crypto.randomBytes(16).toString('hex');
    const tok2 = await pool.query(
      `INSERT INTO dispatch_tokens (survey_id, contact_id, token, channel, status, sent_at, answered_at, client_ip)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), $6) RETURNING id`,
      [surveyId, c2Id, token2, 'email', 'answered', '127.0.0.1']
    );
    const t2Id = tok2.rows[0].id;

    // Resposta 2 - Q1: Jardim La Salle
    await pool.query('INSERT INTO responses (survey_id, question_id, option_id, text_answer, token_id, ip_address) VALUES ($1, $2, $3, $4, $5, $6)',
      [surveyId, q1Id, q1OptIds['Jardim La Salle'], null, t2Id, '127.0.0.1']);
    // Resposta 2 - Q2: Regular
    await pool.query('INSERT INTO responses (survey_id, question_id, option_id, text_answer, token_id, ip_address) VALUES ($1, $2, $3, $4, $5, $6)',
      [surveyId, q2Id, q2OptIds['Regular'], null, t2Id, '127.0.0.1']);
    // Resposta 2 - Q3: Candidata Gama (Partido do Futuro)
    await pool.query('INSERT INTO responses (survey_id, question_id, option_id, text_answer, token_id, ip_address) VALUES ($1, $2, $3, $4, $5, $6)',
      [surveyId, q3Id, q3OptIds['Candidata Gama (Partido do Futuro)'], null, t2Id, '127.0.0.1']);
    // Resposta 2 - Q4: Segurança Pública e Asfalto, Buracos e Transporte Público
    await pool.query('INSERT INTO responses (survey_id, question_id, option_id, text_answer, token_id, ip_address) VALUES ($1, $2, $3, $4, $5, $6)',
      [surveyId, q4Id, q4OptIds['Segurança Pública'], null, t2Id, '127.0.0.1']);
    await pool.query('INSERT INTO responses (survey_id, question_id, option_id, text_answer, token_id, ip_address) VALUES ($1, $2, $3, $4, $5, $6)',
      [surveyId, q4Id, q4OptIds['Asfalto, Buracos e Transporte Público'], null, t2Id, '127.0.0.1']);
    // Resposta 2 - Q5: Melhorar a iluminação da praça central.
    await pool.query('INSERT INTO responses (survey_id, question_id, option_id, text_answer, token_id, ip_address) VALUES ($1, $2, $3, $4, $5, $6)',
      [surveyId, q5Id, null, 'Melhorar a iluminação da praça central.', t2Id, '127.0.0.1']);

    console.log('Duas respostas de exemplo inseridas com sucesso!');


    // 5. Criar link para alguém responder
    console.log('Gerando token de link ativo para testes...');
    const contactTest = await pool.query(
      'INSERT INTO contacts (name, email, phone) VALUES ($1, $2, $3) RETURNING id',
      ['Contratante Teste', 'contratante@teste.com', '+5545999993333']
    );
    const cTestId = contactTest.rows[0].id;
    const tokenTest = crypto.randomBytes(16).toString('hex');
    await pool.query(
      `INSERT INTO dispatch_tokens (survey_id, contact_id, token, channel, status, sent_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [surveyId, cTestId, tokenTest, 'whatsapp', 'pending']
    );

    const baseUrl = process.env.APP_URL || 'https://pesquisa.techinteligente.site';
    const testLink = `${baseUrl}/survey/${tokenTest}`;

    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║  🎉 Link gerado com sucesso para testes do contratante!             ║');
    console.log(`║  Link: ${testLink} ║`);
    console.log('╚══════════════════════════════════════════════════════════════════════╝');
    console.log('');

  } catch (err) {
    console.error('Erro durante o seeding da pesquisa:', err.message);
  } finally {
    await pool.end();
  }
}

run();
