const BASE_URL = 'http://72.61.37.70:4444';
const EMAIL = 'admin@admin.com';
const PASSWORD = 'admin123'; // Senha padrao

async function runTest() {
  console.log('Iniciando teste automatizado na VPS...');
  let token = '';
  
  // 1. Login
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Falha no login');
    token = data.token;
    console.log('✅ Login realizado com sucesso.');
  } catch (err) {
    console.error('❌ Erro no login:', err.message);
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  let surveyId, questionId, optionId;

  // 2. Criar Pesquisa
  try {
    const res = await fetch(`${BASE_URL}/api/admin/surveys`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: 'Pesquisa de Teste Automático' })
    });
    const data = await res.json();
    surveyId = data.id;
    console.log(`✅ Pesquisa criada (ID: ${surveyId}).`);
  } catch (err) {
    console.error('❌ Erro ao criar pesquisa:', err);
    return;
  }

  // 3. Adicionar Pergunta
  try {
    const res = await fetch(`${BASE_URL}/api/admin/surveys/${surveyId}/questions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ question_text: 'Qual sua cor favorita?', type: 'single_choice' })
    });
    const data = await res.json();
    questionId = data.id;
    console.log(`✅ Pergunta criada (ID: ${questionId}).`);
  } catch (err) {
    console.error('❌ Erro ao criar pergunta:', err);
  }

  // 4. Adicionar Opção
  try {
    const res = await fetch(`${BASE_URL}/api/admin/questions/${questionId}/options`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ option_text: 'Azul', image_url: null })
    });
    const data = await res.json();
    optionId = data.id;
    console.log(`✅ Opção criada (ID: ${optionId}).`);
  } catch (err) {
    console.error('❌ Erro ao criar opção:', err);
  }

  // 5. Testar o novo endpoint PUT (Atualizar opção)
  try {
    const res = await fetch(`${BASE_URL}/api/admin/options/${optionId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ option_text: 'Azul Claro', image_url: 'https://exemplo.com/azul.png' })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    if (data.option_text === 'Azul Claro' && data.image_url === 'https://exemplo.com/azul.png') {
      console.log(`✅ Endpoint de edição (PUT) funcionando perfeitamente!`);
    } else {
      console.log(`❌ Erro: Endpoint retornou dados diferentes:`, data);
    }
  } catch (err) {
    console.error('❌ Erro ao editar opção (O endpoint novo foi aplicado na VPS?):', err.message);
  }

  // 6. Limpar (Deletar Pesquisa)
  try {
    await fetch(`${BASE_URL}/api/admin/surveys/${surveyId}`, { method: 'DELETE', headers });
    console.log(`✅ Pesquisa de teste excluída com sucesso.`);
  } catch (err) {
    console.error('❌ Erro ao excluir pesquisa:', err);
  }

  console.log('Fim do teste.');
}

runTest();
