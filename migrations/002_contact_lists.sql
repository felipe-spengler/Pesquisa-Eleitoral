-- =====================================================
-- Pesquisa Eleitoral — Migration 002: Listas de Contatos
-- =====================================================

CREATE TABLE IF NOT EXISTS contact_lists (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Adicionar list_id na tabela contacts referenciando a lista
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS list_id INT REFERENCES contact_lists(id) ON DELETE SET NULL;

-- Criar índice para busca rápida por lista
CREATE INDEX IF NOT EXISTS idx_contacts_list ON contacts(list_id);
