# 🗳️ Pesquisa Eleitoral

Sistema completo de pesquisa eleitoral com painel administrativo, motor de disparo assíncrono via WhatsApp/E-mail e formulário público com trava por token único.

---

## 🚀 Quick Start com Docker

### 1. Configure as variáveis de ambiente

```bash
cp .env.example .env
# Edite o .env com seus dados reais
```

### 2. Suba os serviços

```bash
docker-compose up --build -d
```

### 3. Crie o admin padrão

```bash
docker-compose exec app node scripts/seed-admin.js
```

### 4. Acesse o painel

```
http://localhost:4444/admin
Login: admin@admin.com
Senha: admin123
```

> ⚠️ **Troque a senha após o primeiro login!**

---

## 📁 Estrutura do Projeto

```
pesquisa-eleitoral/
├── src/
│   ├── config/
│   │   ├── db.js              # Pool PostgreSQL
│   │   └── redis.js           # Conexão Redis + BullMQ queue
│   ├── middleware/
│   │   └── auth.js            # Verificação JWT
│   ├── routes/
│   │   ├── auth.js            # POST /api/auth/login|logout
│   │   ├── admin.js           # /api/admin/* (CRUD + dashboard + exportação)
│   │   ├── survey.js          # /api/survey/:token (GET + POST submit)
│   │   └── dispatch.js        # POST /api/dispatch (202 + fila)
│   ├── workers/
│   │   └── dispatchWorker.js  # BullMQ Worker (WhatsApp + E-mail)
│   ├── utils/
│   │   ├── mailer.js          # Nodemailer helper
│   │   └── whatsapp.js        # Meta Cloud API helper
│   └── app.js                 # Express setup
├── public/
│   ├── admin/
│   │   ├── login.html         # Página de login
│   │   └── dashboard.html     # Painel SPA completo
│   ├── survey/
│   │   └── index.html         # Formulário público do eleitor
│   └── css/
│       ├── admin.css          # Tema dark premium admin
│       └── survey.css         # CSS do formulário eleitor
├── migrations/
│   └── 001_init.sql           # DDL completo das tabelas
├── scripts/
│   └── seed-admin.js          # Cria admin padrão
├── server.js                  # Entry point (auto-executa migrations)
├── Dockerfile                 # Multi-stage build
├── docker-compose.yaml        # 4 serviços: app, worker, postgres, redis
└── .env.example               # Template de variáveis
```

---

## 🔑 Variáveis de Ambiente

| Variável | Descrição |
|---|---|
| `PORT` | Porta da aplicação (padrão: **4444**) |
| `APP_URL` | URL pública para links dos tokens |
| `DATABASE_URL` | Connection string PostgreSQL |
| `REDIS_URL` | URL do Redis |
| `JWT_SECRET` | Chave secreta JWT |
| `META_WA_TOKEN` | Token de acesso Meta Cloud API |
| `META_PHONE_ID` | Phone Number ID da Meta |
| `META_TEMPLATE_NAME` | Nome do template WhatsApp aprovado |
| `SMTP_HOST` | Host SMTP |
| `SMTP_PORT` | Porta SMTP (587 ou 465) |
| `SMTP_USER` | Usuário SMTP |
| `SMTP_PASS` | Senha SMTP |
| `SMTP_FROM` | Remetente dos e-mails |

---

## 📡 Endpoints da API

### Autenticação
| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/login` | Login → retorna JWT |
| POST | `/api/auth/logout` | Logout (limpa cookie) |

### Admin (requer JWT)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/admin/surveys` | Listar pesquisas |
| POST | `/api/admin/surveys` | Criar pesquisa |
| GET | `/api/admin/surveys/:id` | Buscar pesquisa com perguntas |
| PUT | `/api/admin/surveys/:id` | Atualizar pesquisa |
| DELETE | `/api/admin/surveys/:id` | Excluir pesquisa |
| POST | `/api/admin/surveys/:id/questions` | Adicionar pergunta |
| PUT | `/api/admin/questions/:id` | Atualizar pergunta |
| DELETE | `/api/admin/questions/:id` | Excluir pergunta |
| POST | `/api/admin/questions/:id/options` | Adicionar opção |
| DELETE | `/api/admin/options/:id` | Excluir opção |
| GET | `/api/admin/contacts` | Listar contatos |
| POST | `/api/admin/contacts/import` | Importar CSV |
| GET | `/api/admin/surveys/:id/results` | Dashboard de apuração |
| GET | `/api/admin/surveys/:id/export` | Exportar CSV de respostas |
| GET | `/api/admin/dispatch/status/:id` | Status de disparo |

### Disparo (requer JWT)
| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/dispatch` | Iniciar disparo (retorna 202) |
| GET | `/api/dispatch/contacts` | Listar contatos para disparo |

### Formulário Público
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/survey/:token` | Validar token e retornar pesquisa |
| POST | `/api/survey/:token/submit` | Submeter respostas |

---

## 🧠 Regras de Negócio Implementadas

### Trava de Token Único
- Cada contato recebe um token UUID único por disparo
- Na submissão, usa `SELECT FOR UPDATE` para prevenir race conditions
- Status possíveis: `pending` → `sent` → `answered` (ou `failed`)

### Disparo Assíncrono
- `POST /api/dispatch` retorna **202 Accepted** imediatamente
- Jobs são inseridos no BullMQ com 3 tentativas e backoff exponencial
- Worker separado (`pesquisa_worker`) consome a fila com concorrência 5
- Falhas atualizam `dispatch_tokens.status = 'failed'`

### Template WhatsApp
O template precisa ser criado e aprovado no Meta Business Manager com:
- **Header param**: nome do contato
- **Body param**: URL do link de pesquisa
- **Button param**: URL do link de pesquisa

---

## 📊 Modelo do CSV para Importação de Contatos

```csv
nome,email,telefone
João Silva,joao@email.com,5511999998888
Maria Santos,maria@email.com,5511977776666
```

---

## 🛠️ Desenvolvimento Local (sem Docker)

```bash
# 1. Instalar dependências
npm install

# 2. Configurar .env com PostgreSQL e Redis locais

# 3. Iniciar servidor
npm run dev

# 4. Iniciar worker (terminal separado)
npm run worker

# 5. Seed admin
npm run seed
```

---

## 🏥 Health Check

```bash
curl http://localhost:4444/api/health
# → { "status": "ok", "timestamp": "...", "port": 4444 }
```

---

## 🐳 Serviços Docker

| Serviço | Container | Porta Externa |
|---|---|---|
| App | `pesquisa_app` | **4444** |
| Worker | `pesquisa_worker` | — |
| PostgreSQL | `pesquisa_postgres` | `127.0.0.1:5435` |
| Redis | `pesquisa_redis` | `127.0.0.1:6380` |

> PostgreSQL e Redis não são expostos publicamente — apenas acessíveis internamente e via localhost para administração.
