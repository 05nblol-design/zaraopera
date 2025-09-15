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

// Função para testar dados de produção diretamente no banco
async function testProductionData() {
  try {
    console.log('🔍 Testando dados de produção diretamente no banco...');
    
    // Primeiro, vamos ver quais tabelas existem
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('📋 Tabelas encontradas no banco:');
    tablesResult.rows.forEach(table => {
      console.log(`  - ${table.table_name}`);
    });
    
    // Verificar se há máquinas
    const machinesResult = await pool.query('SELECT id, name, status FROM machines LIMIT 5');
    console.log('\n📊 Máquinas encontradas:', machinesResult.rows.length);
    
    if (machinesResult.rows.length > 0) {
      console.log('🏭 Primeiras máquinas:');
      machinesResult.rows.forEach(machine => {
        console.log(`  - ID: ${machine.id}, Nome: ${machine.name}, Status: ${machine.status}`);
      });
      
      // Testar dados de produção para a primeira máquina
      const machineId = machinesResult.rows[0].id;
      console.log(`\n📈 Testando dados de produção para máquina ID: ${machineId}`);
      
      // Verificar dados de operações da máquina
      try {
        const operationsResult = await pool.query(
          'SELECT * FROM machine_operations WHERE machine_id = $1 ORDER BY created_at DESC LIMIT 5',
          [machineId]
        );
        console.log('📊 Operações da máquina:', operationsResult.rows.length);
        if (operationsResult.rows.length > 0) {
          console.log('📋 Últimas operações:');
          operationsResult.rows.forEach(op => {
            console.log(`  - ID: ${op.id}, Produtos: ${op.product_count || 'N/A'}, Status: ${op.status || 'N/A'}, Data: ${op.created_at}`);
          });
        }
      } catch (err) {
        console.log('⚠️ Erro ao buscar operações:', err.message);
      }
      
      // Verificar configurações de qualidade
      try {
        const qualityConfigResult = await pool.query(
          'SELECT id, machine_id, products_per_test, is_active FROM quality_test_configs WHERE machine_id = $1',
          [machineId]
        );
        
        console.log('🔬 Configurações de qualidade:', qualityConfigResult.rows.length);
        if (qualityConfigResult.rows.length > 0) {
          console.log('⚙️ Configurações encontradas:');
          qualityConfigResult.rows.forEach(config => {
            console.log(`  - ID: ${config.id}, Produtos por teste: ${config.products_per_test}, Ativo: ${config.is_active}`);
          });
        }
      } catch (err) {
        console.log('⚠️ Tabela quality_test_configs não encontrada ou erro:', err.message);
      }
      
      // Verificar testes de qualidade executados
      try {
        const testsResult = await pool.query(
          'SELECT COUNT(*) as total_tests FROM quality_tests WHERE machine_id = $1',
          [machineId]
        );
        console.log('🧪 Total de testes executados:', testsResult.rows[0].total_tests);
      } catch (err) {
        console.log('⚠️ Tabela quality_tests não encontrada ou erro:', err.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Erro ao testar dados:', error.message);
  } finally {
    await pool.end();
  }
}

testProductionData();