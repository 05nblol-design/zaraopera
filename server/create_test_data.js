require('dotenv').config();
const { Pool } = require('pg');

// Configuração direta do pool
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'zara_operacao',
  password: process.env.DB_PASSWORD || '4409',
  port: process.env.DB_PORT || 5432,
});

// Função para criar dados de teste
async function createTestData() {
  try {
    console.log('🔧 Criando dados de teste...');
    
    // Primeiro, vamos ver a estrutura da tabela quality_test_configs
    const tableStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'quality_test_configs'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Estrutura da tabela quality_test_configs:');
    tableStructure.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // Verificar estrutura da tabela machine_operations
    const operationsStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'machine_operations'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Estrutura da tabela machine_operations:');
    operationsStructure.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // Verificar estrutura da tabela quality_tests
    const testsStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'quality_tests'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Estrutura da tabela quality_tests:');
    testsStructure.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // Verificar se já existem configurações de qualidade
    const existingConfigs = await pool.query('SELECT COUNT(*) as count FROM quality_test_configs');
    
    if (existingConfigs.rows[0].count > 0) {
      console.log('⚠️ Já existem configurações de qualidade. Removendo dados antigos...');
      await pool.query('DELETE FROM quality_tests');
      await pool.query('DELETE FROM quality_test_configs');
      await pool.query('DELETE FROM machine_operations');
    }
    
    // Criar configurações de qualidade para as máquinas existentes
    const machines = await pool.query('SELECT id, name FROM machines');
    
    for (const machine of machines.rows) {
      console.log(`📋 Criando configuração de qualidade para ${machine.name} (ID: ${machine.id})`);
      
      // Inserir configuração de qualidade
      const configResult = await pool.query(`
        INSERT INTO quality_test_configs 
        (machine_id, test_name, test_description, products_per_test, is_active, is_required, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING id
      `, [machine.id, 'Teste de Qualidade Padrão', 'Teste de qualidade rotineiro para controle de produção', 100, true, true]);
      
      const configId = configResult.rows[0].id;
      console.log(`✅ Configuração criada com ID: ${configId}`);
      
      // Criar algumas operações de máquina simulando produção
      console.log(`📊 Criando operações de produção para ${machine.name}`);
      
      // Precisamos de um user_id válido - vamos usar 1 como padrão
      const userId = 1;
      
      // Operação atual em andamento
      await pool.query(`
        INSERT INTO machine_operations 
        (machine_id, user_id, status, start_time, notes, created_at, updated_at)
        VALUES ($1, $2, $3, NOW() - INTERVAL '2 hours', $4, NOW(), NOW())
      `, [machine.id, userId, 'RUNNING', 'Operação em andamento - 75 produtos produzidos']);
      
      // Algumas operações anteriores
      await pool.query(`
        INSERT INTO machine_operations 
        (machine_id, user_id, status, start_time, end_time, notes, created_at, updated_at)
        VALUES ($1, $2, $3, NOW() - INTERVAL '1 day', NOW() - INTERVAL '20 hours', $4, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day')
      `, [machine.id, userId, 'COMPLETED', 'Operação concluída - 150 produtos produzidos']);
      
      await pool.query(`
        INSERT INTO machine_operations 
        (machine_id, user_id, status, start_time, end_time, notes, created_at, updated_at)
        VALUES ($1, $2, $3, NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day 20 hours', $4, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days')
      `, [machine.id, userId, 'COMPLETED', 'Operação concluída - 200 produtos produzidos']);
      
      // Criar alguns testes de qualidade executados
      console.log(`🧪 Criando histórico de testes para ${machine.name}`);
      
      await pool.query(`
        INSERT INTO quality_tests 
        (machine_id, user_id, config_id, product, lot, box_number, package_size, package_width, bottom_size, side_size, zipper_distance, facilitator_distance, approved, test_date, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW() - INTERVAL '3 hours', NOW(), NOW())
      `, [machine.id, userId, configId, 'Produto Teste', 'LOTE001', 'CX001', 'Médio', 15.5, 10.2, 8.3, 2.1, 1.8, true]);
      
      await pool.query(`
        INSERT INTO quality_tests 
        (machine_id, user_id, config_id, product, lot, box_number, package_size, package_width, bottom_size, side_size, zipper_distance, facilitator_distance, approved, test_date, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW() - INTERVAL '1 day', NOW(), NOW())
      `, [machine.id, userId, configId, 'Produto Teste', 'LOTE002', 'CX002', 'Grande', 18.0, 12.1, 9.5, 2.3, 2.0, true]);
    }
    
    console.log('\n✅ Dados de teste criados com sucesso!');
    console.log('📊 Resumo dos dados criados:');
    
    // Verificar os dados criados
    const configCount = await pool.query('SELECT COUNT(*) as count FROM quality_test_configs WHERE is_active = true');
    const operationCount = await pool.query('SELECT COUNT(*) as count FROM machine_operations');
    const testCount = await pool.query('SELECT COUNT(*) as count FROM quality_tests');
    
    console.log(`  - Configurações de qualidade ativas: ${configCount.rows[0].count}`);
    console.log(`  - Operações de máquina: ${operationCount.rows[0].count}`);
    console.log(`  - Testes executados: ${testCount.rows[0].count}`);
    
    // Mostrar dados específicos para verificação
    console.log('\n📋 Detalhes das configurações:');
    const configs = await pool.query(`
      SELECT qc.*, m.name as machine_name 
      FROM quality_test_configs qc 
      JOIN machines m ON qc.machine_id = m.id 
      WHERE qc.is_active = true
    `);
    
    configs.rows.forEach(config => {
      console.log(`  - ${config.machine_name}: ${config.products_per_test} produtos por teste`);
    });
    
  } catch (error) {
    console.error('❌ Erro ao criar dados de teste:', error.message);
  } finally {
    await pool.end();
  }
}

createTestData();