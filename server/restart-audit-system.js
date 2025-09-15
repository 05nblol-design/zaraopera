const auditLogger = require('./services/auditLogger');
const path = require('path');
const fs = require('fs').promises;

async function restartAuditSystem() {
  try {
    console.log('🔄 Reiniciando sistema de auditoria...');
    
    // Verificar se o diretório de logs existe
    const logDir = path.join(__dirname, 'logs');
    try {
      await fs.access(logDir);
      console.log('✅ Diretório de logs encontrado:', logDir);
    } catch (error) {
      console.log('📁 Criando diretório de logs...');
      await fs.mkdir(logDir, { recursive: true });
      console.log('✅ Diretório de logs criado:', logDir);
    }
    
    // Testar log de sistema
    await auditLogger.logSystemEvent({
      event: 'STARTUP',
      component: 'AUDIT_SYSTEM',
      level: 'INFO',
      message: 'Sistema de auditoria reiniciado manualmente',
      metadata: {
        timestamp: new Date().toISOString(),
        action: 'manual_restart'
      }
    });
    
    console.log('✅ Sistema de auditoria reiniciado com sucesso!');
    console.log('📋 Log de teste criado');
    
    // Verificar arquivos de log criados
    const files = await fs.readdir(logDir);
    console.log('📄 Arquivos de log disponíveis:', files);
    
    // Testar diferentes tipos de log
    await auditLogger.logAuth({
      event: 'TEST_AUTH',
      userId: 'system',
      ip: '127.0.0.1',
      userAgent: 'audit-restart-script',
      success: true,
      message: 'Teste de log de autenticação'
    });
    
    await auditLogger.logDataAccess({
      userId: 'system',
      resource: 'audit_system',
      action: 'RESTART',
      ip: '127.0.0.1',
      success: true,
      message: 'Teste de log de acesso a dados'
    });
    
    console.log('✅ Todos os tipos de log testados com sucesso!');
    console.log('🎯 Sistema de auditoria está funcionando corretamente');
    
  } catch (error) {
    console.error('❌ Erro ao reiniciar sistema de auditoria:', error);
    process.exit(1);
  }
}

// Executar o restart
restartAuditSystem().then(() => {
  console.log('🏁 Script de reinicialização concluído');
  process.exit(0);
}).catch(error => {
  console.error('💥 Falha crítica:', error);
  process.exit(1);
});