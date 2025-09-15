const pool = require('../config/database');
const ShiftRotationService = require('./shiftRotationService');
const { setCache, getCache, deleteCache } = require('../config/redis');

class AdvancedRealTimeProductionService {
  constructor(io) {
    this.io = io;
    this.updateInterval = null;
    this.isRunning = false;
    this.shiftRotationService = new ShiftRotationService();
    
    // Configuração do sistema 3x3 com turnos de 12 horas
    this.SHIFT_CONFIG = {
      MORNING: { start: 7, end: 19, duration: 12 }, // 7h às 19h
      NIGHT: { start: 19, end: 7, duration: 12 }    // 19h às 7h do dia seguinte
    };
    
    // Escalas A, B, C, D
    this.TEAMS = ['A', 'B', 'C', 'D'];
    
    // Cache para histórico de BPM por máquina
    this.bpmHistory = new Map();
    
    // TTL para cache de produção (5 minutos)
    this.PRODUCTION_CACHE_TTL = 300;
  }

  /**
   * Inicia o serviço de atualização em tempo real (a cada segundo)
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️ Serviço avançado de produção em tempo real já está rodando');
      return;
    }

    console.log('🚀 Iniciando serviço avançado de produção em tempo real (cálculo por segundo)...');
    this.isRunning = true;
    
    // Atualizar a cada 1 segundo para cálculo contínuo
    this.updateInterval = setInterval(() => {
      this.updateProductionRealTime();
    }, 1000);

    // Primeira execução imediata
    this.updateProductionRealTime();
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
    console.log('🛑 Serviço avançado de produção em tempo real parado');
  }

  /**
   * Atualiza produção em tempo real para todas as máquinas ativas
   */
  async updateProductionRealTime() {
    try {
      // Buscar máquinas com operações ativas
      const machinesQuery = `
        SELECT m.*, 
               o.id as operation_id, o.status as operation_status, o.start_time, o.end_time,
               u.id as user_id, u.name as user_name, u.email as user_email,
               st.team_code, st.team_name
        FROM machines m
        LEFT JOIN machine_operations o ON m.id = o.machine_id 
          AND o.status IN ('ACTIVE', 'RUNNING') 
          AND o.end_time IS NULL
        LEFT JOIN users u ON o.user_id = u.id
        LEFT JOIN shift_team_members stm ON u.id = stm.user_id AND stm.is_active = true
        LEFT JOIN shift_teams st ON stm.team_id = st.id AND st.is_active = true
        WHERE m.status = 'FUNCIONANDO'
      `;
      const machinesResult = await pool.query(machinesQuery);
      const runningMachines = machinesResult.rows;

      for (const machine of runningMachines) {
        if (machine.operation_id) {
          await this.updateMachineProductionAdvanced(machine);
        }
      }

    } catch (error) {
      console.error('❌ Erro ao atualizar produção em tempo real:', error);
    }
  }

  /**
   * Atualiza produção de uma máquina específica com cálculo avançado
   */
  async updateMachineProductionAdvanced(machine) {
    try {
      const now = new Date();
      const machineId = machine.id;
      const operatorId = machine.user_id;
      const teamCode = machine.team_code || 'A'; // Default para escala A
      
      // Determinar turno e escala atual
      const currentShift = this.getCurrentShift(now);
      const teamShift = await this.shiftRotationService.getTeamActiveShift(teamCode, now);
      
      // Verificar se a equipe está em período de trabalho
      if (!teamShift.isWorkDay) {
        console.log(`⏸️ Equipe ${teamCode} está em período de descanso - pausando cálculo`);
        return;
      }

      // Buscar ou criar dados do turno atual
      let shiftData = await this.getOrCreateShiftData(machineId, operatorId, teamCode, currentShift, now);
      
      // Calcular produção incremental baseada em BPM
      const incrementalProduction = await this.calculateIncrementalProduction(machineId, shiftData, now);
      
      if (incrementalProduction > 0) {
        // Atualizar produção total
        const newTotalProduction = shiftData.total_production + incrementalProduction;
        
        await pool.query(
          'UPDATE shift_data SET total_production = $1, updated_at = $2 WHERE id = $3',
          [newTotalProduction, now, shiftData.id]
        );
        
        // Atualizar cache
        this.updateProductionCache(machineId, {
          totalProduction: newTotalProduction,
          incrementalProduction,
          lastUpdate: now,
          currentBPM: machine.production_speed,
          teamCode,
          shiftType: currentShift.type
        });
        
        // Emitir atualização via WebSocket
        if (this.io) {
          this.io.emit('production:realtime-update', {
            machineId,
            machineName: machine.name,
            operatorName: machine.user_name,
            teamCode,
            shiftType: currentShift.type,
            totalProduction: newTotalProduction,
            incrementalProduction,
            currentBPM: machine.production_speed,
            timestamp: now
          });
        }
        
        console.log(`📈 ${machine.name} (${teamCode}): +${incrementalProduction.toFixed(4)} peças = ${newTotalProduction.toFixed(2)} total`);
      }

    } catch (error) {
      console.error(`❌ Erro ao atualizar produção avançada da máquina ${machine.name}:`, error);
    }
  }

