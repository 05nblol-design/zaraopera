const pool = require('../config/database');
const NotificationService = require('../services/notificationService');

/**
 * Gerar alertas de teflon baseado nas horas de operação
 * Verifica se as horas de operação desde a última troca excedem o limite configurado
 */
const generateTeflonAlerts = async (req, res, next) => {
  try {
    const { machineId } = req.body || req.params;
    
    if (!machineId) {
      return next();
    }

    console.log(`🔍 Verificando alertas de teflon para máquina ${machineId}`);

    // Buscar informações da máquina
    const machineQuery = 'SELECT id, name, code FROM machines WHERE id = $1';
    const machineResult = await pool.query(machineQuery, [parseInt(machineId)]);
    const machine = machineResult.rows[0] || null;

    if (!machine) {
      console.log(`ℹ️ Máquina ${machineId} não encontrada`);
      return next();
    }

    // Configuração padrão de teflon (12 horas)
    const config = {
      machineId: parseInt(machineId),
      hoursPerTest: 12,
      isActive: true,
      machine: machine
    };

    // Verificar e gerar alerta
    await checkAndGenerateTeflonAlert(machineId, config);

    next();
  } catch (error) {
    console.error('Erro ao gerar alertas de teflon:', error);
    next();
  }
};

/**
 * Verificar e gerar alerta específico para uma configuração
 */
const checkAndGenerateTeflonAlert = async (machineId, config) => {
  try {
    // Buscar a última troca de teflon da máquina
    const teflonQuery = 'SELECT * FROM teflon_changes WHERE machine_id = $1 ORDER BY change_date DESC LIMIT 1';
    const teflonResult = await pool.query(teflonQuery, [parseInt(machineId)]);
    const lastTeflonChange = teflonResult.rows[0] || null;

    // Definir data de referência (última troca ou início dos tempos)
    const referenceDate = lastTeflonChange 
      ? lastTeflonChange.change_date 
      : new Date('2020-01-01'); // Data muito antiga se nunca houve troca

    // Calcular horas de operação desde a última troca
    const operationHours = await calculateOperationHoursSince(machineId, referenceDate);

    console.log(`⏱️ Horas de operação desde última troca: ${operationHours}h (limite: ${config.hoursPerTest}h)`);

    // Verificar se excede o limite
    if (operationHours >= config.hoursPerTest) {
      console.log(`🚨 Limite de horas excedido! Criando alerta...`);
      
      // Verificar se já existe um alerta recente para evitar duplicatas
      const alertQuery = `
        SELECT * FROM production_alerts 
        WHERE machine_id = $1 
        AND alert_type = $2 
        AND is_active = true 
        AND created_at >= $3
      `;
      const alertResult = await pool.query(alertQuery, [
        parseInt(machineId),
        'TEFLON_CHANGE_REQUIRED',
        new Date(Date.now() - 24 * 60 * 60 * 1000)
      ]);
      const existingAlert = alertResult.rows[0] || null;

      if (!existingAlert) {
        await createTeflonAlert(machineId, config, operationHours);
      } else {
        console.log(`ℹ️ Alerta já existe para esta máquina nas últimas 24 horas`);
      }
    }
  } catch (error) {
    console.error('Erro ao verificar alerta de teflon:', error);
  }
};

/**
 * Calcular horas de operação desde uma data de referência
 */
const calculateOperationHoursSince = async (machineId, referenceDate) => {
  try {
    // Buscar dados de turno desde a data de referência
    const shiftQuery = `
      SELECT start_time, end_time, downtime 
      FROM shift_data 
      WHERE machine_id = $1 AND shift_date >= $2
    `;
    const shiftResult = await pool.query(shiftQuery, [parseInt(machineId), referenceDate]);
    const shiftData = shiftResult.rows;

    // Calcular horas de operação baseado no tempo de turno menos downtime
    const totalHours = shiftData.reduce((total, shift) => {
      if (shift.start_time && shift.end_time) {
        const shiftDuration = (shift.end_time.getTime() - shift.start_time.getTime()) / (1000 * 60 * 60); // em horas
        const downtimeHours = (shift.downtime || 0) / 60; // converter minutos para horas
        const operationHours = Math.max(0, shiftDuration - downtimeHours);
        return total + operationHours;
      }
      return total;
    }, 0);

    return totalHours;
  } catch (error) {
    console.error('Erro ao calcular horas de operação:', error);
    return 0;
  }
};

/**
 * Criar alerta de teflon no banco de dados
 */
const createTeflonAlert = async (machineId, config, operationHours) => {
  try {
    console.log(`🚨 Criando alerta de teflon para máquina ${config.machine.name}`);
    
    // Criar alerta no banco de dados usando ProductionAlert
    const createAlertQuery = `
      INSERT INTO production_alerts (
        machine_id, production_count, products_per_test, alert_type, severity, 
        message, target_roles, is_active, metadata, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    
    const alertResult = await pool.query(createAlertQuery, [
      parseInt(machineId),
      Math.round(operationHours), // Usar horas como "produção"
      config.hoursPerTest,
      'TEFLON_CHANGE_REQUIRED',
      'HIGH',
      `Teflon da máquina ${config.machine.name} precisa ser trocado. Horas de operação: ${operationHours}h (limite: ${config.hoursPerTest}h).`,
      JSON.stringify(['MANAGER', 'LEADER', 'OPERATOR']),
      true,
      JSON.stringify({
        machineName: config.machine.name,
        timestamp: new Date().toISOString(),
        operationHours: operationHours,
        hoursPerTest: config.hoursPerTest,
        exceedBy: operationHours - config.hoursPerTest,
        alertTypeDetail: 'TEFLON_HOURS_EXCEEDED'
      }),
      new Date(),
      new Date()
    ]);
    
    const alert = alertResult.rows[0];
    
    // Enviar notificações automáticas para gestores e líderes
    try {
      const notificationData = {
        type: 'TEFLON_ALERT',
        title: 'Alerta de Teflon - Troca Necessária',
        message: `Máquina ${config.machine.name}: Teflon precisa ser trocado. Horas de operação: ${operationHours}h (limite: ${config.hoursPerTest}h).`,
        priority: 'HIGH',
        machineId: parseInt(machineId),
        alertId: alert.id,
        metadata: {
          machineName: config.machine.name,
          operationHours,
          hoursPerTest: config.hoursPerTest,
          exceedBy: operationHours - config.hoursPerTest
        }
      };
      
      // Enviar para diferentes roles
      const roles = ['MANAGER', 'LEADER', 'OPERATOR'];
      for (const role of roles) {
        await NotificationService.sendToRole(role, notificationData);
      }
      
      console.log('✅ Notificações de teflon enviadas com sucesso');
    } catch (notificationError) {
      console.error('❌ Erro ao enviar notificações automáticas:', notificationError);
    }
    
    console.log(`✅ Alerta de teflon criado: ID ${alert.id}`);
    return alert;
  } catch (error) {
    console.error('Erro ao criar alerta de teflon:', error);
    throw error;
  }
};

/**
 * Middleware para verificar alertas de teflon em tempo real
 * Usado em endpoints de operação
 */
const checkTeflonAlerts = async (req, res, next) => {
  try {
    const { machineId } = req.body || req.params;
    
    if (machineId) {
      await generateTeflonAlerts(req, res, () => {});
    }
    
    next();
  } catch (error) {
    console.error('Erro ao verificar alertas de teflon:', error);
    next();
  }
};

module.exports = {
  generateTeflonAlerts,
  checkTeflonAlerts,
  createTeflonAlert,
  calculateOperationHoursSince
};