const emailService = require('./emailService');
const pushService = require('./pushService');
const { pool, query } = require('../config/postgresql');
const nodemailer = require('nodemailer');
const fetch = require('node-fetch');

// Configuração do email
const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

class NotificationService {
  constructor() {
    this.emailEnabled = !!process.env.SMTP_USER;
    this.pushEnabled = !!process.env.FIREBASE_PROJECT_ID;
    this.io = null; // Socket.IO instance
    
    // Configurações de prioridade
    this.priorities = {
      info: { color: '#10B981', icon: 'info', sound: 'info.mp3' },
      warning: { color: '#F59E0B', icon: 'warning', sound: 'warning.mp3' },
      critical: { color: '#EF4444', icon: 'error', sound: 'critical.mp3' }
    };
    
    console.log(`📧 Email notifications: ${this.emailEnabled ? 'Enabled' : 'Disabled'}`);
    console.log(`📱 Push notifications: ${this.pushEnabled ? 'Enabled' : 'Disabled'}`);
  }

  // Método para definir a instância do Socket.IO
  setSocketIO(io) {
    this.io = io;
    console.log('🔌 Socket.IO configurado no NotificationService');
  }

  async getUserEmailsByRole(roles) {
    try {
      const rolesArray = Array.isArray(roles) ? roles : [roles];
      const placeholders = rolesArray.map((_, index) => `$${index + 1}`).join(', ');
      
      const queryText = `
        SELECT email, name, role 
        FROM users 
        WHERE role IN (${placeholders}) 
          AND is_active = true 
          AND email IS NOT NULL
      `;
      
      const result = await query(queryText, rolesArray);
      return result.rows.map(user => user.email).filter(email => email);
    } catch (error) {
      console.error('❌ Erro ao buscar emails dos usuários:', error);
      return [];
    }
  }

  async getUsersByRole(roles) {
    try {
      console.log('👥 Buscando usuários por role:', roles);
      
      const rolesArray = Array.isArray(roles) ? roles : [roles];
      const placeholders = rolesArray.map((_, index) => `$${index + 1}`).join(', ');
      
      const queryText = `
        SELECT id, email, name, role 
        FROM users 
        WHERE role IN (${placeholders}) 
          AND is_active = true
      `;
      
      const result = await query(queryText, rolesArray);
      const users = result.rows;

      console.log(`📊 Usuários encontrados: ${users.length}`);
      users.forEach(user => {
        console.log(`   - ${user.name} (${user.role}) - ID: ${user.id} - Email: ${user.email}`);
      });
      
      return users;
    } catch (error) {
      console.error('❌ Erro ao buscar usuários por papel:', error);
      console.error('❌ Stack trace:', error.stack);
      return [];
    }
  }

  async saveNotification(data) {
    try {
      console.log('💾 Salvando notificação no banco...');
      console.log('📋 Dados recebidos:', JSON.stringify(data, null, 2));
      
      const notificationData = {
        type: data.type,
        title: data.title,
        message: data.message,
        userId: data.userId || null,
        machineId: data.machineId || null,
        testId: data.testId || null,
        changeId: data.changeId || null,
        priority: data.priority || 'MEDIUM',
        channels: Array.isArray(data.channels) ? JSON.stringify(data.channels) : JSON.stringify(['SYSTEM']),
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        read: false
      };
      
      console.log('🔄 Dados preparados para o Prisma:', JSON.stringify(notificationData, null, 2));
      
      const insertQuery = `
        INSERT INTO notifications (user_id, title, message, type, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING *
      `;
      
      const result = await query(insertQuery, [
        notificationData.userId,
        notificationData.title || notificationData.message, // usa message como title se não fornecido
        notificationData.message,
        notificationData.type || 'info'
      ]);
      
      const notification = {
        id: result.rows[0].id,
        userId: result.rows[0].user_id,
        message: result.rows[0].message,
        createdAt: result.rows[0].created_at
      };

      console.log('✅ Notificação salva com sucesso - ID:', notification.id);
      
      // Emitir evento WebSocket para notificação em tempo real
      if (this.io) {
        console.log('📡 Emitindo notificação via WebSocket...');
        
        // Emitir para usuário específico se houver userId
        if (data.userId) {
          this.io.to(`user:${data.userId}`).emit('new-notification', notification);
        } else {
          // Emitir para todos os usuários baseado no tipo de notificação
          if (data.type === 'QUALITY_TEST' || data.type === 'MACHINE_STATUS') {
            this.io.to('leadership').emit('new-notification', notification);
          } else if (data.type === 'TEFLON_CHANGE') {
            this.io.to('operators').emit('new-notification', notification);
            this.io.to('leadership').emit('new-notification', notification);
          } else {
            // Notificação geral para todos
            this.io.emit('new-notification', notification);
          }
        }
      } else {
        console.log('⚠️ Socket.IO não configurado - notificação não enviada em tempo real');
      }
      
      return notification;
    } catch (error) {
      console.error('❌ Erro ao salvar notificação:', error);
      console.error('❌ Código do erro:', error.code);
      console.error('❌ Mensagem do erro:', error.message);
      console.error('❌ Stack trace:', error.stack);
      console.error('❌ Dados da notificação:', JSON.stringify(data, null, 2));
      return null;
    }
  }

