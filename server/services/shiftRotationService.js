const pool = require('../config/database');

class ShiftRotationService {
  constructor() {
    // Sistema 3x3: 3 dias trabalhando, 3 dias de folga
    // 4 escalas: 2 diurnas (7-19h) e 2 noturnas (19-7h)
    this.SHIFT_SCHEDULE = {
      SHIFT_1: { start: 7, end: 19, type: 'DAY' },    // Primeira escala diurna
      SHIFT_2: { start: 19, end: 7, type: 'NIGHT' }, // Primeira escala noturna
      SHIFT_3: { start: 7, end: 19, type: 'DAY' },   // Segunda escala diurna
      SHIFT_4: { start: 19, end: 7, type: 'NIGHT' }  // Segunda escala noturna
    };
    
    this.ROTATION_CYCLE_DAYS = 12; // 4 escalas × 3 dias = 12 dias por ciclo completo
    this.WORK_DAYS = 3;
    this.REST_DAYS = 3;
  }

  /**
   * Inicializa as equipes de turno no sistema
   * @param {Array} teams - Array de equipes com membros
   * @returns {Promise<Array>} Equipes criadas
   */
  async initializeShiftTeams(teams) {
    try {
      const createdTeams = [];
      
      for (const team of teams) {
        // Criar equipe
        const shiftTeamResult = await pool.query(
          `INSERT INTO shift_teams (team_code, current_cycle, cycle_start_date, last_rotation, next_rotation, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [team.code, 1, new Date(), new Date(), this.calculateNextRotationDate(new Date()), new Date(), new Date()]
        );
        const shiftTeam = shiftTeamResult.rows[0];

        // Adicionar membros à equipe
        for (const member of team.members) {
          await pool.query(
            `INSERT INTO shift_team_members (team_id, user_id, is_leader, is_active, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [shiftTeam.id, member.userId, member.isLeader || false, true, new Date(), new Date()]
          );
        }

        createdTeams.push(shiftTeam);
      }

      return createdTeams;
    } catch (error) {
      console.error('Erro ao inicializar equipes de turno:', error);
      throw error;
    }
  }

  /**
   * Calcula a próxima data de rotação (a cada 3 dias)
   * @param {Date} currentDate - Data atual
   * @returns {Date} Próxima data de rotação
   */
  calculateNextRotationDate(currentDate) {
    const nextRotation = new Date(currentDate);
    nextRotation.setDate(nextRotation.getDate() + this.WORK_DAYS);
    return nextRotation;
  }

  /**
   * Determina qual escala está ativa no momento
   * @param {Date} date - Data para verificar
   * @returns {string} SHIFT_1, SHIFT_2, SHIFT_3, SHIFT_4 ou REST
   */
  getCurrentShift(date = new Date()) {
    const cycleDay = this.getCycleDayNumber(date);
    
    // Dias 1-3: SHIFT_1, Dias 4-6: SHIFT_2, Dias 7-9: SHIFT_3, Dias 10-12: SHIFT_4
    if (cycleDay >= 1 && cycleDay <= 3) return 'SHIFT_1';
    if (cycleDay >= 4 && cycleDay <= 6) return 'SHIFT_2';
    if (cycleDay >= 7 && cycleDay <= 9) return 'SHIFT_3';
    if (cycleDay >= 10 && cycleDay <= 12) return 'SHIFT_4';
    
    return 'REST';
  }

  /**
   * Calcula o dia do ciclo (1-12) baseado na data
   * @param {Date} date - Data para calcular
   * @returns {number} Dia do ciclo (1-12)
   */
  getCycleDayNumber(date) {
    // Usar 1º de janeiro de 2024 como referência para o ciclo
    const referenceDate = new Date('2024-01-01');
    const diffTime = Math.abs(date - referenceDate);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    return (diffDays % this.ROTATION_CYCLE_DAYS) + 1;
  }

  /**
   * Obtém a escala ativa para uma equipe específica em uma data
   * @param {string} teamCode - Código da equipe
   * @param {Date} date - Data para verificar
   * @returns {Promise<Object>} Informações da escala ativa
   */
  async getTeamActiveShift(teamCode, date = new Date()) {
    try {
      const teamResult = await pool.query(
        `SELECT st.*, 
                json_agg(
                  json_build_object(
                    'id', stm.id,
                    'teamId', stm."teamId",
                    'userId', stm."userId",
                    'isLeader', stm."isLeader",
                    'isActive', stm.isActive,
                    'createdAt', stm."createdAt",
                    'updatedAt', stm."updatedAt",
                    'user', json_build_object(
                      'id', u.id,
                      'name', u.name,
                      'email', u.email,
                      'role', u.role
                    )
                  )
                ) as members
         FROM shift_teams st
         LEFT JOIN shift_team_members stm ON st.id = stm.team_id
         LEFT JOIN users u ON stm.user_id = u.id
         WHERE st.team_code = $1
         GROUP BY st.id`,
        [teamCode]
      );
      const team = teamResult.rows[0];
      if (team && team.members && team.members[0] && !team.members[0].id) {
        team.members = [];
      }

      if (!team) {
        throw new Error(`Equipe ${teamCode} não encontrada`);
      }

      const currentShift = this.getCurrentShift(date);
      const cycleDay = this.getCycleDayNumber(date);
      const isWorkDay = currentShift !== 'REST';
      
      let shiftTimes = null;
      if (isWorkDay) {
        shiftTimes = this.getShiftTimes(date, currentShift);
      }

      return {
        teamCode,
        currentShift,
        cycleDay,
        isWorkDay,
        shiftTimes,
        members: team.members.filter(m => m.isActive),
        rotationCycle: team.currentCycle
      };
    } catch (error) {
      console.error('Erro ao obter escala ativa da equipe:', error);
      throw error;
    }
  }

