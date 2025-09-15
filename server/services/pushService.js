const admin = require('firebase-admin');
const pool = require('../config/database');

class PushNotificationService {
  constructor() {
    this.initialized = false;
    this.initializeFirebase();
  }

  async initializeFirebase() {
    try {
      // Verificar se as credenciais do Firebase estão configuradas
      if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL) {
        console.log('⚠️ Firebase não configurado - Push notifications desabilitadas');
        this.initialized = false;
        return;
      }

      // Verificar se já foi inicializado
      if (admin.apps.length === 0) {
        // Configuração do Firebase Admin SDK
        const serviceAccount = {
          type: "service_account",
          project_id: process.env.FIREBASE_PROJECT_ID,
          private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
          private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          client_email: process.env.FIREBASE_CLIENT_EMAIL,
          client_id: process.env.FIREBASE_CLIENT_ID,
          auth_uri: "https://accounts.google.com/o/oauth2/auth",
          token_uri: "https://oauth2.googleapis.com/token",
          auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
          client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
        };

        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: process.env.FIREBASE_PROJECT_ID
        });
      }

      this.initialized = true;
      console.log('🔥 Firebase Admin SDK inicializado com sucesso');
    } catch (error) {
      console.error('❌ Erro ao inicializar Firebase:', error.message);
      this.initialized = false;
    }
  }

  async registerDeviceToken(userId, token, deviceInfo = {}) {
    try {
      // Salvar token no banco de dados
      const deviceInfoJson = JSON.stringify(deviceInfo);
      const query = `
        INSERT INTO user_devices (user_id, token, device_info, last_used, active, created_at, updated_at)
        VALUES ($1, $2, $3, NOW(), true, NOW(), NOW())
        ON CONFLICT (user_id, token)
        DO UPDATE SET
          device_info = $3,
          last_used = NOW(),
          active = true,
          updated_at = NOW()
      `;
      
      await pool.query(query, [userId, token, deviceInfoJson]);

      console.log(`📱 Token de dispositivo registrado para usuário ${userId}`);
      return { success: true };
    } catch (error) {
      console.error('❌ Erro ao registrar token:', error);
      return { success: false, error: error.message };
    }
  }

  async sendToUser(userId, notification, data = {}) {
    try {
      if (!this.initialized) {
        throw new Error('Firebase não inicializado');
      }

      // Buscar tokens do usuário
      const query = 'SELECT token FROM user_devices WHERE user_id = $1 AND active = true';
      const result = await pool.query(query, [userId]);
      const userDevices = result.rows;

      if (userDevices.length === 0) {
        console.log(`📱 Nenhum dispositivo encontrado para usuário ${userId}`);
        return { success: true, sent: 0 };
      }

      const tokens = userDevices.map(device => device.token);
      return await this.sendToTokens(tokens, notification, data);
    } catch (error) {
      console.error('❌ Erro ao enviar notificação para usuário:', error);
      return { success: false, error: error.message };
    }
  }

  async sendToRole(role, notification, data = {}) {
    try {
      if (!this.initialized) {
        throw new Error('Firebase não inicializado');
      }

      // Buscar usuários com a role específica
      const query = `
        SELECT ud.token 
        FROM users u 
        JOIN user_devices ud ON u.id = ud.user_id 
        WHERE u.role = $1 AND u.is_active = true AND ud.active = true
      `;
      const result = await pool.query(query, [role]);
      const tokens = result.rows.map(row => row.token);

      if (tokens.length === 0) {
        console.log(`📱 Nenhum dispositivo encontrado para role ${role}`);
        return { success: true, sent: 0 };
      }

      return await this.sendToTokens(tokens, notification, data);
    } catch (error) {
      console.error('❌ Erro ao enviar notificação para role:', error);
      return { success: false, error: error.message };
    }
  }

  async sendToTokens(tokens, notification, data = {}) {
    try {
      if (!this.initialized) {
        throw new Error('Firebase não inicializado');
      }

      const message = {
        notification: {
          title: notification.title,
          body: notification.body,
          icon: notification.icon || '/icon-192x192.png'
        },
        data: {
          ...data,
          timestamp: new Date().toISOString()
        },
        tokens
      };

      const response = await admin.messaging().sendMulticast(message);
      
      // Processar tokens inválidos
      if (response.failureCount > 0) {
        const failedTokens = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            failedTokens.push(tokens[idx]);
            console.log(`❌ Token inválido: ${tokens[idx]} - ${resp.error?.message}`);
          }
        });

        // Remover tokens inválidos do banco
        if (failedTokens.length > 0) {
          await this.removeInvalidTokens(failedTokens);
        }
      }

      console.log(`📱 Notificação enviada: ${response.successCount}/${tokens.length} dispositivos`);
      return {
        success: true,
        sent: response.successCount,
        failed: response.failureCount
      };
    } catch (error) {
      console.error('❌ Erro ao enviar notificação:', error);
      return { success: false, error: error.message };
    }
  }

  async removeInvalidTokens(tokens) {
    try {
      if (tokens.length > 0) {
        const placeholders = tokens.map((_, index) => `$${index + 1}`).join(',');
        const query = `UPDATE user_devices SET active = false WHERE token IN (${placeholders})`;
        await pool.query(query, tokens);
      }
      console.log(`🗑️ ${tokens.length} tokens inválidos removidos`);
    } catch (error) {
      console.error('❌ Erro ao remover tokens inválidos:', error);
    }
  }

  async sendQualityTestAlert(testData) {
    const notification = {
      title: `🧪 Teste de Qualidade ${testData.result === 'APPROVED' ? 'Aprovado' : 'Reprovado'}`,
      body: `Máquina: ${testData.machine?.name} - Operador: ${testData.user?.name}`,
      icon: testData.result === 'APPROVED' ? '/icons/success.png' : '/icons/warning.png'
    };

    const data = {
      type: 'quality_test',
      testId: testData.id.toString(),
      result: testData.result,
      machineId: testData.machineId?.toString(),
      url: '/dashboard'
    };

    // Enviar para líderes e gestores
    const results = await Promise.all([
      this.sendToRole('LEADER', notification, data),
      this.sendToRole('MANAGER', notification, data),
      this.sendToRole('ADMIN', notification, data)
    ]);

    return results;
  }

  async sendTeflonChangeAlert(changeData) {
    const daysUntilExpiry = Math.ceil((new Date(changeData.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
    const isExpired = daysUntilExpiry <= 0;

    const notification = {
      title: isExpired ? '🚨 Teflon Vencido!' : '⚠️ Lembrete: Troca de Teflon',
      body: `${changeData.machine?.name} - ${isExpired ? 'Vencido' : `${daysUntilExpiry} dias restantes`}`,
      icon: isExpired ? '/icons/error.png' : '/icons/warning.png'
    };

    const data = {
      type: 'teflon_change',
      changeId: changeData.id.toString(),
      machineId: changeData.machineId?.toString(),
      daysUntilExpiry: daysUntilExpiry.toString(),
      url: '/teflon'
    };

    // Enviar para todos os usuários relevantes
    const results = await Promise.all([
      this.sendToRole('OPERATOR', notification, data),
      this.sendToRole('LEADER', notification, data),
      this.sendToRole('MANAGER', notification, data),
      this.sendToRole('ADMIN', notification, data)
    ]);

    return results;
  }

  async sendMachineStatusAlert(machineData) {
    const statusLabels = {
      'ACTIVE': 'Ativa',
      'INACTIVE': 'Inativa',
      'MAINTENANCE': 'Em Manutenção',
      'ERROR': 'Com Erro'
    };

    const notification = {
      title: '🔧 Status da Máquina Alterado',
      body: `${machineData.name} - ${statusLabels[machineData.status]}`,
      icon: '/icons/machine.png'
    };

    const data = {
      type: 'machine_status',
      machineId: machineData.id.toString(),
      status: machineData.status,
      url: '/machines'
    };

    // Enviar para líderes, gestores e administradores
    const results = await Promise.all([
      this.sendToRole('LEADER', notification, data),
      this.sendToRole('MANAGER', notification, data),
      this.sendToRole('ADMIN', notification, data)
    ]);

    return results;
  }

  async sendDailyReportNotification(reportData) {
    const notification = {
      title: '📊 Relatório Diário Disponível',
      body: `Taxa de qualidade: ${reportData.qualityRate}% - ${reportData.totalTests} testes realizados`,
      icon: '/icons/report.png'
    };

    const data = {
      type: 'daily_report',
      date: new Date().toISOString().split('T')[0],
      qualityRate: reportData.qualityRate.toString(),
      url: '/dashboard'
    };

    // Enviar para gestores e administradores
    const results = await Promise.all([
      this.sendToRole('MANAGER', notification, data),
      this.sendToRole('ADMIN', notification, data)
    ]);

    return results;
  }

  async sendTeflonExpiryAlert(alertData) {
    const { title, message, machineId, urgencyLevel } = alertData;
    
    const notification = {
      title,
      body: message,
      icon: urgencyLevel === 'HIGH' ? '/icons/error.png' : '/icons/warning.png'
    };

    const data = {
      type: 'teflon_expiry',
      machineId: machineId?.toString(),
      urgencyLevel,
      url: '/teflon'
    };

    // Enviar para operadores, líderes, gestores e administradores
    const results = await Promise.all([
      this.sendToRole('OPERATOR', notification, data),
      this.sendToRole('LEADER', notification, data),
      this.sendToRole('MANAGER', notification, data),
      this.sendToRole('ADMIN', notification, data)
    ]);

    return results;
  }
}

module.exports = new PushNotificationService();