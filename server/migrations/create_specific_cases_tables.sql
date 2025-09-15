-- Tabela para rastreamento de testes de qualidade
CREATE TABLE IF NOT EXISTS quality_tests (
  id SERIAL PRIMARY KEY,
  machine_id INTEGER,
  test_type VARCHAR(100) NOT NULL,
  description TEXT,
  scheduled_date TIMESTAMP NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  priority VARCHAR(10) DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  assigned_to INTEGER,
  notified BOOLEAN DEFAULT false,
  notification_sent_at TIMESTAMP,
  completed_at TIMESTAMP,
  results TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela para rastreamento de teflon
CREATE TABLE IF NOT EXISTS teflon_tracking (
  id SERIAL PRIMARY KEY,
  machine_id INTEGER,
  teflon_type VARCHAR(100) NOT NULL,
  installation_date TIMESTAMP NOT NULL,
  last_change_date TIMESTAMP NOT NULL,
  usage_hours INTEGER DEFAULT 0,
  max_usage_hours INTEGER DEFAULT 2000,
  max_days INTEGER DEFAULT 90,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'needs_change', 'changed', 'inactive')),
  notified BOOLEAN DEFAULT false,
  notification_sent_at TIMESTAMP,
  changed_at TIMESTAMP,
  changed_by INTEGER,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela para rastreamento de validades
CREATE TABLE IF NOT EXISTS validity_tracking (
  id SERIAL PRIMARY KEY,
  item_name VARCHAR(200) NOT NULL,
  item_type VARCHAR(100) NOT NULL, -- 'material', 'product', 'chemical', 'tool', etc.
  item_code VARCHAR(100),
  batch_number VARCHAR(100),
  expiry_date DATE NOT NULL,
  location VARCHAR(200),
  supplier VARCHAR(200),
  quantity DECIMAL(10,2),
  unit VARCHAR(50),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'consumed', 'disposed')),
  notified BOOLEAN DEFAULT false,
  notification_sent_at TIMESTAMP,
  action_taken VARCHAR(200),
  action_date TIMESTAMP,
  responsible_user INTEGER,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_quality_tests_machine_status ON quality_tests(machine_id, status);
CREATE INDEX IF NOT EXISTS idx_quality_tests_scheduled_date ON quality_tests(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_quality_tests_notified ON quality_tests(notified, status);

CREATE INDEX IF NOT EXISTS idx_teflon_tracking_machine_status ON teflon_tracking(machine_id, status);
CREATE INDEX IF NOT EXISTS idx_teflon_tracking_usage ON teflon_tracking(usage_hours, max_usage_hours);
CREATE INDEX IF NOT EXISTS idx_teflon_tracking_notified ON teflon_tracking(notified, status);

CREATE INDEX IF NOT EXISTS idx_validity_tracking_expiry ON validity_tracking(expiry_date, status);
CREATE INDEX IF NOT EXISTS idx_validity_tracking_notified ON validity_tracking(notified, status);
CREATE INDEX IF NOT EXISTS idx_validity_tracking_type ON validity_tracking(item_type, status);

-- Triggers para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_quality_tests_updated_at BEFORE UPDATE ON quality_tests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teflon_tracking_updated_at BEFORE UPDATE ON teflon_tracking
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_validity_tracking_updated_at BEFORE UPDATE ON validity_tracking
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Inserir dados de exemplo para testes
INSERT INTO quality_tests (machine_id, test_type, description, scheduled_date, priority) VALUES
(1, 'Calibração', 'Teste de calibração mensal da máquina', NOW() - INTERVAL '2 hours', 'HIGH'),
(2, 'Pressão', 'Verificação de pressão do sistema', NOW() + INTERVAL '1 day', 'MEDIUM'),
(1, 'Temperatura', 'Teste de controle de temperatura', NOW() - INTERVAL '30 minutes', 'URGENT');

INSERT INTO teflon_tracking (machine_id, teflon_type, installation_date, last_change_date, usage_hours, max_usage_hours) VALUES
(1, 'Teflon Industrial A', '2024-01-15', '2024-01-15', 1950, 2000),
(2, 'Teflon Industrial B', '2024-02-01', '2024-02-01', 1800, 2000),
(3, 'Teflon Especial', '2023-12-01', '2023-12-01', 2100, 2000);

INSERT INTO validity_tracking (item_name, item_type, item_code, expiry_date, location, quantity, unit) VALUES
('Lubrificante Industrial XYZ', 'material', 'LUB001', CURRENT_DATE + INTERVAL '2 days', 'Almoxarifado A', 50.5, 'litros'),
('Tinta Especial ABC', 'material', 'TNT002', CURRENT_DATE - INTERVAL '1 day', 'Estoque B', 25.0, 'kg'),
('Produto Químico DEF', 'chemical', 'QUI003', CURRENT_DATE + INTERVAL '7 days', 'Área Restrita', 10.0, 'litros'),
('Ferramenta de Corte GHI', 'tool', 'FER004', CURRENT_DATE + INTERVAL '1 day', 'Oficina', 1.0, 'unidade');

-- Comentários para documentação
COMMENT ON TABLE quality_tests IS 'Tabela para rastreamento de testes de qualidade agendados e realizados';
COMMENT ON TABLE teflon_tracking IS 'Tabela para rastreamento do uso e troca de teflon nas máquinas';
COMMENT ON TABLE validity_tracking IS 'Tabela para rastreamento de validades de produtos, materiais e ferramentas';

COMMENT ON COLUMN quality_tests.test_type IS 'Tipo do teste (calibração, pressão, temperatura, etc.)';
COMMENT ON COLUMN teflon_tracking.usage_hours IS 'Horas de uso acumuladas desde a última troca';
COMMENT ON COLUMN validity_tracking.item_type IS 'Tipo do item (material, product, chemical, tool, etc.)';