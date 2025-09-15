const cron = require('cron');
const notificationService = require('./notificationService');
const shiftService = require('./shiftService');
const pool = require('../config/database');

class SchedulerService {
  constructor() {
    this.jobs = new Map();
    this.initializeJobs();
  }

  initializeJobs() {
    console.log('⏰ Inicializando agendador de tarefas...');
    
    // Relatório diário às 18:00
    this.scheduleJob('daily-report', '0 18 * * *', async () => {
      console.log('📊 Executando relatório diário agendado...');
      await notificationService.sendDailyReport();
    });

    // Verificação de teflon vencido a cada 6 horas
    this.scheduleJob('teflon-check', '0 */6 * * *', async () => {
      console.log('🔍 Verificando trocas de teflon vencidas...');
      await this.checkExpiredTeflon();
    });

    // Limpeza de notificações antigas (30 dias) - diariamente às 02:00
    this.scheduleJob('cleanup-notifications', '0 2 * * *', async () => {
      console.log('🧹 Limpando notificações antigas...');
      await this.cleanupOldNotifications();
    });

    // Verificação de máquinas inativas - a cada 2 horas
    this.scheduleJob('machine-check', '0 */2 * * *', async () => {
      console.log('🔧 Verificando status das máquinas...');
      await this.checkInactiveMachines();
    });

    // Arquivamento automático de turnos às 7:00 e 19:00
    this.scheduleJob('archive-shifts', '0 7,19 * * *', async () => {
      console.log('📦 Verificando turnos para arquivar...');
      await this.archiveCompletedShifts();
    });

    // Verificação de dados de turno a cada 15 minutos
    this.scheduleJob('update-shifts', '*/15 * * * *', async () => {
      console.log('🔄 Verificando dados de turno...');
      await this.updateShiftData();
    });

    console.log(`✅ ${this.jobs.size} tarefas agendadas inicializadas`);
  }

  scheduleJob(name, cronPattern, task) {
    try {
      const job = new cron.CronJob(cronPattern, task, null, true, 'America/Sao_Paulo');
      this.jobs.set(name, job);
      console.log(`⏰ Tarefa '${name}' agendada: ${cronPattern}`);
    } catch (error) {
      console.error(`❌ Erro ao agendar tarefa '${name}':`, error.message);
    }
  }

  async checkExpiredTeflon() {
    try {
      const now = new Date();
      const fiveDaysFromNow = new Date(now.getTime() + (5 * 24 * 60 * 60 * 1000));

      // Buscar trocas de teflon vencidas ou que vencerão em 5 dias
      const [expiredChangesResult, expiringChangesResult] = await Promise.all([
        // Trocas já vencidas
        pool.query(
          `SELECT tc.*, 
                  json_build_object(
                    'id', m.id,
                    'name', m.name,
                    'code', m.code
                  ) as machine,
                  json_build_object(
                    'id', u.id,
                    'name', u.name,
                    'email', u.email
                  ) as user
           FROM "TeflonChange" tc
           LEFT JOIN "Machine" m ON tc."machineId" = m.id
           LEFT JOIN users u ON tc."userId" = u.id
           WHERE tc."expiryDate" < $1 AND tc."alertSent" = $2`,
          [now, false]
        ),
        // Trocas que vencerão em até 5 dias
        pool.query(
          `SELECT tc.*, 
                  json_build_object(
                    'id', m.id,
                    'name', m.name,
                    'code', m.code
                  ) as machine,
                  json_build_object(
                    'id', u.id,
                    'name', u.name,
                    'email', u.email
                  ) as user
           FROM "TeflonChange" tc
           LEFT JOIN "Machine" m ON tc."machineId" = m.id
           LEFT JOIN users u ON tc."userId" = u.id
           WHERE tc."expiryDate" >= $1 AND tc."expiryDate" <= $2 AND tc."notificationSent" = $3`,
          [now, fiveDaysFromNow, false]
        )
      ]);
      const expiredChanges = expiredChangesResult.rows;
      const expiringChanges = expiringChangesResult.rows;

      const allChanges = [...expiredChanges, ...expiringChanges];

      console.log(`🔍 Encontradas ${allChanges.length} trocas de teflon para notificar (${expiredChanges.length} vencidas, ${expiringChanges.length} vencendo)`);

      for (const change of allChanges) {
        const daysUntilExpiry = Math.ceil((change.expiryDate - now) / (1000 * 60 * 60 * 24));
        const isExpired = daysUntilExpiry <= 0;
        
        await notificationService.sendTeflonExpiryNotification({
          ...change,
          daysUntilExpiry
        });
        
        // Marcar como notificado baseado no tipo
        const updateData = isExpired 
          ? { alertSent: true } 
          : { notificationSent: true };
          
        if (isExpired) {
          await pool.query(
            'UPDATE "TeflonChange" SET "alertSent" = $1 WHERE id = $2',
            [true, change.id]
          );
        } else {
          await pool.query(
            'UPDATE "TeflonChange" SET "notificationSent" = $1 WHERE id = $2',
            [true, change.id]
          );
        }
      }

      return { 
        success: true, 
        processed: allChanges.length,
        expired: expiredChanges.length,
        expiring: expiringChanges.length
      };
    } catch (error) {
      console.error('❌ Erro ao verificar teflon vencido:', error);
      return { success: false, error: error.message };
    }
  }