  async sendQualityTestNotification(testData) {
    try {
      console.log('📧 Enviando notificação de teste de qualidade...');
      
      // Salvar notificação no banco
      await this.saveNotification({
        type: 'QUALITY_TEST',
        title: `Teste de Qualidade ${testData.result === 'APPROVED' ? 'Aprovado' : 'Reprovado'}`,
        message: `Máquina: ${testData.machine?.name} - Resultado: ${testData.result}`,
        testId: testData.id,
        machineId: testData.machineId,
        priority: testData.result === 'REJECTED' ? 'HIGH' : 'MEDIUM',
        channels: ['EMAIL', 'PUSH', 'SYSTEM'],
        metadata: {
          result: testData.result,
          machineName: testData.machine?.name,
          operatorName: testData.user?.name
        }
      });

      const results = {};

      // Enviar email
      if (this.emailEnabled) {
        const recipients = await this.getUserEmailsByRole(['LEADER', 'MANAGER', 'ADMIN']);
        if (recipients.length > 0) {
          results.email = await emailService.sendQualityTestAlert(testData, recipients);
        }
      }

      // Enviar push notification
      if (this.pushEnabled) {
        results.push = await pushService.sendQualityTestAlert(testData);
      }

      console.log('✅ Notificação de teste de qualidade enviada');
      return { success: true, results };
    } catch (error) {
      console.error('❌ Erro ao enviar notificação de teste:', error);
      return { success: false, error: error.message };
    }
  }

