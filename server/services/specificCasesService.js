const pool = require('../config/database');
const notificationService = require('./notificationService');
const externalNotificationService = require('./externalNotifications');

class SpecificCasesService {
  constructor() {
    this.caseTypes = {
      QUALITY_TEST: 'quality_test',
      TEFLON_CHANGE: 'teflon_change',
      VALIDITY_CHECK: 'validity_check'
    };
  }

  // Verificar testes de qualidade pendentes
  async checkQualityTests() {
    try {
      const query = `
        SELECT 
          qt.*,
          m.name as machine_name,
          m.location as machine_location
        FROM quality_tests qt
        JOIN machines m ON qt.machine_id = m.id
        WHERE qt.status = 'pending'
          AND qt.scheduled_date <= NOW()
          AND qt.notified = false
        ORDER BY qt.priority DESC, qt.scheduled_date ASC
      `;
      
      const result = await pool.query(query);
      const pendingTests = result.rows;

      for (const test of pendingTests) {
        await this.createQualityTestNotification(test);
      }

      return pendingTests;
    } catch (error) {
      console.error('Erro ao verificar testes de qualidade:', error);
      throw error;
    }
  }

  // Verificar necessidade de troca de teflon
  async checkTeflonChanges() {
    try {
      const query = `
        SELECT 
          t.*,
          m.name as machine_name,
          m.location as machine_location,
          EXTRACT(DAYS FROM (NOW() - t.last_change_date)) as days_since_change
        FROM teflon_tracking t
        JOIN machines m ON t.machine_id = m.id
        WHERE (
          (t.usage_hours >= t.max_usage_hours - 24) OR
          (EXTRACT(DAYS FROM (NOW() - t.last_change_date)) >= t.max_days - 1)
        )
        AND t.status = 'active'
        AND t.notified = false
        ORDER BY 
          CASE 
            WHEN t.usage_hours >= t.max_usage_hours THEN 1
            WHEN EXTRACT(DAYS FROM (NOW() - t.last_change_date)) >= t.max_days THEN 2
            ELSE 3
          END,
          t.usage_hours DESC
      `;
      
      const result = await pool.query(query);
      const teflonChanges = result.rows;

      for (const teflon of teflonChanges) {
        await this.createTeflonChangeNotification(teflon);
      }

      return teflonChanges;
    } catch (error) {
      console.error('Erro ao verificar trocas de teflon:', error);
      throw error;
    }
  }

  // Verificar validades de produtos/materiais
  async checkValidityDates() {
    try {
      const query = `
        SELECT 
          v.*,
          EXTRACT(DAYS FROM (v.expiry_date - NOW())) as days_until_expiry
        FROM validity_tracking v
        WHERE v.expiry_date <= NOW() + INTERVAL '7 days'
          AND v.status = 'active'
          AND v.notified = false
        ORDER BY 
          CASE 
            WHEN v.expiry_date <= NOW() THEN 1
            WHEN v.expiry_date <= NOW() + INTERVAL '1 day' THEN 2
            WHEN v.expiry_date <= NOW() + INTERVAL '3 days' THEN 3
            ELSE 4
          END,
          v.expiry_date ASC
      `;
      
      const result = await pool.query(query);
      const validityItems = result.rows;

      for (const item of validityItems) {
        await this.createValidityNotification(item);
      }

      return validityItems;
    } catch (error) {
      console.error('Erro ao verificar validades:', error);
      throw error;
    }
  }

