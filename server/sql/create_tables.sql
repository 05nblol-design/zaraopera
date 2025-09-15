-- Script SQL para criar todas as tabelas no PostgreSQL
-- Baseado no schema Prisma

-- Criar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela de usuários
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    avatar VARCHAR(255),
    badge_number VARCHAR(50) UNIQUE,
    role VARCHAR(50) DEFAULT 'OPERATOR',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de máquinas
CREATE TABLE machines (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    code VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'STOPPED',
    location VARCHAR(255),
    model VARCHAR(255),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    production_speed FLOAT DEFAULT 0,
    target_production FLOAT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de configurações de máquina
CREATE TABLE machine_configs (
    id SERIAL PRIMARY KEY,
    machine_id INTEGER UNIQUE NOT NULL,
    general TEXT,
    operational TEXT,
    alerts TEXT,
    quality TEXT,
    maintenance TEXT,
    tipo_material VARCHAR(255),
    produto VARCHAR(255),
    lote VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE
);

-- Tabela de operações de máquina
CREATE TABLE machine_operations (
    id SERIAL PRIMARY KEY,
    machine_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (machine_id) REFERENCES machines(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Tabela de configurações de teste de qualidade
CREATE TABLE quality_test_configs (
    id SERIAL PRIMARY KEY,
    machine_id INTEGER NOT NULL,
    test_name VARCHAR(255) NOT NULL,
    test_description TEXT,
    test_frequency INTEGER DEFAULT 100,
    products_per_test INTEGER DEFAULT 1,
    is_required BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    min_pass_rate FLOAT DEFAULT 95.0,
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Tabela de testes de qualidade
CREATE TABLE quality_tests (
    id SERIAL PRIMARY KEY,
    machine_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    config_id INTEGER,
    operator_id INTEGER,
    is_required BOOLEAN DEFAULT false,
    product VARCHAR(255) NOT NULL,
    lot VARCHAR(255) NOT NULL,
    box_number VARCHAR(255) NOT NULL,
    package_size VARCHAR(255) NOT NULL,
    package_width FLOAT NOT NULL,
    bottom_size FLOAT NOT NULL,
    side_size FLOAT NOT NULL,
    zipper_distance FLOAT NOT NULL,
    facilitator_distance FLOAT NOT NULL,
    ruler_test_done BOOLEAN DEFAULT false,
    hermeticity_test_done BOOLEAN DEFAULT false,
    visual_inspection BOOLEAN,
    dimensional_check BOOLEAN,
    color_consistency BOOLEAN,
    surface_quality BOOLEAN,
    adhesion_test BOOLEAN,
    approved BOOLEAN NOT NULL,
    observations TEXT,
    images TEXT DEFAULT '[]',
    videos TEXT DEFAULT '[]',
    test_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (machine_id) REFERENCES machines(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (config_id) REFERENCES quality_test_configs(id),
    FOREIGN KEY (operator_id) REFERENCES users(id)
);

-- Tabela de mudanças de teflon
CREATE TABLE teflon_changes (
    id SERIAL PRIMARY KEY,
    machine_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    change_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expiry_date TIMESTAMP NOT NULL,
    teflon_type VARCHAR(255) NOT NULL,
    observations TEXT,
    photos TEXT DEFAULT '[]',
    alert_sent BOOLEAN DEFAULT false,
    notification_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (machine_id) REFERENCES machines(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Tabela de notificações
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    machine_id INTEGER,
    test_id INTEGER,
    change_id INTEGER,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(100) NOT NULL,
    priority VARCHAR(50) DEFAULT 'MEDIUM',
    channels TEXT DEFAULT '["SYSTEM"]',
    read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,
    metadata TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (machine_id) REFERENCES machines(id)
);

-- Tabela de dispositivos de usuário
CREATE TABLE user_devices (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    device_info TEXT,
    active BOOLEAN DEFAULT true,
    last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, token)
);

-- Tabela de relatórios
CREATE TABLE reports (
    id SERIAL PRIMARY KEY,
    type VARCHAR(100) NOT NULL,
    period VARCHAR(100) NOT NULL,
    data TEXT NOT NULL,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de logs do sistema
CREATE TABLE system_logs (
    id SERIAL PRIMARY KEY,
    action VARCHAR(255) NOT NULL,
    user_id INTEGER,
    details TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de histórico de status de máquina
CREATE TABLE machine_status_history (
    id SERIAL PRIMARY KEY,
    machine_id INTEGER NOT NULL,
    user_id INTEGER,
    previous_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    reason TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Tabela de permissões de máquina
CREATE TABLE machine_permissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    machine_id INTEGER NOT NULL,
    can_view BOOLEAN DEFAULT true,
    can_operate BOOLEAN DEFAULT false,
    can_edit BOOLEAN DEFAULT false,
    granted_by INTEGER,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE,
    UNIQUE(user_id, machine_id)
);

-- Tabela de dados de turno
CREATE TABLE shift_data (
    id SERIAL PRIMARY KEY,
    machine_id INTEGER NOT NULL,
    operator_id INTEGER NOT NULL,
    shift_type VARCHAR(50) NOT NULL,
    shift_date TIMESTAMP NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    rotation_cycle INTEGER DEFAULT 1,
    rotation_day INTEGER DEFAULT 1,
    team_group VARCHAR(10),
    is_rest_day BOOLEAN DEFAULT false,
    total_production FLOAT DEFAULT 0,
    target_production FLOAT DEFAULT 0,
    efficiency FLOAT DEFAULT 0,
    downtime FLOAT DEFAULT 0,
    last_known_speed INTEGER,
    quality_tests INTEGER DEFAULT 0,
    approved_tests INTEGER DEFAULT 0,
    rejected_tests INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    is_archived BOOLEAN DEFAULT false,
    production_data TEXT,
    quality_data TEXT,
    maintenance_data TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    archived_at TIMESTAMP,
    FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE,
    FOREIGN KEY (operator_id) REFERENCES users(id),
    UNIQUE(machine_id, operator_id, shift_date, shift_type)
);

-- Tabela de arquivo de produção
CREATE TABLE production_archives (
    id SERIAL PRIMARY KEY,
    shift_data_id INTEGER UNIQUE NOT NULL,
    machine_id INTEGER NOT NULL,
    operator_id INTEGER NOT NULL,
    archive_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    archived_data TEXT NOT NULL,
    data_size INTEGER,
    checksum VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shift_data_id) REFERENCES shift_data(id) ON DELETE CASCADE,
    FOREIGN KEY (machine_id) REFERENCES machines(id),
    FOREIGN KEY (operator_id) REFERENCES users(id)
);

-- Tabela de alertas de produção
CREATE TABLE production_alerts (
    id SERIAL PRIMARY KEY,
    machine_id INTEGER NOT NULL,
    production_count INTEGER NOT NULL,
    products_per_test INTEGER NOT NULL,
    alert_type VARCHAR(100) DEFAULT 'PRODUCTION_LIMIT_EXCEEDED',
    severity VARCHAR(50) DEFAULT 'HIGH',
    message TEXT NOT NULL,
    target_roles TEXT DEFAULT '["MANAGER","LEADER","OPERATOR"]',
    is_active BOOLEAN DEFAULT true,
    is_resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP,
    resolved_by INTEGER,
    metadata TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE
);

-- Tabela de equipes de turno
CREATE TABLE shift_teams (
    id SERIAL PRIMARY KEY,
    team_code VARCHAR(10) UNIQUE NOT NULL,
    team_name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    current_cycle INTEGER DEFAULT 1,
    current_day INTEGER DEFAULT 1,
    current_shift_type VARCHAR(50) DEFAULT 'SHIFT_1',
    cycle_start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_rotation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    next_rotation TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de membros de equipe de turno
CREATE TABLE shift_team_members (
    id SERIAL PRIMARY KEY,
    team_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    is_leader BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES shift_teams(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(team_id, user_id)
);

-- Tabela de histórico de configuração de teste de qualidade
CREATE TABLE quality_test_config_history (
    id SERIAL PRIMARY KEY,
    config_id INTEGER NOT NULL,
    field_changed VARCHAR(255) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_by INTEGER,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reason TEXT,
    FOREIGN KEY (config_id) REFERENCES quality_test_configs(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Criar índices para melhor performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_badge_number ON users(badge_number);
CREATE INDEX idx_machines_code ON machines(code);
CREATE INDEX idx_quality_tests_machine_id ON quality_tests(machine_id);
CREATE INDEX idx_quality_tests_test_date ON quality_tests(test_date);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_shift_data_machine_id ON shift_data(machine_id);
CREATE INDEX idx_shift_data_shift_date ON shift_data(shift_date);
CREATE INDEX idx_production_alerts_machine_id ON production_alerts(machine_id);
CREATE INDEX idx_production_alerts_is_resolved ON production_alerts(is_resolved);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Criar triggers para updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_machines_updated_at BEFORE UPDATE ON machines FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_machine_configs_updated_at BEFORE UPDATE ON machine_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_machine_operations_updated_at BEFORE UPDATE ON machine_operations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_quality_tests_updated_at BEFORE UPDATE ON quality_tests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_teflon_changes_updated_at BEFORE UPDATE ON teflon_changes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_devices_updated_at BEFORE UPDATE ON user_devices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_machine_permissions_updated_at BEFORE UPDATE ON machine_permissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_shift_data_updated_at BEFORE UPDATE ON shift_data FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_production_alerts_updated_at BEFORE UPDATE ON production_alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_shift_teams_updated_at BEFORE UPDATE ON shift_teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_shift_team_members_updated_at BEFORE UPDATE ON shift_team_members FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_quality_test_configs_updated_at BEFORE UPDATE ON quality_test_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;