  async sendTeflonChangeNotification(changeData) {
    try {
      console.log('📧 Enviando notificação de troca de teflon...');
      
      const daysUntilExpiry = Math.ceil((new Date(changeData.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
      const isExpired = daysUntilExpiry <= 0;
      
      // Salvar notificação no banco
      await this.saveNotification({
        type: 'TEFLON_CHANGE',
        title: isExpired ? 'Teflon Vencido' : 'Lembrete de Troca de Teflon',
        message: `${changeData.machine?.name} - ${isExpired ? 'Vencido' : `${daysUntilExpiry} dias restantes`}`,
        changeId: changeData.id,
        machineId: changeData.machineId,
        priority: isExpired ? 'HIGH' : 'MEDIUM',
        channels: ['EMAIL', 'PUSH', 'SYSTEM'],
        metadata: {
          daysUntilExpiry,
          isExpired,
          machineName: changeData.machine?.name,
          expiryDate: changeData.expiryDate
        }
      });

      const results = {};

      // Enviar email
      if (this.emailEnabled) {
        const recipients = await this.getUserEmailsByRole(['OPERATOR', 'LEADER', 'MANAGER', 'ADMIN']);
        if (recipients.length > 0) {
          results.email = await emailService.sendTeflonChangeReminder(changeData, recipients);
        }
      }

      // Enviar push notification
      if (this.pushEnabled) {
        results.push = await pushService.sendTeflonChangeAlert(changeData);
      }

      console.log('✅ Notificação de troca de teflon enviada');
      return { success: true, results };
    } catch (error) {
      console.error('❌ Erro ao enviar notificação de teflon:', error);
      return { success: false, error: error.message };
    }
  }

  async sendMachineStatusNotification(machineId, status, previousStatus, operatorName, reason, notes) {
    try {
      console.log('📧 Enviando notificação de status de máquina...');
      console.log('🏭 Parâmetros recebidos:', { machineId, status, previousStatus, operatorName, reason, notes });
      
      // Buscar dados da máquina
      const machineResult = await pool.query(
        'SELECT * FROM machines WHERE id = $1',
        [machineId]
      );
      const machine = machineResult.rows[0];
      
      if (!machine) {
        console.log('❌ Máquina não encontrada');
        return { success: false, error: 'Máquina não encontrada' };
      }
      
      console.log('🏭 Dados da máquina encontrada:', JSON.stringify(machine, null, 2));
      
      // Buscar usuários que devem receber a notificação
      const targetUsers = await this.getUsersByRole(['LEADER', 'MANAGER', 'ADMIN']);
      console.log(`📋 Criando notificações para ${targetUsers.length} usuários`);
      targetUsers.forEach(user => {
        console.log(`   - ${user.name} (${user.role}) - ID: ${user.id}`);
      });
      
      if (targetUsers.length === 0) {
        console.log('⚠️ Nenhum usuário encontrado para enviar notificações');
        return { success: false, error: 'Nenhum usuário encontrado' };
      }
      
      // Criar notificação individual para cada usuário
      let createdNotifications = 0;
      for (const user of targetUsers) {
        console.log(`\n🔄 Criando notificação para: ${user.name} (ID: ${user.id})`);
        
        const notificationData = {
          type: 'MACHINE_STATUS',
          title: 'Status da Máquina Alterado',
          message: `${machine.name} - Status: ${status}${reason ? ` (${reason})` : ''}`,
          userId: user.id,
          machineId: machineId,
          priority: status === 'ERROR' || status === 'PARADA' ? 'HIGH' : 'MEDIUM',
          channels: ['EMAIL', 'PUSH', 'SYSTEM'],
          metadata: {
            status: status,
            previousStatus: previousStatus,
            machineName: machine.name,
            location: machine.location,
            operatorName: operatorName,
            reason: reason,
            notes: notes
          }
        };
        
        console.log(`📋 Dados da notificação para ${user.name}:`, JSON.stringify(notificationData, null, 2));
        
        const notification = await this.saveNotification(notificationData);
        if (notification) {
          console.log(`✅ Notificação criada com sucesso para ${user.name} - ID: ${notification.id}`);
          createdNotifications++;
        } else {
          console.log(`❌ Falha ao criar notificação para ${user.name}`);
        }
      }
      
      console.log(`📊 Notificações criadas: ${createdNotifications}/${targetUsers.length}`);

      const results = {};

      // Enviar email
      if (this.emailEnabled) {
        const recipients = await this.getUserEmailsByRole(['LEADER', 'MANAGER', 'ADMIN']);
        if (recipients.length > 0) {
          results.email = await emailService.sendMachineStatusAlert(machineData, recipients);
        }
      }

      // Enviar push notification
      if (this.pushEnabled) {
        results.push = await pushService.sendMachineStatusAlert(machineData);
      }

      console.log('✅ Notificação de status de máquina enviada');
      return { success: true, results };
    } catch (error) {
      console.error('❌ Erro ao enviar notificação de máquina:', error);
      console.error('❌ Stack trace:', error.stack);
      return { success: false, error: error.message };
    }
  }

  async sendDailyReport() {
    try {
      console.log('📊 Gerando e enviando relatório diário...');
      
      // Calcular dados do relatório
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0));
      const endOfDay = new Date(today.setHours(23, 59, 59, 999));

      const [qualityTestsResult, machinesResult, teflonChangesResult] = await Promise.all([
        pool.query(
          `SELECT * FROM "QualityTest" 
           WHERE "createdAt" >= $1 AND "createdAt" <= $2`,
          [startOfDay, endOfDay]
        ),
        pool.query(
          `SELECT * FROM "Machine" WHERE status = 'ACTIVE'`
        ),
        pool.query(
          `SELECT * FROM "TeflonChange" 
           WHERE "changeDate" >= $1 AND "changeDate" <= $2`,
          [startOfDay, endOfDay]
        )
      ]);
      const qualityTests = qualityTestsResult.rows;
      const machines = machinesResult.rows;
      const teflonChanges = teflonChangesResult.rows;

      const approvedTests = qualityTests.filter(test => test.result === 'APPROVED').length;
      const rejectedTests = qualityTests.filter(test => test.result === 'REJECTED').length;
      const totalTests = qualityTests.length;
      const qualityRate = totalTests > 0 ? Math.round((approvedTests / totalTests) * 100) : 0;

      const reportData = {
        date: today.toISOString().split('T')[0],
        approvedTests,
        rejectedTests,
        totalTests,
        qualityRate,
        activeMachines: machines.length,
        teflonChanges: teflonChanges.length
      };

      // Salvar notificação no banco
      await this.saveNotification({
        type: 'DAILY_REPORT',
        title: 'Relatório Diário Disponível',
        message: `Taxa de qualidade: ${qualityRate}% - ${totalTests} testes realizados`,
        priority: 'LOW',
        channels: ['EMAIL', 'PUSH', 'SYSTEM'],
        metadata: reportData
      });

      const results = {};

      // Enviar email
      if (this.emailEnabled) {
        const recipients = await this.getUserEmailsByRole(['MANAGER', 'ADMIN']);
        if (recipients.length > 0) {
          results.email = await emailService.sendDailyReport(reportData, recipients);
        }
      }

      // Enviar push notification
      if (this.pushEnabled) {
        results.push = await pushService.sendDailyReportNotification(reportData);
      }

      console.log('✅ Relatório diário enviado');
      return { success: true, results, reportData };
    } catch (error) {
      console.error('❌ Erro ao enviar relatório diário:', error);
      return { success: false, error: error.message };
    }
  }

  async getNotifications(userId, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        unreadOnly = false,
        type = null
      } = options;

      const where = {
        OR: [
          { userId },
          { userId: null } // Notificações globais
        ]
      };

      if (unreadOnly) {
        where.read = false;
      }

      if (type) {
        where.type = type;
      }

      let whereClause = 'WHERE 1=1';
      const params = [];
      let paramIndex = 1;
      
      if (userId) {
        whereClause += ` AND (n."userId" = $${paramIndex} OR n."userId" IS NULL)`;
        params.push(userId);
        paramIndex++;
      }
      if (read !== undefined) {
        whereClause += ` AND n.read = $${paramIndex}`;
        params.push(read);
        paramIndex++;
      }
      if (type) {
        whereClause += ` AND n.type = $${paramIndex}`;
        params.push(type);
        paramIndex++;
      }
      
      const offset = (page - 1) * limit;
      
      const [notificationsResult, totalResult] = await Promise.all([
        pool.query(
          `SELECT n.*, 
                  json_build_object(
                    'name', m.name,
                    'location', m.location
                  ) as machine,
                  json_build_object(
                    'name', u.name,
                    'email', u.email
                  ) as user
           FROM "Notification" n
           LEFT JOIN "Machine" m ON n."machineId" = m.id
           LEFT JOIN users u ON n."userId" = u.id
           ${whereClause}
           ORDER BY n."createdAt" DESC
           LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
          [...params, limit, offset]
        ),
        pool.query(
          `SELECT COUNT(*) as total FROM "Notification" n ${whereClause}`,
          params
        )
      ]);
      
      const notifications = notificationsResult.rows;
      const total = parseInt(totalResult.rows[0].total);

      return {
        success: true,
        data: notifications,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('❌ Erro ao buscar notificações:', error);
      return { success: false, error: error.message };
    }
  }

  async markAsRead(notificationId, userId) {
    try {
      await pool.query(
        `UPDATE "Notification" 
         SET read = true, "readAt" = $1, "updatedAt" = $1
         WHERE id = $2 AND ("userId" = $3 OR "userId" IS NULL)`,
        [new Date(), notificationId, userId]
      );

      return { success: true };
    } catch (error) {
      console.error('❌ Erro ao marcar notificação como lida:', error);
      return { success: false, error: error.message };
    }
  }

  async markAllAsRead(userId) {
    try {
      await pool.query(
          `UPDATE "Notification" 
           SET read = true, "readAt" = $1, "updatedAt" = $1
           WHERE ("userId" = $2 OR "userId" IS NULL) AND read = false`,
          [new Date(), userId]
        );

      return { success: true };
    } catch (error) {
      console.error('❌ Erro ao marcar todas as notificações como lidas:', error);
      return { success: false, error: error.message };
    }
  }

  // Método para notificações de vencimento de teflon
  async sendTeflonExpiryNotification(teflonData) {
    try {
      console.log('📧 Enviando notificação de vencimento de teflon...');
      
      const { machine, user, daysUntilExpiry, expiryDate } = teflonData;
      const isExpired = daysUntilExpiry <= 0;
      const urgencyLevel = daysUntilExpiry <= 1 ? 'HIGH' : 'MEDIUM';
      
      const title = isExpired 
        ? '🚨 Teflon Vencido'
        : `⚠️ Teflon Vencerá em ${daysUntilExpiry} dia(s)`;
        
      const message = isExpired
        ? `O teflon da máquina ${machine.name} está vencido desde ${expiryDate.toLocaleDateString('pt-BR')}`
        : `O teflon da máquina ${machine.name} vencerá em ${daysUntilExpiry} dia(s) (${expiryDate.toLocaleDateString('pt-BR')})`;
      
      // Salvar notificação no banco
      await this.saveNotification({
        type: 'TEFLON_CHANGE',
        title,
        message,
        machineId: machine.id,
        changeId: teflonData.id,
        priority: urgencyLevel,
        channels: ['EMAIL', 'PUSH', 'SYSTEM'],
        metadata: {
          machineName: machine.name,
          teflonType: teflonData.teflonType,
          expiryDate: expiryDate.toISOString(),
          daysUntilExpiry,
          isExpired,
          operatorName: user.name
        }
      });

      const results = {};

      // Buscar emails específicos: operador que fez a troca + líderes e gestores
      const [operatorEmail, roleEmails] = await Promise.all([
        // Email do operador específico que fez a troca
        pool.query(
          'SELECT email FROM users WHERE id = $1',
          [user.id]
        ).then(result => result.rows[0]),
        // Emails de líderes, gestores e admins
        this.getUserEmailsByRole(['LEADER', 'MANAGER', 'ADMIN'])
      ]);
      
      const recipients = [...roleEmails];
      if (operatorEmail?.email && !recipients.includes(operatorEmail.email)) {
        recipients.push(operatorEmail.email);
      }
      
      // Enviar email
      if (this.emailEnabled && recipients.length > 0) {
        results.email = await emailService.sendTeflonExpiryAlert({
          machine: machine.name,
          teflonType: teflonData.teflonType,
          expiryDate: expiryDate.toLocaleDateString('pt-BR'),
          daysUntilExpiry,
          isExpired,
          operatorName: user.name
        }, recipients);
      }

      // Enviar push notification
      if (this.pushEnabled) {
        results.push = await pushService.sendTeflonExpiryAlert({
          title,
          message,
          machineId: machine.id,
          urgencyLevel
        });
      }

      console.log('✅ Notificação de vencimento de teflon enviada');
      return { success: true, results };
    } catch (error) {
      console.error('❌ Erro ao enviar notificação de teflon:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Enviar notificação para usuários de uma role específica
   * @param {string} role - Role dos usuários (OPERATOR, LEADER, MANAGER, ADMIN)
   * @param {Object} notificationData - Dados da notificação
   */
  async sendToRole(role, notificationData) {
    try {
      console.log(`📢 Enviando notificação para role: ${role}`);
      console.log(`📋 Dados da notificação:`, notificationData);
      
      // Buscar usuários da role específica
      const users = await this.getUsersByRole([role]);
      
      if (users.length === 0) {
        console.log(`⚠️ Nenhum usuário encontrado para a role: ${role}`);
        return { success: true, sent: 0 };
      }
      
      const results = {
        email: { success: true, sent: 0 },
        push: { success: true, sent: 0 },
        database: { success: true, sent: 0 }
      };
      
      // Salvar notificação no banco para cada usuário
      for (const user of users) {
        const notification = await this.saveNotification({
          ...notificationData,
          userId: user.id
        });
        
        if (notification) {
          results.database.sent++;
        }
      }
      
      // Enviar email se habilitado
      if (this.emailEnabled) {
        const emails = users.map(user => user.email).filter(email => email);
        if (emails.length > 0) {
          // Aqui você pode implementar o envio de email específico
          console.log(`📧 Enviando emails para ${emails.length} usuários da role ${role}`);
          results.email.sent = emails.length;
        }
      }
      
      // Enviar push notification se habilitado
      if (this.pushEnabled) {
        const pushResult = await pushService.sendToRole(role, {
          title: notificationData.title,
          body: notificationData.message
        }, notificationData.metadata || {});
        
        results.push = pushResult;
      }
      
      console.log(`✅ Notificação enviada para ${users.length} usuários da role ${role}`);
      return { success: true, results, userCount: users.length };
      
    } catch (error) {
      console.error(`❌ Erro ao enviar notificação para role ${role}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * NOVOS MÉTODOS PARA SISTEMA DE ALERTAS PROFISSIONAL
   */

  /**
   * Cria um novo alerta no sistema
   * @param {Object} alertData - Dados do alerta
   * @param {number} alertData.machine_id - ID da máquina
   * @param {string} alertData.lote - Lote relacionado
   * @param {string} alertData.caixa - Caixa relacionada
   * @param {string} alertData.type - Tipo do alerta (teste, teflon, parada)
   * @param {string} alertData.priority - Prioridade (info, warning, critical)
   * @param {string} alertData.message - Mensagem do alerta
   * @param {number[]} userIds - IDs dos usuários para notificar
   */
  async createAlert(alertData, userIds = []) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Verificar se já existe um alerta similar em aberto (últimas 24h)
      // Para casos específicos, usar critérios mais específicos
      let duplicateQuery;
      let duplicateParams;
      
      if (alertData.type && alertData.type.includes('specific_case')) {
        // Para casos específicos, verificar por tipo específico e máquina
        duplicateQuery = `
          SELECT id FROM alerts 
          WHERE machine_id = $1 
            AND type = $2 
            AND message LIKE $3
            AND created_at > NOW() - INTERVAL '2 hours'
          ORDER BY created_at DESC 
          LIMIT 1
        `;
        duplicateParams = [alertData.machine_id, alertData.type, `%${alertData.message.substring(0, 50)}%`];
      } else {
        // Para alertas gerais, usar critérios padrão
        duplicateQuery = `
          SELECT id FROM alerts 
          WHERE machine_id = $1 
            AND type = $2 
            AND priority = $3 
            AND created_at > NOW() - INTERVAL '24 hours'
          ORDER BY created_at DESC 
          LIMIT 1
        `;
        duplicateParams = [alertData.machine_id, alertData.type, alertData.priority];
      }
      
      const duplicateCheck = await client.query(duplicateQuery, duplicateParams);
      
      if (duplicateCheck.rows.length > 0) {
        console.log('⚠️ Alerta duplicado detectado, ignorando...', {
          type: alertData.type,
          machine_id: alertData.machine_id
        });
        await client.query('ROLLBACK');
        return { success: false, reason: 'duplicate', existingAlertId: duplicateCheck.rows[0].id };
      }
      
      // Inserir novo alerta
      const alertResult = await client.query(`
        INSERT INTO alerts (machine_id, lote, caixa, type, priority, message)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [alertData.machine_id, alertData.lote, alertData.caixa, alertData.type, alertData.priority, alertData.message]);
      
      const alert = alertResult.rows[0];
      
      // Se não foram especificados usuários, buscar todos os usuários ativos
      if (userIds.length === 0) {
        const usersResult = await client.query('SELECT id FROM users WHERE is_active = true');
        userIds = usersResult.rows.map(row => row.id);
      }
      
      // Enviar notificações para cada usuário
      for (const userId of userIds) {
        await this.sendNotificationToUser(userId, alert, client);
      }
      
      await client.query('COMMIT');
      
      console.log(`✅ Alerta criado e enviado para ${userIds.length} usuários`);
      return { success: true, alert, notifiedUsers: userIds.length };
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Erro ao criar alerta:', error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Envia notificação para um usuário específico
   */
  async sendNotificationToUser(userId, alert, client) {
    try {
      // Buscar preferências do usuário
      const prefsResult = await client.query(`
        SELECT ac.*, u.email, u.phone 
        FROM alert_channels ac
        JOIN users u ON u.id = ac.user_id
        WHERE ac.user_id = $1
      `, [userId]);
      
      if (prefsResult.rows.length === 0) {
        console.log(`⚠️ Usuário ${userId} não possui configurações de alerta`);
        return;
      }
      
      const userPrefs = prefsResult.rows[0];
      
      // Verificar se a prioridade do alerta atende ao mínimo configurado
      const priorityLevels = { info: 1, warning: 2, critical: 3 };
      const alertLevel = priorityLevels[alert.priority] || 1;
      const minLevel = priorityLevels[userPrefs.min_priority] || 1;
      
      if (alertLevel < minLevel) {
        console.log(`⚠️ Alerta ${alert.priority} abaixo do mínimo ${userPrefs.min_priority} para usuário ${userId}`);
        return;
      }
      
      const notificationPromises = [];
      
      // Email
      if (userPrefs.email && userPrefs.email) {
        notificationPromises.push(this.sendAlertEmail(userPrefs.email, alert));
      }
      
      // SMS
      if (userPrefs.sms && userPrefs.phone) {
        notificationPromises.push(this.sendAlertSMS(userPrefs.phone, alert));
      }
      
      // WhatsApp
      if (userPrefs.whatsapp && userPrefs.phone) {
        notificationPromises.push(this.sendAlertWhatsApp(userPrefs.phone, alert));
      }
      
      // Executar envios em paralelo
      const results = await Promise.allSettled(notificationPromises);
      
      // Registrar log de notificação
      const channels = [];
      if (userPrefs.email) channels.push('email');
      if (userPrefs.sms) channels.push('sms');
      if (userPrefs.whatsapp) channels.push('whatsapp');
      
      await client.query(`
        INSERT INTO notification_logs (alert_id, user_id, channels, status, sent_at)
        VALUES ($1, $2, $3, $4, NOW())
      `, [alert.id, userId, JSON.stringify(channels), 'sent']);
      
      console.log(`📤 Notificação enviada para usuário ${userId} via ${channels.join(', ')}`);
      
      // Emitir via WebSocket se disponível
      if (this.io) {
        const priorityConfig = this.priorities[alert.priority];
        this.io.to(`user:${userId}`).emit('new-alert', {
          ...alert,
          priorityConfig,
          timestamp: new Date().toISOString()
        });
      }
      
    } catch (error) {
      console.error(`❌ Erro ao enviar notificação para usuário ${userId}:`, error);
      
      // Registrar erro no log
      await client.query(`
        INSERT INTO notification_logs (alert_id, user_id, channels, status, error_message, sent_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
      `, [alert.id, userId, '[]', 'failed', error.message]);
    }
  }
  
  /**
   * Envia email de alerta
   */
  async sendAlertEmail(email, alert) {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      throw new Error('Configurações de email não encontradas');
    }
    
    const priorityConfig = this.priorities[alert.priority];
    const subject = `🚨 Alerta ${alert.priority.toUpperCase()} - Máquina ${alert.machine_id}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: ${priorityConfig.color}; color: white; padding: 20px; text-align: center;">
          <h2>🚨 Alerta do Sistema ZARA</h2>
        </div>
        <div style="padding: 20px; background: #f9f9f9;">
          <h3>Detalhes do Alerta:</h3>
          <ul>
            <li><strong>Máquina:</strong> ${alert.machine_id}</li>
            <li><strong>Tipo:</strong> ${alert.type}</li>
            <li><strong>Prioridade:</strong> ${alert.priority}</li>
            <li><strong>Lote:</strong> ${alert.lote || 'N/A'}</li>
            <li><strong>Caixa:</strong> ${alert.caixa || 'N/A'}</li>
            <li><strong>Data:</strong> ${new Date(alert.created_at).toLocaleString('pt-BR')}</li>
          </ul>
          <div style="background: white; padding: 15px; border-left: 4px solid ${priorityConfig.color};">
            <strong>Mensagem:</strong><br>
            ${alert.message}
          </div>
        </div>
        <div style="padding: 20px; text-align: center; color: #666;">
          <small>Sistema ZARA - Controle de Operações</small>
        </div>
      </div>
    `;
    
    await emailTransporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject,
      html
    });
  }
  
  /**
   * Envia SMS de alerta
   */
  async sendAlertSMS(phone, alert) {
    // Implementação futura com Twilio ou Zenvia
    console.log(`📱 SMS seria enviado para ${phone}: ${alert.message}`);
  }
  
  /**
   * Envia WhatsApp via Meta Cloud API
   */
  async sendAlertWhatsApp(phone, alert) {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_ID;
    
    if (!token || !phoneNumberId) {
      throw new Error('Configurações do WhatsApp não encontradas');
    }
    
    const message = `🚨 *Alerta ZARA*\n\n` +
      `*Máquina:* ${alert.machine_id}\n` +
      `*Tipo:* ${alert.type}\n` +
      `*Prioridade:* ${alert.priority}\n` +
      `*Lote:* ${alert.lote || 'N/A'}\n` +
      `*Caixa:* ${alert.caixa || 'N/A'}\n\n` +
      `*Mensagem:* ${alert.message}\n\n` +
      `_${new Date(alert.created_at).toLocaleString('pt-BR')}_`;
    
    const response = await fetch(`https://graph.facebook.com/v17.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body: message }
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Erro no WhatsApp: ${error}`);
    }
  }
  
  /**
   * Busca alertas com filtros
   */
  async getAlerts(filters = {}) {
    const { machine_id, lote, type, priority, start_date, end_date, limit = 50, offset = 0 } = filters;
    
    let query = 'SELECT * FROM alerts WHERE 1=1';
    const params = [];
    let paramCount = 0;
    
    if (machine_id) {
      query += ` AND machine_id = $${++paramCount}`;
      params.push(machine_id);
    }
    
    if (lote) {
      query += ` AND lote ILIKE $${++paramCount}`;
      params.push(`%${lote}%`);
    }
    
    if (type) {
      query += ` AND type = $${++paramCount}`;
      params.push(type);
    }
    
    if (priority) {
      query += ` AND priority = $${++paramCount}`;
      params.push(priority);
    }
    
    if (start_date) {
      query += ` AND created_at >= $${++paramCount}`;
      params.push(start_date);
    }
    
    if (end_date) {
      query += ` AND created_at <= $${++paramCount}`;
      params.push(end_date);
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    return result.rows;
  }
  
  /**
   * Busca configurações de alerta de um usuário
   */
  async getUserAlertConfig(userId) {
    const result = await pool.query('SELECT * FROM alert_channels WHERE user_id = $1', [userId]);
    return result.rows[0] || null;
  }
  
  /**
   * Atualiza configurações de alerta de um usuário
   */
  async updateUserAlertConfig(userId, config) {
    const { email, sms, whatsapp, sound, min_priority } = config;
    
    const result = await pool.query(`
      UPDATE alert_channels 
      SET email = $2, sms = $3, whatsapp = $4, sound = $5, min_priority = $6, updated_at = NOW()
      WHERE user_id = $1
      RETURNING *
    `, [userId, email, sms, whatsapp, sound, min_priority]);
    
    return result.rows[0];
  }
}

module.exports = new NotificationService();