const shiftService = require('../services/shiftService');
const pool = require('../config/database');

/**
 * Middleware para interceptar operações de produção e atualizar dados de turno
 */
class ShiftMiddleware {
  /**
   * Middleware para operações de máquina
   * Atualiza dados do turno quando há mudanças na produção
   */
  static async trackMachineOperation(req, res, next) {
    console.log('🔍 MIDDLEWARE trackMachineOperation - INÍCIO');
    console.log('   URL:', req.method, req.originalUrl);
    console.log('   Params:', req.params);
    console.log('   Body:', req.body);
    console.log('   User:', req.user ? { id: req.user.id, role: req.user.role } : 'não autenticado');
    try {
      // Armazenar dados originais para comparação
      req.originalBody = { ...req.body };
      req.shiftTrackingEnabled = true;
      
      console.log('✅ trackMachineOperation - Dados armazenados, continuando...');
      // Continuar com a requisição
      next();
    } catch (error) {
      console.error('❌ Erro no middleware de turno:', error);
      next(error);
    }
  }

  /**
   * Middleware pós-processamento para atualizar dados de turno
   */
  static async updateShiftData(req, res, next) {
    console.log('🔍 MIDDLEWARE updateShiftData - INÍCIO');
    // Interceptar a resposta original
    const originalSend = res.send;
    
    res.send = async function(data) {
      console.log('📤 updateShiftData - Interceptando resposta');
      console.log('   Status Code:', res.statusCode);
      console.log('   shiftTrackingEnabled:', req.shiftTrackingEnabled);
      try {
        // Se a operação foi bem-sucedida e temos dados de máquina
        if (res.statusCode >= 200 && res.statusCode < 300 && req.shiftTrackingEnabled) {
          console.log('✅ updateShiftData - Condições atendidas, processando...');
          await ShiftMiddleware.processShiftUpdate(req, data);
        } else {
          console.log('⚠️ updateShiftData - Condições não atendidas');
        }
      } catch (error) {
        console.error('❌ Erro ao atualizar dados de turno:', error);
      }
      
      // Chamar o send original
      originalSend.call(this, data);
    };
    
    next();
  }

  /**
   * Processa atualização dos dados de turno
   */
  static async processShiftUpdate(req, responseData) {
    try {
      const { operatorId } = req.body || {};
      const { user } = req;
      
      // Obter machineId dos parâmetros da URL ou do body
      const machineId = parseInt(req.params?.id) || parseInt(req.body?.machineId);
      
      if (!machineId) {
        console.log('⚠️ processShiftUpdate: machineId não encontrado em req.params.id nem req.body.machineId');
        return;
      }
      
      console.log(`🔍 processShiftUpdate: machineId=${machineId}, operatorId=${operatorId}, user.id=${user?.id}`);
      
      // Determinar operador (do body ou do usuário logado)
      const finalOperatorId = operatorId || (user && user.role === 'OPERATOR' ? user.id : null);
      
      if (!finalOperatorId) {
        console.log('⚠️ processShiftUpdate: finalOperatorId não encontrado');
        return;
      }

      // Buscar dados atuais da máquina para calcular produção
      const machineQuery = `
        SELECT m.*, 
               mo.id as operation_id, mo.start_time as operation_start_time, mo.end_time as operation_end_time,
               qt.id as quality_test_id, qt.result as quality_test_result, qt.created_at as quality_test_created_at
        FROM machines m
        LEFT JOIN machine_operations mo ON m.id = mo.machine_id AND mo.end_time IS NULL
        LEFT JOIN quality_tests qt ON m.id = qt.machine_id AND qt.created_at >= $2
        WHERE m.id = $1
        ORDER BY mo.start_time DESC, qt.created_at DESC
      `;
      
      const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
       const machineResult = await pool.query(machineQuery, [machineId, todayStart]);
       
       let machineData = null;
       
       if (machineResult.rows.length > 0) {
         // Mapear resultado para estrutura esperada
         const firstRow = machineResult.rows[0];
         machineData = {
           id: firstRow.id,
           name: firstRow.name,
           status: firstRow.status,
           machine_operations: [],
           quality_tests: []
         };
         
         // Agrupar operações e testes de qualidade
         const operationsMap = new Map();
         const qualityTestsMap = new Map();
         
         machineResult.rows.forEach(row => {
           if (row.operation_id && !operationsMap.has(row.operation_id)) {
             operationsMap.set(row.operation_id, {
               id: row.operation_id,
               startTime: row.operation_start_time,
               endTime: row.operation_end_time
             });
           }
           
           if (row.quality_test_id && !qualityTestsMap.has(row.quality_test_id)) {
             qualityTestsMap.set(row.quality_test_id, {
               id: row.quality_test_id,
               result: row.quality_test_result,
               createdAt: row.quality_test_created_at
             });
           }
         });
         
         machineData.machine_operations = Array.from(operationsMap.values()).slice(0, 1); // take 1
         machineData.quality_tests = Array.from(qualityTestsMap.values());
       }

      if (!machineData) return;

      // Calcular dados de produção para o turno
      const productionData = await ShiftMiddleware.calculateProductionData(machineData, finalOperatorId);
      
      // Atualizar dados do turno
      await shiftService.createOrUpdateShiftData(machineId, finalOperatorId, productionData);
      
      console.log(`🔄 Dados de turno atualizados - Máquina: ${machineId}, Operador: ${finalOperatorId}`);
    } catch (error) {
      console.error('Erro ao processar atualização de turno:', error);
    }
  }

