const db = require('../config/database');

/**
 * Calcula a produção baseada na velocidade configurada e tempo de operação
 * @param {number} machineId - ID da máquina
 * @param {Date} startTime - Hora de início do período
 * @param {Date} endTime - Hora de fim do período
 * @returns {Object} Dados de produção calculados
 */
async function calculateProduction(machineId, startTime, endTime) {
  try {
    // Buscar máquina com velocidade de produção e status atual
    const machineQuery = `
      SELECT m.id, m.name, m.code, m.production_speed, m.status, m.updated_at
      FROM machines m
      WHERE m.id = $1
    `;
    
    const statusHistoryQuery = `
      SELECT sh.new_status, sh.created_at
      FROM machine_status_history sh
      WHERE sh.machine_id = $1 AND sh.created_at >= $2 AND sh.created_at <= $3
      ORDER BY sh.created_at ASC
    `;
    
    const machineResult = await db.query(machineQuery, [machineId]);
    
    if (machineResult.rows.length === 0) {
      throw new Error('Máquina não encontrada');
    }
    
    const machine = {
      id: machineResult.rows[0].id,
      name: machineResult.rows[0].name,
      code: machineResult.rows[0].code,
      productionSpeed: machineResult.rows[0].production_speed,
      status: machineResult.rows[0].status,
      updatedAt: machineResult.rows[0].updated_at
    };
    
    const statusHistoryResult = await db.query(statusHistoryQuery, [machineId, startTime, endTime]);
    machine.statusHistory = statusHistoryResult.rows.map(row => ({
      newStatus: row.new_status,
      createdAt: row.created_at
    }));

    if (!machine) {
      throw new Error('Máquina não encontrada');
    }

    if (!machine.productionSpeed || machine.productionSpeed <= 0) {
      return {
        machineId,
        period: { startTime, endTime },
        productionSpeed: 0,
        totalMinutes: 0,
        runningMinutes: 0,
        stoppedMinutes: 0,
        maintenanceMinutes: 0,
        estimatedProduction: 0,
        efficiency: 0,
        statusBreakdown: []
      };
    }

    // Calcular tempo total do período em minutos
    const totalMinutes = Math.floor((endTime - startTime) / (1000 * 60));

    // Se não há histórico de status, implementar fallback robusto
    if (!machine.statusHistory || machine.statusHistory.length === 0) {
      const currentStatus = machine.status || 'PARADA';
      const isRunning = currentStatus === 'FUNCIONANDO';
      const isOffShift = currentStatus === 'FORA_DE_TURNO';
      
      console.log(`⚠️ Sem histórico de status para máquina ${machineId}. Status atual: ${currentStatus}`);
      
      // Buscar produção real do banco de dados
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const shiftDataQuery = `
        SELECT total_production
        FROM shift_data
        WHERE machine_id = $1 AND shift_date = $2
        ORDER BY total_production DESC
        LIMIT 1
      `;
      
      const shiftDataResult = await db.query(shiftDataQuery, [machineId, today]);
      const shiftData = shiftDataResult.rows.length > 0 ? {
        totalProduction: shiftDataResult.rows[0].total_production
      } : null;
      
      let estimatedProduction = 0;
      let runningMinutes = 0;
      
      if (shiftData && shiftData.totalProduction > 0) {
        // Usar produção real do banco
        estimatedProduction = shiftData.totalProduction;
        // Calcular tempo de funcionamento baseado na produção real
        runningMinutes = Math.floor(estimatedProduction / machine.productionSpeed);
      } else if (isRunning && !isOffShift) {
        // CORREÇÃO: Se máquina está funcionando, assumir que funcionou todo o período
        runningMinutes = totalMinutes;
        estimatedProduction = Math.floor(runningMinutes * machine.productionSpeed);
      }
      
      // CORREÇÃO: Lógica mais robusta para calcular tempos baseado no status atual
      let actualRunningTime = 0;
      let actualStoppedTime = 0;
      let actualMaintenanceTime = 0;
      
      if (isRunning && !isOffShift) {
        // Máquina funcionando: todo o tempo é tempo funcionando
        actualRunningTime = runningMinutes > 0 ? runningMinutes : totalMinutes;
        actualStoppedTime = 0;
        actualMaintenanceTime = 0;
      } else if (currentStatus === 'MANUTENCAO' || currentStatus === 'MAINTENANCE') {
        // Máquina em manutenção
        actualRunningTime = 0;
        actualStoppedTime = 0;
        actualMaintenanceTime = totalMinutes;
      } else {
        // Máquina parada ou fora de turno
        actualRunningTime = 0;
        actualStoppedTime = totalMinutes;
        actualMaintenanceTime = 0;
      }
      
      const efficiency = totalMinutes > 0 ? Math.round((actualRunningTime / totalMinutes) * 100) : 0;
      
      console.log(`📊 Fallback - Status: ${currentStatus}, Total: ${totalMinutes}min, Running: ${actualRunningTime}min, Stopped: ${actualStoppedTime}min`);
      
      return {
        machineId,
        period: { startTime, endTime },
        productionSpeed: machine.productionSpeed,
        totalMinutes,
        runningMinutes: actualRunningTime,
        stoppedMinutes: actualStoppedTime,
        maintenanceMinutes: actualMaintenanceTime,
        estimatedProduction,
        efficiency,
        statusBreakdown: [{
          status: currentStatus,
          minutes: totalMinutes,
          percentage: 100
        }]
      };
    }

    // Analisar histórico de status para calcular tempo em cada estado
    const statusBreakdown = {
      FUNCIONANDO: 0,
      PARADA: 0,
      MANUTENCAO: 0,
      FORA_DE_TURNO: 0
    };

    // CORREÇÃO: Usar status atual da máquina como status inicial
    let currentStatus = machine.status || 'PARADA';
    let currentTime = startTime;

    // Se há histórico de status, processar cronologicamente
    if (machine.statusHistory && machine.statusHistory.length > 0) {
      // Ordenar histórico por data (mais antigo primeiro)
      const sortedHistory = machine.statusHistory.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      
      // Verificar se há mudanças dentro do período
      const changesInPeriod = sortedHistory.filter(change => {
        const changeTime = new Date(change.createdAt);
        return changeTime >= startTime && changeTime <= endTime;
      });
      
      if (changesInPeriod.length > 0) {
        // CORREÇÃO: Não alterar o status inicial se há mudanças no período
        // Manter o status atual da máquina como inicial
        
        // Processar cada mudança de status
        for (const statusChange of changesInPeriod) {
          const changeTime = new Date(statusChange.createdAt);
          
          // Calcular tempo no status anterior
          if (changeTime > currentTime) {
            const minutes = Math.floor((changeTime - currentTime) / (1000 * 60));
            if (statusBreakdown.hasOwnProperty(currentStatus)) {
              statusBreakdown[currentStatus] += minutes;
            }
          }
          
          currentStatus = statusChange.newStatus;
          currentTime = changeTime;
        }
      }
      // Se não há mudanças no período, manter o status atual da máquina
    }

    // Adicionar tempo restante até o fim do período
    if (currentTime < endTime) {
      const minutes = Math.floor((endTime - currentTime) / (1000 * 60));
      if (statusBreakdown.hasOwnProperty(currentStatus)) {
        statusBreakdown[currentStatus] += minutes;
      }
    }
    
    // CORREÇÃO: Se não há breakdown significativo, usar status atual da máquina
    const totalBreakdownMinutes = Object.values(statusBreakdown).reduce((sum, minutes) => sum + minutes, 0);
    
    if (totalBreakdownMinutes < totalMinutes * 0.5) {
      // Se o breakdown não cobre pelo menos 50% do tempo, usar status atual
      
      // Resetar breakdown e usar status atual
      Object.keys(statusBreakdown).forEach(key => statusBreakdown[key] = 0);
      
      // CORREÇÃO CRÍTICA: Garantir que o status seja válido e mapeado corretamente
      const currentMachineStatus = machine.status || 'PARADA';
      if (statusBreakdown.hasOwnProperty(currentMachineStatus)) {
        statusBreakdown[currentMachineStatus] = totalMinutes;
      } else {
        // Se o status não existe no breakdown, mapear para PARADA
        statusBreakdown['PARADA'] = totalMinutes;
      }
    }

    // Buscar produção real do banco de dados ao invés de recalcular
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const shiftDataQuery2 = `
      SELECT total_production
      FROM shift_data
      WHERE machine_id = $1 AND shift_date = $2
      ORDER BY total_production DESC
      LIMIT 1
    `;
    
    const shiftDataResult2 = await db.query(shiftDataQuery2, [machineId, today]);
     const shiftData = shiftDataResult2.rows.length > 0 ? {
       totalProduction: shiftDataResult2.rows[0].total_production
     } : null;
    
    const estimatedProduction = shiftData ? shiftData.totalProduction : 0;
    const runningMinutes = statusBreakdown.FUNCIONANDO;

    // Calcular eficiência (tempo funcionando / tempo total)
    const efficiency = totalMinutes > 0 ? Math.round((runningMinutes / totalMinutes) * 100) : 0;

    // Preparar breakdown para resposta
    const statusBreakdownArray = Object.entries(statusBreakdown)
      .filter(([status, minutes]) => minutes > 0)
      .map(([status, minutes]) => ({
        status,
        minutes,
        percentage: totalMinutes > 0 ? Math.round((minutes / totalMinutes) * 100) : 0
      }));

    return {
      machineId,
      period: { startTime, endTime },
      productionSpeed: machine.productionSpeed,
      totalMinutes,
      runningMinutes: statusBreakdown.FUNCIONANDO,
      stoppedMinutes: statusBreakdown.PARADA,
      maintenanceMinutes: statusBreakdown.MANUTENCAO,
      estimatedProduction,
      efficiency,
      statusBreakdown: statusBreakdownArray
    };

  } catch (error) {
    console.error('Erro ao calcular produção:', error);
    throw error;
  }
}