  /**
   * Calcula produção incremental baseada em BPM desde a última atualização
   */
  async calculateIncrementalProduction(machineId, shiftData, currentTime) {
    try {
      const lastUpdate = new Date(shiftData.updated_at || shiftData.created_at);
      const timeDiffSeconds = Math.max(0, (currentTime - lastUpdate) / 1000);
      
      if (timeDiffSeconds < 0.5) {
        return 0; // Evitar cálculos muito frequentes
      }
      
      // Buscar BPM atual da máquina
      const machineResult = await pool.query(
        'SELECT production_speed FROM machines WHERE id = $1',
        [machineId]
      );
      const currentBPM = machineResult.rows[0]?.production_speed || 0;
      
      if (currentBPM <= 0) {
        return 0;
      }
      
      // Converter BPM para peças por segundo
      const piecesPerSecond = currentBPM / 60;
      
      // Calcular produção incremental
      const incrementalProduction = piecesPerSecond * timeDiffSeconds;
      
      // Registrar no histórico de BPM se houve mudança
      await this.recordBPMChange(machineId, currentBPM, currentTime);
      
      return incrementalProduction;
      
    } catch (error) {
      console.error(`❌ Erro ao calcular produção incremental:`, error);
      return 0;
    }
  }

  /**
   * Registra mudanças de BPM para histórico inteligente
   */
  async recordBPMChange(machineId, newBPM, timestamp) {
    try {
      // Verificar se houve mudança de BPM
      const lastBPMResult = await pool.query(
        `SELECT bpm_value FROM production_bpm_history 
         WHERE machine_id = $1 
         ORDER BY created_at DESC 
         LIMIT 1`,
        [machineId]
      );
      
      const lastBPM = lastBPMResult.rows[0]?.bpm_value;
      
      if (lastBPM !== newBPM) {
        // Registrar mudança de BPM
        await pool.query(
          `INSERT INTO production_bpm_history (machine_id, bpm_value, changed_at, created_at)
           VALUES ($1, $2, $3, $4)`,
          [machineId, newBPM, timestamp, timestamp]
        );
        
        console.log(`⚡ BPM alterado - Máquina ${machineId}: ${lastBPM || 0} → ${newBPM}`);
      }
      
    } catch (error) {
      // Se a tabela não existir, criar silenciosamente
      if (error.message.includes('does not exist')) {
        await this.createBPMHistoryTable();
      } else {
        console.error(`❌ Erro ao registrar mudança de BPM:`, error);
      }
    }
  }

