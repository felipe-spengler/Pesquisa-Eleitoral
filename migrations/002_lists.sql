-- =====================================================
-- Pesquisa Eleitoral — Gestão de Listas (Migration 002)
-- =====================================================

CREATE TABLE IF NOT EXISTS contact_lists (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS list_id INT REFERENCES contact_lists(id) ON DELETE CASCADE;
