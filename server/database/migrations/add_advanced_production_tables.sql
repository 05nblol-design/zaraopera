-- Migração para adicionar tabelas de produção avançada
-- Data: 2024
-- Descrição: Adiciona suporte para histórico de BPM e produção avançada com escala 3x3

-- Tabela para histórico de mudanças de BPM
CREATE TABLE IF NOT EXISTS production_bmp_history (
    id SERIAL PRIMARY KEY,
    machine_id INTEGER NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    bmp_value DECIMAL(10,2) NOT NULL DEFAULT 0,
    previous_bmp DECIMAL(10,2) DEFAULT 0,
    changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    shift_type VARCHAR(20) DEFAULT 'MORNING',
    team_group VARCHAR(10),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_production_bmp_history_machine_id ON production_bmp_history(machine_id);
CREATE INDEX IF NOT EXISTS idx_production_bmp_history_changed_at ON production_bmp_history(changed_at);
CREATE INDEX IF NOT EXISTS idx_production_bmp_history_team_group ON production_bmp_history(team_group);
CREATE INDEX IF NOT EXISTS idx_production_bmp_history_shift_type ON production_bmp_history(shift_type);

-- Tabela para equipes de turno 3x3
CREATE TABLE IF NOT EXISTS shift_teams (
    id SERIAL PRIMARY KEY,
    team_code VARCHAR(10) UNIQUE NOT NULL, -- A, B, C, D
    team_name VARCHAR(100) NOT NULL,
    shift_pattern VARCHAR(50) DEFAULT '3x3', -- Padrão 3x3
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela para membros das equipes
CREATE TABLE IF NOT EXISTS shift_team_members (
    id SERIAL PRIMARY KEY,
    team_id INTEGER NOT NULL REFERENCES shift_teams(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_in_team VARCHAR(50) DEFAULT 'OPERATOR', -- OPERATOR, LEADER, SUPERVISOR
    is_active BOOLEAN DEFAULT true,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para membros das equipes
CREATE INDEX IF NOT EXISTS idx_shift_team_members_team_id ON shift_team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_shift_team_members_user_id ON shift_team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_shift_team_members_active ON shift_team_members(is_active);

-- Constraint para evitar usuário em múltiplas equipes ativas
CREATE UNIQUE INDEX IF NOT EXISTS idx_shift_team_members_unique_active 
ON shift_team_members(user_id) 
WHERE is_active = true;

-- Tabela para cronograma de turnos 3x3
CREATE TABLE IF NOT EXISTS shift_schedule_3x3 (
    id SERIAL PRIMARY KEY,
    team_id INTEGER NOT NULL REFERENCES shift_teams(id) ON DELETE CASCADE,
    schedule_date DATE NOT NULL,
    shift_type VARCHAR(20) NOT NULL, -- MORNING, NIGHT
    is_working_day BOOLEAN NOT NULL DEFAULT true,
    cycle_day INTEGER NOT NULL, -- 1-12 (ciclo de 12 dias)
    work_pattern VARCHAR(10) NOT NULL, -- WORK, REST
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para cronograma
CREATE INDEX IF NOT EXISTS idx_shift_schedule_3x3_team_date ON shift_schedule_3x3(team_id, schedule_date);
CREATE INDEX IF NOT EXISTS idx_shift_schedule_3x3_date ON shift_schedule_3x3(schedule_date);
CREATE INDEX IF NOT EXISTS idx_shift_schedule_3x3_shift_type ON shift_schedule_3x3(shift_type);

-- Constraint para evitar duplicatas
CREATE UNIQUE INDEX IF NOT EXISTS idx_shift_schedule_3x3_unique 
ON shift_schedule_3x3(team_id, schedule_date, shift_type);

-- Adicionar colunas à tabela shift_data existente para suporte 3x3
ALTER TABLE shift_data 
ADD COLUMN IF NOT EXISTS team_group VARCHAR(10),
ADD COLUMN IF NOT EXISTS shift_pattern VARCHAR(50) DEFAULT '3x3',
ADD COLUMN IF NOT EXISTS cycle_day INTEGER,
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

-- Índices adicionais para shift_data
CREATE INDEX IF NOT EXISTS idx_shift_data_team_group ON shift_data(team_group);
CREATE INDEX IF NOT EXISTS idx_shift_data_archived ON shift_data(is_archived);
CREATE INDEX IF NOT EXISTS idx_shift_data_cycle_day ON shift_data(cycle_day);

-- Tabela para arquivos de produção (backup de turnos finalizados)
CREATE TABLE IF NOT EXISTS production_archives (
    id SERIAL PRIMARY KEY,
    shift_data_id INTEGER NOT NULL REFERENCES shift_data(id) ON DELETE CASCADE,
    machine_id INTEGER NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    operator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    archived_data JSONB NOT NULL, -- Dados completos do turno arquivado
    data_size INTEGER DEFAULT 0, -- Tamanho dos dados em bytes
    archive_reason VARCHAR(100) DEFAULT 'SHIFT_END',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para arquivos
CREATE INDEX IF NOT EXISTS idx_production_archives_machine_id ON production_archives(machine_id);
CREATE INDEX IF NOT EXISTS idx_production_archives_created_at ON production_archives(created_at);
CREATE INDEX IF NOT EXISTS idx_production_archives_shift_data_id ON production_archives(shift_data_id);

-- Inserir equipes padrão 3x3
INSERT INTO shift_teams (team_code, team_name, shift_pattern, is_active) VALUES
('A', 'Equipe Alpha', '3x3', true),
('B', 'Equipe Beta', '3x3', true),
('C', 'Equipe Charlie', '3x3', true),
('D', 'Equipe Delta', '3x3', true)
ON CONFLICT (team_code) DO NOTHING;

-- Função para calcular ciclo 3x3
CREATE OR REPLACE FUNCTION calculate_3x3_cycle(p_start_date DATE, p_current_date DATE)
RETURNS TABLE(
    cycle_day INTEGER,
    is_working BOOLEAN,
    pattern VARCHAR(10)
) AS $$
DECLARE
    v_days_diff INTEGER;
    v_cycle_position INTEGER;
BEGIN
    -- Calcular diferença em dias
    v_days_diff := p_current_date - p_start_date;
    
    -- Calcular posição no ciclo de 12 dias (0-11)
    v_cycle_position := v_days_diff % 12;
    
    -- Determinar se é dia de trabalho (primeiros 3 dias do ciclo)
    IF v_cycle_position < 3 THEN
        RETURN QUERY SELECT v_cycle_position + 1, true, 'WORK'::VARCHAR(10);
    ELSE
        RETURN QUERY SELECT v_cycle_position + 1, false, 'REST'::VARCHAR(10);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Função para gerar cronograma 3x3 automático
CREATE OR REPLACE FUNCTION generate_3x3_schedule(
    p_team_id INTEGER,
    p_start_date DATE,
    p_end_date DATE
) RETURNS INTEGER AS $$
DECLARE
    v_current_date DATE;
    v_cycle_info RECORD;
    v_inserted_count INTEGER := 0;
BEGIN
    v_current_date := p_start_date;
    
    WHILE v_current_date <= p_end_date LOOP
        -- Calcular informações do ciclo para a data atual
        SELECT * INTO v_cycle_info 
        FROM calculate_3x3_cycle(p_start_date, v_current_date);
        
        -- Inserir turnos apenas em dias de trabalho
        IF v_cycle_info.is_working THEN
            -- Turno da manhã (7h-19h)
            INSERT INTO shift_schedule_3x3 (
                team_id, schedule_date, shift_type, is_working_day, 
                cycle_day, work_pattern
            ) VALUES (
                p_team_id, v_current_date, 'MORNING', true,
                v_cycle_info.cycle_day, v_cycle_info.pattern
            ) ON CONFLICT DO NOTHING;
            
            -- Turno da noite (19h-7h)
            INSERT INTO shift_schedule_3x3 (
                team_id, schedule_date, shift_type, is_working_day, 
                cycle_day, work_pattern
            ) VALUES (
                p_team_id, v_current_date, 'NIGHT', true,
                v_cycle_info.cycle_day, v_cycle_info.pattern
            ) ON CONFLICT DO NOTHING;
            
            v_inserted_count := v_inserted_count + 2;
        END IF;
        
        v_current_date := v_current_date + INTERVAL '1 day';
    END LOOP;
    
    RETURN v_inserted_count;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar timestamp em shift_teams
CREATE OR REPLACE FUNCTION update_shift_teams_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_shift_teams_timestamp
    BEFORE UPDATE ON shift_teams
    FOR EACH ROW
    EXECUTE FUNCTION update_shift_teams_timestamp();

-- Comentários nas tabelas
COMMENT ON TABLE production_bmp_history IS 'Histórico de mudanças de BPM por máquina e operador';
COMMENT ON TABLE shift_teams IS 'Equipes de turno para sistema 3x3 (A, B, C, D)';
COMMENT ON TABLE shift_team_members IS 'Membros das equipes de turno';
COMMENT ON TABLE shift_schedule_3x3 IS 'Cronograma de turnos 3x3 com ciclo de 12 dias';
COMMENT ON TABLE production_archives IS 'Arquivo de dados de produção de turnos finalizados';

COMMENT ON FUNCTION calculate_3x3_cycle IS 'Calcula posição no ciclo 3x3 e se é dia de trabalho';
COMMENT ON FUNCTION generate_3x3_schedule IS 'Gera cronograma automático 3x3 para uma equipe';

-- Log da migração
INSERT INTO system_logs (level, component, message, metadata, created_at) VALUES (
    'INFO', 'DATABASE', 'Migração de produção avançada aplicada com sucesso',
    '{"migration": "add_advanced_production_tables", "version": "1.0"}',
    CURRENT_TIMESTAMP
) ON CONFLICT DO NOTHING;

COMMIT;