  // Criar notificação para teste de qualidade
  async createQualityTestNotification(test) {
    try {
      const priority = this.getQualityTestPriority(test);
      const message = this.formatQualityTestMessage(test);
      
      const alertData = {
        type: 'quality_test',
        priority,
        title: 'Teste de Qualidade Pendente',
        message,
        machine_id: test.machine_id,
        metadata: {
          test_id: test.id,
          test_type: test.test_type,
          scheduled_date: test.scheduled_date,
          machine_name: test.machine_name
        }
      };

      // Criar alerta no sistema
      const alert = await notificationService.createAlert(alertData);

      // Enviar notificações externas se necessário
      if (priority === 'HIGH' || priority === 'URGENT') {
        await this.sendExternalNotification(alert, 'quality_test');
      }

      // Marcar como notificado
      await pool.query(
        'UPDATE quality_tests SET notified = true, notification_sent_at = NOW() WHERE id = $1',
        [test.id]
      );

      return alert;
    } catch (error) {
      console.error('Erro ao criar notificação de teste de qualidade:', error);
      throw error;
    }
  }

  // Criar notificação para troca de teflon
  async createTeflonChangeNotification(teflon) {
    try {
      const priority = this.getTeflonChangePriority(teflon);
      const message = this.formatTeflonChangeMessage(teflon);
      
      const alertData = {
        type: 'teflon_change',
        priority,
        title: 'Troca de Teflon Necessária',
        message,
        machine_id: teflon.machine_id,
        metadata: {
          teflon_id: teflon.id,
          usage_hours: teflon.usage_hours,
          max_usage_hours: teflon.max_usage_hours,
          days_since_change: teflon.days_since_change,
          machine_name: teflon.machine_name
        }
      };

      // Criar alerta no sistema
      const alert = await notificationService.createAlert(alertData);

      // Enviar notificações externas se necessário
      if (priority === 'HIGH' || priority === 'URGENT') {
        await this.sendExternalNotification(alert, 'teflon_change');
      }

      // Marcar como notificado
      await pool.query(
        'UPDATE teflon_tracking SET notified = true, notification_sent_at = NOW() WHERE id = $1',
        [teflon.id]
      );

      return alert;
    } catch (error) {
      console.error('Erro ao criar notificação de troca de teflon:', error);
      throw error;
    }
  }

  // Criar notificação para validade
  async createValidityNotification(item) {
    try {
      const priority = this.getValidityPriority(item);
      const message = this.formatValidityMessage(item);
      
      const alertData = {
        type: 'validity_check',
        priority,
        title: 'Validade de Produto/Material',
        message,
        metadata: {
          validity_id: item.id,
          item_name: item.item_name,
          item_type: item.item_type,
          expiry_date: item.expiry_date,
          days_until_expiry: item.days_until_expiry,
          location: item.location
        }
      };

      // Criar alerta no sistema
      const alert = await notificationService.createAlert(alertData);

      // Enviar notificações externas se necessário
      if (priority === 'HIGH' || priority === 'URGENT') {
        await this.sendExternalNotification(alert, 'validity_check');
      }

      // Marcar como notificado
      await pool.query(
        'UPDATE validity_tracking SET notified = true, notification_sent_at = NOW() WHERE id = $1',
        [item.id]
      );

      return alert;
    } catch (error) {
      console.error('Erro ao criar notificação de validade:', error);
      throw error;
    }
  }

  // Determinar prioridade do teste de qualidade
  getQualityTestPriority(test) {
    const now = new Date();
    const scheduledDate = new Date(test.scheduled_date);
    const hoursOverdue = (now - scheduledDate) / (1000 * 60 * 60);

    if (hoursOverdue > 24) return 'URGENT';
    if (hoursOverdue > 4) return 'HIGH';
    if (hoursOverdue > 0) return 'MEDIUM';
    return 'LOW';
  }

  // Determinar prioridade da troca de teflon
  getTeflonChangePriority(teflon) {
    const usagePercentage = (teflon.usage_hours / teflon.max_usage_hours) * 100;
    const daysSinceChange = teflon.days_since_change;

    if (usagePercentage >= 100 || daysSinceChange >= teflon.max_days) return 'URGENT';
    if (usagePercentage >= 95 || daysSinceChange >= teflon.max_days - 1) return 'HIGH';
    if (usagePercentage >= 90 || daysSinceChange >= teflon.max_days - 2) return 'MEDIUM';
    return 'LOW';
  }

