-- Inserir dados iniciais no PostgreSQL

-- Inserir usuários
INSERT INTO users (email, password, name, role, is_active) VALUES
('admin@zara.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Administrador', 'ADMIN', true),
('operador@zara.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Operador', 'OPERATOR', true),
('lider@zara.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Líder', 'LEADER', true);

-- Inserir máquinas
INSERT INTO machines (name, code, status, location, model, description, production_speed, target_production) VALUES
('Máquina 1', 'M001', 'STOPPED', 'Setor A', 'Modelo X1', 'Máquina de produção principal', 0, 1000),
('Máquina 2', 'M002', 'STOPPED', 'Setor B', 'Modelo X2', 'Máquina de produção secundária', 0, 800);

-- Inserir configurações de máquina
INSERT INTO machine_configs (machine_id, general, operational, alerts, quality, maintenance) VALUES
(1, '{"temperatura": 25, "pressao": 1.2}', '{"velocidade": 100, "modo": "automatico"}', '{"temperatura_max": 80, "pressao_max": 2.0}', '{"tolerancia": 0.1}', '{"proxima_manutencao": "2024-02-01"}'),
(2, '{"temperatura": 23, "pressao": 1.1}', '{"velocidade": 80, "modo": "automatico"}', '{"temperatura_max": 75, "pressao_max": 1.8}', '{"tolerancia": 0.15}', '{"proxima_manutencao": "2024-02-15"}');

-- Inserir algumas notificacoes de exemplo
INSERT INTO notifications (user_id, title, message, type, priority, read) VALUES
(1, 'Sistema Iniciado', 'O sistema foi iniciado com sucesso', 'SYSTEM', 'LOW', false),
(2, 'Maquina Disponivel', 'Maquina 1 esta disponivel para operacao', 'MACHINE', 'MEDIUM', false),
(1, 'Relatorio Diario', 'Relatorio diario de producao disponivel', 'REPORT', 'LOW', false);

-- Inserir turnos padrão
INSERT INTO shifts (name, start_time, end_time, is_active) VALUES
('Turno Manhã', '06:00:00', '14:00:00', true),
('Turno Tarde', '14:00:00', '22:00:00', true),
('Turno Noite', '22:00:00', '06:00:00', true);

COMMIT;