  async cleanupOldNotifications() {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await pool.query(
        'DELETE FROM "Notification" WHERE "createdAt" < $1 AND read = $2',
        [thirtyDaysAgo, true]
      );

      console.log(`🧹 ${result.rowCount} notificações antigas removidas`);
      return { success: true, deleted: result.rowCount };
    } catch (error) {
      console.error('❌ Erro ao limpar notificações antigas:', error);
      return { success: false, error: error.message };
    }
  }

  async checkInactiveMachines() {
    try {
      const twoHoursAgo = new Date();
      twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);

      // Buscar máquinas que não tiveram testes de qualidade nas últimas 2 horas
      const machinesResult = await pool.query(
        `SELECT m.*, 
                COALESCE(
                  json_agg(
                    CASE WHEN qt.id IS NOT NULL THEN
                      json_build_object(
                        'id', qt.id,
                        'createdAt', qt."createdAt"
                      )
                    END
                  ) FILTER (WHERE qt.id IS NOT NULL), '[]'
                ) as "qualityTests"
         FROM "Machine" m
         LEFT JOIN "QualityTest" qt ON m.id = qt."machineId" AND qt."createdAt" >= $1
         WHERE m.status = $2
         GROUP BY m.id`,
        [twoHoursAgo, 'ACTIVE']
      );
      const machines = machinesResult.rows;
      const inactiveMachines = machines.filter(machine => machine.qualityTests.length === 0);

      console.log(`🔧 Encontradas ${inactiveMachines.length} máquinas inativas`);

      for (const machine of inactiveMachines) {
        // Verificar se já foi enviada notificação recentemente
        const recentNotificationResult = await pool.query(
          `SELECT * FROM "Notification" 
           WHERE type = $1 AND "machineId" = $2 AND "createdAt" >= $3 
           ORDER BY "createdAt" DESC LIMIT 1`,
          ['MACHINE_INACTIVE', machine.id, twoHoursAgo]
        );
        const recentNotification = recentNotificationResult.rows[0];

        if (!recentNotification) {
          await notificationService.saveNotification({
            type: 'MACHINE_INACTIVE',
            title: 'Máquina Inativa Detectada',
            message: `${machine.name} não registra atividade há mais de 2 horas`,
            machineId: machine.id,
            priority: 'MEDIUM',
            channels: ['SYSTEM'],
            metadata: {
              machineName: machine.name,
              location: machine.location,
              lastActivity: twoHoursAgo.toISOString()
            }
          });
        }
      }

      return { success: true, inactiveMachines: inactiveMachines.length };
    } catch (error) {
      console.error('❌ Erro ao verificar máquinas inativas:', error);
      return { success: false, error: error.message };
    }
  }

  async generateWeeklyReport() {
    try {
      console.log('📊 Gerando relatório semanal...');
      
      const now = new Date();
      const weekAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));

      const [qualityTestsResult, teflonChangesResult, machinesResult] = await Promise.all([
        pool.query(
          `SELECT qt.*, 
                  json_build_object(
                    'id', m.id,
                    'name', m.name,
                    'code', m.code
                  ) as machine,
                  json_build_object(
                    'id', u.id,
                    'name', u.name,
                    'email', u.email
                  ) as user
           FROM "QualityTest" qt
           LEFT JOIN "Machine" m ON qt."machineId" = m.id
           LEFT JOIN users u ON qt."userId" = u.id
           WHERE qt."createdAt" >= $1 AND qt."createdAt" <= $2`,
          [weekAgo, now]
        ),
        pool.query(
          `SELECT tc.*, 
                  json_build_object(
                    'id', m.id,
                    'name', m.name,
                    'code', m.code
                  ) as machine
           FROM "TeflonChange" tc
           LEFT JOIN "Machine" m ON tc."machineId" = m.id
           WHERE tc."changeDate" >= $1 AND tc."changeDate" <= $2`,
          [weekAgo, now]
        ),
        pool.query('SELECT * FROM "Machine"')
      ]);
      const qualityTests = qualityTestsResult.rows;
      const teflonChanges = teflonChangesResult.rows;
      const machines = machinesResult.rows;

      const approvedTests = qualityTests.filter(test => test.result === 'APPROVED').length;
      const rejectedTests = qualityTests.filter(test => test.result === 'REJECTED').length;
      const totalTests = qualityTests.length;
      const qualityRate = totalTests > 0 ? Math.round((approvedTests / totalTests) * 100) : 0;

      // Agrupar por máquina
      const machineStats = machines.map(machine => {
        const machineTests = qualityTests.filter(test => test.machineId === machine.id);
        const machineApproved = machineTests.filter(test => test.result === 'APPROVED').length;
        const machineTotal = machineTests.length;
        const machineRate = machineTotal > 0 ? Math.round((machineApproved / machineTotal) * 100) : 0;

        return {
          name: machine.name,
          location: machine.location,
          totalTests: machineTotal,
          qualityRate: machineRate,
          teflonChanges: teflonChanges.filter(change => change.machineId === machine.id).length
        };
      });

      const reportData = {
        period: {
          start: weekAgo.toISOString().split('T')[0],
          end: now.toISOString().split('T')[0]
        },
        summary: {
          totalTests,
          approvedTests,
          rejectedTests,
          qualityRate,
          teflonChanges: teflonChanges.length,
          activeMachines: machines.filter(m => m.status === 'ACTIVE').length
        },
        machines: machineStats
      };

      // Salvar relatório no banco
      await pool.query(
        `INSERT INTO "Report" (type, period, data, "generatedAt", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ['WEEKLY', 'week', JSON.stringify(reportData), now, now, now]
      );

      console.log('✅ Relatório semanal gerado com sucesso');
      return { success: true, reportData };
    } catch (error) {
      console.error('❌ Erro ao gerar relatório semanal:', error);
      return { success: false, error: error.message };
    }
  }

  stopJob(name) {
    const job = this.jobs.get(name);
    if (job) {
      job.stop();
      this.jobs.delete(name);
      console.log(`⏹️ Tarefa '${name}' parada`);
      return true;
    }
    return false;
  }

  startJob(name) {
    const job = this.jobs.get(name);
    if (job) {
      job.start();
      console.log(`▶️ Tarefa '${name}' iniciada`);
      return true;
    }
    return false;
  }

  getJobStatus() {
    const status = {};
    for (const [name, job] of this.jobs) {
      status[name] = {
        running: job.running,
        nextDate: job.nextDate()?.toISOString(),
        lastDate: job.lastDate()?.toISOString()
      };
    }
    return status;
  }

  async archiveCompletedShifts() {
    try {
      console.log('📦 Iniciando arquivamento de turnos completos...');
      const result = await shiftService.archiveCompletedShifts();
      console.log(`✅ ${result.archived} turnos arquivados`);
      return result;
    } catch (error) {
      console.error('❌ Erro ao arquivar turnos:', error);
      return { success: false, error: error.message };
    }
  }

  async updateShiftData() {
    try {
      const result = await shiftService.updateCurrentShiftData();
      return result;
    } catch (error) {
      console.error('❌ Erro ao atualizar dados de turno:', error);
      return { success: false, error: error.message };
    }
  }

  stopAll() {
    console.log('⏹️ Parando todas as tarefas agendadas...');
    for (const [name, job] of this.jobs) {
      job.stop();
      console.log(`⏹️ Tarefa '${name}' parada`);
    }
    this.jobs.clear();
  }
}

module.exports = new SchedulerService();