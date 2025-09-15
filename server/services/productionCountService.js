const pool = require('../config/database');
const NotificationService = require('./notificationService');

/**
 * Serviço para contagem de produtos e verificação de limites
 */
class ProductionCountService {
  /**
   * Incrementa a contagem de produtos para uma máquina
   * @param {number} machineId - ID da máquina
   * @param {number} quantity - Quantidade produzida (padrão: 1)
   */
  static async incrementProductCount(machineId, quantity = 1) {
    try {
      // Buscar configurações de produção da máquina
      const configQuery = `
        SELECT mc.production, m.name as machine_name, m.code as machine_code
        FROM machine_configurations mc
        JOIN machines m ON mc.machine_id = m.id
        WHERE mc.machine_id = $1
      `;
      const configResult = await pool.query(configQuery, [machineId]);
      
      if (configResult.rows.length === 0) {
        console.log(`Máquina ${machineId} não possui configurações de produção`);
        return;
      }
      
      const config = configResult.rows[0];
      const productionConfig = config.production || {};
      
      // Se não há configurações de produção, não fazer nada
      if (!productionConfig.enablePopups && !productionConfig.enableAlerts) {
        return;
      }
      
      // Buscar ou criar contador de produção atual
      const counterQuery = `
        SELECT * FROM production_counters 
        WHERE machine_id = $1 AND DATE(created_at) = CURRENT_DATE
        ORDER BY created_at DESC LIMIT 1
      `;
      const counterResult = await pool.query(counterQuery, [machineId]);
      
      let currentCount = 0;
      let counterId = null;
      
      if (counterResult.rows.length > 0) {
        const counter = counterResult.rows[0];
        currentCount = counter.count + quantity;
        counterId = counter.id;
        
        // Atualizar contador existente
        await pool.query(
          'UPDATE production_counters SET count = $1, updated_at = NOW() WHERE id = $2',
          [currentCount, counterId]
        );
      } else {
        // Criar novo contador para hoje
        const insertResult = await pool.query(
          `INSERT INTO production_counters (machine_id, count, created_at, updated_at) 
           VALUES ($1, $2, NOW(), NOW()) RETURNING id`,
          [machineId, quantity]
        );
        currentCount = quantity;
        counterId = insertResult.rows[0].id;
      }
      
      // Verificar se deve gerar popup ou alerta
      await this.checkProductionLimits(machineId, currentCount, productionConfig, {
        machine_name: config.machine_name,
        machine_code: config.machine_code
      });
      
      return { currentCount, counterId };
      
    } catch (error) {
      console.error('Erro ao incrementar contagem de produtos:', error);
      throw error;
    }
  }
  
  /**
   * Verifica se os limites de popup ou alerta foram atingidos
   */
  static async checkProductionLimits(machineId, currentCount, productionConfig, machineInfo) {
    try {
      const { popupThreshold, alertThreshold, enablePopups, enableAlerts } = productionConfig;
      
      // Verificar se deve gerar popup
      if (enablePopups && popupThreshold && currentCount >= popupThreshold) {
        await this.createPopupNotification(machineId, currentCount, popupThreshold, machineInfo);
      }
      
      // Verificar se deve gerar alerta para gestores
      if (enableAlerts && alertThreshold && currentCount >= alertThreshold) {
        await this.createManagerAlert(machineId, currentCount, alertThreshold, machineInfo);
      }
      
    } catch (error) {
      console.error('Erro ao verificar limites de produção:', error);
    }
  }
  
  /**
   * Cria notificação de popup para operador
   */
  static async createPopupNotification(machineId, currentCount, threshold, machineInfo) {
    try {
      console.log(`[DEBUG] createPopupNotification called: machineId=${machineId}, currentCount=${currentCount}, threshold=${threshold}`);
      
      // Verificar se já existe popup ativo para hoje
      const existingPopupQuery = `
        SELECT * FROM production_popups 
        WHERE machine_id = $1 AND DATE(created_at) = CURRENT_DATE AND is_active = true
      `;
      const existingResult = await pool.query(existingPopupQuery, [machineId]);
      
      console.log(`[DEBUG] Existing popups found: ${existingResult.rows.length}`);
      
      if (existingResult.rows.length > 0) {
        const existingPopup = existingResult.rows[0];
        console.log(`[DEBUG] Existing popup: id=${existingPopup.id}, count=${existingPopup.production_count}`);
        
        // Se a produção atual é significativamente maior, atualizar o popup existente
        if (currentCount > existingPopup.production_count) {
          const updateQuery = `
            UPDATE production_popups 
            SET production_count = $1, message = $2, updated_at = NOW()
            WHERE id = $3
            RETURNING *
          `;
          const message = `Máquina ${machineInfo.machine_name} atingiu ${currentCount} produtos. Realizar teste de qualidade.`;
          await pool.query(updateQuery, [currentCount, message, existingPopup.id]);
          console.log(`[SUCCESS] Popup atualizado para máquina ${machineInfo.machine_name}: ${currentCount}/${threshold} produtos`);
        } else {
          console.log(`[INFO] Popup não atualizado: contagem atual ${currentCount} não é maior que ${existingPopup.production_count}`);
        }
        return;
      }
      
      // Criar popup de notificação
      const popupQuery = `
        INSERT INTO production_popups (
          machine_id, production_count, threshold, message, is_active, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        RETURNING *
      `;
      
      const message = `Máquina ${machineInfo.machine_name} atingiu ${currentCount} produtos. Realizar teste de qualidade.`;
      
      const popupResult = await pool.query(popupQuery, [
        machineId,
        currentCount,
        threshold,
        message,
        true
      ]);
      
      console.log(`✅ Popup criado para máquina ${machineInfo.machine_name}: ${currentCount}/${threshold} produtos`);
      
      return popupResult.rows[0];
      
    } catch (error) {
      console.error('Erro ao criar popup de notificação:', error);
    }
  }
  
