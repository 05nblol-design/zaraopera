-- Tabela para contadores de produção diários
CREATE TABLE IF NOT EXISTS production_counters (
    id SERIAL PRIMARY KEY,
    machine_id INTEGER NOT NULL,
    count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE
);

-- Tabela para popups de notificação de produção
CREATE TABLE IF NOT EXISTS production_popups (
    id SERIAL PRIMARY KEY,
    machine_id INTEGER NOT NULL,
    production_count INTEGER NOT NULL,
    threshold INTEGER NOT NULL,
    message TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    acknowledged_at TIMESTAMP NULL,
    acknowledged_by INTEGER NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE,
    FOREIGN KEY (acknowledged_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_production_counters_machine_date ON production_counters(machine_id, DATE(created_at));
CREATE INDEX IF NOT EXISTS idx_production_popups_machine_active ON production_popups(machine_id, is_active);
CREATE INDEX IF NOT EXISTS idx_production_alerts_machine_active ON production_alerts(machine_id, is_active);

-- Comentários
COMMENT ON TABLE production_counters IS 'Contadores diários de produção por máquina';
COMMENT ON TABLE production_popups IS 'Popups de notificação para operadores quando atingir limite de produção';
COMMENT ON COLUMN production_counters.count IS 'Quantidade de produtos produzidos no dia';
COMMENT ON COLUMN production_popups.threshold IS 'Limite configurado que gerou o popup';
COMMENT ON COLUMN production_popups.acknowledged_at IS 'Quando o popup foi reconhecido pelo operador';