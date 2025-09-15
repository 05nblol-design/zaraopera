const pool = require('../config/database');
const crypto = require('crypto');

class ShiftService {
  constructor() {
    this.SHIFT_HOURS = {
      MORNING: { start: 7, end: 19 },
      NIGHT: { start: 19, end: 7 }
    };
  }

  /**
   * Determina o tipo de turno baseado na hora atual
   * @param {Date} date - Data para verificar
   * @returns {string} 'MORNING' ou 'NIGHT'
   */
  getShiftType(date = new Date()) {
    const hour = date.getHours();
    return (hour >= 7 && hour < 19) ? 'MORNING' : 'NIGHT';
  }

  /**
   * Calcula os horários de início e fim do turno
   * @param {Date} date - Data de referência
   * @param {string} shiftType - Tipo do turno
   * @returns {Object} { startTime, endTime }
   */
  getShiftTimes(date, shiftType) {
    const baseDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    if (shiftType === 'MORNING') {
      const startTime = new Date(baseDate.getTime() + 7 * 60 * 60 * 1000); // 7:00
      const endTime = new Date(baseDate.getTime() + 19 * 60 * 60 * 1000);   // 19:00
      return { startTime, endTime };
    } else {
      const startTime = new Date(baseDate.getTime() + 19 * 60 * 60 * 1000); // 19:00
      const endTime = new Date(baseDate.getTime() + 24 * 60 * 60 * 1000 + 7 * 60 * 60 * 1000); // 7:00 do próximo dia
      return { startTime, endTime };
    }
  }

  /**
   * Cria ou atualiza dados do turno atual
   * @param {number} machineId - ID da máquina
   * @param {number} operatorId - ID do operador
   * @param {Object} productionData - Dados de produção
   * @returns {Object} Dados do turno
   */
  async createOrUpdateShiftData(machineId, operatorId, productionData = {}) {
    try {
      const now = new Date();
      const shiftType = this.getShiftType(now);
      const { startTime, endTime } = this.getShiftTimes(now, shiftType);
      const shiftDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Verificar se já existe dados para este turno
      const findShiftQuery = `
        SELECT * FROM shift_data 
        WHERE machine_id = $1 AND operator_id = $2 AND shift_date = $3 AND shift_type = $4 AND is_active = true
        LIMIT 1
      `;
      
      const findResult = await db.query(findShiftQuery, [machineId, operatorId, shiftDate, shiftType]);
      let shiftData = findResult.rows.length > 0 ? findResult.rows[0] : null;

      if (shiftData) {
        // Atualizar dados existentes
        // Usar o maior valor entre produção atual e nova para evitar regressão
        const currentProduction = shiftData.totalProduction || 0;
        const newProduction = productionData.totalProduction || 0;
        const finalProduction = Math.max(currentProduction, newProduction);
        
        const updateShiftQuery = `
          UPDATE shift_data SET 
            total_production = $1,
            efficiency = $2,
            downtime = $3,
            quality_tests = $4,
            approved_tests = $5,
            rejected_tests = $6,
            production_data = $7,
            updated_at = $8
          WHERE id = $9
          RETURNING *
        `;
        
        const updateResult = await db.query(updateShiftQuery, [
          finalProduction,
          productionData.efficiency || shiftData.efficiency,
          productionData.downtime || shiftData.downtime,
          productionData.qualityTests || shiftData.quality_tests,
          productionData.approvedTests || shiftData.approved_tests,
          productionData.rejectedTests || shiftData.rejected_tests,
          productionData.detailedData ? JSON.stringify(productionData.detailedData) : shiftData.production_data,
          now,
          shiftData.id
        ]);
        
        shiftData = updateResult.rows[0];
        
        // Log para debug
        if (finalProduction !== currentProduction) {
          console.log(`🔄 Produção atualizada: ${currentProduction} → ${finalProduction} peças`);
        }
      } else {
        // Criar novos dados de turno
        const createShiftQuery = `
          INSERT INTO shift_data (
            machine_id, operator_id, shift_type, shift_date, start_time, end_time,
            total_production, target_production, efficiency, downtime,
            quality_tests, approved_tests, rejected_tests, production_data
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          RETURNING *
        `;
        
        const createResult = await db.query(createShiftQuery, [
          machineId,
          operatorId,
          shiftType,
          shiftDate,
          startTime,
          endTime,
          productionData.totalProduction || 0,
          productionData.targetProduction || 0,
          productionData.efficiency || 0,
          productionData.downtime || 0,
          productionData.qualityTests || 0,
          productionData.approvedTests || 0,
          productionData.rejectedTests || 0,
          productionData.detailedData ? JSON.stringify(productionData.detailedData) : null
        ]);
        
        shiftData = createResult.rows[0];
      }

      return shiftData;
    } catch (error) {
      console.error('Erro ao criar/atualizar dados do turno:', error);
      throw error;
    }
  }