  /**
   * Calcula dados de produção baseado no estado atual da máquina
   */
  static async calculateProductionData(machineData, operatorId) {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // Buscar dados do turno atual
      const currentShift = await shiftService.getCurrentShiftData(machineData.id, operatorId);
      const shiftStartTime = currentShift ? currentShift.startTime : todayStart;
      
      // Buscar produção real do banco sempre, independente de operações ativas
      // CORREÇÃO: Preservar produção mesmo quando não há operações ativas
      const existingShiftData = await shiftService.getCurrentShiftData(machineData.id, operatorId);
      let totalProduction = existingShiftData ? existingShiftData.totalProduction : 0;
      let efficiency = 0;
      let downtime = 0;
      
      if (machineData.machine_operations && machineData.machine_operations.length > 0) {
        const operation = machineData.machine_operations[0];
        const operationDuration = (now - new Date(operation.startTime)) / (1000 * 60 * 60); // horas
        
        // Calcular eficiência baseada no status
        const shiftDuration = (now - shiftStartTime) / (1000 * 60 * 60); // horas
        if (shiftDuration > 0) {
          const productiveTime = operationDuration;
          efficiency = Math.min(100, (productiveTime / shiftDuration) * 100);
          downtime = Math.max(0, shiftDuration - productiveTime);
        }
      } else {
        // Mesmo sem operações ativas, calcular eficiência baseada nos dados existentes
        if (existingShiftData) {
          efficiency = existingShiftData.efficiency || 0;
          downtime = existingShiftData.downtime || 0;
        }
      }
      
      // Calcular dados de qualidade
      const qualityTests = machineData.quality_tests || [];
      const todayTests = qualityTests.filter(test => 
        new Date(test.createdAt) >= shiftStartTime
      );
      
      const approvedTests = todayTests.filter(test => test.result === 'APPROVED').length;
      const rejectedTests = todayTests.filter(test => test.result === 'REJECTED').length;
      
      return {
        totalProduction,
        efficiency: Math.round(efficiency * 100) / 100,
        downtime: Math.round(downtime * 100) / 100,
        qualityTests: todayTests.length,
        approvedTests,
        rejectedTests,
        detailedData: {
          lastUpdate: now,
          machineStatus: machineData.status,
          currentOperation: machineData.machine_operations[0] || null,
          qualityMetrics: {
            approvalRate: todayTests.length > 0 ? (approvedTests / todayTests.length) * 100 : 0,
            testsToday: todayTests.length
          }
        }
      };
    } catch (error) {
      console.error('Erro ao calcular dados de produção:', error);
      return {
        totalProduction: 0,
        efficiency: 0,
        downtime: 0,
        qualityTests: 0,
        approvedTests: 0,
        rejectedTests: 0
      };
    }
  }

  /**
   * Middleware para verificar mudança de turno
   */
  static async checkShiftChange(req, res, next) {
    console.log('🔍 MIDDLEWARE checkShiftChange - INÍCIO');
    try {
      const { machineId, operatorId } = req.body || {};
      const { user } = req;
      
      console.log('📋 checkShiftChange - machineId:', machineId, 'operatorId:', operatorId, 'user:', user?.id);
      
      if (!machineId) {
        console.log('⚠️ checkShiftChange - Sem machineId, continuando...');
        return next();
      }
      
      const finalOperatorId = operatorId || (user && user.role === 'OPERATOR' ? user.id : null);
      
      if (!finalOperatorId) {
        console.log('⚠️ checkShiftChange - Sem operatorId, continuando...');
        return next();
      }

      // Verificar se houve mudança de turno
      const currentShift = await shiftService.getCurrentShiftData(machineId, finalOperatorId);
      const now = new Date();
      const currentShiftType = shiftService.getShiftType(now);
      const hour = now.getHours();
      const minute = now.getMinutes();
      
      // Só fazer transição de turno nos horários exatos (7:00-7:05 e 19:00-19:05)
      const isShiftTransitionTime = 
        (hour === 7 && minute <= 5) ||   // Transição manhã
        (hour === 19 && minute <= 5);    // Transição noite
      
      // Se não há turno ativo, criar um novo
      if (!currentShift) {
        console.log(`🆕 Criando novo turno ${currentShiftType} para máquina ${machineId}`);
        await shiftService.resetOperatorData(machineId, finalOperatorId);
        req.shiftChanged = true;
        req.newShiftType = currentShiftType;
      }
      // Se há mudança de turno E estamos no horário de transição
      else if (currentShift.shiftType !== currentShiftType && isShiftTransitionTime) {
        console.log(`🔄 Transição de turno detectada para máquina ${machineId} (${currentShift.shiftType} → ${currentShiftType})`);
        await shiftService.resetOperatorData(machineId, finalOperatorId);
        req.shiftChanged = true;
        req.newShiftType = currentShiftType;
      }
      // Caso contrário, manter turno atual (evitar resets desnecessários)
      else if (currentShift.shiftType !== currentShiftType) {
        console.log(`⏳ Mudança de turno detectada mas fora do horário de transição (${hour}:${minute.toString().padStart(2, '0')}) - mantendo turno atual`);
      }
      
      console.log('✅ checkShiftChange - Concluído, continuando...');
      next();
    } catch (error) {
      console.error('❌ Erro ao verificar mudança de turno:', error);
      next(error);
    }
  }

  /**
   * Middleware para validar horário de operação
   */
  static validateOperationTime(req, res, next) {
    console.log('🔍 MIDDLEWARE validateOperationTime - INÍCIO');
    try {
      const now = new Date();
      const hour = now.getHours();
      
      console.log('⏰ validateOperationTime - Hora atual:', hour, 'Minutos:', now.getMinutes());
      
      // Verificar se está dentro do horário de operação (6:30 - 19:30)
      if (hour < 6 || (hour >= 19 && now.getMinutes() > 30)) {
        // Permitir operações, mas marcar como fora de turno
        req.outsideShiftHours = true;
        console.log(`⚠️ Operação fora do horário de turno: ${now.toLocaleTimeString()}`);
      }
      
      console.log('✅ validateOperationTime - Concluído, continuando...');
      next();
    } catch (error) {
      console.error('❌ Erro ao validar horário de operação:', error);
      next(error);
    }
  }
}

module.exports = ShiftMiddleware;