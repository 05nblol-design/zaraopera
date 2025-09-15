const cron = require('node-cron');
const specificCasesService = require('./specificCasesService');
const notificationService = require('./notificationService');

class SpecificCasesScheduler {
  constructor() {
    this.jobs = new Map();
    this.isRunning = false;
  }

  // Inicializar agendador
  start() {
    if (this.isRunning) {
      console.log('⚠️ Agendador de casos específicos já está em execução');
      return;
    }

    console.log('🕐 Iniciando agendador de casos específicos...');

    // Verificação completa a cada 30 minutos
    this.scheduleJob('complete-check', '*/30 * * * *', async () => {
      try {
        console.log('🔍 Executando verificação completa de casos específicos...');
        const results = await specificCasesService.runAllChecks();
        
        const totalNotifications = 
          results.qualityTests.length + 
          results.teflonChanges.length + 
          results.validityChecks.length;

        if (totalNotifications > 0) {
          console.log(`📢 ${totalNotifications} notificações criadas na verificação automática`);
          
          // Criar alerta de resumo se houver muitas notificações
          if (totalNotifications >= 5) {
            await this.createSummaryAlert(results, totalNotifications);
          }
        } else {
          console.log('✅ Nenhuma notificação necessária na verificação automática');
        }
      } catch (error) {
        console.error('❌ Erro na verificação automática completa:', error);
        await this.createErrorAlert('Verificação Completa', error);
      }
    });

    // Verificação de testes de qualidade a cada 15 minutos
    this.scheduleJob('quality-tests', '*/15 * * * *', async () => {
      try {
        const results = await specificCasesService.checkQualityTests();
        if (results.length > 0) {
          console.log(`🧪 ${results.length} testes de qualidade pendentes detectados`);
        }
      } catch (error) {
        console.error('❌ Erro na verificação de testes de qualidade:', error);
      }
    });

    // Verificação de teflon a cada hora
    this.scheduleJob('teflon-check', '0 * * * *', async () => {
      try {
        const results = await specificCasesService.checkTeflonChanges();
        if (results.length > 0) {
          console.log(`🔧 ${results.length} trocas de teflon necessárias detectadas`);
        }
      } catch (error) {
        console.error('❌ Erro na verificação de teflon:', error);
      }
    });

    // Verificação de validades duas vezes por dia (8h e 20h)
    this.scheduleJob('validity-check', '0 8,20 * * *', async () => {
      try {
        const results = await specificCasesService.checkValidityDates();
        if (results.length > 0) {
          console.log(`📅 ${results.length} itens próximos do vencimento detectados`);
        }
      } catch (error) {
        console.error('❌ Erro na verificação de validades:', error);
      }
    });

    // Verificação urgente a cada 5 minutos (apenas para casos críticos)
    this.scheduleJob('urgent-check', '*/5 * * * *', async () => {
      try {
        await this.checkUrgentCases();
      } catch (error) {
        console.error('❌ Erro na verificação urgente:', error);
      }
    });

    // Limpeza de notificações antigas (diariamente às 2h)
    this.scheduleJob('cleanup', '0 2 * * *', async () => {
      try {
        await this.cleanupOldNotifications();
      } catch (error) {
        console.error('❌ Erro na limpeza de notificações:', error);
      }
    });

    this.isRunning = true;
    console.log('✅ Agendador de casos específicos iniciado com sucesso');
    console.log('📋 Jobs agendados:');
    console.log('  - Verificação completa: a cada 30 minutos');
    console.log('  - Testes de qualidade: a cada 15 minutos');
    console.log('  - Verificação de teflon: a cada hora');
    console.log('  - Verificação de validades: 8h e 20h');
    console.log('  - Verificação urgente: a cada 5 minutos');
    console.log('  - Limpeza: diariamente às 2h');
  }

  // Parar agendador
  stop() {
    if (!this.isRunning) {
      console.log('⚠️ Agendador de casos específicos não está em execução');
      return;
    }

    console.log('🛑 Parando agendador de casos específicos...');
    
    this.jobs.forEach((job, name) => {
      job.stop();
      console.log(`  - Job '${name}' parado`);
    });
    
    this.jobs.clear();
    this.isRunning = false;
    console.log('✅ Agendador de casos específicos parado');
  }

  // Agendar um job
  scheduleJob(name, schedule, task) {
    if (this.jobs.has(name)) {
      console.log(`⚠️ Job '${name}' já existe, substituindo...`);
      this.jobs.get(name).stop();
    }

    const job = cron.schedule(schedule, task, {
      scheduled: false,
      timezone: 'America/Sao_Paulo'
    });

    job.start();
    this.jobs.set(name, job);
    console.log(`📅 Job '${name}' agendado: ${schedule}`);
  }