  /**
   * Cria alerta para gestores e líderes
   */
  static async createManagerAlert(machineId, currentCount, threshold, machineInfo) {
    try {
      console.log(`[DEBUG] createManagerAlert called: machineId=${machineId}, currentCount=${currentCount}, threshold=${threshold}`);
      
      // Verificar se já existe alerta ativo para hoje
      const existingAlertQuery = `
        SELECT * FROM production_alerts 
        WHERE machine_id = $1 AND DATE(created_at) = CURRENT_DATE AND is_active = true
      `;
      const existingResult = await pool.query(existingAlertQuery, [machineId]);
      
      console.log(`[DEBUG] Existing alerts found: ${existingResult.rows.length}`);
      
      if (existingResult.rows.length > 0) {
        const existingAlert = existingResult.rows[0];
        console.log(`[DEBUG] Existing alert: id=${existingAlert.id}, count=${existingAlert.production_count}`);
        
        // Se a produção atual é significativamente maior, atualizar o alerta existente
        if (currentCount > existingAlert.production_count) {
          const updateQuery = `
            UPDATE production_alerts 
            SET production_count = $1, message = $2, metadata = $3, updated_at = NOW()
            WHERE id = $4
            RETURNING *
          `;
          const message = `ALERTA: Máquina ${machineInfo.machine_name} atingiu ${currentCount} produtos (limite: ${threshold}). Ação necessária.`;
          const metadata = JSON.stringify({
            machineName: machineInfo.machine_name,
            machineCode: machineInfo.machine_code,
            timestamp: new Date().toISOString(),
            exceedBy: currentCount - threshold
          });
          await pool.query(updateQuery, [currentCount, message, metadata, existingAlert.id]);
          console.log(`[SUCCESS] Alerta atualizado para gestores - máquina ${machineInfo.machine_name}: ${currentCount}/${threshold} produtos`);
        } else {
          console.log(`[INFO] Alerta não atualizado: contagem atual ${currentCount} não é maior que ${existingAlert.production_count}`);
        }
        return;
      }
      
      // Criar alerta para gestores
      const alertQuery = `
        INSERT INTO production_alerts (
          machine_id, production_count, products_per_test, alert_type, severity,
          message, target_roles, is_active, metadata, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        RETURNING *
      `;
      
      const message = `ALERTA: Máquina ${machineInfo.machine_name} atingiu ${currentCount} produtos (limite: ${threshold}). Ação necessária.`;
      
      const alertResult = await pool.query(alertQuery, [
        machineId,
        currentCount,
        threshold,
        'PRODUCTION_THRESHOLD_EXCEEDED',
        'HIGH',
        message,
        JSON.stringify(['MANAGER', 'LEADER']),
        true,
        JSON.stringify({
          machineName: machineInfo.machine_name,
          machineCode: machineInfo.machine_code,
          timestamp: new Date().toISOString(),
          exceedBy: currentCount - threshold
        })
      ]);
      
      console.log(`🚨 Alerta criado para gestores - máquina ${machineInfo.machine_name}: ${currentCount}/${threshold} produtos`);
      
      // Enviar notificação via NotificationService
      try {
        // Enviar para MANAGER
        await NotificationService.sendToRole('MANAGER', {
          type: 'PRODUCTION_ALERT',
          title: 'Limite de Produção Atingido',
          message,
          machineId,
          priority: 'HIGH',
          metadata: {
            alertId: alertResult.rows[0].id,
            productionCount: currentCount,
            threshold
          }
        });
        
        // Enviar para LEADER
        await NotificationService.sendToRole('LEADER', {
          type: 'PRODUCTION_ALERT',
          title: 'Limite de Produção Atingido',
          message,
          machineId,
          priority: 'HIGH',
          metadata: {
            alertId: alertResult.rows[0].id,
            productionCount: currentCount,
            threshold
          }
        });
      } catch (notifError) {
        console.error('Erro ao enviar notificação:', notifError);
      }
      
      return alertResult.rows[0];
      
    } catch (error) {
      console.error('Erro ao criar alerta para gestores:', error);
    }
  }
  
  /**
   * Reseta o contador de produção (usado após teste de qualidade)
   */
  static async resetProductionCounter(machineId) {
    try {
      await pool.query(
        'UPDATE production_counters SET count = 0, updated_at = NOW() WHERE machine_id = $1 AND DATE(created_at) = CURRENT_DATE',
        [machineId]
      );
      
      // Desativar popups e alertas ativos
      await pool.query(
        'UPDATE production_popups SET is_active = false WHERE machine_id = $1 AND is_active = true',
        [machineId]
      );
      
      await pool.query(
        'UPDATE production_alerts SET is_active = false WHERE machine_id = $1 AND is_active = true',
        [machineId]
      );
      
      console.log(`✅ Contador resetado para máquina ${machineId}`);
      
    } catch (error) {
      console.error('Erro ao resetar contador de produção:', error);
      throw error;
    }
  }
  
  /**
   * Busca contador atual de produção
   */
  static async getCurrentCount(machineId) {
    try {
      const query = `
        SELECT count FROM production_counters 
        WHERE machine_id = $1 AND DATE(created_at) = CURRENT_DATE
        ORDER BY created_at DESC LIMIT 1
      `;
      const result = await pool.query(query, [machineId]);
      
      return result.rows.length > 0 ? result.rows[0].count : 0;
      
    } catch (error) {
      console.error('Erro ao buscar contador atual:', error);
      return 0;
    }
  }
}

module.exports = ProductionCountService;