/**
 * Calcula produção para múltiplas máquinas
 * @param {number[]} machineIds - Array de IDs das máquinas
 * @param {Date} startTime - Hora de início do período
 * @param {Date} endTime - Hora de fim do período
 * @returns {Object[]} Array com dados de produção de cada máquina
 */
async function calculateMultipleProduction(machineIds, startTime, endTime) {
  const results = [];
  
  for (const machineId of machineIds) {
    try {
      const production = await calculateProduction(machineId, startTime, endTime);
      results.push(production);
    } catch (error) {
      console.error(`Erro ao calcular produção da máquina ${machineId}:`, error);
      results.push({
        machineId,
        error: error.message,
        period: { startTime, endTime }
      });
    }
  }
  
  return results;
}

/**
 * Calcula produção do turno atual
 * @param {number} machineId - ID da máquina
 * @returns {Object} Dados de produção do turno atual
 */
async function calculateCurrentShiftProduction(machineId) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Determinar turno atual baseado na hora (alinhado com frontend: 7h-19h)
  const hour = now.getHours();
  let shiftStart, shiftEnd;
  
  if (hour >= 7 && hour < 19) {
    // Turno dia: 07:00 - 19:00
    shiftStart = new Date(today.getTime() + 7 * 60 * 60 * 1000);
    shiftEnd = new Date(today.getTime() + 19 * 60 * 60 * 1000);
  } else {
    // Turno noite: 19:00 - 07:00 (próximo dia)
    if (hour >= 19) {
      shiftStart = new Date(today.getTime() + 19 * 60 * 60 * 1000);
      shiftEnd = new Date(today.getTime() + 24 * 60 * 60 * 1000 + 7 * 60 * 60 * 1000);
    } else {
      // Ainda é o turno da noite do dia anterior
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      shiftStart = new Date(yesterday.getTime() + 19 * 60 * 60 * 1000);
      shiftEnd = new Date(today.getTime() + 7 * 60 * 60 * 1000);
    }
  }
  
  // Se ainda estamos no turno, usar hora atual como fim
  if (now < shiftEnd) {
    shiftEnd = now;
  }
  
  // Buscar dados da máquina incluindo status atual
  const machineQuery = `
    SELECT id, name, code, status, production_speed
    FROM machines
    WHERE id = $1
  `;
  
  const machineResult = await db.query(machineQuery, [machineId]);
  
  if (machineResult.rows.length === 0) {
    throw new Error('Máquina não encontrada');
  }
  
  const machine = {
     id: machineResult.rows[0].id,
     name: machineResult.rows[0].name,
     code: machineResult.rows[0].code,
     status: machineResult.rows[0].status,
     productionSpeed: machineResult.rows[0].production_speed
   };

  // Calcular produção com dados em tempo real
  const production = await calculateProduction(machineId, shiftStart, shiftEnd);
  
  // Adicionar informações de tempo real
  production.currentStatus = machine.status;
  production.isCurrentlyRunning = machine.status === 'FUNCIONANDO';
  production.lastUpdate = now;
  
  return production;
}

/**
 * Calcula produção diária
 * @param {number} machineId - ID da máquina
 * @param {Date} date - Data para calcular (opcional, padrão hoje)
 * @returns {Object} Dados de produção do dia
 */
async function calculateDailyProduction(machineId, date = new Date()) {
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
  
  return await calculateProduction(machineId, startOfDay, endOfDay);
}

module.exports = {
  calculateProduction,
  calculateMultipleProduction,
  calculateCurrentShiftProduction,
  calculateDailyProduction
};