  // Verificar apenas casos urgentes
  async checkUrgentCases() {
    const pool = require('../config/database');
    
    try {
      // Verificar testes de qualidade muito atrasados (mais de 4 horas)
      const urgentQualityTests = await pool.query(`
        SELECT COUNT(*) as count
        FROM quality_tests 
        WHERE status = 'pending' 
          AND scheduled_date <= NOW() - INTERVAL '4 hours'
          AND notified = false
      `);

      // Verificar teflon que passou do limite
      const urgentTeflon = await pool.query(`
        SELECT COUNT(*) as count
        FROM teflon_tracking 
        WHERE (
          usage_hours >= max_usage_hours OR
          EXTRACT(DAYS FROM (NOW() - last_change_date)) >= max_days
        )
        AND status = 'active'
        AND notified = false
      `);

      // Verificar itens vencidos
      const expiredItems = await pool.query(`
        SELECT COUNT(*) as count
        FROM validity_tracking 
        WHERE expiry_date <= NOW()
          AND status = 'active'
          AND notified = false
      `);

      const urgentCount = 
        parseInt(urgentQualityTests.rows[0].count) +
        parseInt(urgentTeflon.rows[0].count) +
        parseInt(expiredItems.rows[0].count);

      if (urgentCount > 0) {
        console.log(`🚨 ${urgentCount} casos urgentes detectados`);
        
        // Executar verificação completa para casos urgentes
        await specificCasesService.runAllChecks();
      }
    } catch (error) {
      console.error('Erro na verificação urgente:', error);
    }
  }

  // Criar alerta de resumo
  async createSummaryAlert(results, totalNotifications) {
    try {
      const alertData = {
        type: 'system_summary',
        priority: 'MEDIUM',
        title: 'Resumo de Verificações Automáticas',
        message: `Verificação automática detectou ${totalNotifications} situações que requerem atenção:\n` +
                `• ${results.qualityTests.length} testes de qualidade pendentes\n` +
                `• ${results.teflonChanges.length} trocas de teflon necessárias\n` +
                `• ${results.validityChecks.length} itens próximos do vencimento`,
        metadata: {
          summary: true,
          qualityTests: results.qualityTests.length,
          teflonChanges: results.teflonChanges.length,
          validityChecks: results.validityChecks.length,
          total: totalNotifications,
          timestamp: new Date().toISOString()
        }
      };

      await notificationService.createAlert(alertData);
    } catch (error) {
      console.error('Erro ao criar alerta de resumo:', error);
    }
  }

  // Criar alerta de erro
  async createErrorAlert(checkType, error) {
    try {
      const alertData = {
        type: 'system_error',
        priority: 'HIGH',
        title: 'Erro na Verificação Automática',
        message: `Erro durante a verificação automática de ${checkType}: ${error.message}`,
        metadata: {
          error: true,
          checkType,
          errorMessage: error.message,
          timestamp: new Date().toISOString()
        }
      };

      await notificationService.createAlert(alertData);
    } catch (alertError) {
      console.error('Erro ao criar alerta de erro:', alertError);
    }
  }

  // Limpeza de notificações antigas
  async cleanupOldNotifications() {
    const pool = require('../config/database');
    
    try {
      console.log('🧹 Iniciando limpeza de notificações antigas...');
      
      // Marcar como lidas notificações antigas (mais de 30 dias)
      const oldNotifications = await pool.query(`
        UPDATE alerts 
        SET read = true, updated_at = NOW()
        WHERE created_at <= NOW() - INTERVAL '30 days'
          AND read = false
          AND type IN ('quality_test', 'teflon_change', 'validity_check')
      `);

      // Resetar flag de notificação para itens resolvidos
      await pool.query(`
        UPDATE quality_tests 
        SET notified = false 
        WHERE status IN ('completed', 'cancelled')
          AND notified = true
      `);

      await pool.query(`
        UPDATE teflon_tracking 
        SET notified = false 
        WHERE status IN ('changed', 'inactive')
          AND notified = true
      `);

      await pool.query(`
        UPDATE validity_tracking 
        SET notified = false 
        WHERE status IN ('consumed', 'disposed')
          AND notified = true
      `);

      console.log(`✅ Limpeza concluída. ${oldNotifications.rowCount} notificações antigas marcadas como lidas`);
    } catch (error) {
      console.error('Erro na limpeza de notificações:', error);
    }
  }

  // Obter status do agendador
  getStatus() {
    return {
      isRunning: this.isRunning,
      jobCount: this.jobs.size,
      jobs: Array.from(this.jobs.keys())
    };
  }

  // Executar verificação manual
  async runManualCheck(checkType = 'all') {
    try {
      console.log(`🔍 Executando verificação manual: ${checkType}`);
      
      let results;
      switch (checkType) {
        case 'quality':
          results = { qualityTests: await specificCasesService.checkQualityTests() };
          break;
        case 'teflon':
          results = { teflonChanges: await specificCasesService.checkTeflonChanges() };
          break;
        case 'validity':
          results = { validityChecks: await specificCasesService.checkValidityDates() };
          break;
        default:
          results = await specificCasesService.runAllChecks();
      }
      
      console.log('✅ Verificação manual concluída');
      return results;
    } catch (error) {
      console.error('❌ Erro na verificação manual:', error);
      throw error;
    }
  }
}

module.exports = new SpecificCasesScheduler();