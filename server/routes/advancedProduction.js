const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const pool = require('../config/database');
const AdvancedRealTimeProductionService = require('../services/advancedRealTimeProductionService');

// Middleware de autenticação para todas as rotas
router.use(authenticateToken);

/**
 * POST /api/advanced-production/update-bpm
 * Atualiza o BPM de uma máquina com recálculo inteligente
 */
router.post('/update-bpm', async (req, res) => {
  try {
    const { machineId, bpm } = req.body;
    const operatorId = req.user.id;
    
    if (!machineId || bpm === undefined || bpm < 0) {
      return res.status(400).json({
        success: false,
        message: 'machineId e bpm (≥0) são obrigatórios'
      });
    }
    
    // Verificar se a máquina existe e está ativa
    const machineResult = await pool.query(
      'SELECT * FROM machines WHERE id = $1 AND is_active = true',
      [machineId]
    );
    
    if (machineResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Máquina não encontrada ou inativa'
      });
    }
    
    const machine = machineResult.rows[0];
    const previousBPM = machine.production_speed;
    
    // Atualizar BPM na máquina
    await pool.query(
      'UPDATE machines SET production_speed = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [bpm, machineId]
    );
    
    // Registrar mudança no histórico
    await pool.query(
      `INSERT INTO production_bmp_history (machine_id, bmp_value, previous_bmp, changed_by, changed_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT DO NOTHING`,
      [machineId, bpm, previousBPM, operatorId]
    );
    
    // Log da mudança
    console.log(`⚡ BPM atualizado - Máquina ${machine.name}: ${previousBPM} → ${bpm} BPM (por ${req.user.name})`);
    
    res.json({
      success: true,
      message: 'BPM atualizado com sucesso',
      data: {
        machineId,
        machineName: machine.name,
        previousBPM,
        newBPM: bpm,
        changedBy: req.user.name,
        timestamp: new Date()
      }
    });
    
  } catch (error) {
    console.error('Erro ao atualizar BPM:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * GET /api/advanced-production/current/:machineId
 * Busca dados de produção em tempo real de uma máquina
 */
router.get('/current/:machineId', async (req, res) => {
  try {
    const { machineId } = req.params;
    const { teamCode } = req.query;
    
    // Buscar dados atuais da máquina
    const machineResult = await pool.query(
      `SELECT m.*, 
              o.id as operation_id, o.start_time as operation_start,
              u.name as operator_name, u.id as operator_id,
              st.team_code, st.team_name
       FROM machines m
       LEFT JOIN machine_operations o ON m.id = o.machine_id AND o.end_time IS NULL
       LEFT JOIN users u ON o.user_id = u.id
       LEFT JOIN shift_team_members stm ON u.id = stm.user_id AND stm.is_active = true
       LEFT JOIN shift_teams st ON stm.team_id = st.id AND st.is_active = true
       WHERE m.id = $1`,
      [machineId]
    );
    
    if (machineResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Máquina não encontrada'
      });
    }
    
    const machine = machineResult.rows[0];
    
    // Buscar dados do turno atual
    const today = new Date();
    const currentHour = today.getHours();
    const shiftType = (currentHour >= 7 && currentHour < 19) ? 'MORNING' : 'NIGHT';
    const shiftDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    const shiftDataResult = await pool.query(
      `SELECT * FROM shift_data 
       WHERE "machineId" = $1 AND "shiftDate" = $2 AND "shiftType" = $3 AND "isActive" = true
       ORDER BY "createdAt" DESC LIMIT 1`,
      [machineId, shiftDate, shiftType]
    );
    
    const shiftData = shiftDataResult.rows[0] || null;
    
    // Buscar histórico de BPM recente
    const bmpHistoryResult = await pool.query(
      `SELECT * FROM production_bmp_history 
       WHERE machine_id = $1 
       ORDER BY changed_at DESC 
       LIMIT 10`,
      [machineId]
    );
    
    // Calcular estatísticas do turno
    let shiftStats = null;
    if (shiftData) {
      const shiftDurationHours = 12; // Turno de 12 horas
      const elapsedTime = (new Date() - new Date(shiftData.start_time)) / (1000 * 60 * 60);
      const remainingTime = Math.max(0, shiftDurationHours - elapsedTime);
      
      shiftStats = {
        totalProduction: shiftData.total_production,
        targetProduction: shiftData.target_production,
        efficiency: shiftData.efficiency,
        downtime: shiftData.downtime,
        elapsedTime: elapsedTime.toFixed(2),
        remainingTime: remainingTime.toFixed(2),
        averageProductionRate: elapsedTime > 0 ? (shiftData.total_production / elapsedTime).toFixed(2) : 0
      };
    }
    
    res.json({
      success: true,
      data: {
        machine: {
          id: machine.id,
          name: machine.name,
          code: machine.code,
          status: machine.status,
          currentBPM: machine.production_speed,
          targetProduction: machine.target_production
        },
        operation: machine.operation_id ? {
          id: machine.operation_id,
          startTime: machine.operation_start,
          operator: {
            id: machine.operator_id,
            name: machine.operator_name
          }
        } : null,
        team: {
          code: machine.team_code,
          name: machine.team_name
        },
        shift: {
          type: shiftType,
          date: shiftDate,
          stats: shiftStats
        },
        bmpHistory: bmpHistoryResult.rows,
        lastUpdate: new Date()
      }
    });
    
  } catch (error) {
    console.error('Erro ao buscar dados de produção atual:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * GET /api/advanced-production/history/:machineId
 * Busca histórico detalhado de produção por turno e escala
 */
router.get('/history/:machineId', async (req, res) => {
  try {
    const { machineId } = req.params;
    const { startDate, endDate, teamCode, shiftType, page = 1, limit = 50 } = req.query;
    
    let query = `
      SELECT sd.*, 
             u.name as operator_name, u.email as operator_email,
             m.name as machine_name, m.code as machine_code,
             st.team_name
      FROM shift_data sd
      JOIN users u ON sd.operator_id = u.id
      JOIN machines m ON sd.machine_id = m.id
      LEFT JOIN shift_teams st ON sd.team_group = st.team_code
      WHERE sd.machine_id = $1
    `;
    
    const params = [machineId];
    let paramCount = 1;
    
    if (startDate) {
      paramCount++;
      query += ` AND sd.shift_date >= $${paramCount}`;
      params.push(startDate);
    }
    
    if (endDate) {
      paramCount++;
      query += ` AND sd.shift_date <= $${paramCount}`;
      params.push(endDate);
    }
    
    if (teamCode) {
      paramCount++;
      query += ` AND sd.team_group = $${paramCount}`;
      params.push(teamCode);
    }
    
    if (shiftType) {
      paramCount++;
      query += ` AND sd.shift_type = $${paramCount}`;
      params.push(shiftType);
    }
    
    query += ` ORDER BY sd.shift_date DESC, sd.shift_type DESC`;
    
    // Adicionar paginação
    const offset = (page - 1) * limit;
    query += ` LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    
    // Contar total de registros
    let countQuery = `
      SELECT COUNT(*) as total
      FROM shift_data sd
      WHERE sd.machine_id = $1
    `;
    
    const countParams = [machineId];
    let countParamCount = 1;
    
    if (startDate) {
      countParamCount++;
      countQuery += ` AND sd.shift_date >= $${countParamCount}`;
      countParams.push(startDate);
    }
    
    if (endDate) {
      countParamCount++;
      countQuery += ` AND sd.shift_date <= $${countParamCount}`;
      countParams.push(endDate);
    }
    
    if (teamCode) {
      countParamCount++;
      countQuery += ` AND sd.team_group = $${countParamCount}`;
      countParams.push(teamCode);
    }
    
    if (shiftType) {
      countParamCount++;
      countQuery += ` AND sd.shift_type = $${countParamCount}`;
      countParams.push(shiftType);
    }
    
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);
    
    res.json({
      success: true,
      data: {
        history: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
    
  } catch (error) {
    console.error('Erro ao buscar histórico de produção:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * POST /api/advanced-production/reset-shift
 * Reseta histórico de produção ao final do turno
 */
router.post('/reset-shift', async (req, res) => {
  try {
    const { machineId, teamCode } = req.body;
    const operatorId = req.user.id;
    
    if (!machineId) {
      return res.status(400).json({
        success: false,
        message: 'machineId é obrigatório'
      });
    }
    
    // Verificar permissões (apenas supervisores e gerentes podem resetar)
    if (!['MANAGER', 'SUPERVISOR', 'LEADER'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Permissão insuficiente para resetar turno'
      });
    }
    
    const now = new Date();
    const currentHour = now.getHours();
    const shiftType = (currentHour >= 7 && currentHour < 19) ? 'MORNING' : 'NIGHT';
    const shiftDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Arquivar dados do turno atual
    const archiveResult = await pool.query(
      `UPDATE shift_data 
       SET is_active = false, is_archived = true, archived_at = $1
       WHERE machine_id = $2 AND shift_date = $3 AND shift_type = $4 AND is_active = true
       RETURNING *`,
      [now, machineId, shiftDate, shiftType]
    );
    
    if (archiveResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Nenhum turno ativo encontrado para resetar'
      });
    }
    
    const archivedData = archiveResult.rows[0];
    
    // Criar registro no arquivo de produção
    await pool.query(
      `INSERT INTO production_archives (shift_data_id, machine_id, operator_id, archived_data, data_size)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        archivedData.id,
        machineId,
        operatorId,
        JSON.stringify(archivedData),
        JSON.stringify(archivedData).length
      ]
    );
    
    // Log da operação
    console.log(`📦 Turno resetado - Máquina ${machineId}, Escala ${teamCode || 'N/A'}, Produção arquivada: ${archivedData.total_production}`);
    
    res.json({
      success: true,
      message: 'Turno resetado e dados arquivados com sucesso',
      data: {
        archivedProduction: archivedData.total_production,
        archivedEfficiency: archivedData.efficiency,
        archivedDowntime: archivedData.downtime,
        archiveTimestamp: now,
        resetBy: req.user.name
      }
    });
    
  } catch (error) {
    console.error('Erro ao resetar turno:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * GET /api/advanced-production/bmp-history/:machineId
 * Busca histórico de mudanças de BPM
 */
router.get('/bmp-history/:machineId', async (req, res) => {
  try {
    const { machineId } = req.params;
    const { startDate, endDate, limit = 100 } = req.query;
    
    let query = `
      SELECT pbh.*, u.name as changed_by_name, m.name as machine_name
      FROM production_bmp_history pbh
      LEFT JOIN users u ON pbh.changed_by = u.id
      LEFT JOIN machines m ON pbh.machine_id = m.id
      WHERE pbh.machine_id = $1
    `;
    
    const params = [machineId];
    let paramCount = 1;
    
    if (startDate) {
      paramCount++;
      query += ` AND pbh.changed_at >= $${paramCount}`;
      params.push(startDate);
    }
    
    if (endDate) {
      paramCount++;
      query += ` AND pbh.changed_at <= $${paramCount}`;
      params.push(endDate);
    }
    
    query += ` ORDER BY pbh.changed_at DESC LIMIT $${paramCount + 1}`;
    params.push(limit);
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      data: result.rows
    });
    
  } catch (error) {
    console.error('Erro ao buscar histórico de BPM:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * GET /api/advanced-production/statistics/:machineId
 * Busca estatísticas avançadas de produção
 */
router.get('/statistics/:machineId', async (req, res) => {
  try {
    const { machineId } = req.params;
    const { period = '7d', teamCode } = req.query;
    
    // Calcular período baseado no parâmetro
    const now = new Date();
    let startDate = new Date(now);
    
    switch (period) {
      case '1d':
        startDate.setDate(startDate.getDate() - 1);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      default:
        startDate.setDate(startDate.getDate() - 7);
    }
    
    let query = `
      SELECT 
        COUNT(*) as total_shifts,
        AVG(total_production) as avg_production,
        MAX(total_production) as max_production,
        MIN(total_production) as min_production,
        SUM(total_production) as total_production,
        AVG(efficiency) as avg_efficiency,
        AVG(downtime) as avg_downtime,
        shift_type,
        team_group
      FROM shift_data
      WHERE machine_id = $1 AND shift_date >= $2 AND is_archived = true
    `;
    
    const params = [machineId, startDate];
    let paramCount = 2;
    
    if (teamCode) {
      paramCount++;
      query += ` AND team_group = $${paramCount}`;
      params.push(teamCode);
    }
    
    query += ` GROUP BY shift_type, team_group ORDER BY shift_type, team_group`;
    
    const result = await pool.query(query, params);
    
    // Buscar dados da máquina
    const machineResult = await pool.query(
      'SELECT name, code, production_speed, target_production FROM machines WHERE id = $1',
      [machineId]
    );
    
    const machine = machineResult.rows[0];
    
    res.json({
      success: true,
      data: {
        machine,
        period,
        statistics: result.rows,
        generatedAt: now
      }
    });
    
  } catch (error) {
    console.error('Erro ao buscar estatísticas de produção:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

module.exports = router;