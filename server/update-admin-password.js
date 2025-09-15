const pool = require('./config/database');
const bcrypt = require('bcryptjs');

async function updateAdminPassword() {
  try {
    console.log('🔧 Atualizando senha do admin...');
    
    const client = await pool.connect();
    
    // Gerar nova senha hash
    const hashedPassword = await bcrypt.hash('admin123', 12);
    
    // Atualizar senha do admin
    const updateResult = await client.query(
      'UPDATE users SET password = $1, updated_at = NOW() WHERE email = $2 RETURNING id, email, name',
      [hashedPassword, 'admin@zara.com']
    );
    
    if (updateResult.rows.length > 0) {
      console.log('✅ Senha do admin atualizada:', updateResult.rows[0]);
      
      // Testar a nova senha
      const testResult = await client.query(
        'SELECT password FROM users WHERE email = $1',
        ['admin@zara.com']
      );
      
      const passwordMatch = await bcrypt.compare('admin123', testResult.rows[0].password);
      console.log('✅ Teste da nova senha:', passwordMatch ? 'SUCESSO' : 'FALHA');
    } else {
      console.log('❌ Usuário admin não encontrado');
    }
    
    client.release();
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    process.exit(0);
  }
}

updateAdminPassword();