const pool = require('../config/database');
const NotificationService = require('../services/notificationService');

/**
 * Middleware para gerar alertas automáticos de produção
 * Monitora a produção em tempo real e notifica gestores, líderes e operadores
 */
const generateProductionAlerts = async (req, res, next) => {
  try {
    const { machineId } = req.body;
    
    if (!machineId) {
      return next();
    }

    // Verificar se o pool está disponível
    if (!pool || typeof pool.query !== 'function') {
      console.error('❌ Pool de banco de dados não está disponível');
      return next();
    }

    // Verificar se o pool está disponível
    if (!pool || typeof pool.query !== 'function') {
      console.error('❌ Pool de banco de dados não está disponível');
      return next();
    }

    // Buscar configurações ativas para a máquina
    const configQuery = `
      SELECT qtc.*, m.name as machine_name, m.code as machine_code
      FROM quality_test_configs qtc
      JOIN machines m ON qtc.machine_id = m.id
      WHERE qtc.machine_id = $1 AND qtc.is_active = true
    `;
    const configResult = await pool.query(configQuery, [parseInt(machineId)]);
    const activeConfigs = configResult.rows.map(row => ({
      ...row,
      machine: {
        name: row.machine_name,
        code: row.machine_code
      }
    }));

    if (activeConfigs.length === 0) {
      return next();
    }

    // Verificar cada configuração e gerar alertas
    for (const config of activeConfigs) {
      await checkAndGenerateAlert(machineId, config);
    }

    next();
  } catch (error) {
    console.error('Erro ao gerar alertas de produção:', error);
    next();
  }
};

/**
 * Verifica se deve gerar alerta e cria notificações
 */
const checkAndGenerateAlert = async (machineId, config) => {
  try {
    const testQuery = `
      SELECT * FROM quality_tests 
      WHERE machine_id = $1 AND config_id = $2 AND is_required = true 
      ORDER BY test_date DESC LIMIT 1
    `;
    const testResult = await pool.query(testQuery, [parseInt(machineId), config.id]);
    const lastTest = testResult.rows[0] || null;

    const lastTestDate = lastTest ? lastTest.test_date : new Date(0);
    
    // Contar produção desde o último teste usando shiftData
    const shiftQuery = `
      SELECT * FROM shift_data 
      WHERE machine_id = $1 AND created_at > $2
    `;
    const shiftResult = await pool.query(shiftQuery, [parseInt(machineId), lastTestDate]);
    const shiftData = shiftResult.rows;
    
    const productionCount = shiftData.reduce((total, shift) => total + (shift.total_production || 0), 0);

    // Gerar alerta se a produção atingiu o limite
    if (productionCount >= config.products_per_test) {
      await createProductionAlert(machineId, config, productionCount);
    }
  } catch (error) {
    console.error('Erro ao verificar alerta de produção:', error);
  }
};

/**
 * Cria notificações para diferentes tipos de usuários
 */
const createProductionAlert = async (machineId, config, productionCount) => {
  try {
    console.log(`🚨 Criando alerta de produção para máquina ${config.machine.name}`);
    
    // Criar alerta no banco de dados
    const createAlertQuery = `
      INSERT INTO production_alerts (
        machine_id, production_count, products_per_test, alert_type, severity, 
        message, target_roles, is_active, metadata, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    
    const alertResult = await pool.query(createAlertQuery, [
      parseInt(machineId),
      productionCount,
      config.products_per_test,
      'PRODUCTION_LIMIT_EXCEEDED',
      'HIGH',
      `Produção atingiu ${productionCount} peças. Limite configurado: ${config.products_per_test} peças por teste.`,
      JSON.stringify(['MANAGER', 'LEADER', 'OPERATOR']),
      true,
      JSON.stringify({
        machineName: config.machine.name,
        timestamp: new Date().toISOString(),
        exceedBy: productionCount - config.products_per_test
      }),
      new Date(),
      new Date()
    ]);
    
    const alert = alertResult.rows[0];
    
    // Enviar notificações automáticas para gestores e líderes
    try {
      const notificationData = {
        type: 'PRODUCTION_ALERT',
        title: 'Alerta de Produção - Teste Necessário',
        message: `Máquina ${config.machine.name}: Produção atingiu ${productionCount} peças. É necessário realizar teste de qualidade (limite: ${config.products_per_test} peças).`,
        priority: 'HIGH',
        channels: ['EMAIL', 'PUSH', 'IN_APP'],
        metadata: {
          machineId: parseInt(machineId),
          machineName: config.machine.name,
          productionCount,
          productsPerTest: config.products_per_test,
          exceedBy: productionCount - config.products_per_test,
          alertType: 'PRODUCTION_LIMIT_EXCEEDED'
        }
      };
      
      // Enviar para gestores e líderes
      await NotificationService.sendToRole('MANAGER', notificationData);
      await NotificationService.sendToRole('LEADER', notificationData);
      
      // Enviar notificação específica para operadores
      const operatorNotificationData = {
        ...notificationData,
        title: 'Teste de Qualidade Necessário',
        message: `Máquina ${config.machine.name}: Realize teste de qualidade. Produção atual: ${productionCount} peças.`,
        priority: 'MEDIUM'
      };
      
      await NotificationService.sendToRole('OPERATOR', operatorNotificationData);
      
      console.log(`📧 Notificações automáticas enviadas para o alerta ${alert.id}`);
      
    } catch (notificationError) {
      console.error('❌ Erro ao enviar notificações automáticas:', notificationError);
      // Não falhar o processo principal se as notificações falharem
    }
    
    console.log(`✅ Alerta de produção criado: ID ${alert.id}`);
    return alert;
    
  } catch (error) {
    console.error('❌ Erro ao criar alerta de produção:', error);
    throw error;
  }
};

/**
 * Middleware para verificar alertas em tempo real
 * Usado em endpoints de produção
 */
const checkProductionAlerts = async (req, res, next) => {
  try {
    const { machineId } = req.body || req.params;
    
    if (machineId) {
      await generateProductionAlerts(req, res, next);
    }
    
    next();
  } catch (error) {
    console.error('Erro ao verificar alertas de produção:', error);
    next();
  }
};

/**
 * Função para verificar alertas de produção (não middleware)
 * Usado em serviços internos
 */
const checkProductionAlertsService = async (machineId, currentProduction) => {
  try {
    if (machineId) {
      // Criar objetos mock para req e res
      const mockReq = {
        body: { machineId, currentProduction },
        params: { machineId }
      };
      const mockRes = {};
      
      await generateProductionAlerts(mockReq, mockRes, () => {});
    }
  } catch (error) {
    console.error('Erro ao verificar alertas de produção:', error);
  }
};

module.exports = {
  generateProductionAlerts,
  checkProductionAlerts,
  checkProductionAlertsService,
  createProductionAlert
};