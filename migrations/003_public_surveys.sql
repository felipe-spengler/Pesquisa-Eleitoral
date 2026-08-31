-- =====================================================
-- Migration 003: Suporte a Pesquisas Públicas (Fingerprint)
-- =====================================================

ALTER TABLE responses ADD COLUMN IF NOT EXISTS visitor_id VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_responses_visitor ON responses(visitor_id);
