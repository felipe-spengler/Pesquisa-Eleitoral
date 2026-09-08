-- =====================================================
-- Migration 004: Suporte a Imagens e Estilos Customizados
-- =====================================================

ALTER TABLE surveys ADD COLUMN IF NOT EXISTS theme_config JSON DEFAULT '{}';
ALTER TABLE options ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);
