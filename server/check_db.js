const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'zara_operacao',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

async function checkMachineConfig() {
  try {
    console.log('=== VERIFICANDO CONFIGURAÇÃO DA MÁQUINA 1 ===');
    
    // 1. Verificar configuração da máquina
    const configQuery = `
      SELECT mc.production, m.name as machine_name, m.code as machine_code
      FROM machine_configs mc
      JOIN machines m ON mc.machine_id = m.id
      WHERE mc.machine_id = 1
    `;
    const configResult = await pool.query(configQuery);
    
    if (configResult.rows.length === 0) {
      console.log('❌ Máquina 1 não possui configurações de produção');
      return;
    }
    
    const config = configResult.rows[0];
    const productionConfig = JSON.parse(config.production || '{}');
    
    console.log('📊 Configuração atual:');
    console.log('   - Machine:', config.machine_name);
    console.log('   - Production Config:', JSON.stringify(productionConfig, null, 2));
    
    // 2. Verificar contador atual
    const counterQuery = `
      SELECT * FROM production_counters 
      WHERE machine_id = 1 AND DATE(created_at) = CURRENT_DATE
      ORDER BY created_at DESC LIMIT 1
    `;
    const counterResult = await pool.query(counterQuery);
    
    console.log('\n📈 Contador atual:');
    if (counterResult.rows.length > 0) {
      console.log('   - Count:', counterResult.rows[0].count);
      console.log('   - Updated:', counterResult.rows[0].updated_at);
    } else {
      console.log('   - Nenhum contador encontrado para hoje');
    }
    
    // 3. Verificar popups ativos
    const popupQuery = `
      SELECT * FROM production_popups 
      WHERE machine_id = 1 AND is_active = true
      ORDER BY created_at DESC
    `;
    const popupResult = await pool.query(popupQuery);
    
    console.log('\n🔔 Popups ativos:', popupResult.rows.length);
    popupResult.rows.forEach(popup => {
      console.log(`   - ID: ${popup.id}, Count: ${popup.production_count}, Threshold: ${popup.threshold}`);
    });
    
    // 4. Verificar alertas ativos
    const alertQuery = `
      SELECT * FROM production_alerts 
      WHERE machine_id = 1 AND is_active = true
      ORDER BY created_at DESC
    `;
    const alertResult = await pool.query(alertQuery);
    
    console.log('\n🚨 Alertas ativos:', alertResult.rows.length);
    alertResult.rows.forEach(alert => {
      console.log(`   - ID: ${alert.id}, Count: ${alert.production_count}, Type: ${alert.alert_type}`);
    });
    
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await pool.end();
  }
}

checkMachineConfig();