  // Determinar prioridade da validade
  getValidityPriority(item) {
    const daysUntilExpiry = item.days_until_expiry;

    if (daysUntilExpiry <= 0) return 'URGENT';
    if (daysUntilExpiry <= 1) return 'HIGH';
    if (daysUntilExpiry <= 3) return 'MEDIUM';
    return 'LOW';
  }

  // Formatar mensagem do teste de qualidade
  formatQualityTestMessage(test) {
    const scheduledDate = new Date(test.scheduled_date).toLocaleString('pt-BR');
    return `Teste de qualidade ${test.test_type} pendente para a máquina ${test.machine_name} (${test.machine_location}). Agendado para: ${scheduledDate}`;
  }

  // Formatar mensagem da troca de teflon
  formatTeflonChangeMessage(teflon) {
    const usagePercentage = Math.round((teflon.usage_hours / teflon.max_usage_hours) * 100);
    return `Troca de teflon necessária na máquina ${teflon.machine_name} (${teflon.machine_location}). Uso atual: ${teflon.usage_hours}h/${teflon.max_usage_hours}h (${usagePercentage}%). Última troca: ${teflon.days_since_change} dias atrás.`;
  }

  // Formatar mensagem da validade
  formatValidityMessage(item) {
    const expiryDate = new Date(item.expiry_date).toLocaleDateString('pt-BR');
    const daysText = item.days_until_expiry <= 0 ? 'VENCIDO' : `${Math.ceil(item.days_until_expiry)} dias`;
    return `${item.item_type}: ${item.item_name} - Validade: ${expiryDate} (${daysText}). Localização: ${item.location || 'Não informada'}`;
  }

  // Enviar notificação externa
  async sendExternalNotification(alert, caseType) {
    try {
      const users = await this.getUsersForNotification(caseType, alert.priority);
      
      for (const user of users) {
        if (user.external_notifications_enabled) {
          await externalNotificationService.sendMultiChannelNotification(
            user,
            {
              title: alert.title,
              message: alert.message,
              priority: alert.priority,
              type: caseType
            }
          );
        }
      }
    } catch (error) {
      console.error('Erro ao enviar notificação externa:', error);
      // Não falhar o processo principal se notificação externa falhar
    }
  }

  // Obter usuários para notificação baseado no tipo de caso
  async getUsersForNotification(caseType, priority) {
    try {
      let roleCondition = '';
      
      switch (caseType) {
        case 'quality_test':
          roleCondition = "(role = 'quality_manager' OR role = 'supervisor' OR role = 'admin')";
          break;
        case 'teflon_change':
          roleCondition = "(role = 'maintenance' OR role = 'supervisor' OR role = 'admin')";
          break;
        case 'validity_check':
          roleCondition = "(role = 'inventory_manager' OR role = 'supervisor' OR role = 'admin')";
          break;
        default:
          roleCondition = "role = 'admin'";
      }

      const query = `
        SELECT u.*, up.external_notifications_enabled
        FROM users u
        LEFT JOIN user_preferences up ON u.id = up.user_id
        WHERE u.active = true 
          AND ${roleCondition}
          AND (up.external_notifications_enabled IS NULL OR up.external_notifications_enabled = true)
      `;
      
      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      console.error('Erro ao obter usuários para notificação:', error);
      return [];
    }
  }

  // Executar verificação de todos os casos específicos
  async runAllChecks() {
    try {
      console.log('Iniciando verificação de casos específicos...');
      
      const results = {
        qualityTests: await this.checkQualityTests(),
        teflonChanges: await this.checkTeflonChanges(),
        validityChecks: await this.checkValidityDates()
      };

      const totalNotifications = 
        results.qualityTests.length + 
        results.teflonChanges.length + 
        results.validityChecks.length;

      console.log(`Verificação concluída. ${totalNotifications} notificações criadas.`);
      return results;
    } catch (error) {
      console.error('Erro na verificação de casos específicos:', error);
      throw error;
    }
  }
}

module.exports = new SpecificCasesService();