const db = require('../config/database');
const { pool } = db;

/**
 * Calcula OEE (Overall Equipment Effectiveness) usando a fórmula:
 * OEE = Disponibilidade × Performance × Qualidade
 * 
 * @param {number} machineId - ID da máquina
 * @param {Date} startTime - Hora de início do período
 * @param {Date} endTime - Hora de fim do período
 * @returns {Object} Dados de OEE calculados
 */
async function calculateOEE(machineId, startTime, endTime) {
  try {
    // Buscar máquina com configurações
    const machineQuery = `
      SELECT m.id, m.name, m.code, m.production_speed, m.status, m.target_production
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
      targetProduction: machineResult.rows[0].target_production
    };
    
    const statusHistoryResult = await db.query(statusHistoryQuery, [machineId, startTime, endTime]);
    machine.statusHistory = statusHistoryResult.rows.map(row => ({
       newStatus: row.new_status,
       createdAt: row.created_at
     }));

    // Calcular tempo total do período em minutos
    const totalMinutes = Math.floor((endTime - startTime) / (1000 * 60));

    // 1. DISPONIBILIDADE = Tempo de Funcionamento / Tempo Total Planejado
    const availability = await calculateAvailability(machine, startTime, endTime, totalMinutes);

    // 2. PERFORMANCE = Produção Real / Produção Teórica
    const performance = await calculatePerformance(machine, startTime, endTime, availability.runningMinutes);

    // 3. QUALIDADE = Peças Boas / Peças Totais Produzidas
    const quality = await calculateQuality(machine, startTime, endTime);

    // Calcular OEE final
    const oee = (availability.percentage / 100) * (performance.percentage / 100) * (quality.percentage / 100) * 100;

    return {
      machineId,
      period: { startTime, endTime },
      totalMinutes,
      oee: Math.round(oee * 100) / 100,
      availability: {
        percentage: Math.round(availability.percentage * 100) / 100,
        runningMinutes: availability.runningMinutes,
        plannedMinutes: availability.plannedMinutes,
        downtimeMinutes: availability.downtimeMinutes,
        breakdown: availability.breakdown
      },
      performance: {
        percentage: Math.round(performance.percentage * 100) / 100,
        actualProduction: performance.actualProduction,
        theoreticalProduction: performance.theoreticalProduction,
        productionSpeed: performance.productionSpeed
      },
      quality: {
        percentage: Math.round(quality.percentage * 100) / 100,
        goodParts: quality.goodParts,
        totalParts: quality.totalParts,
        defectiveParts: quality.defectiveParts,
        testsRequired: quality.testsRequired,
        testsPassed: quality.testsPassed
      },
      classification: getOEEClassification(oee)
    };

  } catch (error) {
    console.error('Erro ao calcular OEE:', error);
    throw error;
  }
}

/**
 * Calcula a Disponibilidade da máquina
 * Disponibilidade = Tempo de Funcionamento / Tempo Total Planejado
 */
async function calculateAvailability(machine, startTime, endTime, totalMinutes) {
  const statusBreakdown = {
    FUNCIONANDO: 0,
    PARADA: 0,
    MANUTENCAO: 0,
    FORA_DE_TURNO: 0
  };

  // Se não há histórico de status, usar status atual
  if (!machine.statusHistory || machine.statusHistory.length === 0) {
    const currentStatus = machine.status || 'PARADA';
    statusBreakdown[currentStatus] = totalMinutes;
  } else {
    // Processar histórico de status
    // Obter status inicial: primeiro status do histórico ou status atual da máquina
    let currentStatus = machine.status || 'PARADA';
    
    // Se há histórico, verificar se há um status anterior ao período
    if (machine.statusHistory.length > 0) {
      const firstChange = machine.statusHistory[0];
      const firstChangeTime = new Date(firstChange.createdAt);
      
      // Se a primeira mudança é depois do início do período,
      // usar o status atual da máquina como status inicial
      if (firstChangeTime > startTime) {
        // Manter currentStatus como está (status atual da máquina)
      } else {
        // Se a primeira mudança é antes ou no início do período,
        // encontrar o status que estava ativo no início do período
        for (let i = 0; i < machine.statusHistory.length; i++) {
          const change = machine.statusHistory[i];
          const changeTime = new Date(change.createdAt);
          
          if (changeTime <= startTime) {
            currentStatus = change.newStatus;
          } else {
            break;
          }
        }
      }
    }
    
    let currentTime = startTime;

    for (const statusChange of machine.statusHistory) {
      const changeTime = new Date(statusChange.createdAt);
      
      // Só processar mudanças dentro do período
      if (changeTime >= startTime && changeTime <= endTime) {
        if (changeTime > currentTime) {
          const minutes = Math.floor((changeTime - currentTime) / (1000 * 60));
          if (minutes > 0) {
            statusBreakdown[currentStatus] += minutes;
          }
        }
        
        currentStatus = statusChange.newStatus;
        currentTime = changeTime;
      }
    }

    // Adicionar tempo restante até o fim do período
    if (currentTime < endTime) {
      const minutes = Math.floor((endTime - currentTime) / (1000 * 60));
      if (minutes > 0) {
        statusBreakdown[currentStatus] += minutes;
      }
    }
  }

  const runningMinutes = statusBreakdown.FUNCIONANDO;
  const plannedMinutes = totalMinutes - statusBreakdown.FORA_DE_TURNO; // Excluir tempo fora de turno
  const downtimeMinutes = statusBreakdown.PARADA + statusBreakdown.MANUTENCAO;
  
  const availability = plannedMinutes > 0 ? (runningMinutes / plannedMinutes) * 100 : 0;

  return {
    percentage: availability,
    runningMinutes,
    plannedMinutes,
    downtimeMinutes,
    breakdown: Object.entries(statusBreakdown)
      .filter(([status, minutes]) => minutes > 0)
      .map(([status, minutes]) => ({
        status,
        minutes,
        percentage: totalMinutes > 0 ? Math.round((minutes / totalMinutes) * 100) : 0
      }))
  };
}

/**
 * Calcula a Performance da máquina
 * Performance = Produção Real / Produção Teórica
 */
async function calculatePerformance(machine, startTime, endTime, runningMinutes) {
  // Buscar produção real do banco de dados
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const shiftDataResult = await db.query(
    'SELECT * FROM shift_data WHERE machine_id = $1 AND shift_date = $2 LIMIT 1',
    [machine.id, today]
  );
  const shiftData = shiftDataResult.rows[0] || null;

  const actualProduction = shiftData ? shiftData.total_production : 0;
  const productionSpeed = machine.productionSpeed || 0;
  const theoreticalProduction = runningMinutes * productionSpeed;
  
  const performance = theoreticalProduction > 0 ? (actualProduction / theoreticalProduction) * 100 : 0;

  return {
    percentage: Math.min(performance, 100), // Performance não pode ser maior que 100%
    actualProduction,
    theoreticalProduction,
    productionSpeed
  };
}

/**
 * Calcula a qualidade baseada nos testes de qualidade realizados e configurações
 * @param {Object} machine - Dados da máquina
 * @param {Date} startTime - Início do período
 * @param {Date} endTime - Fim do período
 * @returns {Promise<Object>} Dados detalhados de qualidade
 */
async function calculateQuality(machine, startTime, endTime) {
  try {
    // Buscar testes de qualidade do período
    const qualityTestsResult = await db.query(`
      SELECT qt.*, qtc.is_required as config_is_required, qtc.test_frequency as config_test_frequency
      FROM quality_tests qt
      LEFT JOIN quality_test_configs qtc ON qt.config_id = qtc.id
      WHERE qt.machine_id = $1 AND qt.test_date >= $2 AND qt.test_date <= $3
    `, [machine.id, startTime, endTime]);
    const qualityTests = qualityTestsResult.rows.map(row => ({
      ...row,
      machineId: row.machine_id,
      testDate: row.test_date,
      isRequired: row.is_required,
      configId: row.config_id,
      config: row.config_is_required !== null ? {
        isRequired: row.config_is_required,
        testFrequency: row.config_test_frequency
      } : null
    }));

    // Buscar configurações ativas para a máquina
    const activeConfigsResult = await db.query(
      'SELECT * FROM quality_test_configs WHERE machine_id = $1 AND is_active = true',
      [machine.id]
    );
    const activeConfigs = activeConfigsResult.rows.map(row => ({
      ...row,
      machineId: row.machine_id,
      isActive: row.is_active,
      isRequired: row.is_required,
      testFrequency: row.test_frequency
    }));

    // Separar testes obrigatórios e opcionais
    const requiredTests = qualityTests.filter(test => test.isRequired || test.config?.isRequired);
    const optionalTests = qualityTests.filter(test => !test.isRequired && !test.config?.isRequired);

    let qualityScore = 100;
    let penalties = [];
    let details = {
      totalTests: qualityTests.length,
      requiredTests: requiredTests.length,
      optionalTests: optionalTests.length,
      approvedTests: 0,
      rejectedTests: 0,
      pendingRequiredTests: 0
    };

    if (qualityTests.length === 0 && activeConfigs.length === 0) {
      // Se não há testes nem configurações, assumir qualidade padrão
      return {
        percentage: 95.0,
        goodParts: 0,
        totalParts: 0,
        defectiveParts: 0,
        testsRequired: 0,
        testsPassed: 0,
        details,
        penalties,
        hasRequiredTests: false
      };
    }

    // Calcular aprovação dos testes realizados
    const approvedTests = qualityTests.filter(test => test.approved);
    const rejectedTests = qualityTests.filter(test => !test.approved);
    
    details.approvedTests = approvedTests.length;
    details.rejectedTests = rejectedTests.length;

    // Penalizar por testes reprovados
    if (qualityTests.length > 0) {
      // Testes obrigatórios reprovados têm penalidade maior
      const rejectedRequiredTests = requiredTests.filter(test => !test.approved);
      const rejectedOptionalTests = optionalTests.filter(test => !test.approved);
      
      if (rejectedRequiredTests.length > 0) {
        const requiredPenalty = (rejectedRequiredTests.length / requiredTests.length) * 30; // Até 30% de penalidade
        qualityScore -= requiredPenalty;
        penalties.push({
          type: 'REQUIRED_TESTS_FAILED',
          count: rejectedRequiredTests.length,
          penalty: requiredPenalty,
          description: `${rejectedRequiredTests.length} teste(s) obrigatório(s) reprovado(s)`
        });
      }
      
      if (rejectedOptionalTests.length > 0) {
        const optionalPenalty = (rejectedOptionalTests.length / optionalTests.length) * 10; // Até 10% de penalidade
        qualityScore -= optionalPenalty;
        penalties.push({
          type: 'OPTIONAL_TESTS_FAILED',
          count: rejectedOptionalTests.length,
          penalty: optionalPenalty,
          description: `${rejectedOptionalTests.length} teste(s) opcional(is) reprovado(s)`
        });
      }
    }

    // Verificar testes obrigatórios pendentes baseado na produção
    for (const config of activeConfigs) {
      if (!config.isRequired) continue;
      
      // Calcular quantos testes deveriam ter sido feitos baseado na produção
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const shiftDataResult = await db.query(
        'SELECT * FROM shift_data WHERE machine_id = $1 AND shift_date = $2 LIMIT 1',
        [machine.id, today]
      );
      const shiftData = shiftDataResult.rows[0] || null;

      const production = shiftData ? shiftData.total_production : 0;
      const testsRequired = Math.ceil(production / (config.testFrequency || 100));
      const testsPerformed = requiredTests.filter(test => test.configId === config.id).length;
      const pendingTests = Math.max(0, testsRequired - testsPerformed);
      
      if (pendingTests > 0) {
        details.pendingRequiredTests += pendingTests;
        
        // Penalizar por testes obrigatórios não realizados
        const pendingPenalty = pendingTests * 15; // 15% por teste pendente
        qualityScore -= pendingPenalty;
        penalties.push({
          type: 'REQUIRED_TESTS_PENDING',
          count: pendingTests,
          penalty: pendingPenalty,
          description: `${pendingTests} teste(s) obrigatório(s) pendente(s)`,
          configId: config.id
        });
      }
    }

    // Garantir que a qualidade não seja negativa
    qualityScore = Math.max(0, qualityScore);
    
    return {
      percentage: Math.round(qualityScore * 10) / 10,
      goodParts: approvedTests.length,
      totalParts: qualityTests.length,
      defectiveParts: rejectedTests.length,
      testsRequired: activeConfigs.reduce((sum, config) => {
        if (!config.isRequired) return sum;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        // Simplificado para este retorno
        return sum + 1;
      }, 0),
      testsPassed: approvedTests.length,
      details,
      penalties,
      hasRequiredTests: activeConfigs.some(c => c.isRequired)
    };
  } catch (error) {
    console.error('Erro ao calcular qualidade:', error);
    return {
      percentage: 95.0,
      goodParts: 0,
      totalParts: 0,
      defectiveParts: 0,
      testsRequired: 0,
      testsPassed: 0,
      details: { totalTests: 0, requiredTests: 0, optionalTests: 0, approvedTests: 0, rejectedTests: 0, pendingRequiredTests: 0 },
      penalties: [],
      hasRequiredTests: false
    };
  }
}

/**
 * Classifica o OEE baseado em padrões da indústria
 */
function getOEEClassification(oee) {
  if (oee >= 85) {
    return { level: 'EXCELENTE', color: 'green', description: 'Classe mundial' };
  } else if (oee >= 70) {
    return { level: 'BOM', color: 'blue', description: 'Aceitável' };
  } else if (oee >= 50) {
    return { level: 'REGULAR', color: 'yellow', description: 'Precisa melhorar' };
  } else {
    return { level: 'RUIM', color: 'red', description: 'Inaceitável' };
  }
}

/**
 * Calcula OEE para o turno atual
 */
async function calculateCurrentShiftOEE(machineId) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Determinar turno atual baseado na hora
  const hour = now.getHours();
  let shiftStart, shiftEnd;
  
  if (hour >= 6 && hour < 14) {
    // Turno manhã: 06:00 - 14:00
    shiftStart = new Date(today.getTime() + 6 * 60 * 60 * 1000);
    shiftEnd = new Date(today.getTime() + 14 * 60 * 60 * 1000);
  } else if (hour >= 14 && hour < 22) {
    // Turno tarde: 14:00 - 22:00
    shiftStart = new Date(today.getTime() + 14 * 60 * 60 * 1000);
    shiftEnd = new Date(today.getTime() + 22 * 60 * 60 * 1000);
  } else {
    // Turno noite: 22:00 - 06:00 (próximo dia)
    if (hour >= 22) {
      shiftStart = new Date(today.getTime() + 22 * 60 * 60 * 1000);
      shiftEnd = new Date(today.getTime() + 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000);
    } else {
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      shiftStart = new Date(yesterday.getTime() + 22 * 60 * 60 * 1000);
      shiftEnd = new Date(today.getTime() + 6 * 60 * 60 * 1000);
    }
  }
  
  // Se ainda estamos no turno, usar hora atual como fim
  if (now < shiftEnd) {
    shiftEnd = now;
  }
  
  return await calculateOEE(machineId, shiftStart, shiftEnd);
}

/**
 * Calcula OEE para múltiplas máquinas
 */
async function calculateMultipleOEE(machineIds, startTime, endTime) {
  const results = await Promise.allSettled(
    machineIds.map(machineId => calculateOEE(machineId, startTime, endTime))
  );
  
  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      console.error(`Erro ao calcular OEE para máquina ${machineIds[index]}:`, result.reason);
      return {
        machineId: machineIds[index],
        error: result.reason.message,
        oee: 0,
        availability: { percentage: 0 },
        performance: { percentage: 0 },
        quality: { percentage: 0 }
      };
    }
  });
}

module.exports = {
  calculateOEE,
  calculateCurrentShiftOEE,
  calculateMultipleOEE,
  calculateAvailability,
  calculatePerformance,
  calculateQuality,
  getOEEClassification
};