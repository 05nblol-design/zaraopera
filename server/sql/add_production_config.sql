-- Adicionar coluna production na tabela machine_configs
ALTER TABLE machine_configs ADD COLUMN IF NOT EXISTS production TEXT DEFAULT '{}';

-- Comentário: Esta coluna armazenará as configurações de produção em formato JSON
-- Exemplo de estrutura JSON:
-- {
--   "popupThreshold": 100,
--   "alertThreshold": 500,
--   "enablePopups": true,
--   "enableAlerts": true
-- }