  /**
   * Cria tabela de histórico de BPM se não existir
   */
  async createBPMHistoryTable() {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS production_bpm_history (
          id SERIAL PRIMARY KEY,
          machine_id INTEGER NOT NULL,
          bpm_value FLOAT NOT NULL,
          changed_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE
        )
      `);
      
      await pool.query(
        'CREATE INDEX IF NOT EXISTS idx_bpm_history_machine_id ON production_bmp_history(machine_id)'
      );
      
      console.log('✅ Tabela de histórico de BPM criada com sucesso');
      
    } catch (error) {
      console.error('❌ Erro ao criar tabela de histórico de BPM:', error);
    }
  }

  /**
   * Busca ou cria dados do turno atual
   */
  async getOrCreateShiftData(machineId, operatorId, teamCode, currentShift, now) {
    try {
      const shiftDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // Buscar dados existentes do turno
      const existingResult = await pool.query(
        `SELECT * FROM shift_data 
         WHERE "machineId" = $1 AND "operatorId" = $2 AND "shiftDate" = $3 AND "shiftType" = $4
         ORDER BY "createdAt" DESC LIMIT 1`,
        [machineId, operatorId, shiftDate, currentShift.type]
      );
      
      if (existingResult.rows.length > 0) {
        return existingResult.rows[0];
      }
      
      // Criar novos dados do turno
      const shiftStartTime = this.getShiftStartTime(currentShift.type, shiftDate);
      const shiftEndTime = this.getShiftEndTime(currentShift.type, shiftDate);
      
      const createResult = await pool.query(
        `INSERT INTO shift_data (
           "machineId", "operatorId", "shiftDate", "shiftType", "startTime", "endTime",
           "totalProduction", "targetProduction", "efficiency", "downtime", "teamCode", "isActive", "isArchived"
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [
          machineId, operatorId, shiftDate, currentShift.type,
          shiftStartTime, shiftEndTime, 0, 0, 0, 0, teamCode, true, false
        ]
      );
      
      console.log(`🆕 Novo turno criado - Máquina ${machineId}, Escala ${teamCode}, Turno ${currentShift.type}`);
      return createResult.rows[0];
      
    } catch (error) {
      console.error('❌ Erro ao buscar/criar dados do turno:', error);
      throw error;
    }
  }

  /**
   * Determina o turno atual baseado no horário
   */
  getCurrentShift(date = new Date()) {
    const hour = date.getHours();
    
    if (hour >= 7 && hour < 19) {
      return { type: 'MORNING', start: 7, end: 19 };
    } else {
      return { type: 'NIGHT', start: 19, end: 7 };
    }
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
   * Atualiza BPM de uma máquina com recálculo inteligente
   */
  async updateMachineBPM(machineId, newBPM, operatorId) {
    try {
      const now = new Date();
      
      // Atualizar BPM na tabela de máquinas
      await pool.query(
        'UPDATE machines SET production_speed = $1, updated_at = $2 WHERE id = $3',
        [newBPM, now, machineId]
      );
      
      // Registrar mudança no histórico
      await this.recordBPMChange(machineId, newBPM, now);
      
      // Emitir evento de mudança de BPM
      if (this.io) {
        this.io.emit('bpm:changed', {
          machineId,
          newBPM,
          changedBy: operatorId,
          timestamp: now
        });
      }
      
      console.log(`⚡ BPM atualizado - Máquina ${machineId}: ${newBPM} BPM`);
      return true;
      
    } catch (error) {
      console.error(`❌ Erro ao atualizar BPM da máquina ${machineId}:`, error);
      return false;
    }
  }

  /**
   * Reseta histórico de produção ao final do turno
   */
  async resetShiftHistory(machineId, operatorId, teamCode) {
    try {
      const now = new Date();
      const currentShift = this.getCurrentShift(now);
      const shiftDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // Arquivar dados do turno atual
      const archiveResult = await pool.query(
        `UPDATE shift_data 
         SET is_active = false, is_archived = true, archived_at = $1
         WHERE machine_id = $2 AND operator_id = $3 AND shift_date = $4 AND shift_type = $5 AND is_active = true
         RETURNING *`,
        [now, machineId, operatorId, shiftDate, currentShift.type]
      );
      
      if (archiveResult.rows.length > 0) {
        const archivedData = archiveResult.rows[0];
        
        // Criar registro no arquivo de produção
        await pool.query(
          `INSERT INTO production_archives (shift_data_id, machine_id, operator_id, archived_data)
           VALUES ($1, $2, $3, $4)`,
          [archivedData.id, machineId, operatorId, JSON.stringify(archivedData)]
        );
        
        console.log(`📦 Histórico arquivado - Máquina ${machineId}, Escala ${teamCode}, Produção: ${archivedData.total_production}`);
        
        // Emitir evento de reset
        if (this.io) {
          this.io.emit('shift:reset', {
            machineId,
            teamCode,
            archivedProduction: archivedData.total_production,
            timestamp: now
          });
        }
        
        return true;
      }
      
      return false;
      
    } catch (error) {
      console.error(`❌ Erro ao resetar histórico do turno:`, error);
      return false;
    }
  }

  /**
   * Atualiza cache de produção
   */
  async updateProductionCache(machineId, data) {
    const cacheData = {
      ...data,
      lastCacheUpdate: new Date()
    };
    await setCache(`production_${machineId}`, cacheData, this.PRODUCTION_CACHE_TTL);
  }

  /**
   * Busca dados de produção do cache
   */
  async getProductionFromCache(machineId) {
    return await getCache(`production_${machineId}`) || null;
  }

  /**
   * Busca histórico detalhado de produção por turno e escala
   */
  async getProductionHistory(machineId, startDate, endDate, teamCode = null) {
    try {
      let query = `
        SELECT sd.*, u.name as operator_name, m.name as machine_name
        FROM shift_data sd
        JOIN users u ON sd.operator_id = u.id
        JOIN machines m ON sd.machine_id = m.id
        WHERE sd.machine_id = $1 AND sd.shift_date BETWEEN $2 AND $3
      `;
      
      const params = [machineId, startDate, endDate];
      
      if (teamCode) {
        query += ' AND sd.team_group = $4';
        params.push(teamCode);
      }
      
      query += ' ORDER BY sd.shift_date DESC, sd.shift_type';
      
      const result = await pool.query(query, params);
      return result.rows;
      
    } catch (error) {
      console.error('❌ Erro ao buscar histórico de produção:', error);
      return [];
    }
  }
}

module.exports = AdvancedRealTimeProductionService;