  /**
   * Calcula os horários de início e fim da escala
   * @param {Date} date - Data de referência
   * @param {string} shiftType - Tipo da escala (SHIFT_1, SHIFT_2, SHIFT_3, SHIFT_4)
   * @returns {Object} { startTime, endTime }
   */
  getShiftTimes(date, shiftType) {
    const baseDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const schedule = this.SHIFT_SCHEDULE[shiftType];
    
    if (!schedule) {
      throw new Error(`Tipo de escala inválido: ${shiftType}`);
    }

    if (schedule.type === 'DAY') {
      // Turno diurno: 7:00 às 19:00
      const startTime = new Date(baseDate.getTime() + schedule.start * 60 * 60 * 1000);
      const endTime = new Date(baseDate.getTime() + schedule.end * 60 * 60 * 1000);
      return { startTime, endTime };
    } else {
      // Turno noturno: 19:00 às 7:00 do próximo dia
      const startTime = new Date(baseDate.getTime() + schedule.start * 60 * 60 * 1000);
      const endTime = new Date(baseDate.getTime() + 24 * 60 * 60 * 1000 + schedule.end * 60 * 60 * 1000);
      return { startTime, endTime };
    }
  }

  /**
   * Cria dados de turno para o sistema 3x3
   * @param {number} machineId - ID da máquina
   * @param {number} operatorId - ID do operador
   * @param {string} teamCode - Código da equipe
   * @param {Object} productionData - Dados de produção
   * @returns {Promise<Object>} Dados do turno criados
   */
  async createShiftData3x3(machineId, operatorId, teamCode, productionData = {}) {
    try {
      const now = new Date();
      const teamShift = await this.getTeamActiveShift(teamCode, now);
      
      if (!teamShift.isWorkDay) {
        throw new Error(`Equipe ${teamCode} está em período de descanso`);
      }

      const { startTime, endTime } = teamShift.shiftTimes;
      const shiftDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const cycleDay = this.getCycleDayNumber(now);

      // Verificar se já existe dados para este turno
      let shiftDataResult = await pool.query(
        `SELECT * FROM "ShiftData" 
         WHERE "machineId" = $1 AND "operatorId" = $2 AND "shiftDate" = $3 
         AND "shiftType" = $4 AND "isActive" = $5 
         ORDER BY "createdAt" DESC LIMIT 1`,
        [machineId, operatorId, shiftDate, teamShift.currentShift, true]
      );
      let shiftData = shiftDataResult.rows[0];

      if (shiftData) {
        // Atualizar dados existentes
        const updateResult = await pool.query(
          `UPDATE "ShiftData" SET 
           "totalProduction" = $1, "efficiency" = $2, "downtime" = $3,
           "rotationCycle" = $4, "rotationDay" = $5, "teamGroup" = $6, "updatedAt" = $7
           WHERE id = $8 RETURNING *`,
          [
            productionData.totalProduction || shiftData.totalProduction,
            productionData.efficiency || shiftData.efficiency,
            productionData.downtime || shiftData.downtime,
            teamShift.rotationCycle,
            cycleDay,
            teamCode,
            now,
            shiftData.id
          ]
        );
        shiftData = updateResult.rows[0];
      } else {
        // Criar novos dados de turno
        const createResult = await pool.query(
          `INSERT INTO "ShiftData" (
            "machineId", "operatorId", "shiftType", "shiftDate", "startTime", "endTime",
            "totalProduction", "targetProduction", "efficiency", "downtime", 
            "qualityTests", "approvedTests", "rejectedTests", "rotationCycle", 
            "rotationDay", "teamGroup", "isRestDay", "productionData", isActive, 
            "createdAt", "updatedAt"
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
          ) RETURNING *`,
          [
            machineId, operatorId, teamShift.currentShift, shiftDate, startTime, endTime,
            productionData.totalProduction || 0, productionData.targetProduction || 0,
            productionData.efficiency || 0, productionData.downtime || 0,
            productionData.qualityTests || 0, productionData.approvedTests || 0,
            productionData.rejectedTests || 0, teamShift.rotationCycle, cycleDay,
            teamCode, false, productionData.detailedData ? JSON.stringify(productionData.detailedData) : null,
            true, now, now
          ]
        );
        shiftData = createResult.rows[0];
      }

      return {
        ...shiftData,
        teamInfo: teamShift
      };
    } catch (error) {
      console.error('Erro ao criar dados do turno 3x3:', error);
      throw error;
    }
  }

  /**
   * Obtém o cronograma de rotação para os próximos dias
   * @param {string} teamCode - Código da equipe
   * @param {number} days - Número de dias para projetar
   * @returns {Promise<Array>} Cronograma de rotação
   */
  async getRotationSchedule(teamCode, days = 30) {
    try {
      const schedule = [];
      const today = new Date();
      
      for (let i = 0; i < days; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        
        const teamShift = await this.getTeamActiveShift(teamCode, date);
        
        schedule.push({
          date: date.toISOString().split('T')[0],
          shift: teamShift.currentShift,
          isWorkDay: teamShift.isWorkDay,
          cycleDay: teamShift.cycleDay,
          shiftTimes: teamShift.shiftTimes
        });
      }
      
      return schedule;
    } catch (error) {
      console.error('Erro ao obter cronograma de rotação:', error);
      throw error;
    }
  }
}

module.exports = ShiftRotationService;