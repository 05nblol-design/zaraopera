-- Tabela para configurações de canais de alerta por usuário
CREATE TABLE IF NOT EXISTS alert_channels (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email BOOLEAN DEFAULT true,
    sms BOOLEAN DEFAULT false,
    whatsapp BOOLEAN DEFAULT false,
    sound BOOLEAN DEFAULT true,
    min_priority VARCHAR(20) DEFAULT 'normal' CHECK (min_priority IN ('info', 'warning', 'critical')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Tabela para registrar todos os alertas enviados
CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    machine_id INT NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    lote VARCHAR(50),
    caixa VARCHAR(50),
    type VARCHAR(50) NOT NULL, -- ex: teste, teflon, parada, validade
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('info', 'warning', 'critical')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB, -- dados adicionais específicos do alerta
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved')),
    acknowledged_at TIMESTAMP,
    acknowledged_by INT REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMP,
    resolved_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela para rastrear envios de notificações
CREATE TABLE IF NOT EXISTS notification_logs (
    id SERIAL PRIMARY KEY,
    alert_id INT NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp', 'push', 'sound')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'delivered')),
    error_message TEXT,
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_alerts_machine_id ON alerts(machine_id);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(type);
CREATE INDEX IF NOT EXISTS idx_alerts_priority ON alerts(priority);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_alerts_lote ON alerts(lote);
CREATE INDEX IF NOT EXISTS idx_notification_logs_alert_id ON notification_logs(alert_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id ON notification_logs(user_id);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_alert_channels_updated_at BEFORE UPDATE ON alert_channels FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_alerts_updated_at BEFORE UPDATE ON alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Inserir configurações padrão para usuários existentes
INSERT INTO alert_channels (user_id, email, sms, whatsapp, sound, min_priority)
SELECT id, true, false, false, true, 'info'
FROM users
WHERE id NOT IN (SELECT user_id FROM alert_channels)
ON CONFLICT (user_id) DO NOTHING;

-- Comentários para documentação
COMMENT ON TABLE alert_channels IS 'Configurações de canais de notificação por usuário';
COMMENT ON TABLE alerts IS 'Registro de todos os alertas do sistema';
COMMENT ON TABLE notification_logs IS 'Log de envios de notificações por canal';
COMMENT ON COLUMN alerts.metadata IS 'Dados JSON com informações específicas do alerta';
COMMENT ON COLUMN alerts.status IS 'Status do alerta: active (ativo), acknowledged (reconhecido), resolved (resolvido)';
COMMENT ON COLUMN notification_logs.channel IS 'Canal de envio: email, sms, whatsapp, push, sound';