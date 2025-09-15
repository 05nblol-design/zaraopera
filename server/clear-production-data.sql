-- Script para zerar todos os dados de produção das máquinas
-- Execute este script diretamente no PostgreSQL

-- Zerar dados de produção
DELETE FROM production_data;

-- Zerar dados de turnos
DELETE FROM shifts;

-- Zerar histórico de status das máquinas
DELETE FROM machine_status_history;

-- Zerar testes de qualidade
DELETE FROM quality_tests;

-- Zerar alertas (se existir)
DELETE FROM alerts WHERE 1=1;

-- Zerar notificações (se existir)
DELETE FROM notifications WHERE 1=1;

-- Resetar sequências (IDs) para começar do 1 novamente
ALTER SEQUENCE IF EXISTS production_data_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS shifts_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS machine_status_history_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS quality_tests_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS alerts_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS notifications_id_seq RESTART WITH 1;

-- Confirmar operação
SELECT 'Dados de produção zerados com sucesso!' as resultado;