  /**
   * Arquiva dados do turno quando ele termina
   * @param {number} shiftDataId - ID dos dados do turno
   * @returns {Object} Dados arquivados
   */
  async archiveShiftData(shiftDataId) {
    try {
      // Buscar dados completos do turno
      const shiftQuery = `
        SELECT sd.*, m.name as machine_name, u.name as operator_name
        FROM shift_data sd
        JOIN machines m ON sd.machine_id = m.id
        JOIN users u ON sd.operator_id = u.id
        WHERE sd.id = $1
      `;
      
      const shiftResult = await db.query(shiftQuery, [shiftDataId]);
      const shiftData = shiftResult.rows.length > 0 ? shiftResult.rows[0] : null;

      if (!shiftData) {
        throw new Error('Dados do turno não encontrados');
      }

      if (shiftData.is_archived) {
        throw new Error('Dados do turno já foram arquivados');
      }

      // Preparar dados para arquivamento
      const archiveData = {
        shiftInfo: {
          id: shiftData.id,
          machineId: shiftData.machine_id,
          machineName: shiftData.machine_name,
          operatorId: shiftData.operator_id,
          operatorName: shiftData.operator_name,
          shiftType: shiftData.shift_type,
          shiftDate: shiftData.shift_date,
          startTime: shiftData.start_time,
          endTime: shiftData.end_time
        },
        productionMetrics: {
          totalProduction: shiftData.total_production,
          targetProduction: shiftData.target_production,
          efficiency: shiftData.efficiency,
          downtime: shiftData.downtime
        },
        qualityMetrics: {
          qualityTests: shiftData.quality_tests,
          approvedTests: shiftData.approved_tests,
          rejectedTests: shiftData.rejected_tests,
          approvalRate: shiftData.quality_tests > 0 ? (shiftData.approved_tests / shiftData.quality_tests) * 100 : 0
        },
        detailedData: {
          productionData: shiftData.production_data ? JSON.parse(shiftData.production_data) : null,
          qualityData: shiftData.quality_data ? JSON.parse(shiftData.quality_data) : null,
          maintenanceData: shiftData.maintenance_data ? JSON.parse(shiftData.maintenance_data) : null
        },
        archivedAt: new Date()
      };

      const archivedDataString = JSON.stringify(archiveData);
      const dataSize = Buffer.byteLength(archivedDataString, 'utf8');
      const checksum = crypto.createHash('md5').update(archivedDataString).digest('hex');

      // Criar arquivo
      const createArchiveQuery = `
        INSERT INTO production_archive (shift_data_id, machine_id, operator_id, archived_data, data_size, checksum)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      
      const archiveResult = await db.query(createArchiveQuery, [
        shiftData.id,
        shiftData.machine_id,
        shiftData.operator_id,
        archivedDataString,
        dataSize,
        checksum
      ]);
      
      const archive = archiveResult.rows[0];

      // Marcar dados do turno como arquivados e inativos
      const updateShiftQuery = `
        UPDATE shift_data SET is_active = false, is_archived = true, updated_at = NOW()
        WHERE id = $1
      `;
      
      await db.query(updateShiftQuery, [shiftDataId]);

      console.log(`✅ Dados do turno ${shiftData.shift_type} arquivados para máquina ${shiftData.machine_name}`);
      return archive;
    } catch (error) {
      console.error('Erro ao arquivar dados do turno:', error);
      throw error;
    }
  }

  /**
   * Transiciona dados do operador para novo turno (preservando produção)
   * @param {number} machineId - ID da máquina
   * @param {number} operatorId - ID do operador
   * @returns {Object} Novos dados do turno
   */
  async resetOperatorData(machineId, operatorId) {
    try {
      const now = new Date();
      const currentShiftType = this.getShiftType(now);
      
      // Buscar turno ativo anterior
      const previousShiftResult = await pool.query(
        `SELECT * FROM "ShiftData" 
         WHERE "machineId" = $1 AND "operatorId" = $2 
         AND "isActive" = true AND "isArchived" = false
         ORDER BY "createdAt" DESC
         LIMIT 1`,
        [machineId, operatorId]
      );
      const previousShift = previousShiftResult.rows[0];

      let preservedProduction = 0;
      
      // Se existe turno anterior e é diferente do atual
      if (previousShift && previousShift.shiftType !== currentShiftType) {
        // Preservar produção atual antes de arquivar
        preservedProduction = previousShift.totalProduction || 0;
        console.log(`💾 Preservando produção de ${preservedProduction} peças do turno anterior`);
        
        await this.archiveShiftData(previousShift.id);
      } else if (previousShift) {
        // Se é o mesmo turno, manter produção existente
        preservedProduction = previousShift.totalProduction || 0;
      }

      // Criar novo turno preservando a produção
      const newShiftData = await this.createOrUpdateShiftData(machineId, operatorId, {
        totalProduction: preservedProduction, // Preservar produção ao invés de zerar
        efficiency: 0,
        downtime: 0,
        qualityTests: 0,
        approvedTests: 0,
        rejectedTests: 0
      });

      console.log(`🔄 Transição para novo turno ${currentShiftType} - Máquina: ${machineId}, Operador: ${operatorId}, Produção preservada: ${preservedProduction}`);
      return newShiftData;
    } catch (error) {
      console.error('Erro ao fazer transição de turno:', error);
      throw error;
    }
  }

  /**
   * Busca dados do turno atual
   * @param {number} machineId - ID da máquina
   * @param {number} operatorId - ID do operador
   * @returns {Object} Dados do turno atual
   */
  async getCurrentShiftData(machineId, operatorId) {
    try {
      const now = new Date();
      const shiftType = this.getShiftType(now);
      const shiftDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const shiftDataResult = await pool.query(
        `SELECT sd.*, 
                json_build_object(
                  'id', m.id,
                  'name', m.name,
                  'code', m.code,
                  'status', m.status
                ) as machine,
                json_build_object(
                  'id', u.id,
                  'name', u.name,
                  'email', u.email,
                  'role', u.role
                ) as operator
         FROM "ShiftData" sd
         LEFT JOIN "Machine" m ON sd."machineId" = m.id
         LEFT JOIN users u ON sd."operatorId" = u.id
         WHERE sd."machineId" = $1 AND sd."operatorId" = $2 
         AND sd."shiftDate" = $3 AND sd."shiftType" = $4 
         AND sd."isActive" = true
         LIMIT 1`,
        [machineId, operatorId, shiftDate, shiftType]
      );
      const shiftData = shiftDataResult.rows[0];

      return shiftData;
    } catch (error) {
      console.error('Erro ao buscar dados do turno atual:', error);
      throw error;
    }
  }

  /**
   * Busca dados arquivados por período
   * @param {Object} filters - Filtros de busca
   * @returns {Array} Lista de dados arquivados
   */
  async getArchivedData(filters = {}) {
    try {
      const where = {};
      
      if (filters.machineId) where.machineId = filters.machineId;
      if (filters.operatorId) where.operatorId = filters.operatorId;
      if (filters.startDate || filters.endDate) {
        where.archiveDate = {};
        if (filters.startDate) where.archiveDate.gte = new Date(filters.startDate);
        if (filters.endDate) where.archiveDate.lte = new Date(filters.endDate);
      }

      let whereClause = 'WHERE 1=1';
      const params = [];
      let paramIndex = 1;
      
      if (filters.machineId) {
        whereClause += ` AND pa."machineId" = $${paramIndex}`;
        params.push(filters.machineId);
        paramIndex++;
      }
      if (filters.operatorId) {
        whereClause += ` AND pa."operatorId" = $${paramIndex}`;
        params.push(filters.operatorId);
        paramIndex++;
      }
      if (filters.startDate) {
        whereClause += ` AND pa."archiveDate" >= $${paramIndex}`;
        params.push(new Date(filters.startDate));
        paramIndex++;
      }
      if (filters.endDate) {
        whereClause += ` AND pa."archiveDate" <= $${paramIndex}`;
        params.push(new Date(filters.endDate));
        paramIndex++;
      }

      const archivesResult = await pool.query(
        `SELECT pa.*, 
                json_build_object(
                  'name', m.name,
                  'code', m.code
                ) as machine,
                json_build_object(
                  'name', u.name,
                  'email', u.email
                ) as operator,
                json_build_object(
                  'shiftType', sd."shiftType",
                  'shiftDate', sd."shiftDate"
                ) as "shiftData"
         FROM "ProductionArchive" pa
         LEFT JOIN "Machine" m ON pa."machineId" = m.id
         LEFT JOIN users u ON pa."operatorId" = u.id
         LEFT JOIN "ShiftData" sd ON pa."shiftDataId" = sd.id
         ${whereClause}
         ORDER BY pa."archiveDate" DESC`,
        params
      );
      const archives = archivesResult.rows;

      return archives.map(archive => ({
        ...archive,
        archivedData: JSON.parse(archive.archivedData)
      }));
    } catch (error) {
      console.error('Erro ao buscar dados arquivados:', error);
      throw error;
    }
  }

  /**
   * Verifica e arquiva turnos que terminaram
   * Função para ser executada automaticamente
   */
  async archiveCompletedShifts() {
    try {
      const now = new Date();
      const currentHour = now.getHours();
      
      // Verificar se estamos no horário de mudança de turno (7:00 ou 19:00)
      if (currentHour !== 7 && currentHour !== 19) {
        return { message: 'Não é horário de mudança de turno' };
      }

      // Buscar turnos ativos que deveriam ter terminado
      const activeShiftsResult = await pool.query(
        `SELECT * FROM "ShiftData" 
         WHERE "isActive" = true AND "isArchived" = false 
         AND "endTime" <= $1`,
        [now]
      );
      const activeShifts = activeShiftsResult.rows;

      console.log(`🔍 Encontrados ${activeShifts.length} turnos para arquivar`);

      const results = [];
      for (const shift of activeShifts) {
        try {
          const archive = await this.archiveShiftData(shift.id);
          results.push({ success: true, shiftId: shift.id, archiveId: archive.id });
        } catch (error) {
          console.error(`Erro ao arquivar turno ${shift.id}:`, error);
          results.push({ success: false, shiftId: shift.id, error: error.message });
        }
      }

      return {
        message: `Processados ${activeShifts.length} turnos`,
        archived: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results
      };
    } catch (error) {
      console.error('Erro ao verificar turnos para arquivar:', error);
      throw error;
    }
  }

  /**
   * Atualiza dados do turno atual com informações de produção
   */
  async updateCurrentShiftData() {
    try {
      // Buscar todos os turnos ativos
      const activeShiftsResult = await pool.query(
        `SELECT sd.*, 
                json_build_object(
                  'id', m.id,
                  'name', m.name,
                  'type', m.type,
                  'status', m.status
                ) as machine,
                json_build_object(
                  'id', u.id,
                  'name', u.name,
                  'email', u.email,
                  'role', u.role
                ) as operator
         FROM shift_data sd
         LEFT JOIN machines m ON sd."machineId" = m.id
         LEFT JOIN users u ON sd."operatorId" = u.id
         WHERE sd."isActive" = true AND sd."isArchived" = false`,
        []
      );
      const activeShifts = activeShiftsResult.rows;

      const results = [];
      for (const shift of activeShifts) {
        try {
          // Calcular dados atualizados de produção
          const productionData = await this.calculateCurrentProductionData(shift.machineId, shift.operatorId);
          
          // Atualizar turno
          await this.createOrUpdateShiftData(shift.machineId, shift.operatorId, productionData);
          
          results.push({ success: true, shiftId: shift.id });
        } catch (error) {
          console.error(`Erro ao atualizar turno ${shift.id}:`, error);
          results.push({ success: false, shiftId: shift.id, error: error.message });
        }
      }

      return {
        message: `Atualizados ${results.filter(r => r.success).length} de ${activeShifts.length} turnos`,
        results
      };
    } catch (error) {
      console.error('Erro ao atualizar dados de turno:', error);
      throw error;
    }
  }

  /**
   * Calcula dados de produção atuais para um turno
   */
  async calculateCurrentProductionData(machineId, operatorId) {
    try {
      const now = new Date();
      const currentShift = await this.getCurrentShiftData(machineId, operatorId);
      const shiftStartTime = currentShift ? currentShift.startTime : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 0, 0);
      
      // Buscar dados da máquina
      const machineResult = await pool.query(
        `SELECT m.*,
                COALESCE(
                  json_agg(
                    json_build_object(
                      'id', mo.id,
                      'startTime', mo."startTime",
                      'endTime', mo."endTime",
                      'status', mo.status
                    ) ORDER BY mo."startTime" DESC
                  ) FILTER (WHERE mo.id IS NOT NULL), '[]'
                ) as machine_operations,
                COALESCE(
                  json_agg(
                    DISTINCT json_build_object(
                      'id', qt.id,
                      'result', qt.result,
                      'createdAt', qt."createdAt"
                    )
                  ) FILTER (WHERE qt.id IS NOT NULL), '[]'
                ) as quality_tests
         FROM "Machine" m
         LEFT JOIN "MachineOperation" mo ON m.id = mo."machineId" 
              AND mo."startTime" >= $2
         LEFT JOIN "QualityTest" qt ON m.id = qt."machineId" 
              AND qt."createdAt" >= $2
         WHERE m.id = $1
         GROUP BY m.id`,
        [machineId, shiftStartTime]
      );
      const machine = machineResult.rows[0];

      if (!machine) {
        return { totalProduction: 0, efficiency: 0, downtime: 0, qualityTests: 0, approvedTests: 0, rejectedTests: 0 };
      }

      // Buscar produção real do banco ao invés de recalcular baseado na velocidade atual
      // Isso evita o bug de salto instantâneo quando a velocidade muda
      const existingShiftData = await this.getCurrentShiftData(machineId, operatorId);
      const totalProduction = existingShiftData ? existingShiftData.totalProduction : 0;
      
      // Calcular tempo total de operação para eficiência
      let totalOperationTime = 0;
      machine.machine_operations.forEach(operation => {
        const startTime = new Date(operation.startTime);
        const endTime = operation.endTime ? new Date(operation.endTime) : now;
        const duration = (endTime - startTime) / (1000 * 60 * 60); // horas
        totalOperationTime += duration;
      });

      // Calcular eficiência
      const shiftDuration = (now - shiftStartTime) / (1000 * 60 * 60); // horas
      const efficiency = shiftDuration > 0 ? Math.min(100, (totalOperationTime / shiftDuration) * 100) : 0;
      const downtime = Math.max(0, shiftDuration - totalOperationTime);

      // Dados de qualidade
      const qualityTests = machine.quality_tests.length;
      const approvedTests = machine.quality_tests.filter(test => test.result === 'APPROVED').length;
      const rejectedTests = machine.quality_tests.filter(test => test.result === 'REJECTED').length;

      return {
        totalProduction,
        efficiency: Math.round(efficiency * 100) / 100,
        downtime: Math.round(downtime * 100) / 100,
        qualityTests,
        approvedTests,
        rejectedTests,
        detailedData: {
          lastUpdate: now,
          machineStatus: machine.status,
          operationsCount: machine.machine_operations.length,
          totalOperationTime: Math.round(totalOperationTime * 100) / 100
        }
      };
    } catch (error) {
      console.error('Erro ao calcular dados de produção:', error);
      return { totalProduction: 0, efficiency: 0, downtime: 0, qualityTests: 0, approvedTests: 0, rejectedTests: 0 };
    }
  }
}

module.exports = new ShiftService();