-- =====================================================
-- Pesquisa Eleitoral — DDL Inicial (Migration 001)
-- =====================================================

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS surveys (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    survey_id INT REFERENCES surveys(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('single_choice', 'multiple_choice', 'text')),
    order_index INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS options (
    id SERIAL PRIMARY KEY,
    question_id INT REFERENCES questions(id) ON DELETE CASCADE,
    option_text VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(150),
    phone VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS dispatch_tokens (
    id SERIAL PRIMARY KEY,
    survey_id INT REFERENCES surveys(id) ON DELETE CASCADE,
    contact_id INT REFERENCES contacts(id) ON DELETE CASCADE,
    token VARCHAR(64) UNIQUE NOT NULL,
    channel VARCHAR(10) CHECK (channel IN ('whatsapp', 'email')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'answered')),
    sent_at TIMESTAMP,
    answered_at TIMESTAMP,
    client_ip VARCHAR(45)
);

CREATE TABLE IF NOT EXISTS responses (
    id SERIAL PRIMARY KEY,
    survey_id INT REFERENCES surveys(id) ON DELETE CASCADE,
    question_id INT REFERENCES questions(id) ON DELETE CASCADE,
    option_id INT REFERENCES options(id) ON DELETE SET NULL,
    text_answer TEXT,
    token_id INT REFERENCES dispatch_tokens(id) ON DELETE SET NULL,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_dispatch_tokens_token ON dispatch_tokens(token);
CREATE INDEX IF NOT EXISTS idx_dispatch_tokens_survey ON dispatch_tokens(survey_id);
CREATE INDEX IF NOT EXISTS idx_responses_survey ON responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_responses_question ON responses(question_id);
CREATE INDEX IF NOT EXISTS idx_questions_survey ON questions(survey_id);
