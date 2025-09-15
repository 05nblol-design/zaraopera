const pool = require('../config/database');
const { checkProductionAlertsService } = require('../middleware/productionAlertMiddleware');

class RealTimeProductionService {
  constructor(io) {
    this.io = io;
    this.updateInterval = null;
    this.isRunning = false;
  }

  /**
   * Inicia o serviço de atualização em tempo real
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️ Serviço de produção em tempo real já está rodando');
      return;
    }

    console.log('🚀 Iniciando serviço de produção em tempo real...');
    this.isRunning = true;
    
    // Atualizar a cada 30 segundos
    this.updateInterval = setInterval(() => {
      this.updateProduction();
    }, 30000);

    // Primeira execução imediata
    this.updateProduction();
  }

  /**
   * Para o serviço de atualização
   */
  stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.isRunning = false;
    console.log('🛑 Serviço de produção em tempo real parado');
  }

  /**
   * Atualiza dados de produção para todas as máquinas ativas
   */
  async updateProduction() {
    try {
      console.log('🔄 RealTimeProductionService: Executando updateProduction...');
      // Buscar máquinas com status FUNCIONANDO
      const machinesQuery = `
        SELECT m.*, 
               o.id as operation_id, o.status as operation_status, o.start_time, o.end_time,
               u.id as user_id, u.name as user_name, u.email as user_email
        FROM machines m
        LEFT JOIN machine_operations o ON m.id = o.machine_id 
          AND o.status IN ('ACTIVE', 'RUNNING') 
          AND o.end_time IS NULL
        LEFT JOIN users u ON o.user_id = u.id
        WHERE m.status = 'FUNCIONANDO'
      `;
      const machinesResult = await pool.query(machinesQuery);
      const runningMachines = machinesResult.rows;

      console.log(`🔄 Atualizando produção para ${runningMachines.length} máquinas funcionando`);

      for (const machine of runningMachines) {
        if (machine.operation_id) {
          const operation = {
            id: machine.operation_id,
            status: machine.operation_status,
            startTime: machine.start_time,
            endTime: machine.end_time,
            user: {
              id: machine.user_id,
              name: machine.user_name,
              email: machine.user_email
            }
          };
          await this.updateMachineProduction(machine, operation);
        } else {
          // Fallback: atualizar produção mesmo sem operação ativa
          console.log(`⚠️ Máquina ${machine.name} funcionando sem operação ativa - usando fallback`);
          await this.updateMachineProductionFallback(machine);
        }
      }

    } catch (error) {
      console.error('❌ Erro ao atualizar produção:', error);
    }
  }

  /**
   * Atualiza produção de uma máquina específica
   */
  async updateMachineProduction(machine, operation) {
    try {
      const now = new Date();
      const startTime = new Date(operation.startTime);
      const operationDurationMinutes = Math.floor((now - startTime) / (1000 * 60));
      
      // Buscar dados do turno atual
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const shiftDataResult = await pool.query(
        'SELECT * FROM shift_data WHERE machine_id = $1 AND operator_id = $2 AND shift_date = $3 LIMIT 1',
        [machine.id, operation.user.id, today]
      );
      let shiftData = shiftDataResult.rows[0] || null;

      if (shiftData) {
        // Calcular produção incremental desde a última atualização
        const lastUpdateTime = new Date(shiftData.updated_at || shiftData.created_at);
        const incrementalMinutes = Math.max(0, Math.floor((now - lastUpdateTime) / (1000 * 60)));
        
        // CORREÇÃO: Usar velocidade armazenada no shiftData ou velocidade atual apenas para novos períodos
        // Evita aplicar nova velocidade a períodos já calculados
        let incrementalProduction = 0;
        
        if (incrementalMinutes > 0) {
          // Buscar a velocidade que estava ativa no momento da última atualização
          const previousSpeed = shiftData.last_known_speed || machine.production_speed || 1;
          const currentSpeed = machine.production_speed || 1;
          
          // Se a velocidade mudou, usar a velocidade anterior para o cálculo incremental
          // Isso evita aplicar a nova velocidade retroativamente
          const speedToUse = (previousSpeed !== currentSpeed) ? previousSpeed : currentSpeed;
          
          incrementalProduction = Math.max(0, Math.floor(incrementalMinutes * speedToUse));
          
          const newTotalProduction = shiftData.total_production + incrementalProduction;
          
          await pool.query(
            'UPDATE shift_data SET total_production = $1, last_known_speed = $2, updated_at = $3 WHERE id = $4',
            [newTotalProduction, currentSpeed, now, shiftData.id]
          );
          
          console.log(`📈 Produção incremental - ${machine.name}: +${incrementalProduction} peças (${incrementalMinutes}min a ${speedToUse}/min) = ${newTotalProduction} total`);
          if (previousSpeed !== currentSpeed) {
            console.log(`⚡ Velocidade alterada de ${previousSpeed}/min para ${currentSpeed}/min - aplicando nova velocidade apenas para próximos períodos`);
          }
        }
      } else {
        // Criar novos dados de turno
        const shiftType = this.getCurrentShiftType();
        const shiftStartTime = this.getShiftStartTime(shiftType, today);
        const shiftEndTime = this.getShiftEndTime(shiftType, today);
        
        // Iniciar produção do zero para novo turno (não recalcular baseado na velocidade atual)
        const totalProduction = 0;
        
        await pool.query(`
          INSERT INTO shift_data (machine_id, operator_id, shift_date, shift_type, start_time, end_time, total_production, target_production, efficiency)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          machine.id,
          operation.user.id,
          today,
          shiftType,
          shiftStartTime,
          shiftEndTime,
          totalProduction,
          machine.targetProduction || 0,
          machine.targetProduction ? (totalProduction / machine.targetProduction) * 100 : 0
        ]);
        
        console.log(`🆕 Novo turno criado - ${machine.name}: ${totalProduction} peças`);
      }

      // Buscar dados atualizados do turno para emitir via WebSocket
      const updatedShiftDataResult = await pool.query(
        'SELECT * FROM shift_data WHERE machine_id = $1 AND operator_id = $2 AND shift_date = $3 LIMIT 1',
        [machine.id, operation.user.id, today]
      );
      const updatedShiftData = updatedShiftDataResult.rows[0] || null;
      
      const currentTotalProduction = updatedShiftData ? updatedShiftData.total_production : 0;
      
      // Debug: Verificar se this.io está definido
      console.log('🔍 DEBUG: this.io está definido?', !!this.io);
      console.log('🔍 DEBUG: Tipo de this.io:', typeof this.io);
      
      // Emitir atualização via WebSocket
      if (this.io) {
        const updateData = {
          machineId: machine.id,
          machineName: machine.name,
          operatorName: operation.user.name,
          totalProduction: currentTotalProduction,
          operationDuration: operationDurationMinutes,
          productionSpeed: machine.production_speed,
          lastUpdate: now
        };
        
        console.log('📡 Emitindo evento production:update:', updateData);
        this.io.emit('production:update', updateData);
      } else {
        console.log('⚠️ WebSocket (io) não disponível para emitir evento');
      }

      console.log(`✅ Produção atualizada - ${machine.name}: ${currentTotalProduction} peças (${operationDurationMinutes}min)`);
      
      // Verificar alertas de produção
      try {
        await checkProductionAlertsService(machine.id, currentTotalProduction);
      } catch (alertError) {
        console.error(`❌ Erro ao verificar alertas de produção para máquina ${machine.name}:`, alertError);
      }

    } catch (error) {
      console.error(`❌ Erro ao atualizar produção da máquina ${machine.name}:`, error);
    }
  }

  /**
   * Determina o tipo de turno atual
   */
  getCurrentShiftType() {
    const now = new Date();
    const hour = now.getHours();
    
    // Turno da manhã: 7h às 19h
    // Turno da noite: 19h às 7h do dia seguinte
    return (hour >= 7 && hour < 19) ? 'MORNING' : 'NIGHT';
  }

  /**
   * Calcula horário de início do turno
   */
  getShiftStartTime(shiftType, date) {
    const startTime = new Date(date);
    if (shiftType === 'MORNING') {
      startTime.setHours(7, 0, 0, 0);
    } else {
      startTime.setHours(19, 0, 0, 0);
    }
    return startTime;
  }

  /**
   * Calcula horário de fim do turno
   */
  getShiftEndTime(shiftType, date) {
    const endTime = new Date(date);
    if (shiftType === 'MORNING') {
      endTime.setHours(19, 0, 0, 0);
    } else {
      endTime.setDate(endTime.getDate() + 1);
      endTime.setHours(7, 0, 0, 0);
    }
    return endTime;
  }

  /**
   * Busca a velocidade de produção que estava ativa em um momento específico
   */
  async getPreviousProductionSpeed(machineId, timestamp) {
    try {
      // Buscar a velocidade atual da máquina como aproximação
      // TODO: Implementar tabela de histórico de velocidades para precisão total
      const machineResult = await pool.query(
        'SELECT production_speed FROM machines WHERE id = $1',
        [machineId]
      );
      const machine = machineResult.rows[0] || null;
      
      return machine?.production_speed || 1;
    } catch (error) {
      console.error(`❌ Erro ao buscar velocidade anterior da máquina ${machineId}:`, error);
      return 1; // Velocidade padrão segura
    }
  }

  /**
   * Força atualização imediata para uma máquina específica
   */
  async forceUpdateMachine(machineId) {
    try {
      const machineResult = await pool.query(`
        SELECT m.*, 
               o.id as operation_id, o.status as operation_status, o.start_time, o.end_time,
               u.id as user_id, u.name as user_name, u.email as user_email
        FROM machines m
        LEFT JOIN machine_operations o ON m.id = o.machine_id 
          AND o.status = 'ACTIVE' 
          AND o.end_time IS NULL
        LEFT JOIN users u ON o.user_id = u.id
        WHERE m.id = $1
        ORDER BY o.start_time DESC
        LIMIT 1
      `, [machineId]);
      const machineData = machineResult.rows[0] || null;
      
      const machine = machineData ? {
        ...machineData,
        operations: machineData.operation_id ? [{
          id: machineData.operation_id,
          status: machineData.operation_status,
          startTime: machineData.start_time,
          endTime: machineData.end_time,
          user: {
            id: machineData.user_id,
            name: machineData.user_name,
            email: machineData.user_email
          }
        }] : []
      } : null;

      if (machine && machine.status === 'FUNCIONANDO' && machine.operations.length > 0) {
        await this.updateMachineProduction(machine, machine.operations[0]);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`❌ Erro ao forçar atualização da máquina ${machineId}:`, error);
      return false;
    }
  }

  // Método de fallback para atualizar produção quando não há operações ativas
  async updateMachineProductionFallback(machine) {
    try {
      const currentTime = new Date();
      
      // Buscar dados do turno atual usando a mesma lógica da função principal
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // CORREÇÃO: Buscar shiftData existente sem filtrar por shiftType específico
      // para evitar criar registros duplicados com tipos diferentes
      const shiftDataResult = await pool.query(
        'SELECT * FROM shift_data WHERE machine_id = $1 AND shift_date = $2 ORDER BY updated_at DESC LIMIT 1',
        [machine.id, today]
      );
      let shiftData = shiftDataResult.rows[0] || null;

      if (!shiftData) {
        // Criar novos dados de turno usando a mesma lógica da função principal
        const shiftType = this.getCurrentShiftType();
        const shiftStartTime = this.getShiftStartTime(shiftType, today);
        const shiftEndTime = this.getShiftEndTime(shiftType, today);
        
        // Buscar um operador padrão ou usar ID 1 como fallback
        const defaultOperatorResult = await pool.query(
          'SELECT * FROM users WHERE role = $1 AND is_active = true LIMIT 1',
          ['OPERATOR']
        );
        const defaultOperator = defaultOperatorResult.rows[0] || null;
        
        const createShiftResult = await pool.query(`
          INSERT INTO shift_data (machine_id, operator_id, shift_date, shift_type, start_time, end_time, total_production, target_production, efficiency)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *
        `, [
          machine.id,
          defaultOperator?.id || 1,
          today,
          shiftType,
          shiftStartTime,
          shiftEndTime,
          0,
          machine.target_production || 0,
          0
        ]);
        shiftData = createShiftResult.rows[0];
        console.log(`📊 Criado novo shiftData para máquina ${machine.name} no turno ${shiftType}`);
      }

      // Calcular tempo desde a última atualização
      const lastUpdate = shiftData.updated_at || shiftData.created_at;
      let timeDiffMinutes = Math.max(0, (currentTime - lastUpdate) / (1000 * 60));
      
      // Se for um shiftData recém-criado, simular pelo menos 1 minuto para teste
      if (timeDiffMinutes < 0.1 && shiftData.total_production === 0) {
        timeDiffMinutes = 1; // Simular 1 minuto para permitir cálculo inicial
        console.log(`📊 Simulando 1 minuto para shiftData recém-criado`);
      }

      if (timeDiffMinutes > 0) {
        // Determinar se a máquina estava funcionando baseado no status atual
        const isRunning = machine.status === 'FUNCIONANDO';
        const productionSpeed = machine.production_speed || 0;

        // Calcular produção incremental apenas se a máquina estava funcionando
        // CORREÇÃO: Usar Math.floor ao invés de Math.ceil para evitar arredondamentos excessivos
        // e usar velocidade armazenada para evitar aplicação retroativa
        let incrementalProduction = 0;
        
        if (isRunning && productionSpeed > 0) {
          // CORREÇÃO: Usar a mesma lógica da função principal para evitar aplicação retroativa
          const previousSpeed = shiftData.last_known_speed || productionSpeed;
          const currentSpeed = productionSpeed;
          
          // Se a velocidade mudou, usar a velocidade anterior para o cálculo incremental
          const speedToUse = (previousSpeed !== currentSpeed) ? previousSpeed : currentSpeed;
          
          incrementalProduction = Math.max(0, Math.floor(timeDiffMinutes * speedToUse));
          
          if (previousSpeed !== currentSpeed) {
            console.log(`⚡ Fallback - Velocidade alterada de ${previousSpeed}/min para ${currentSpeed}/min - aplicando nova velocidade apenas para próximos períodos`);
          }
        }
        
        console.log(`📊 Debug: isRunning=${isRunning}, speed=${productionSpeed}, time=${timeDiffMinutes}min, production=${incrementalProduction}`);

        // Calcular downtime incremental baseado no status atual da máquina
        // CORREÇÃO: Considerar todos os status que não são produtivos como downtime
        const nonproductiveStatuses = ['PARADA', 'STOPPED', 'MANUTENCAO', 'MAINTENANCE', 'ERROR', 'FORA_DE_TURNO'];
        const isNonProductive = nonproductiveStatuses.includes(machine.status);
        const incrementalDowntime = isNonProductive ? timeDiffMinutes : 0;
        
        console.log(`📊 Status: ${machine.status}, isRunning: ${isRunning}, isNonProductive: ${isNonProductive}, downtime: ${incrementalDowntime}min`);

        // Atualizar shiftData
        const updatedShiftResult = await pool.query(`
          UPDATE shift_data 
          SET total_production = $1, downtime = $2, last_known_speed = $3, updated_at = CURRENT_TIMESTAMP
          WHERE id = $4
          RETURNING *
        `, [
          shiftData.total_production + incrementalProduction,
          shiftData.downtime + incrementalDowntime,
          productionSpeed,
          shiftData.id
        ]);
        const updatedShiftData = updatedShiftResult.rows[0];

        // Calcular eficiência baseada no tempo total do turno
        const totalShiftMinutes = (updatedShiftData.end_time - updatedShiftData.start_time) / (1000 * 60);
        const runningMinutes = totalShiftMinutes - updatedShiftData.downtime;
        const efficiency = totalShiftMinutes > 0 
          ? Math.round((runningMinutes / totalShiftMinutes) * 100) 
          : 0;

        await pool.query(
          'UPDATE shift_data SET efficiency = $1 WHERE id = $2',
          [efficiency, updatedShiftData.id]
        );

        console.log(`📊 Fallback: Máquina ${machine.name} - Produção: +${incrementalProduction}, Tempo: ${timeDiffMinutes.toFixed(1)}min, Status: ${machine.status}`);
        
        // Verificar alertas de produção no fallback
        try {
          await checkProductionAlertsService(machine.id, updatedShiftData.totalProduction);
        } catch (alertError) {
          console.error(`❌ Erro ao verificar alertas de produção (fallback) para máquina ${machine.name}:`, alertError);
        }

        // Emitir atualização via WebSocket se disponível
        if (this.io) {
          this.io.emit('productionUpdate', {
            machineId: machine.id,
            machineName: machine.name,
            production: updatedShiftData.total_production,
            downtime: updatedShiftData.downtime,
            efficiency,
            shiftType,
            lastUpdate: currentTime,
            source: 'fallback'
          });
        }

        return true;
      }

      return false;
    } catch (error) {
      console.error(`❌ Erro no fallback de produção da máquina ${machine.id}:`, error);
      return false;
    }
  }
}

module.exports = RealTimeProductionService;