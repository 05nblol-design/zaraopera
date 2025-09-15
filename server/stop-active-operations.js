const pool = require('./config/database');

async function stopActiveOperations() {
  try {
    console.log('🛑 Finalizando operações ativas...');
    
    // Buscar operações ativas
    const activeOperations = await pool.query(
      "SELECT * FROM machine_operations WHERE status = 'ACTIVE'"
    );
    
    console.log(`📊 Encontradas ${activeOperations.rows.length} operações ativas:`);
    
    for (const operation of activeOperations.rows) {
      console.log(`\n🔄 Finalizando operação ID ${operation.id}:`);
      console.log(`   Máquina: ${operation.machine_id}`);
      console.log(`   Operador: ${operation.operator_id}`);
      console.log(`   Início: ${operation.start_time}`);
      
      // Finalizar a operação
      await pool.query(
        `UPDATE machine_operations 
         SET status = 'COMPLETED', 
             end_time = NOW(), 
             updated_at = NOW()
         WHERE id = $1`,
        [operation.id]
      );
      
      // Atualizar status da máquina para disponível
      await pool.query(
        `UPDATE machines 
         SET status = 'DISPONIVEL',
             updated_at = NOW()
         WHERE id = $1`,
        [operation.machine_id]
      );
      
      console.log(`   ✅ Operação ${operation.id} finalizada`);
    }
    
    // Verificar se ainda há operações ativas
    const remainingOperations = await pool.query(
      "SELECT COUNT(*) as count FROM machine_operations WHERE status = 'ACTIVE'"
    );
    
    console.log(`\n📊 Operações ativas restantes: ${remainingOperations.rows[0].count}`);
    
    if (remainingOperations.rows[0].count == 0) {
      console.log('✅ Todas as operações foram finalizadas com sucesso!');
    }
    
  } catch (error) {
    console.error('❌ Erro ao finalizar operações:', error.message);
  } finally {
    await pool.end();
  }
}

stopActiveOperations();